<script setup lang="ts">
import { isNil } from "ramda";

const props = withDefaults(
  defineProps<{
    dataQualityReport: DataQualityReportAPI | undefined;
    dataDriftSummary: DataDriftSummaryItemAPI[] | undefined;
    rangeSelected: RangeOption | undefined;
    loading: boolean;
  }>(),
  {
    dataQualityReport: undefined,
    dataDriftSummary: undefined,
    range: undefined,
    loading: false,
  },
);

const cardData = computed((): CardData[] => {
  const driftTotal = isNil(props.dataDriftSummary)
    ? 0
    : props.dataDriftSummary?.length;
  const driftDetected = isNil(props.dataDriftSummary)
    ? []
    : props.dataDriftSummary.filter((el) => el.alert === true).length;

  const completenessDiff: number =
    props.dataQualityReport?.completenessDiffPercentage ?? 0;
  const latencyDiff: number =
    props.dataQualityReport?.avgLatencyDiffPercentage ?? 0;

  const getLevelIcon = (diff: number): "positive" | "negative" | "neutral" => {
    if (diff > 0) return "positive";
    if (diff < 0) return "negative";
    return "neutral";
  };

  const getColor = (diff: number): string => {
    if (diff < 0) return "text-tertiary-500";
    if (diff > 0) return "text-success-600";
    return "text-primary-500";
  };
  const getBorderColor = (diff: number): string => {
    if (diff < 0) return "bg-tertiary-500";
    if (diff > 0) return "bg-success-600";
    return "bg-primary-500";
  };

  let tooltipText: string[] | undefined = undefined;
  if (
    !isNil(props.dataDriftSummary) &&
    props.dataDriftSummary.filter((el) => el.alert === true).length > 0
  ) {
    let drifts = props.dataDriftSummary
      .filter((el: DataDriftSummaryItemAPI) => el.alert === true)
      .map((el: DataDriftSummaryItemAPI) => {
        return `${el.name}  peak drift reached at ${Math.ceil(el.value * 100) / 100}`;
      });

    tooltipText = drifts;
  }

  return [
    {
      title: "Drift Detection",
      headerIcon: undefined,
      value: driftTotal === 0 ? undefined : `${driftDetected}/${driftTotal}`,
      borderColor: getBorderColor(0),
      comment:
        driftTotal === 0
          ? undefined
          : {
              textValue: `${driftDetected === 0 ? "No" : driftDetected} attributes with drift detected`,
              color: getColor(driftDetected === 0 ? 1 : -driftDetected),
              level: "neutral",
              tooltipText: tooltipText,
              hideTooltip: driftDetected === 0,
            },
    },
    {
      title: "Data Completeness",
      headerIcon: "heroicons:chart-bar-solid",
      value: isNil(props.dataQualityReport?.completeness)
        ? undefined
        : props.dataQualityReport?.completeness + "%",
      borderColor: getBorderColor(completenessDiff),
      comment: isNil(props.dataQualityReport?.completenessDiffPercentage)
        ? undefined
        : {
            textValue: `${Math.abs(completenessDiff)}% vs reference dataset`,
            color: getColor(completenessDiff),
            level: getLevelIcon(completenessDiff),
            hideTooltip: true,
          },
    },
    {
      title: "Avg Response Latency",
      headerIcon: "heroicons:clock",
      value: isNil(props.dataQualityReport?.avgLatencyMs)
        ? undefined
        : props.dataQualityReport?.avgLatencyMs + "ms",
      borderColor: getBorderColor(-latencyDiff),
      comment: isNil(props.dataQualityReport?.avgLatencyMs)
        ? undefined
        : {
            textValue: `${Math.abs(latencyDiff)}% vs reference dataset`,
            color: getColor(-latencyDiff),
            level: getLevelIcon(latencyDiff),
            hideTooltip: true,
          },
    },
  ];
});
</script>

<template>
  <div class="flex justify-between py-4 gap-x-6">
    <Card
      v-for="(value, index) in cardData"
      :key="index"
      :card="value"
      :loading="loading"
    />
  </div>
</template>
