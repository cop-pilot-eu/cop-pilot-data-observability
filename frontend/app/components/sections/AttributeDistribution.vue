<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    attributeQualityReport: AttributeQualityReportAPI | undefined;
    dataDriftSummary: DataDriftSummaryItemAPI[] | undefined;
    dataDistributionReport: DataDistributionReportItemAPI[] | undefined;
    dataDriftReport: DataDriftReportItemAPI[] | undefined;
    rangeSelected: RangeOption | undefined;
    loading: boolean;
    error: string | undefined;
  }>(),
  {
    attributeQualityReport: undefined,
    dataDriftSummary: undefined,
    dataDistributionReport: undefined,
    dataDriftReport: undefined,
    rangeSelected: undefined,
    loading: false,
    error: undefined,
  },
);

const {
  horizontalbarChartOptions,
  barChartOptions,
  lineChartOptions,
  attributeSelected,
  attributesList,
} = useAttributeCharts(toRefs(props));
</script>

<template>
  <div class="py-4">
    <div class="font-semibold text-xl py-4 text-primary-700">
      <p>Attribute Distribution & Quality</p>
    </div>
    <div>
      <ChartContainer
        :title="'Observed / Missing Values By Attribute'"
        :loading="loading"
        :error="error"
        :options="horizontalbarChartOptions"
      />

      <div
        class="p-4 my-4 shadow-xl border-2 border-primary-600 bg-secondary-200 rounded-md"
      >
        <Table
          :attribute-quality-report="attributeQualityReport"
          :data-drift-summary="dataDriftSummary"
          :data-drift-report="dataDriftReport"
          :loading="loading"
        />
      </div>
      <div>
        <div>
          <USelect
            v-model="attributeSelected"
            :items="attributesList"
            :disabled="error !== undefined"
          />
        </div>
        <div class="flex flex-col 2xl:flex-row justify-between gap-4">
          <ChartContainer
            :title="`${attributeSelected ?? ''} Distribution: Baseline VS Current`"
            :loading="loading"
            :error="error"
            :options="barChartOptions"
            class="flex-1 min-w-0"
          />
          <ChartContainer
            :title="`${attributeSelected ?? ''} Drift Score Over Time`"
            :loading="loading"
            :error="error"
            :options="lineChartOptions"
            class="flex-1 min-w-0"
          />
        </div>
      </div>
    </div>
  </div>
</template>
