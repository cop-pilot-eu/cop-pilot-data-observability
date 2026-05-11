<script setup lang="ts">
defineProps({
  title: {
    type: String,
    default: "Error",
  },
  errorMsg: {
    type: String,
    default:
      "An error occurred while retrieving the data. Please try again later.",
  },
  height: {
    type: String,
    required: false,
    default: "h-60",
  },
});
</script>

<template>
  <div
    :class="['flex flex-col w-full items-center justify-start', `${height}`]"
  >
    <UAlert
      :class="['flex items-start justify-center']"
      icon="ooui:error"
      color="error"
      variant="soft"
      :title="title"
      :description="errorMsg"
    />
  </div>
</template>
