<script setup lang="ts">
import { isNil } from "ramda";

const props = withDefaults(
  defineProps<{
    entityList: string[];
    clustersList: SelectOptionAPI[];
    brokersList: SelectOptionAPI[];
    lastUpdate: Date | undefined;
    error: string | undefined;
    loading?: boolean;
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

// Dropdown grows past the trigger to show full names, capped by the viewport.
const selectUi = {
  content: "min-w-fit max-w-(--reka-select-content-available-width)",
};
// Hover tooltip with the full name of a truncated selection.
const clusterTitle = computed(
  () => props.clustersList.find((c) => c.value === cluster.value)?.title,
);
const brokerTitle = computed(
  () => props.brokersList.find((b) => b.value === broker.value)?.title,
);

const emit = defineEmits(["loadData", "loadBrokerData", "loadEntityData"]);

const itemsRange = ref<{ label: string; value: RangeOption }[]>([
  { label: "Last 24 Hours", value: "lastDay" },
  { label: "Last Week", value: "lastWeek" },
  { label: "All time", value: "allTime" },
]);

const cluster = ref<string | undefined>(undefined);
const broker = ref<string | undefined>(undefined);
const entity = ref<string | undefined>(undefined);
const range = ref<RangeOption>("lastDay");

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

// Selection last sent to the backend. Fetch is highlighted while the
// current selection differs from it, i.e. the dashboard is out of date.
const applied = ref<{
  cluster?: string;
  broker?: string;
  entity?: string;
  range: RangeOption;
}>();
const canFetch = computed(
  () => !isNil(cluster.value) && !isNil(broker.value) && !isNil(entity.value),
);
const dirty = computed(
  () =>
    !applied.value ||
    applied.value.cluster !== cluster.value ||
    applied.value.broker !== broker.value ||
    applied.value.entity !== entity.value ||
    applied.value.range !== range.value,
);

const loadData = () => {
  applied.value = {
    cluster: cluster.value,
    broker: broker.value,
    entity: entity.value,
    range: range.value,
  };
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
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="space-y-3 py-4">
    <p class="text-primary-800 text-sm">
      Last update:
      <span class="text-primary-600 font-semibold">{{
        formattedLastUpdate ?? "—"
      }}</span>
    </p>

    <!-- One wrapping row: growing selects fill each line, so wrapped lines stay aligned. -->
    <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div class="flex items-center gap-x-2">
        <p class="text-primary-800 text-sm whitespace-nowrap">Select period</p>
        <USelect v-model="range" :items="itemsRange" class="w-40" />
      </div>

      <div class="flex flex-1 min-w-72 items-center gap-x-2">
        <p class="text-primary-800 text-sm whitespace-nowrap">Select cluster</p>
        <USelect
          v-model="cluster"
          :items="clustersList"
          label-key="title"
          class="flex-1 min-w-0"
          :ui="selectUi"
          :title="clusterTitle"
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
          :ui="selectUi"
          :title="brokerTitle"
          :disabled="error !== undefined || brokersList.length === 0"
          @update:modelValue="loadEntityData"
        />
      </div>

      <div class="flex flex-[1.25] min-w-80 items-center gap-x-2">
        <p class="text-primary-800 text-sm whitespace-nowrap">Select entity</p>
        <USelect
          v-model="entity"
          :items="entityList"
          placeholder="No entities"
          class="flex-1 min-w-0"
          :ui="selectUi"
          :title="entity"
          :disabled="error !== undefined || entityList.length === 0"
        />
      </div>

      <UButton
        label="Fetch"
        icon="heroicons:arrow-path"
        :variant="dirty ? 'solid' : 'outline'"
        :disabled="!canFetch"
        :loading="loading"
        @click="loadData"
      />
    </div>
  </div>
</template>
