#!/usr/bin/env bash
# Functional / smoke tests for a running data-observability stack.
#
#   func_test.sh <env-file>                 read-only checks (safe on production)
#   func_test.sh <env-file> --with-ingest   + end-to-end ingest -> DB -> stats
#
# All HTTP calls are made from inside the data-analytics container over the
# compose network, so no host ports are needed and nothing clashes with other
# stacks on the agent.
#
# --with-ingest writes a fake entity into context_history, so it is only
# allowed against the throwaway CI project (COMPOSE_PROJECT_NAME=dataobs-ci-*).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
env_file="${1:?usage: $0 <env-file> [--with-ingest]}"
mode="${2:-}"
set -a
# shellcheck disable=SC1090
. "$env_file"
set +a

compose() { "$here/../scripts/compose.sh" "$env_file" "$@"; }
pass=0
fail=0
ok()  { echo "  [PASS] $*"; pass=$((pass + 1)); }
bad() { echo "  [FAIL] $*"; fail=$((fail + 1)); }

# http <method> <url> [json-body]  -> prints "<status>\n<body>"
http() {
  local method="$1" url="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    compose exec -T data-analytics curl -sS -m 30 -o /tmp/resp -w '%{http_code}' \
      -X "$method" -H 'Content-Type: application/json' --data "$body" "$url" || true
  else
    compose exec -T data-analytics curl -sS -m 30 -o /tmp/resp -w '%{http_code}' \
      -X "$method" "$url" || true
  fi
  echo
  compose exec -T data-analytics cat /tmp/resp 2>/dev/null || true
}

check() { # check <name> <expected-status> <grep-pattern|""> <method> <url> [body]
  local name="$1" want="$2" pattern="$3"
  shift 3
  local out status body
  out="$(http "$@")"
  status="$(head -n1 <<<"$out")"
  body="$(tail -n +2 <<<"$out")"
  if [[ "$status" != "$want" ]]; then
    bad "$name: HTTP $status (want $want) body: ${body:0:300}"
  elif [[ -n "$pattern" ]] && ! grep -qE -- "$pattern" <<<"$body"; then
    bad "$name: body does not match /$pattern/: ${body:0:300}"
  else
    ok "$name (HTTP $status)"
  fi
}

echo "== Functional tests against project '${COMPOSE_PROJECT_NAME}' =="

echo "-- container health"
for svc in db data-analytics backend frontend; do
  cid="$(compose ps -q "$svc" || true)"
  if [[ -z "$cid" ]]; then bad "$svc: no container"; continue; fi
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid")"
  [[ "$health" == "healthy" ]] && ok "$svc is healthy" || bad "$svc health=$health"
done

echo "-- database"
applied="$(compose exec -T -e PGPASSWORD="$DB_PASSWORD" db psql -U "$DB_USERNAME" -d "$DB_NAME" -tAc \
  "SELECT count(*) FROM public.migrations" 2>/dev/null | tr -dc '0-9' || true)"
available="$(compose exec -T backend sh -c 'ls dist/migrations/*.js | wc -l' | tr -dc '0-9')"
[[ -n "$applied" && "$applied" -ge "$available" ]] \
  && ok "migrations applied ($applied/$available)" \
  || bad "migrations applied=${applied:-?} available=$available"
ht="$(compose exec -T -e PGPASSWORD="$DB_PASSWORD" db psql -U "$DB_USERNAME" -d "$DB_NAME" -tAc \
  "SELECT count(*) FROM timescaledb_information.hypertables WHERE hypertable_name='context_history'" | tr -dc '0-9' || true)"
[[ "$ht" == "1" ]] && ok "context_history is a TimescaleDB hypertable" || bad "context_history hypertable missing"

echo "-- data-analytics"
check "openapi exposes /calculate-stats" 200 '/calculate-stats' GET http://data-analytics:8000/openapi.json

echo "-- backend"
check "GET /clusters lists clusters"    200 '"value"' GET http://backend:3001/clusters
check "GET /brokers/upv-iteam"          200 'cluster2' GET http://backend:3001/brokers/upv-iteam
check "unknown broker is rejected"      404 ''        POST http://backend:3001/subscriptions/does-not-exist '{"data":[]}'

echo "-- frontend"
check "GET / serves the SPA"            200 '<html|__nuxt' GET http://frontend:3000/
check "GET /api/clusters proxies to backend" 200 '"value"' GET http://frontend:3000/api/clusters

if [[ "$mode" == "--with-ingest" ]]; then
  if [[ "$COMPOSE_PROJECT_NAME" != dataobs-ci-* ]]; then
    echo "Refusing --with-ingest on project '${COMPOSE_PROJECT_NAME}': it writes test rows." >&2
    exit 2
  fi
  echo "-- end-to-end: notification -> context_history -> stats (CI stack only)"
  entity="urn:ngsi-ld:Access:ci-smoke-${BUILD_NUMBER:-0}"
  now="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
  from="$(date -u -d '-1 hour' +%Y-%m-%dT%H:%M:%S.000Z)"
  to="$(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%S.000Z)"
  notif="{\"id\":\"urn:ngsi-ld:Notification:ci\",\"type\":\"Notification\",\"data\":[{\"id\":\"${entity}\",\"type\":\"Access\",\"TimeInstant\":{\"type\":\"Property\",\"value\":\"${now}\"},\"totalCounterIn\":{\"type\":\"Property\",\"value\":7},\"totalCounterOut\":{\"type\":\"Property\",\"value\":3}}]}"
  check "POST /subscriptions/cluster2 accepts notification" 200 '' POST http://backend:3001/subscriptions/cluster2 "$notif"
  check "GET /entities/cluster2 returns ingested entity" 200 "$entity" GET http://backend:3001/entities/cluster2
  check "POST /stats (backend -> analytics -> DB)" 201 '' POST http://backend:3001/stats \
    "{\"from\":\"${from}\",\"to\":\"${to}\",\"clusterId\":\"upv-iteam\",\"brokerId\":\"cluster2\",\"entityId\":\"${entity}\"}"
fi

echo "== ${pass} passed, ${fail} failed =="
if [[ "$fail" -gt 0 ]]; then
  echo "-- recent logs"
  compose logs --no-color --tail=60 data-analytics backend frontend || true
  exit 1
fi
