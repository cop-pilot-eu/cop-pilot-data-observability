import { isNil } from "ramda";
import {
  escapeHtml,
  formatChunkRange,
  getTimeGroupKey,
} from "../utils/formatters";

// Round up to two significant digits, e.g. 0.1234 -> 0.13, 4.56 -> 4.6
const niceCeil = (v: number): number => {
  if (v <= 0) return v;
  const step = 10 ** (Math.floor(Math.log10(v)) - 1);
  // toFixed drops float noise (0.1 * 1.1 = 0.11000000000000001) before the ceil
  return Number((Math.ceil(Number((v / step).toFixed(6))) * step).toPrecision(2));
};

export const useAttributeCharts = (props: {
  attributeQualityReport: Ref<AttributeQualityReportAPI | undefined>;
  dataDistributionReport: Ref<DataDistributionReportItemAPI[] | undefined>;
  dataDriftReport: Ref<DataDriftReportItemAPI[] | undefined>;
  rangeSelected: Ref<RangeOption | undefined>;
}) => {
  const attributeSelected = ref<string | undefined>(undefined);

  const attributesList = computed(() => {
    if (isNil(props.attributeQualityReport.value)) return [];
    return Object.keys(props.attributeQualityReport.value);
  });

  watch(
    attributesList,
    (newAttributesList) => {
      if (
        isNil(attributeSelected.value) ||
        !newAttributesList.includes(attributeSelected.value)
      ) {
        attributeSelected.value = newAttributesList[0];
      }
    },
    { immediate: true },
  );

  const horizontalbarChartOptions = computed(() => {
    const data: AttributeDistributionHorizontalBarChartUI[] = [];

    if (!isNil(props.attributeQualityReport.value)) {
      Object.keys(props.attributeQualityReport.value).forEach((key: string) => {
        if (isNil(props.attributeQualityReport.value)) return;
        const obj = props.attributeQualityReport.value[key];
        // `count` is pandas .count(): non-null values only, so rows = count + missing
        const observed = obj?.count ?? 0;
        const missing = obj?.missing ?? 0;
        data.push({
          attribute: key,
          observed,
          missing,
          total: observed + missing,
        });
      });
    }

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any[]) => {
          const total = params.reduce(
            (sum: number, p: any) => sum + p.value,
            0,
          );
          const lines = params.map((p: any) => {
            const pct =
              total > 0 ? ((p.value / total) * 100).toFixed(1) : "0.0";
            return `${p.marker}${escapeHtml(p.seriesName)}: <b>${p.value}</b> (${pct}%)`;
          });
          return `${escapeHtml(String(params[0].axisValue))}<br/>${lines.join("<br/>")}`;
        },
      },
      legend: { data: ["Observed", "Missing"], top: "top" },
      grid: { left: "3%", right: "3%", bottom: "20%" },
      xAxis: {
        type: "value",
        name: "Volume",
        nameLocation: "center",
        // End at the largest total; ECharts' nice rounding would run past it (2k -> 2.5k)
        ...(data.length > 0 && {
          max: Math.max(...data.map((d) => d.total)) || undefined,
        }),
        splitLine: { show: true, lineStyle: { type: "dashed" } },
      },
      yAxis: {
        type: "category",
        data: data.map((d) => d.attribute),
        name: "Attributes",
        nameLocation: "center",
        axisTick: { show: true },
        axisLine: { lineStyle: { color: "#64748B" } },
      },
      series: [
        {
          name: "Observed",
          type: "bar",
          stack: "total",
          barWidth: "60%",
          color: "#10B981",
          data: data.map((d) => d.observed),
          itemStyle: { borderRadius: 4 },
        },
        {
          name: "Missing",
          type: "bar",
          stack: "total",
          color: "#F43F5E",
          data: data.map((d) => d.missing),
          itemStyle: { borderRadius: 4 },
        },
      ],
    };
  });

  const barChartOptions = computed(() => {
    const barData: AttributeDistributionBarChartUI = {
      bins: [],
      data: { baseline: [], current: [] },
    };

    if (
      !isNil(props.dataDistributionReport.value) &&
      !isNil(attributeSelected.value)
    ) {
      props.dataDistributionReport.value
        .filter((d) => d.attribute === attributeSelected.value)
        .forEach((d: DataDistributionReportItemAPI) => {
          barData.bins.push(d.bin);
          barData.data.baseline.push(d.reference);
          barData.data.current.push(d.analysis);
        });
    }

    return {
      tooltip: { trigger: "axis" },
      legend: { data: ["Baseline", "Current"], top: "0%" },
      grid: { left: "3%", right: "3%", bottom: "20%" },
      xAxis: { type: "category", data: barData.bins },
      yAxis: { type: "value", name: "Volume", nameLocation: "center" },
      series: [
        {
          name: "Baseline",
          type: "bar",
          data: barData.data.baseline,
          color: "#94a3b8",
          itemStyle: { borderRadius: [4, 4, 0, 0] },
        },
        {
          name: "Current",
          type: "bar",
          data: barData.data.current,
          color: "#6366F1",
          itemStyle: { borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  });

  const lineChartOptions = computed(() => {
    const data: AttributeDistributionLineChartUI[] = [];
    let thresholdLimit: number | undefined = undefined;

    if (
      !isNil(props.dataDriftReport.value) &&
      !isNil(attributeSelected.value)
    ) {
      for (const d of props.dataDriftReport.value) {
        const col = d.columns.find(
          (c: DriftColumnAPI) => c.name === attributeSelected.value,
        );

        thresholdLimit = col?.upperThreshold;
        const start = new Date(d.chunkStartDate);
        const end = new Date(d.chunkEndDate);
        // Chunk size is set in analytics (CHUNK_PERIOD / CHUNK_SIZE), not by the
        // selected range: label sub-day chunks with time, others with date only.
        // getTimeGroupKey: "lastHour" = dd/mm/yyyy hh:mm, "lastWeek" = dd/mm/yyyy
        const subDay = end.getTime() - start.getTime() < 23 * 3_600_000;
        data.push({
          time: getTimeGroupKey(start, subDay ? "lastHour" : "lastWeek"),
          score: col?.value ?? 0,
          startMs: start.getTime(),
          range: formatChunkRange(start, end),
        });
      }
      data.sort((a, b) => a.startMs - b.startMs);
    }

    // ECharts sizes the axis from the series data only, so a threshold above
    // every score would sit off-chart: lift the max to just above it.
    const maxScore = Math.max(0, ...data.map((d) => d.score));
    const yAxisMax =
      !isNil(thresholdLimit) && thresholdLimit >= maxScore
        ? niceCeil(thresholdLimit * 1.1)
        : undefined;

    return {
      legend: { data: ["Drift Score", "Current Day"], top: "0%" },
      grid: { left: "3%", right: "7%", bottom: "35%" },
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
      tooltip: {
        trigger: "axis",
        formatter: (params: any[]) => {
          const p = params[0];
          const d = data[p.dataIndex];
          const range = d ? d.range : String(p.axisValue);
          return `${escapeHtml(range)}<br/>${p.marker}${escapeHtml(p.seriesName)}: <b>${Number(p.value).toFixed(4)}</b>`;
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((d) => d.time),
        axisLabel: { rotate: 45 },
      },
      yAxis: {
        type: "value",
        name: "Drift Score",
        nameLocation: "center",
        ...(yAxisMax !== undefined && { max: yAxisMax }),
      },
      series: [
        {
          name: "Drift Score",
          type: "line",
          smooth: true,
          data: data.map((d) => d.score),
          color: "#10B981",
          areaStyle: { color: "rgba(16, 185, 129, 0.1)" },
          markLine: {
            symbol: ["none", "none"],
            label: {
              show: true,
              formatter: () => `${Number(thresholdLimit).toFixed(4)}`,
            },
            lineStyle: { type: "dashed", color: "#F43F5E", width: 2 },
            data: !isNil(thresholdLimit) ? [{ yAxis: thresholdLimit }] : [],
          },
        },
        {
          // Ranges end at now, so the last chunk is the day still running.
          name: "Current Day",
          // Line, not scatter: only Bar/Line are registered in nuxt.config.ts.
          // One non-null point, so it renders as a lone marker.
          type: "line",
          z: 3,
          color: "#F97316",
          data: data.map((d, i) => (i === data.length - 1 ? d.score : null)),
        },
      ],
    };
  });

  return {
    horizontalbarChartOptions,
    barChartOptions,
    lineChartOptions,
    attributeSelected,
    attributesList,
  };
};
