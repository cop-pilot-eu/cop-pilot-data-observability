# COP Pilot — Data Observability

A single-page dashboard for real-time monitoring of context data quality, latency,
and schema compliance, built as part of the COP-PILOT project (EU Grant 101189819).

## Tech Stack

| Category        | Library / Tool                   |
| --------------- | -------------------------------- |
| Framework       | Nuxt 4 (SSR disabled — SPA mode) |
| UI              | Vue 3 + TypeScript               |
| Component Lib   | Nuxt UI v4                       |
| Charts          | nuxt-echarts (Apache ECharts)    |
| Styling         | Tailwind CSS v4                  |
| Icons           | @nuxt/icon                       |
| Package Manager | pnpm                             |
| Font            | Public Sans                      |
| Utilities       | Ramda                            |

## Project Structure

```
app/
├── assets/css/         # Tailwind config + custom color tokens
├── components/
│   ├── layout/         # App shell: Header, Footer
│   ├── base/           # Reusable UI: Card, Table, LoadingSpinner, ErrorCard, NoResultsFound
│   ├── Charts/         # Chart primitives: Chart (VChart wrapper), ChartContainer
│   └── sections/       # Dashboard sections: Filters, CardContainer,
│                       #   AttributeDistribution, LatencyTracking
├── composables/
│   ├── api.ts                  # HTTP client (EntitiesAPI, StatsAPI)
│   ├── errorHandler.ts         # HTTP status → user-facing message mapping
│   ├── timeRangeHandler.ts     # RangeOption → date range conversion
│   ├── mockData.ts             # Generated mock data for development
│   ├── useAttributeCharts.ts   # Data transformation for attribute charts
│   └── useLatencyCharts.ts     # Data transformation for latency charts
├── layouts/
│   └── default.vue             # Page layout wrapper
├── pages/
│   └── index.vue               # Dashboard page — data orchestrator
└── types/                      # Global TypeScript type definitions
```

## Setup

Requires Node 24 and pnpm 8.15.8+.

```bash
pnpm install
```

## Development

```bash
pnpm dev       # Start dev server at http://localhost:3000
```

## Production

```bash
pnpm build     # Production build
pnpm preview   # Preview production build locally
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

| Variable                    | Description                 | Default                 |
| --------------------------- | --------------------------- | ----------------------- |
| `NUXT_BACKEND_URL`          | Backend API base URL        | `http://localhost:3001` |
| `NUXT_PUBLIC_USE_MOCK_DATA` | Enable mock data (dev only) | `false`                 |

### Mock Data

Setting `NUXT_PUBLIC_USE_MOCK_DATA=true` replaces live API responses for the drift
and response time charts with generated data. Useful for UI development without a
running backend.

> **Note:** This flag has no effect in production builds. The `import.meta.dev`
> guard at runtime ensures mock data is disabled at build time regardless of the
> environment variable value.

## Docker

### Build locally (native platform)

```bash
docker buildx build --no-cache -t cop-pilot-eu/cop-pilot-data-observability-fe:0.1.0 .
```

### Build for production / CI (linux/amd64)

> **Apple Silicon warning:** Running this command on an M1/M2/M3 Mac triggers QEMU
> emulation for the amd64 platform. The Vite transform step is heavily JIT-dependent
> and will stall indefinitely under emulation. Use this command only on a native
> amd64 machine or in a CI runner (e.g. GitHub Actions `ubuntu-latest`).

```bash
docker buildx build --platform=linux/amd64 --no-cache -t cop-pilot-eu/cop-pilot-data-observability-fe:0.1.0 .
```

### Run container

```bash
docker run --env-file .env --name cop-pilot-data-observability-fe -p 3000:3000 cop-pilot-eu/cop-pilot-data-observability-fe:0.1.0
```
