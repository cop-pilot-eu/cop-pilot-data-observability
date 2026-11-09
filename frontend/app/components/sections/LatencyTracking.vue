<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    latencyDistributionReport: LatencyDistributionReportAPI | undefined;
    responseTimesReport: ResponseTimesReportItemAPI[] | undefined;
    rangeSelected: RangeOption | undefined;
    loading: boolean;
    error: string | undefined;
  }>(),
  {
    latencyDistributionReport: undefined,
    responseTimesReport: undefined,
    rangeSelected: undefined,
    loading: false,
    error: undefined,
  },
);

const { barChartOptions, lineChartOptions } = useLatencyCharts(toRefs(props));
</script>

<template>
  <div class="py-4">
    <div class="font-semibold text-xl py-4 text-primary-700">
      <p>Latency tracking</p>
    </div>
    <div class="containerTest">
      <ChartContainer
        :title="'Latency Distribution'"
        :loading="loading"
        :error="error"
        :options="barChartOptions"
      />
      <ChartContainer
        :title="'Response Time'"
        :loading="loading"
        :error="error"
        :options="lineChartOptions"
      />
    </div>
  </div>
</template>
