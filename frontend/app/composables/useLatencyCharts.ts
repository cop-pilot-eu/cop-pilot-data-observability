import { isNil } from "ramda";
import {
  escapeHtml,
  getTimeGroupKey,
  parseTimeGroupKey,
} from "../utils/formatters";

export const useLatencyCharts = (props: {
  latencyDistributionReport: Ref<LatencyDistributionReportAPI | undefined>;
  responseTimesReport: Ref<ResponseTimesReportItemAPI[] | undefined>;
  rangeSelected: Ref<RangeOption | undefined>;
}) => {
  // Buckets split at the reference median and p95; colors match the Response Time lines
  const barData = computed<LatencyBarChartUI[]>(() => {
    const report = props.latencyDistributionReport.value;
    if (isNil(report)) return [];
    return [
      {
        label: "Expected Response Time",
        color: "#10B981",
        ...report.normalResponse,
      },
      {
        label: "Slower Than Usual",
        color: "#F59E0B",
        ...report.slowerThanUsualResponse,
      },
      {
        label: "Unacceptably Slow",
        color: "#F43F5E",
        ...report.unacceptablySlowResponse,
      },
    ];
  });

  const formatMs = (ms: number): string => `${Math.round(ms)} ms`;

  const lineDataTransformed = computed<LatencyLineChartUI[]>(() => {
    if (isNil(props.responseTimesReport.value)) return [];

    const grouped = new Map<string, Omit<LatencyLineChartUI, "time">>();

    props.responseTimesReport.value.forEach((item) => {
      const key = getTimeGroupKey(
        new Date(item.observedAt),
        props.rangeSelected.value,
      );
      const existing = grouped.get(key);
      if (existing) {
        existing.normalResponse += item.normalResponse;
        existing.slowerThanUsualResponse += item.slowerThanUsualResponse;
        existing.unacceptablySlowResponse += item.unacceptablySlowResponse;
      } else {
        grouped.set(key, {
          normalResponse: item.normalResponse,
          slowerThanUsualResponse: item.slowerThanUsualResponse,
          unacceptablySlowResponse: item.unacceptablySlowResponse,
        });
      }
    });

    const isLastHour = props.rangeSelected.value === "lastHour";
    return Array.from(grouped.entries())
      .sort(([a], [b]) => parseTimeGroupKey(a) - parseTimeGroupKey(b))
      .map(([time, values]) => ({
        time: isLastHour ? time.split(" ")[1]! : time,
        ...values,
      }));
  });

  const barChartOptions = computed(() => ({
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: any[]) => {
        const p = params[0];
        const d = barData.value[p.dataIndex];
        if (!d) return "";
        // observed min–max latency of the bucket's responses
        const range =
          isNil(d.minMs) || isNil(d.maxMs)
            ? "No responses"
            : `${formatMs(d.minMs)} – ${formatMs(d.maxMs)}`;
        return `${p.marker}${escapeHtml(d.label)}: <b>${d.count}</b><br/>Range: ${range}`;
      },
    },
    grid: { left: "3%", right: "3%", bottom: "20%" },
    xAxis: {
      type: "category",
      data: barData.value.map((d) => d.label),
      axisLabel: { interval: 0, rotate: 0 },
    },
    yAxis: {
      type: "value",
      name: "Number of responses",
      nameLocation: "center",
      splitLine: { lineStyle: { type: "dashed" } },
    },
    series: [
      {
        name: "Responses",
        type: "bar",
        barWidth: "60%",
        data: barData.value.map((d) => ({
          value: d.count,
          itemStyle: { color: d.color },
        })),
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
    ],
  }));

  const lineChartOptions = computed(() => ({
    tooltip: {
      trigger: "axis",
      formatter: (params: any[]) => {
        const header = escapeHtml(String(params[0].axisValue));
        const lines = params.map(
          (p: any) =>
            `${p.marker}${escapeHtml(p.seriesName)}: <b>${Number(p.value).toFixed(2)}</b>`,
        );
        return `${header}<br/>${lines.join("<br/>")}`;
      },
    },
    legend: {
      data: [
        "Expected Response Time",
        "Slower Than Usual",
        "Unacceptably Slow",
      ],
      top: "5%",
    },
    grid: { left: "3%", right: "3%", bottom: "35%" },
    dataZoom: [
      {
        type: "slider",
        xAxisIndex: 0,
        bottom: "1%",
        height: 20,
        start: 0,
        end: 100,
      },
      { type: "inside", xAxisIndex: 0 },
    ],
    xAxis: {
      type: "category",
      data: lineDataTransformed.value.map((d) => d.time),
      boundaryGap: false,
      axisLabel: { rotate: 45 },
    },
    yAxis: {
      type: "value",
      name: "Number of responses",
      nameLocation: "center",
      axisLabel: { formatter: "{value}" },
    },
    series: [
      {
        name: "Expected Response Time",
        type: "line",
        color: "#10B981",
        symbolSize: 8,
        data: lineDataTransformed.value.map((d) => d.normalResponse),
      },
      {
        name: "Slower Than Usual",
        type: "line",
        color: "#F59E0B",
        symbolSize: 8,
        data: lineDataTransformed.value.map((d) => d.slowerThanUsualResponse),
      },
      {
        name: "Unacceptably Slow",
        type: "line",
        color: "#F43F5E",
        symbolSize: 8,
        data: lineDataTransformed.value.map((d) => d.unacceptablySlowResponse),
      },
    ],
  }));

  return { barChartOptions, lineChartOptions };
};
