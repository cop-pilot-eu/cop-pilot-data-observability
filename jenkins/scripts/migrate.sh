#!/usr/bin/env bash
# Apply pending TypeORM migrations, taking a verified pg_dump backup first
# when anything is pending.
#
#   migrate.sh <env-file>
#
# Inputs (environment):
#   DB_USERNAME / DB_PASSWORD / DB_NAME   (Jenkins credentials or env file)
#   BACKUP_DIR      where dumps go (default: $HOME/backups/cop-pilot-data-observability)
#   KEEP_BACKUPS    how many dumps to keep (default 10)
#   FORCE_BACKUP    true = back up even if nothing is pending
#   SKIP_BACKUP     true = never back up (used only for the throwaway CI stack)
#
# Requires the `db` service of the target project to be up and healthy.
# Migrations run in one transaction (`-t all`): either every pending
# migration is applied, or none is.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
env_file="${1:?usage: $0 <env-file>}"
set -a
# shellcheck disable=SC1090
. "$env_file"
set +a
: "${DB_USERNAME:?}" "${DB_PASSWORD:?}" "${DB_NAME:?}"

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/cop-pilot-data-observability}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"
FORCE_BACKUP="${FORCE_BACKUP:-false}"
SKIP_BACKUP="${SKIP_BACKUP:-false}"

log()  { echo "[migrate] $*"; }
fail() { echo "[migrate] ERROR: $*" >&2; exit 1; }
compose() { "$here/compose.sh" "$env_file" "$@"; }
psql_q() {
  compose exec -T -e PGPASSWORD="$DB_PASSWORD" db \
    psql -v ON_ERROR_STOP=1 -U "$DB_USERNAME" -d "$DB_NAME" -tAc "$1"
}

# Migrations shipped in the new backend image.
available="$(compose run --rm --no-deps -T --entrypoint sh backend \
  -c 'ls dist/migrations/*.js 2>/dev/null | wc -l' | tr -dc '0-9')"
# Migrations recorded in the database (-1 = no migrations table yet).
if [[ "$(psql_q "SELECT to_regclass('public.migrations') IS NOT NULL" | tr -dc 'tf')" == "t" ]]; then
  applied="$(psql_q "SELECT count(*) FROM public.migrations" | tr -dc '0-9')"
else
  applied=-1
fi
has_history="$(psql_q "SELECT to_regclass('public.context_history') IS NOT NULL" | tr -dc 'tf')"
log "migrations in image: ${available}, recorded in DB: ${applied}, context_history present: ${has_history}"

if [[ "$applied" == "-1" && "$has_history" == "t" ]]; then
  fail "context_history exists but there is no TypeORM 'migrations' table. The schema was created outside TypeORM (for example by data-analytics' create_all before migrations ever ran). Running migrations would fail on CREATE TABLE. Fix this by hand (see jenkins/README.md, 'Schema created outside migrations'); nothing was changed."
fi

pending=false
if [[ "$applied" -lt "$available" ]]; then pending=true; fi

if [[ "$SKIP_BACKUP" != "true" && ( "$pending" == "true" || "$FORCE_BACKUP" == "true" ) ]]; then
  mkdir -p "$BACKUP_DIR"
  size="$(psql_q "SELECT pg_size_pretty(pg_database_size(current_database()))")"
  log "Backing up database '${DB_NAME}' (${size}) to ${BACKUP_DIR} ..."
  df -h "$BACKUP_DIR" | sed 's/^/[migrate]   /'
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  out="${BACKUP_DIR}/${DB_NAME}_${stamp}_build${BUILD_NUMBER:-manual}.dump"
  compose exec -T -e PGPASSWORD="$DB_PASSWORD" db \
    pg_dump -U "$DB_USERNAME" -d "$DB_NAME" -Fc >"${out}.partial"
  # Make sure the archive is readable before trusting it.
  compose exec -T db pg_restore --list <"${out}.partial" >/dev/null \
    || fail "backup verification failed (${out}.partial). Migrations NOT applied."
  mv "${out}.partial" "$out"
  log "Backup OK: ${out} ($(du -h "$out" | cut -f1))"
  # Retention: keep the newest $KEEP_BACKUPS dumps.
  ls -1t "${BACKUP_DIR}/${DB_NAME}_"*.dump 2>/dev/null | tail -n +"$((KEEP_BACKUPS + 1))" | xargs -r rm -f --
fi

if [[ "$pending" == "true" ]]; then
  log "Applying $((available - (applied < 0 ? 0 : applied))) pending migration(s) ..."
  compose run --rm --no-deps -T backend \
    node node_modules/typeorm/cli.js migration:run -d dist/ormconfig.js -t all
else
  log "Database schema is up to date; nothing to apply."
fi
