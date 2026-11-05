#!/usr/bin/env bash
# Single entry point for every `docker compose` call made by the pipelines.
#
#   compose.sh <env-file> <docker compose args...>
#
# The env file pins COMPOSE_PROJECT_NAME, image tag, DB volume, etc., so the
# production stack and the throwaway CI stack can never be confused with each
# other. If the env file sets USE_PORTS=true, the host-port overlay
# (docker-compose.ports.yml) is added. Only the production env file does that.
#
# Secrets (DB_USERNAME / DB_PASSWORD) are not written to the env file; for
# production they are inherited from Jenkins `withCredentials`.
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <env-file> <docker compose args...>" >&2
  exit 2
fi

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$1"
shift

if [[ ! -f "$env_file" ]]; then
  echo "compose.sh: env file not found: $env_file" >&2
  exit 2
fi

set -a
# shellcheck disable=SC1090
. "$env_file"
set +a

files=(-f "$here/docker-compose.yml")
if [[ "${USE_PORTS:-false}" == "true" ]]; then
  files+=(-f "$here/docker-compose.ports.yml")
fi

exec docker compose --project-directory "$here" "${files[@]}" "$@"
