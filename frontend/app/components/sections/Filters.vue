<script setup lang="ts">
import { isNil } from "ramda";

const props = withDefaults(
  defineProps<{
    entityList: string[];
    lastUpdate: Date | undefined;
    error: string | undefined;
  }>(),
  {
    entityList: () => [],
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

const emit = defineEmits(["loadData"]);

const itemsRange = ref<{ label: string; value: RangeOption }[]>([
  { label: "Last Hour", value: "lastHour" },
  { label: "Last 24 Hours", value: "lastDay" },
  { label: "Last Week", value: "lastWeek" },
  { label: "All time", value: "allTime" },
]);

const entity = ref<string | undefined>(undefined);
const range = ref<RangeOption>("allTime");

const loadData = () => {
  emit("loadData", entity.value, range.value);
};

watch(
  () => props.entityList,
  (newEntities) => {
    if (newEntities && newEntities.length > 0 && isNil(entity.value)) {
      entity.value = newEntities[0];
      loadData();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex justify-between py-4 space-x-4">
    <USelect
      v-model="range"
      :items="itemsRange"
      class="w-1/6"
      @update:model-value="loadData"
    />

    <div class="flex flex-1 items-center gap-x-2">
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

    <USelect
      v-model="entity"
      :items="entityList"
      class="w-1/4"
      :disabled="error !== undefined"
      @update:modelValue="loadData"
    />
  </div>
</template>
