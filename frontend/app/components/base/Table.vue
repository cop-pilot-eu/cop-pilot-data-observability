<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { isNil } from "ramda";
import { formatChunkLabel } from "../../utils/formatters";

const props = withDefaults(
  defineProps<{
    attributeQualityReport: AttributeQualityReportAPI | undefined;
    dataDriftSummary: DataDriftSummaryItemAPI[] | undefined;
    dataDriftReport: DataDriftReportItemAPI[] | undefined;
    loading: boolean;
  }>(),
  {
    attributeQualityReport: undefined,
    dataDriftSummary: undefined,
    dataDriftReport: undefined,
    loading: false,
  },
);

type Row = AttributeDistributionTableRowUI;
type Align = "left" | "center";

// Layout: the seven data columns share one width and are centred, so their
// values sit at an even rhythm whatever the table width; the shares add up to
// 100% so the full-width table has no spare space to hand out unevenly.
type ColumnLayout = { align: Align; width: string };
const DATA_COLUMN = { align: "center", width: "w-[11%]" } as const;

// Header cells. A th is one of: a group title (VALUE STATS / DRIFT), the empty
// placeholder above an ungrouped column, or a column title.
const placeholderTh = "p-0";
const alignClass = { left: "text-left", center: "text-center" } as const;
const leafTh = ({ align, width }: ColumnLayout) =>
  `px-4 pt-3 pb-2 text-[13px] font-bold text-slate-700 ${width} ${alignClass[align]}`;

// Body cells: chunk rows a size smaller and tighter than attribute rows
const td =
  ({ align }: ColumnLayout) =>
  (cell: { row: { original: Row } }) =>
    [
      "px-4 tabular-nums",
      alignClass[align],
      cell.row.original.kind === "chunk"
        ? "text-[13px] py-1.5 text-slate-500"
        : "text-sm py-3 text-slate-900",
    ].join(" ");

const column = (
  def: TableColumn<Row>,
  layout: ColumnLayout,
): TableColumn<Row> => ({
  ...def,
  meta: {
    class: {
      th: (header: { isPlaceholder: boolean }) =>
        header.isPlaceholder ? placeholderTh : leafTh(layout),
      td: td(layout),
    },
  },
});

// Group title: small caps label with an underline that stops short of the next group
const group = (
  id: string,
  title: string,
  columns: TableColumn<Row>[],
): TableColumn<Row> => ({
  id,
  header: () =>
    h(
      "div",
      {
        class:
          "border-b border-slate-200 pb-1.5 text-left text-xs font-bold uppercase tracking-wider text-slate-600",
      },
      title,
    ),
  columns,
  meta: { class: { th: "px-4 pt-4 pb-0 align-bottom" } },
});

const columns: TableColumn<Row>[] = [
  column({ id: "expand", header: "" }, { align: "left", width: "w-[4%]" }),
  // chunk rows show their date here
  column(
    { accessorKey: "attribute", header: "Attribute" },
    { align: "left", width: "w-[19%]" },
  ),
  group("valueStats", "Value stats", [
    column({ accessorKey: "min", header: "Min" }, DATA_COLUMN),
    column({ accessorKey: "max", header: "Max" }, DATA_COLUMN),
    column({ accessorKey: "mean", header: "Mean" }, DATA_COLUMN),
    column({ accessorKey: "outliers", header: "Outliers" }, DATA_COLUMN),
  ]),
  group("drift", "Drift", [
    column({ accessorKey: "driftScore", header: "Peak score" }, DATA_COLUMN),
    column({ id: "driftAlert", header: "Alert" }, DATA_COLUMN),
    // the attribute's; blank on its chunk rows
    column({ accessorKey: "upperThreshold", header: "Threshold" }, DATA_COLUMN),
  ]),
];

// Expanded block: tinted, and no row lines inside it. UTable's tbody divide-y
// draws a bottom border on every row but the last, so drop it on the expanded
// attribute row and on its chunks except the last one (that line closes the block).
const tableMeta = {
  class: {
    tr: (row: { original: Row }) => {
      const r = row.original;
      const classes: string[] = [];
      if (r.kind === "chunk") classes.push("bg-slate-50");
      if (
        (r.kind === "attribute" && expanded.value.has(r.attribute)) ||
        (r.kind === "chunk" && !r.lastChunk)
      )
        classes.push("border-b-0!");
      return classes.join(" ");
    },
  },
};

// Attributes whose chunks are shown; kept across fetches by name
const expanded = ref(new Set<string>());
const toggleExpanded = (attribute: string): void => {
  const next = new Set(expanded.value);
  if (next.has(attribute)) next.delete(attribute);
  else next.add(attribute);
  expanded.value = next;
};

// Attribute -> its analysis chunk rows in time order
const chunksByAttribute = computed(() => {
  const result = new Map<string, Row[]>();
  if (isNil(props.dataDriftReport)) return result;

  const chunks = [...props.dataDriftReport].sort(
    (a, b) =>
      new Date(a.chunkStartDate).getTime() -
      new Date(b.chunkStartDate).getTime(),
  );
  for (const chunk of chunks) {
    for (const col of chunk.columns) {
      const list = result.get(col.name) ?? [];
      list.push({
        kind: "chunk",
        attribute: col.name,
        upperThreshold: col.upperThreshold,
        min: col.min,
        max: col.max,
        mean: col.mean,
        outliers: col.outliers,
        driftScore: col.value,
        chunkRange: formatChunkLabel(
          new Date(chunk.chunkStartDate),
          new Date(chunk.chunkEndDate),
        ),
        alert: col.alert,
      });
      result.set(col.name, list);
    }
  }
  return result;
});

