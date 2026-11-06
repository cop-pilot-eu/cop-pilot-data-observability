#!/usr/bin/env bash
# Pre-deploy safety checks for the production database volume.
#
#   db-preflight.sh <env-file>
#
# Inputs (environment):
#   ALLOW_NEW_DB_VOLUME=true          allow starting on a missing/empty volume
#   STOP_CONFLICTING_CONTAINERS=true  stop (never remove) foreign containers
#                                     that use our DB volume or host ports
#
# What it does:
#   1. Refuses to continue if the DB volume is missing or empty, unless
#      ALLOW_NEW_DB_VOLUME=true. An empty volume usually means "wrong volume
#      name", and starting Postgres on it would look like total data loss.
#   2. Inspects the volume read-only to find where PG_VERSION lives and works
#      out the matching mount target + PGDATA. It appends DB_MOUNT_TARGET and
#      DB_PGDATA to the env file so the existing cluster is mounted exactly
#      where Postgres expects it.
#   3. Refuses to run two Postgres servers on one data directory: any
#      container outside this compose project that mounts the volume (running
#      or not) is a conflict.
#   4. Same check for containers already holding our published host ports.
#
# It never deletes containers, volumes or data.
set -euo pipefail

env_file="${1:?usage: $0 <env-file>}"
set -a
# shellcheck disable=SC1090
. "$env_file"
set +a

: "${DB_VOLUME:?}" "${COMPOSE_PROJECT_NAME:?}"
DB_IMAGE="${DB_IMAGE:-timescale/timescaledb:2.31.0-pg18}"
EXPECTED_PG_MAJOR="${EXPECTED_PG_MAJOR:-18}"
ALLOW_NEW_DB_VOLUME="${ALLOW_NEW_DB_VOLUME:-false}"
STOP_CONFLICTING_CONTAINERS="${STOP_CONFLICTING_CONTAINERS:-false}"

log()  { echo "[db-preflight] $*"; }
fail() { echo "[db-preflight] ERROR: $*" >&2; exit 1; }

list_pg_candidates() {
  log "Containers using a timescale/postgres image on this host (with their mounts):"
  docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' \
    | grep -Ei 'timescale|postgres' \
    | while IFS=$'\t' read -r name image status; do
        echo "    - ${name} (${image}, ${status})"
        docker inspect -f '{{range .Mounts}}        {{.Type}} {{.Name}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' "$name" || true
      done
  log "Named volumes that look related:"
  docker volume ls --format '{{.Name}}' | grep -Ei 'timescale|observab|postgres|db' | sed 's/^/    - /' || true
}

# ---------------------------------------------------------------------------
# 1. Volume exists?
# ---------------------------------------------------------------------------
if ! docker volume inspect "$DB_VOLUME" >/dev/null 2>&1; then
  if [[ "$ALLOW_NEW_DB_VOLUME" != "true" ]]; then
    list_pg_candidates
    fail "DB volume '${DB_VOLUME}' does not exist. If this is a brand-new installation, re-run with ALLOW_NEW_DB_VOLUME=true. Otherwise set DB_VOLUME to the volume that holds the existing data (see the list above and jenkins/README.md)."
  fi
  log "Creating new DB volume '${DB_VOLUME}' (ALLOW_NEW_DB_VOLUME=true)."
  docker volume create --label "com.cop-pilot.app=data-observability" "$DB_VOLUME" >/dev/null
fi

