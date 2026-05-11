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
    <Icon name="uiw:loading" class="animate-spin h-10 w-10 text-primary-600" />
  </div>
</template>
