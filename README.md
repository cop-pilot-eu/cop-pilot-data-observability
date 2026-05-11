# cop-pilot-data-observability

The Data Observability Dashboard is a web-based monitoring interface that ensures the data flowing through the NGSI-LD Context Broker is accurate, timely, and trustworthy. It provides real-time visibility into context data quality metrics, attribute distributions, and ingestion latency; enabling its users (such as data operators and platform admins) to detect anomalies, monitor data drift, and verify that entity attributes conform to expected behaviour.

## Repository Structure

This monorepo contains three services that work together:

```
cop-pilot-data-observability/
├── frontend/          # Nuxt 4 (Vue) observability dashboard
├── backend/           # NestJS API — context history ingestion and metrics
└── data-analytics/    # Python FastAPI service — statistical analysis engine
```

## Services

### Frontend (`frontend/`)

A Nuxt 4 (Vue) single-page application that renders the observability dashboard. Displays context entity attribute distributions, data drift charts, and ingestion latency metrics. Runs on `http://localhost:3000`.

**Tech stack:** Nuxt 4, Vue 3, TypeScript, Apache ECharts, Nuxt UI v4, Tailwind CSS v4, pnpm

### Backend (`backend/`)

A NestJS (TypeScript) REST API that acts as the central hub. It receives NGSI-LD entity update notifications from the Context Broker subscription, stores context history in PostgreSQL, proxies statistics requests to the data-analytics service, and exposes endpoints consumed by the frontend. Runs on `http://localhost:3001`.

It also includes a **weather collector** that periodically fetches humidity and temperature data from OpenWeatherMap, maps values to `AgriFoodParcel` NGSI-LD entity properties, and pushes the resulting LD+JSON payload to the Context Broker — managing entity creation and subscriptions as needed.

**Tech stack:** NestJS, TypeScript, TypeORM, PostgreSQL, yarn

**Key endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/entities` | List all tracked entity IDs |
| `POST` | `/stats` | Retrieve observability statistics for a given entity and time range |
| `POST` | `/subscription` | Receive NGSI-LD notification payloads from the Context Broker |

### Data Analytics (`data-analytics/`)

A Python FastAPI service that implements the statistical analysis logic. Receives context history data from the backend, computes observability metrics (attribute distributions, drift, latency), and returns structured results. Also ships a standalone `calculate_stats.py` script for running analysis directly against CSV files. Runs on `http://localhost:8000`.

**Tech stack:** Python 3.11, FastAPI, uv

**Key endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/calculate-stats` | Compute observability statistics for a given entity and time range |

## Getting Started

Each service has its own setup instructions — see the README in each subdirectory:

- [backend/README.md](backend/README.md)
- [data-analytics/README.md](data-analytics/README.md)
- [frontend/README.md](frontend/README.md)

### Typical local startup order

1. **Data analytics** — `fastapi dev main.py` (port 8000)
2. **Backend** — start PostgreSQL (`yarn run start:services`), run migrations (`yarn typeorm migration:run`), then `yarn run start:dev` (port 3001)
3. **Frontend** — `pnpm dev` (port 3000)

## Docker

Each service ships a `Dockerfile` for container-based deployment. Images are tagged as:

| Service        | Image                                                       |
| -------------- | ----------------------------------------------------------- |
| Frontend       | `cop-pilot-eu/cop-pilot-data-observability-fe:0.1.0`        |
| Backend        | `cop-pilot-eu/cop-pilot-data-observability-be:0.1.0`        |
| Data Analytics | `cop-pilot-eu/cop-pilot-data-observability-analytics:0.1.0` |
