<script setup lang="ts">
import { isNil } from "ramda";

const props = defineProps({
  card: {
    type: Object as PropType<CardData>,
    required: true,
  },
  loading: {
    type: Boolean,
    required: false,
    default: false,
  },
});

const getValue = computed(() => {
  return isNil(props.card.value) ? false : true;
});
</script>

<template>
  <div class="flex items-center flex-1">
    <div class="w-1 h-4/5 relative left-0.5" :class="card.borderColor"></div>
    <div
      class="w-full h-full flex flex-col justify-between px-6 py-2 space-y-1 border border-neutral-300 rounded-md bg-secondary-200"
    >
      <div
        v-if="!loading"
        class="flex justify-between text-neutral-400 items-center"
      >
        <div class="text-sm font-medium">{{ card.title }}</div>
        <Icon v-if="card.headerIcon" :name="card.headerIcon" class="size-4" />
      </div>
      <USkeleton v-else class="bg-neutral-100 h-4 w-full" />

      <div v-if="!loading" class="text-2xl font-semibold">
        <span v-if="getValue">
          {{ card.value }}
        </span>
        <span v-else class="text-tertiary-600 italic text-sm font-medium">
          Not Applicable
        </span>
      </div>
      <USkeleton v-else class="h-8 w-full bg-neutral-100" />
      <div class="min-h-8">
        <UTooltip
          v-if="card.comment && !loading"
          :disabled="card.comment.hideTooltip ?? true"
          :delay-duration="0"
          :content="{
            align: 'start',
            side: 'bottom',
            sideOffset: 8,
          }"
          :ui="{ content: 'p-0 bg-transparent border-0 shadow-none ' }"
        >
          <div
            class="flex items-center gap-x-1 min-h-8"
            :class="card.comment.color"
          >
            <Icon
              v-if="card.comment.level !== 'neutral'"
              :name="
                card.comment.level === 'positive'
                  ? 'heroicons:arrow-up'
                  : 'heroicons:arrow-down'
              "
              class="size-4"
            />
            <p class="text-sm">{{ card.comment.textValue }}</p>
          </div>

          <template #content>
            <div
              class="bg-secondary-200 text-xs rounded-md shadow-md px-4 py-2 space-y-1 border font-semibold border-neutral-200 text-neutral-300"
            >
              <p v-for="value in card.comment?.tooltipText">
                {{ value }}
              </p>
            </div>
          </template>
        </UTooltip>
        <div v-if="loading" class="min-h-8 flex flex-col justify-end">
          <USkeleton class="h-2 w-full bg-neutral-100" />
        </div>
      </div>
    </div>
  </div>
</template>
<style></style>
