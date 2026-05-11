<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string | undefined;
    height?: string;
    loading: boolean;
    error: string | undefined;
    options: Object;
  }>(),
  {
    title: undefined,
    height: "h-[300px]",
    loading: false,
    error: undefined,
    options: () => ({}),
  },
);
</script>

<template>
  <div
    class="p-4 my-4 rounded-md shadow-xl border-2 border-primary-600 bg-secondary-200"
  >
    <div class="font-semibold text-base py-2 text-neutral-400">
      <p>{{ title }}</p>
    </div>
    <Chart
      :loading="loading"
      :options="options"
      :error="error"
      :height="height"
    />
  </div>
</template>
