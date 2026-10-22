<script setup lang="ts">
// Only active in development. Set NUXT_PUBLIC_USE_MOCK_DATA=true in .env to enable.
const config = useRuntimeConfig();
const USE_MOCK_DATA = import.meta.dev && config.public.useMockData === true;

const { ClustersAPI, BrokersAPI, EntitiesAPI, StatsAPI, loading } = useAPI();
const { handleError } = useErrorHandler();
const { getDateRange } = useTimeRangeHandler();

const clustersList = ref<SelectOptionAPI[]>([]);
const brokersList = ref<SelectOptionAPI[]>([]);
const entityList = ref<string[]>([]);
const errorFilters = ref<string | undefined>(undefined);
const errorStats = ref<string | undefined>(undefined);
const dataResponse = ref<LoadStatsResponseAPI | undefined>(undefined);

const lastUpdate = ref<Date | undefined>(undefined);
const rangeSelected = ref<RangeOption | undefined>(undefined);

const { mockedResponseTimesReport, mockedDriftReport } = useMockData(rangeSelected);

onMounted(async (): Promise<void> => {
  await loadClusters();
});

const loadClusters = async (): Promise<void> => {
  errorFilters.value = undefined;
  try {
    const res = await ClustersAPI.get();
    clustersList.value = res;
  } catch (err: unknown) {
    errorFilters.value = handleError(err);
  }
};

const loadBrokers = async (clusterId: string): Promise<void> => {
  errorFilters.value = undefined;
  dataResponse.value = undefined;
  rangeSelected.value = undefined;
  brokersList.value = [];
  entityList.value = [];
  try {
    const res = await BrokersAPI.get(clusterId);
    brokersList.value = res;
  } catch (err: unknown) {
    errorFilters.value = handleError(err);
  }
};

const loadEntities = async (brokerId: string): Promise<void> => {
  errorFilters.value = undefined;
  dataResponse.value = undefined;
  rangeSelected.value = undefined;
  entityList.value = [];
  try {
    const res = await EntitiesAPI.get(brokerId);
    entityList.value = res;
  } catch (err: unknown) {
    errorFilters.value = handleError(err);
  }
};

const loadStats = async (
  clusterId: string,
  brokerId: string,
  entityId: string,
  range: RangeOption,
): Promise<void> => {

  if (!clustersList.value.some((c) => c.value === clusterId)) return;
  if (!brokersList.value.some((b) => b.value === brokerId)) return;
  if (!entityList.value.includes(entityId)) return;
  errorStats.value = undefined;
  try {
    const res: LoadStatsResponseAPI = await StatsAPI.post({
      ...getDateRange(range),
      clusterId,
      brokerId,
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
        :clusters-list="clustersList"
        :brokers-list="brokersList"
        :last-update="lastUpdate"
        :error="errorFilters"
        @load-broker-data="loadBrokers"
        @load-entity-data="loadEntities"
        @load-data="loadStats"
      />

      <template v-if="(loading && entityList.length > 0) || dataResponse || errorStats">
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
