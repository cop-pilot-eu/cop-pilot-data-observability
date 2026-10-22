<script setup lang="ts">
import { isNil } from "ramda";

const props = withDefaults(
  defineProps<{
    entityList: string[];
    clustersList: SelectOptionAPI[];
    brokersList: SelectOptionAPI[];
    lastUpdate: Date | undefined;
    error: string | undefined;
  }>(),
  {
    entityList: () => [],
    clustersList: () => [],
    brokersList: () => [],
    lastUpdate: undefined,
    error: undefined,
  },
);

const formattedLastUpdate = computed(() => {
  if (!props.lastUpdate) return undefined;
  const d = props.lastUpdate;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${min}:${ss}`;
});

const emit = defineEmits(["loadData", "loadBrokerData", "loadEntityData"]);

const itemsRange = ref<{ label: string; value: RangeOption }[]>([
  { label: "Last Hour", value: "lastHour" },
  { label: "Last 24 Hours", value: "lastDay" },
  { label: "Last Week", value: "lastWeek" },
  { label: "All time", value: "allTime" },
]);

const cluster = ref<string | undefined>(undefined);
const broker = ref<string | undefined>(undefined);
const entity = ref<string | undefined>(undefined);
const range = ref<RangeOption>("allTime");

// Clearing the child selections lets the list watchers below auto-select
// the first option of the freshly loaded lists.
const loadBrokerData = () => {
  broker.value = undefined;
  entity.value = undefined;
  emit("loadBrokerData", cluster.value);
};

const loadEntityData = () => {
  entity.value = undefined;
  emit("loadEntityData", broker.value);
};

const loadData = () => {
  emit("loadData", cluster.value, broker.value, entity.value, range.value);
};

watch(
  () => props.clustersList,
  (newClusters) => {
    if (newClusters && newClusters.length > 0 && isNil(cluster.value)) {
      cluster.value = newClusters[0]?.value;
      loadBrokerData();
    }
  },
  { immediate: true },
);
watch(
  () => props.brokersList,
  (newBrokers) => {
    if (!newBrokers || newBrokers.length === 0) {
      broker.value = undefined;
      return;
    }
    if (isNil(broker.value) && !isNil(cluster.value)) {
      broker.value = newBrokers[0]?.value;
      loadEntityData();
    }
  },
  { immediate: true },
);
watch(
  () => props.entityList,
  (newEntities) => {
    if (!newEntities || newEntities.length === 0) {
      entity.value = undefined;
      return;
    }
    if (isNil(entity.value) && !isNil(broker.value)) {
      entity.value = newEntities[0];
      loadData();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex flex-col 2xl:flex-row gap-4 py-4">
    <div class="flex flex-wrap items-center gap-4 2xl:shrink-0">
      <div class="flex items-center gap-x-2">
        <p class="text-primary-800 text-sm whitespace-nowrap">Select period</p>
        <USelect
          v-model="range"
          :items="itemsRange"
          class="w-40"
          @update:model-value="loadData"
        />
      </div>

      <div class="flex items-center gap-x-2">
        <p class="text-primary-800 text-sm">
          Last update:
          <span class="text-primary-600 font-semibold">{{
            formattedLastUpdate ?? "—"
          }}</span>
        </p>
        <UButton
          label="Reload data"
          icon="heroicons:arrow-path"
          color="neutral"
          variant="outline"
          size="xs"
          @click="loadData"
        />
      </div>
    </div>

    <div class="flex flex-1 flex-wrap items-center gap-4 pl-8">
      <div class="flex flex-1 min-w-64 items-center gap-x-2 justify-end">
        <p class="text-primary-800 text-sm whitespace-nowrap">Select cluster</p>
        <USelect
          v-model="cluster"
          :items="clustersList"
          label-key="title"
          class="flex-1 min-w-0 max-w-2xl"
          :disabled="error !== undefined"
          @update:modelValue="loadBrokerData"
        />
      </div>

      <div class="flex items-center gap-x-2">
        <p class="text-primary-800 text-sm whitespace-nowrap">Select broker</p>
        <USelect
          v-model="broker"
          :items="brokersList"
          label-key="title"
          placeholder="No brokers"
          class="w-44"
          :disabled="error !== undefined || brokersList.length === 0"
          @update:modelValue="loadEntityData"
        />
      </div>

      <div class="flex items-center gap-x-2">
        <p class="text-primary-800 text-sm whitespace-nowrap">Select entity</p>
        <USelect
          v-model="entity"
          :items="entityList"
          placeholder="No entities"
          class="w-72"
          :disabled="error !== undefined || entityList.length === 0"
          @update:modelValue="loadData"
        />
      </div>
    </div>
  </div>
</template>
