<script setup lang="ts">
defineProps({
  height: {
    type: String,
    required: false,
    default: "h-60",
  },
});
</script>

<template>
  <div
    :class="['w-full flex flex-col justify-center items-center', `${height}`]"
  >
    <span class="text-sm text-neutral-500"
      >No results were found for the current selections</span
    >
  </div>
</template>
