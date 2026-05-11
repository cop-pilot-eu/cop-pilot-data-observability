import { isNil } from "ramda";
import {
  escapeHtml,
  getTimeGroupKey,
  parseTimeGroupKey,
} from "../utils/formatters";

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
      if (newAttributesList.length > 0 && isNil(attributeSelected.value)) {
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
        const total = obj?.count ?? 0;
        const missing = obj?.missing ?? 0;
        data.push({ attribute: key, valid: total - missing, missing, total });
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
      legend: { data: ["Valid", "Missing"], top: "top" },
      grid: { left: "3%", right: "3%", bottom: "20%" },
      xAxis: {
        type: "value",
        name: "Volume",
        nameLocation: "center",
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
          name: "Valid",
          type: "bar",
          stack: "total",
          barWidth: "60%",
          color: "#10B981",
          data: data.map((d) => d.valid),
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
    let data: AttributeDistributionLineChartUI[] = [];
    let thresholdLimit: number | undefined = undefined;

    if (
      !isNil(props.dataDriftReport.value) &&
      !isNil(attributeSelected.value)
    ) {
      props.dataDriftReport.value?.forEach((d: DataDriftReportItemAPI) => {
        const col = d.columns.find(
          (c: DriftColumnAPI) => c.name === attributeSelected.value,
        );

        thresholdLimit = col?.upperThreshold;
        data.push({
          time: getTimeGroupKey(
            new Date(d.chunkEndDate),
            props.rangeSelected.value,
          ),
          score: col?.value ?? 0,
        });
      });
      data.sort(
        (a, b) => parseTimeGroupKey(a.time) - parseTimeGroupKey(b.time),
      );
    }

    return {
      legend: { data: ["Drift Score", "Current"], top: "0%" },
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
          return `${escapeHtml(String(p.axisValue))}<br/>${p.marker}${escapeHtml(p.seriesName)}: <b>${Number(p.value).toFixed(4)}</b>`;
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
