# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install       # Install dependencies (uses pnpm 8.15.8, Node 24)
pnpm dev           # Start dev server at http://localhost:3000
pnpm build         # Production build
pnpm preview       # Preview production build
pnpm generate      # Static site generation
```

No test runner is configured.

## Architecture

**Nuxt 4 SPA** (SSR disabled) — Vue 3 + TypeScript dashboard for data observability metrics.

### Key directories under `app/`

- `pages/index.vue` — Single page: orchestrates data loading, holds all top-level state, renders all dashboard sections
- `composables/api.ts` — All HTTP calls via Nuxt `$fetch`; two endpoints: `GET /api/entities`, `POST /api/stats`
- `composables/timeRangeHandler.ts` — Converts `RangeOption` enum values to date ranges
- `composables/errorHandler.ts` — Maps HTTP status codes to user-facing messages
- `types/` — Global types (`declare global`) for API payloads and UI chart shapes; no `.d.ts` files

### Component folders

```
components/
├── layout/        # App shell: Header.vue, Footer.vue
├── base/          # Generic reusable UI: Card.vue, Table.vue, LoadingSpinner.vue, ErrorCard.vue, NoResultsFound.vue
├── Charts/        # Chart primitives: Chart.vue (VChart wrapper), ChartContainer.vue
└── sections/      # Dashboard feature sections: Filters.vue, CardContainer.vue, AttributeDistribution.vue, LatencyTracking.vue
```

### Component hierarchy

```
index.vue
├── sections/Filters.vue               # Entity selector + time range picker
├── sections/CardContainer.vue → base/Card.vue
├── sections/AttributeDistribution.vue # Data drift + distribution charts
│   └── Charts/Chart.vue               # Thin VChart (ECharts) wrapper
└── sections/LatencyTracking.vue       # Performance metrics line charts
    └── Charts/Chart.vue
```

All components are auto-imported by filename — no explicit `import` needed for components in `app/components/`.

### Data flow

1. On mount, `index.vue` calls `EntitiesAPI.get()` to populate the entity dropdown
2. On filter change, calls `StatsAPI.post(payload)` and fans out the response to child components via props
3. Child components are purely presentational — they receive typed data and render charts

### Charts

Uses **nuxt-echarts** (`VChart` component). ECharts chart types (Bar, Line) and components (DataZoom, Grid, Legend, Tooltip, MarkLine) are registered in `nuxt.config.ts`. Build chart `option` objects following the ECharts spec and pass to `<VChart :option="..." />`.

### Environment

Backend URL is set via `NUXT_BACKEND_URL` (defaults to `http://localhost:3001` in dev). Configured as a runtime env var in `nuxt.config.ts`.

### Styling

Tailwind CSS v4 with custom color tokens defined in `app/assets/css/main.css` and referenced in `nuxt.config.ts` (`ui.colors`). Font: Public Sans. Component library: Nuxt UI v4.
