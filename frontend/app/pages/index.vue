<script setup lang="ts">
// Only active in development. Set NUXT_PUBLIC_USE_MOCK_DATA=true in .env to enable.
const config = useRuntimeConfig();
const USE_MOCK_DATA = import.meta.dev && config.public.useMockData === true;

const { EntitiesAPI, StatsAPI, loading } = useAPI();
const { handleError } = useErrorHandler();
const { getDateRange } = useTimeRangeHandler();

const entityList = ref<string[]>([]);
const errorEntity = ref<string | undefined>(undefined);
const errorStats = ref<string | undefined>(undefined);
const dataResponse = ref<LoadStatsResponseAPI | undefined>(undefined);

const lastUpdate = ref<Date | undefined>(undefined);
const rangeSelected = ref<RangeOption | undefined>(undefined);

const { mockedResponseTimesReport, mockedDriftReport } = useMockData(rangeSelected);

onMounted(async (): Promise<void> => {
  await loadEntities();
});

const loadEntities = async (): Promise<void> => {
  errorEntity.value = undefined;
  try {
    const res = await EntitiesAPI.get();
    entityList.value = res;
  } catch (err: unknown) {
    errorEntity.value = handleError(err);
  }
};

const loadStats = async (
  entityId: string,
  range: RangeOption,
): Promise<void> => {
  if (!entityList.value.includes(entityId)) return;
  errorStats.value = undefined;
  try {
    const res: LoadStatsResponseAPI = await StatsAPI.post({
      ...getDateRange(range),
      entityId,
    });
    dataResponse.value = res;
    lastUpdate.value = new Date();
    rangeSelected.value = range;
  } catch (err: unknown) {
    errorStats.value = handleError(err);
  }
};
</script>

<template>
  <div class="overflow-y-auto overflow-x-hidden">
    <div class="space-y-6">
      <Filters
        :entity-list="entityList"
        :last-update="lastUpdate"
        :error="errorEntity"
        @load-data="loadStats"
      />

      <template v-if="loading || dataResponse || errorStats">
        <CardContainer
          :data-quality-report="dataResponse?.dataQualityReport"
          :data-drift-summary="dataResponse?.dataDriftSummary"
          :range-selected="rangeSelected"
          :loading="loading"
        />
        <AttributeDistribution
          :attribute-quality-report="dataResponse?.attributeQualityReport"
          :dataDriftSummary="dataResponse?.dataDriftSummary"
          :data-distribution-report="dataResponse?.dataDistributionReport"
          :data-drift-report="
            USE_MOCK_DATA ? mockedDriftReport : dataResponse?.dataDriftReport
          "
          :range-selected="rangeSelected"
          :loading="loading"
          :error="errorStats"
        />
        <LatencyTracking
          :latency-distribution-report="dataResponse?.latencyDistributionReport"
          :response-times-report="
            USE_MOCK_DATA
              ? mockedResponseTimesReport
              : dataResponse?.responseTimesReport
          "
          :range-selected="rangeSelected"
          :loading="loading"
          :error="errorStats"
        />
      </template>
      <div
        v-else
        class="flex flex-col items-center justify-center py-12 text-neutral-400"
      >
        <p class="text-base">Select an entity to load the dashboard</p>
      </div>
    </div>
  </div>
</template>
