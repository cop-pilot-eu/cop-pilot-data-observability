<script setup lang="ts">
import { isEmpty, isNil } from "ramda";

const props = withDefaults(
  defineProps<{
    options: any;
    loading: boolean;
    error: string | undefined;
    height?: string;
  }>(),
  {
    options: () => ({}),
    loading: false,
    error: undefined,
    height: "h-[300px]",
  },
);

const noData = computed(() => {
  if (isEmpty(props.options) || !props.options?.series?.length) {
    return true;
  }

  const hasSeriesWithEmptyData =
    // check if every data property on every series item has empty array
    props.options?.series?.every(
      (seriesItem: Record<string, any>) => !seriesItem.data.length,
    ) ||
    // data property on every series item might have data, but filled with null values
    props.options?.series?.every((seriesItem: Record<string, any>) =>
      seriesItem.data.every((val: number | number[] | null) => {
        //heatmap check
        if (Array.isArray(val)) return isNil(val[2]);

        return isNil(val);
      }),
    );
  return hasSeriesWithEmptyData ?? false;
});
const hasError = computed(() => props.error ?? false);
const loadingSpinnerStatus = computed(() => !hasError && props.loading);
</script>

<template>
  <!-- todo: check  error handles -->
  <LoadingSpinner v-if="loadingSpinnerStatus" :height="height" />
  <ErrorCard v-else-if="hasError" :height="height" :errorMsg="hasError" />
  <NoResultsFound v-else-if="noData" :height="height" />
  <div v-else :class="['flex', height]">
    <VChart :option="options" />
  </div>
</template>
