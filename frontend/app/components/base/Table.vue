<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { isNil } from "ramda";

const props = withDefaults(
  defineProps<{
    attributeQualityReport: AttributeQualityReportAPI | undefined;
    dataDriftSummary: DataDriftSummaryItemAPI[] | undefined;
    loading: boolean;
  }>(),
  {
    attributeQualityReport: undefined,
    dataDriftSummary: undefined,
    loading: false,
  },
);

// Columns variables
const columnsInit: TableColumn<AttributeDistributionTableRowUI>[] = [
  {
    accessorKey: "attribute",
    header: "Attribute",
  },
  {
    accessorKey: "type",
    header: "Type",
  },
  {
    accessorKey: "min",
    header: "min",
  },
  {
    accessorKey: "max",
    header: "Max",
  },
  {
    accessorKey: "mean",
    header: "Mean",
  },
  {
    accessorKey: "unexpected",
    header: "Unexpected Values",
  },
  {
    accessorKey: "upperThreshold",
    header: "Threshold",
  },
  {
    accessorKey: "driftScore",
    header: "Drift Score",
  },
  {
    accessorKey: "driftAlert",
    header: "Drift Alert",
  },
];
const getTableColumns = computed(() => {
  return columnsInit.map((col) => ({
    ...col,
    meta: {
      class: {
        th: "text-center",
        td: "text-center",
      },
    },
  }));
});

// Table data variables
const tableData = computed((): AttributeDistributionTableRowUI[] => {
  if (isNil(props.attributeQualityReport) || isNil(props.dataDriftSummary))
    return [];

  return Object.entries(props.attributeQualityReport).map(([key, item]) => {
    const driftEntry = props.dataDriftSummary?.findLast((d) => d.name === key);

    return {
      attribute: key,
      type: item.dtype,
      min: item.min,
      max: item.max,
      mean: item.mean,
      unexpected: item.outliers,
      driftScore: driftEntry?.value ?? 0,
      driftAlert: driftEntry?.alert ?? false,
      upperThreshold: driftEntry?.upperThreshold ?? 0,
    };
  });
});
const roundedUpValue = (rawPrice: number): number => {
  const precision = 100;
  return Math.ceil(rawPrice * precision) / precision;
};

const getColorOfDriftScore = (
  driftScore: number,
  attrName: string,
): "error" | "success" | "neutral" => {
  const driftEntry = props.dataDriftSummary?.findLast(
    (d) => d.name === attrName,
  );

  let upperThreshold = driftEntry?.upperThreshold ?? 0;
  if (driftScore > upperThreshold) return "error";
  if (driftScore < upperThreshold) return "success";
  return "neutral";
};
</script>

<template>
  <div class="flex-1 w-full">
    <UTable :data="tableData" :columns="getTableColumns">
      <template #attribute-cell="{ row }">
        {{ row.getValue("attribute") }}
      </template>

      <template #mean-cell="{ row }">
        {{ roundedUpValue(row.getValue("driftScore")) }}
      </template>
      <template #upperThreshold-cell="{ row }">
        {{ roundedUpValue(row.getValue("upperThreshold")) }}
      </template>
      <template #driftScore-cell="{ row }">
        <UBadge
          variant="outline"
          :color="
            getColorOfDriftScore(
              row.getValue('driftScore'),
              row.getValue('attribute'),
            )
          "
        >
          {{ roundedUpValue(row.getValue("driftScore")) }}
        </UBadge>
      </template>

      <template #driftAlert-cell="{ row }">
        <div class="flex space-x-1 items-center justify-center">
          <Icon
            :name="
              !row.getValue('driftAlert')
                ? 'material-symbols:check-circle-outline'
                : 'material-symbols:warning-outline-rounded'
            "
            class="size-6"
            :class="
              !row.getValue('driftAlert')
                ? 'text-success-600'
                : 'text-error-500'
            "
          />
          <span class="font-bold">
            {{ !row.getValue("driftAlert") ? "Healthy" : "Drift detected" }}
          </span>
        </div>
      </template>
    </UTable>
  </div>
</template>