# ---------------------------------------------------------------------------
# 2. Detect on-disk layout (read-only mount, no network)
# ---------------------------------------------------------------------------
layout="$(docker run --rm --network none --entrypoint sh \
  -v "${DB_VOLUME}:/v:ro" "$DB_IMAGE" -c '
    for f in /v/*/docker/PG_VERSION; do
      if [ -s "$f" ]; then echo "majordir $(dirname "$(dirname "$f")" | xargs basename) $(cat "$f")"; exit 0; fi
    done
    if   [ -s /v/PG_VERSION ];      then echo "root - $(cat /v/PG_VERSION)"
    elif [ -s /v/data/PG_VERSION ]; then echo "datasub - $(cat /v/data/PG_VERSION)"
    elif [ -z "$(ls -A /v)" ];      then echo "empty - -"
    else echo "unknown - -"; fi
  ')"
read -r kind _dir pg_version <<<"$layout"
log "Volume '${DB_VOLUME}' layout: kind=${kind} pg_version=${pg_version}"

case "$kind" in
  majordir)
    # Official pg18+ layout: volume mounted at /var/lib/postgresql.
    mount_target=/var/lib/postgresql
    pgdata="/var/lib/postgresql/${pg_version}/docker"
    ;;
  root)
    # Classic layout: the volume itself *is* the data directory.
    mount_target=/var/lib/postgresql/data
    pgdata=/var/lib/postgresql/data
    ;;
  datasub)
    # Volume mounted at /var/lib/postgresql with data in ./data.
    mount_target=/var/lib/postgresql
    pgdata=/var/lib/postgresql/data
    ;;
  empty)
    if [[ "$ALLOW_NEW_DB_VOLUME" != "true" ]]; then
      list_pg_candidates
      fail "DB volume '${DB_VOLUME}' exists but is EMPTY, so it holds no database. Starting on it would make the dashboard look like all data is gone. Point DB_VOLUME at the volume with the real data, or re-run with ALLOW_NEW_DB_VOLUME=true if an empty database is really intended."
    fi
    mount_target=/var/lib/postgresql
    pgdata="/var/lib/postgresql/${EXPECTED_PG_MAJOR}/docker"
    pg_version="$EXPECTED_PG_MAJOR"
    ;;
  *)
    docker run --rm --network none --entrypoint ls -v "${DB_VOLUME}:/v:ro" "$DB_IMAGE" -la /v || true
    fail "Could not recognise a PostgreSQL data directory in volume '${DB_VOLUME}'. Refusing to touch it."
    ;;
esac

if [[ "$pg_version" != "$EXPECTED_PG_MAJOR" ]]; then
  fail "Volume '${DB_VOLUME}' contains a PostgreSQL ${pg_version} cluster but the image is PostgreSQL ${EXPECTED_PG_MAJOR}. A major upgrade needs pg_upgrade or dump/restore; refusing to start."
fi

# ---------------------------------------------------------------------------
# 3. Foreign containers using the volume
# ---------------------------------------------------------------------------
is_ours() {
  [[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$1" 2>/dev/null)" == "$COMPOSE_PROJECT_NAME" ]]
}

conflicts=()
while read -r cid; do
  [[ -z "$cid" ]] && continue
  is_ours "$cid" || conflicts+=("$cid")
done < <(docker ps -a -q --filter "volume=${DB_VOLUME}")

# ---------------------------------------------------------------------------
# 4. Foreign containers holding our host ports (production stack only)
# ---------------------------------------------------------------------------
# Only a stack that publishes ports (USE_PORTS=true in its env file) can clash
# on them. The CI stack publishes none. FRONTEND_PORT/BACKEND_PORT are also
# Jenkins parameters, so they are in the environment of every stage; without
# this guard the CI check would flag the running production stack.
if [[ "${USE_PORTS:-false}" == "true" ]]; then
  for port in ${FRONTEND_PORT:-} ${BACKEND_PORT:-}; do
    while read -r cid; do
      [[ -z "$cid" ]] && continue
      is_ours "$cid" || conflicts+=("$cid")
    done < <(docker ps -q --filter "publish=${port}")
  done
fi

# A conflicting container from another compose project (e.g. a stack that
# was deployed by hand) takes the rest of that project with it, so no orphan
# app containers keep running against a stopped database.
if [[ ${#conflicts[@]} -gt 0 ]]; then
  for cid in "${conflicts[@]}"; do
    proj="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$cid")"
    if [[ -n "$proj" && "$proj" != "$COMPOSE_PROJECT_NAME" ]]; then
      while read -r other; do [[ -n "$other" ]] && conflicts+=("$other"); done \
        < <(docker ps -a -q --filter "label=com.docker.compose.project=${proj}")
    fi
  done
fi

if [[ ${#conflicts[@]} -gt 0 ]]; then
  mapfile -t conflicts < <(printf '%s\n' "${conflicts[@]}" | sort -u)
  log "Containers outside project '${COMPOSE_PROJECT_NAME}' that conflict with this deployment:"
  for cid in "${conflicts[@]}"; do
    docker inspect -f '    - {{.Name}} ({{.Config.Image}}) state={{.State.Status}} restart={{.HostConfig.RestartPolicy.Name}}' "$cid"
  done
  if [[ "$STOP_CONFLICTING_CONTAINERS" != "true" ]]; then
    fail "Refusing to continue: two PostgreSQL servers on one data directory corrupt it, and a busy host port would make the deploy fail. Re-run once with STOP_CONFLICTING_CONTAINERS=true to stop them (they are stopped and set to restart=no, NOT removed), or stop them manually."
  fi
  for cid in "${conflicts[@]}"; do
    log "Stopping $(docker inspect -f '{{.Name}}' "$cid") gracefully and disabling its restart policy (container is kept)."
    docker update --restart=no "$cid" >/dev/null
    docker stop -t 120 "$cid" >/dev/null
  done
fi

{
  echo "DB_MOUNT_TARGET='${mount_target}'"
  echo "DB_PGDATA='${pgdata}'"
} >>"$env_file"
log "OK: mount '${DB_VOLUME}' at ${mount_target}, PGDATA=${pgdata}"
