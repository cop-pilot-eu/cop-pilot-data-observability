# 🚀 CI/CD Deployment via COP-PILOT CI/CD Stack

This repository is deployed with Jenkins on the **`bml-observability-components`** node.
Every push to GitHub is validated and tested; every push to `main` is redeployed automatically.
The stack has 4 containers in one compose project, `cop-pilot-data-observability`:

| | Service | Image | Exposed on host |
| --- | --- | --- | --- |
| 🖥️ | `frontend` | `cop-pilot-eu/cop-pilot-data-observability-fe` | `FRONTEND_PORT` (3000) |
| ⚙️ | `backend` | `cop-pilot-eu/cop-pilot-data-observability-be` | `BACKEND_PORT` (5000) |
| 📊 | `data-analytics` | `cop-pilot-eu/cop-pilot-data-observability-analytics` | no (internal network only) |
| 🗄️ | `db` | `timescale/timescaledb:2.31.0-pg18` | no (internal network only) |

> 🛡️ **Data is never deleted by any pipeline.** See [Data safety](#️-data-safety).

---

## 📁 Files

| File | Purpose |
| --- | --- |
| 🔁 `Jenkinsfile` | Validate → build → integration test → deploy. Runs on every push to GitHub. |
| 🛑 `Jenkinsfile.kill` | Stops the stack. Never deletes data. |
| 🐳 `docker-compose.yml` | Stack definition. The DB volume is `external`. |
| ⚙️ `config/backend.env` | Backend app settings, edited by the developers (commit to change). |
| ⚙️ `config/data-analytics.env` | Data-analytics app settings, edited by the developers (commit to change). |
| 🔌 `docker-compose.ports.yml` | Host ports, used only by the production deployment. |
| 🧰 `scripts/compose.sh` | Wrapper for every compose call: pins the project name and env file. |
| 🔍 `scripts/db-preflight.sh` | DB volume safety checks; works out how to mount the existing data. |
| 💾 `scripts/migrate.sh` | Verified `pg_dump` backup, then TypeORM migrations. |
| 🧪 `tests/func_test.sh` | Functional/smoke tests (read-only by default). |

---

## 🔁 Pipeline (`Jenkinsfile`)

```
Prepare ─► Validate (parallel) ─► Build images ─► Integration test ─► Deployment (main only)
```

1. 🧹 **Prepare**: removes leftover CI stacks and writes the env files for the CI and production stacks.
2. ✅ **Validate** (parallel):
   - ⚙️ backend: `jest` unit tests (blocking), ESLint + Prettier.
   - 📊 data-analytics: app import check, a full stats-engine run on `inputs/*.csv`, `pytest` once tests exist (all blocking), Ruff.
   - ⚠️ Lint findings mark the build **UNSTABLE** but do not block it, because `main` currently has open ESLint/Ruff findings. Set `STRICT_LINT=true` to make lint blocking.
3. 🏗️ **Build_Docker_Images**: builds the 3 images once, tagged `0.1.<BUILD_NUMBER>`, on the agent itself. Nothing is pushed to a registry. These exact images are tested and deployed. The frontend has no test runner, so its production build is its validation.
4. 🧪 **Integration_Test**: starts a throwaway copy of the whole stack (`dataobs-ci-<N>`, with its own network and DB volume, no host ports, broker sync forced off). It then runs migrations and `func_test.sh --with-ingest`:
   - container health, migrations applied, `context_history` is a hypertable;
   - every API, and the frontend → backend proxy;
   - a broker notification → DB → `/stats` round-trip through analytics.

   The CI stack is always removed afterwards.
5. 🚀 **Deployment** (`DEPLOY_BRANCH` only):
   1. 🔍 `db-preflight.sh`: volume safety checks (see below).
   2. 🗄️ Starts the DB only if it is not running (`--no-recreate`: an existing DB container is never replaced).
   3. ⏹️ **Stops and removes only `frontend`, `backend`, `data-analytics`.**
   4. 💾 `migrate.sh`: if migrations are pending, takes a `pg_dump -Fc` backup, verifies it with `pg_restore --list`, then applies the migrations in one transaction.
   5. ▶️ Starts the new app containers and waits until they are healthy.
   6. 🩺 Read-only smoke tests against production.
   7. ↩️ If any of this fails, the app containers are rolled back to the previously running tag. The DB is not touched.

> 💡 Production is touched only after every test has passed, so a broken commit leaves the running version alone.
> `disableConcurrentBuilds()` stops two commits from deploying at the same time.

---

## 🛡️ Data safety

- 🔒 The DB volume is declared `external: true`. Compose never creates or deletes external volumes, so even `docker compose down -v` cannot remove it.
- 🚫 None of the pipelines contains `down -v`, `volume rm` (except on `dataobs-ci-*-db` volumes labelled `com.cop-pilot.ci=true`) or `volume prune`.
- ⛔ `db-preflight.sh` **refuses to deploy** when:
  - the volume does not exist or is **empty**. That usually means a wrong volume name, and starting on it would look like total data loss. Override only on a real first install with `ALLOW_NEW_DB_VOLUME=true`.
  - the volume holds a different PostgreSQL major version (needs `pg_upgrade`).
  - a container outside this stack mounts the volume (running or stopped: two Postgres servers on one data directory corrupt it), or holds our host ports. With `STOP_CONFLICTING_CONTAINERS=true`, those containers and the rest of their compose project are stopped and set to `restart=no`. They are **not removed**.
- 🧭 It also reads the volume layout and mounts it correctly whichever layout the data uses: pg18-style `18/docker/`, a classic data-dir root, or `data/`.
- 💾 Backups go to `BACKUP_DIR` (default `$HOME/backups/cop-pilot-data-observability` on the agent). The newest `KEEP_BACKUPS` are kept. `FORCE_BACKUP=true` takes one on any deploy.

---

## 🔧 Jenkins setup

- 🖧 **Agent:** fixed to the `bml-observability-components` node, which both builds **and hosts** the app.
- 📄 **Job type:** *Pipeline script from SCM*, Script Path `jenkins/Jenkinsfile`, branch `*/main` (or a Multibranch Pipeline).
- 🪝 **Trigger:** turn on *GitHub hook trigger for GITScm polling* and add a GitHub webhook to `https://<jenkins>/github-webhook/`. The `triggers { githubPush() }` block registers itself after the first build.
- 🐳 **Requirements:** the agent needs Docker and Docker Compose v2 (`--wait` support). Node, Python and similar tools are not needed: everything runs in containers.

### 🔑 Credentials

| Credential ID | Type | Purpose |
| --- | --- | --- |
| `cop-pilot-data-observability-db` | Username/Password | DB user/password. **Must match the existing database** (Postgres only reads `POSTGRES_*` on first init; the dev default is `timescaledb` / `timescaledb`). |

### 🎛️ Parameters

| Parameter | Default | Notes |
| --- | --- | --- |
| `DEPLOY_BRANCH` | `main` | Other branches are only validated and tested. |
| `DB_VOLUME` | `data-observability_timescale_data` | Existing volume holding the data. |
| `DB_NAME` | `timescaledb` | |
| `ALLOW_NEW_DB_VOLUME` | `false` | First install only. |
| `STOP_CONFLICTING_CONTAINERS` | `false` | One-time switch from a manually-run deployment. |
| `PUBLIC_HOST` | `167.233.199.19` | Sets `FRONTEND_URL=http://PUBLIC_HOST:FRONTEND_PORT`. Empty means the agent's first IP. |
| `FRONTEND_PORT` / `BACKEND_PORT` | `3000` / `5000` | 5000 is where the brokers already send notifications. |
| `NOTIFY_BASE_URL` | `http://suite5-brokers-dashboard.ziti:5000` | URL the brokers call back to (the Ziti service in front of backend port 5000). Empty means `http://PUBLIC_HOST:BACKEND_PORT`. |
| `BROKER_SYNC_ENABLED` | `true` | Production only: on every start the backend creates, recreates or deletes its broker subscriptions. The CI stack always runs with `false`, so tests never touch real broker subscriptions. |
| `BACKUP_DIR` / `KEEP_BACKUPS` / `FORCE_BACKUP` | see [Data safety](#️-data-safety) | |
| `RUN_1M_BACKFILL` | `false` | One-off: run the `context_history_1m` backfill after the deploy (see below). |
| `STRICT_LINT` | `false` | |

---

## ⚙️ Application settings (env vars)

Developers change app settings **by commit only**, never on the server:

1. Edit `jenkins/config/backend.env` or `jenkins/config/data-analytics.env`: add a new variable or change a value.
2. Commit to `main`. The pipeline tests the change in the CI stack and redeploys with the new values.

Connection settings stay under pipeline control: values under `environment:` in `docker-compose.yml` take precedence over the env files. That covers `DB_*`, `POSTGRES_*`, `APP_NAME`, `NODE_ENV`, `PORT`, `FRONTEND_URL`, `DATA_ANALYTICS_URL`, `NOTIFY_BASE_URL` and `BROKER_SYNC_ENABLED`, so setting them in the env files has no effect. Change those through the Jenkins job parameters.

The env files are in git, so **never put secrets in them**. Secrets go in Jenkins credentials.

## 🔂 One-off: `context_history_1m` backfill

`backend/src/scripts/context_history_1m_backfill.ts` fills the 1-minute continuous aggregate with history, one 7-day chunk at a time. It is safe to re-run.

Run it with **Build with Parameters** → ☑ `RUN_1M_BACKFILL`. The pipeline deploys as usual, then runs the script with the newly deployed backend image against the production DB, while the app keeps running. The output lists each chunk; failed chunks fail the build and are printed for re-run.

---

## 🏁 First deploy on `bml-observability-components` (one-time cutover)

The server currently runs a hand-deployed stack, compose project `data-observability`:
- 🗄️ `timescale-db`: TimescaleDB **2.31.0**-pg18, data in the named volume `data-observability_timescale_data` (pg18 layout)
- ⚙️ `be` on host port **5000**
- 🖥️ `fe` on host port **3000**
- 📊 `analytics`, internal only

The pipeline defaults already match this: `DB_VOLUME=data-observability_timescale_data`, `BACKEND_PORT=5000`, `FRONTEND_PORT=3000`, DB image 2.31.0, and the old backend's `FRONTEND_URL`, `NOTIFY_BASE_URL` and `BROKER_SYNC_ENABLED`.

1. 🔑 Create the Jenkins credential `cop-pilot-data-observability-db` with the existing DB user (`timescaledb`) and its password. Read the password on the server with:
   ```bash
   docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' data-observability-timescale-db-1 | grep POSTGRES_PASSWORD
   ```
2. ▶️ Run the job once with `STOP_CONFLICTING_CONTAINERS=true` and `FORCE_BACKUP=true`.
3. ✅ Later pushes run with the defaults. They do not need the flag again, because the old containers are already stopped and the preflight does not stop anything without it.

### ❓ Does the first run delete the old data?

**No.** Here is what happens to the data on that run:

| Step | What happens | Data |
| --- | --- | --- |
| 1️⃣ Preflight | Checks that `data-observability_timescale_data` contains a PostgreSQL 18 cluster (it refuses an empty or missing volume). | 👀 read-only |
| 2️⃣ Stop old stack | `docker stop -t 120` on the old containers (clean Postgres shutdown), then `restart=no`. Containers are **kept**, not removed. | ✅ untouched |
| 3️⃣ New DB starts | New DB container mounts the **same volume** with the same TimescaleDB version (2.31.0) and the same user. | ✅ same data |
| 4️⃣ Backup | `FORCE_BACKUP=true`: full `pg_dump`, verified, stored in `BACKUP_DIR`. | 💾 extra copy |
| 5️⃣ Migrations | Only migrations not yet recorded are applied. They only **add** things (`CREATE TABLE brokers`, `ADD COLUMN broker_id`); none drops or truncates. If the schema was created without TypeORM, the step stops and changes nothing. | ➕ additive only |
| 6️⃣ New app starts | Backend reconnects to the same brokers with the same notify URL. | ✅ untouched |

⏱️ Expect a short gap (about 1–3 minutes) while the old backend is stopped and the new one starts. Notifications sent in that window may be missed; existing rows are not affected.

### ↩️ Going back to the old stack

Only while the new DB is stopped. Never run both at once.
```bash
docker compose -p cop-pilot-data-observability down        # no -v: the volume is kept
docker update --restart=unless-stopped $(docker ps -aq --filter label=com.docker.compose.project=data-observability)
docker start $(docker ps -aq --filter label=com.docker.compose.project=data-observability)
```
🧹 Once the new stack has proven itself, remove the old containers with `docker rm <name>`, never with `-v`.

### 🩹 Schema created outside migrations

If the database has `context_history` but no `migrations` table, `migrate.sh` stops and changes nothing. Running the migrations would fail on `CREATE TABLE`. Once you have confirmed the schema matches, record the migrations as applied, for example:
```sql
CREATE TABLE IF NOT EXISTS migrations (id SERIAL PRIMARY KEY, "timestamp" bigint NOT NULL, name varchar NOT NULL);
INSERT INTO migrations ("timestamp", name) VALUES (1770719455439,'ContextHistory1770719455439'), (1770719455440,'ReferenceData1770719455440');
-- add Brokers1788784913827 only if the brokers table and context_history.broker_id already exist
```

---

## 🛑 Teardown (`Jenkinsfile.kill`)

- ⏹️ Stops and removes the app containers. With `STOP_DATABASE=true` (default) it also stops the DB cleanly (`down` **without** `-v`).
- 🧹 `REMOVE_IMAGES=true` removes the app images.
- 🔒 The data volume is always kept. Running `Jenkinsfile` again brings everything back with the data.

> ⚠️ Deleting the data is deliberately manual. Take a backup first, then run `docker volume rm <DB_VOLUME>`.

---

## 🧰 Useful commands on the agent

```bash
# 🗄️ DB shell (the project name must match)
docker compose -p cop-pilot-data-observability exec db psql -U <user> -d timescaledb

# 📜 Logs
docker compose -p cop-pilot-data-observability logs -f backend

# ♻️ Restore a backup into the running DB (destructive for the objects in the dump; think first)
docker compose -p cop-pilot-data-observability exec -T db pg_restore -U <user> -d timescaledb --clean --if-exists < backup.dump
```