// Table data variables: attribute rows, each followed by its chunks when expanded
const tableData = computed((): Row[] => {
  if (isNil(props.attributeQualityReport) || isNil(props.dataDriftSummary))
    return [];

  return Object.entries(props.attributeQualityReport).flatMap(
    ([key, item]) => {
      const driftEntry = props.dataDriftSummary?.findLast(
        (d) => d.name === key,
      );
      const chunks = chunksByAttribute.value.get(key) ?? [];
      const attributeRow: Row = {
        kind: "attribute",
        attribute: key,
        upperThreshold: driftEntry?.upperThreshold ?? 0,
        min: item.min,
        max: item.max,
        mean: item.mean,
        outliers: item.outliers,
        driftScore: driftEntry?.value ?? 0,
        chunkCount: chunks.length,
        driftedChunks: chunks.filter((c) => c.alert).length,
      };
      if (!expanded.value.has(key)) return [attributeRow];
      return [
        attributeRow,
        ...chunks.map((c, i) => ({ ...c, lastChunk: i === chunks.length - 1 })),
      ];
    },
  );
});

// Numbers to 2 decimals, to nearest: rounding up would put a Min above the
// smallest value seen. "N/A" as is; a dash for a chunk without values
const formatStat = (value: TableStatUI): string | number => {
  if (isNil(value)) return "—";
  return typeof value === "number" ? Math.round(value * 100) / 100 : value;
};
const formatScore = (value: number): string => value.toFixed(2);

// Attribute peak score pill: red once it crossed the threshold, green below it
const peakPillClass = (row: Row): string =>
  row.driftScore > row.upperThreshold
    ? "bg-rose-50 text-rose-700"
    : "bg-emerald-50 text-emerald-700";
</script>

<template>
  <div class="flex-1 w-full">
    <UTable
      :data="tableData"
      :columns="columns"
      :meta="tableMeta"
      :ui="{ td: 'whitespace-nowrap' }"
    >
      <template #expand-cell="{ row }">
        <UButton
          v-if="row.original.kind === 'attribute'"
          color="neutral"
          variant="soft"
          size="xs"
          square
          :icon="
            expanded.has(row.original.attribute)
              ? 'heroicons:chevron-down-20-solid'
              : 'heroicons:chevron-right-20-solid'
          "
          :aria-label="
            expanded.has(row.original.attribute)
              ? 'Collapse chunks'
              : 'Expand chunks'
          "
          :aria-expanded="expanded.has(row.original.attribute)"
          :disabled="row.original.chunkCount === 0"
          @click="toggleExpanded(row.original.attribute)"
        />
        <!-- Not empty on purpose: an empty slot falls back to UTable's raw value -->
        <span v-else />
      </template>

      <template #attribute-cell="{ row }">
        <span v-if="row.original.kind === 'chunk'" class="pl-1 text-slate-700">
          {{ row.original.chunkRange }}
        </span>
        <span v-else class="font-semibold">{{ row.original.attribute }}</span>
      </template>

      <template #min-cell="{ row }">{{ formatStat(row.original.min) }}</template>
      <template #max-cell="{ row }">{{ formatStat(row.original.max) }}</template>
      <template #mean-cell="{ row }">{{ formatStat(row.original.mean) }}</template>
      <template #outliers-cell="{ row }">
        {{ formatStat(row.original.outliers) }}
      </template>

      <template #driftScore-cell="{ row }">
        <span
          v-if="row.original.kind === 'chunk'"
          class="tabular-nums"
          :class="row.original.alert ? 'text-rose-600' : ''"
        >
          {{ formatScore(row.original.driftScore) }}
        </span>
        <span
          v-else
          class="inline-block rounded-md px-2 py-0.5 font-semibold tabular-nums"
          :class="peakPillClass(row.original)"
        >
          {{ formatScore(row.original.driftScore) }}
        </span>
      </template>

      <template #driftAlert-cell="{ row }">
        <!-- chunk: dot only, the label is for screen readers and hover -->
        <span
          v-if="row.original.kind === 'chunk'"
          class="inline-block size-2 rounded-full"
          :class="row.original.alert ? 'bg-rose-500' : 'bg-emerald-600'"
          :title="row.original.alert ? 'Drifted' : 'Healthy'"
        >
          <span class="sr-only">
            {{ row.original.alert ? "Drifted" : "Healthy" }}
          </span>
        </span>
        <span
          v-else
          class="inline-flex items-center gap-x-2"
          :class="
            row.original.driftedChunks === 0
              ? 'text-emerald-700'
              : 'text-rose-600'
          "
        >
          <span
            class="size-2 rounded-full"
            :class="
              row.original.driftedChunks === 0
                ? 'bg-emerald-600'
                : 'bg-rose-500'
            "
          />
          {{
            row.original.driftedChunks === 0
              ? "Healthy"
              : `${row.original.driftedChunks}/${row.original.chunkCount} chunks drifted`
          }}
        </span>
      </template>

      <template #upperThreshold-cell="{ row }">
        <span v-if="row.original.kind === 'attribute'">
          {{ formatScore(row.original.upperThreshold) }}
        </span>
        <span v-else />
      </template>
    </UTable>
  </div>
</template>
