declare global {
  type CardData = {
    title: string;
    // what the KPI means, shown on hover over an info icon by the title
    info?: string;
    headerIcon: string | undefined;
    value: number | string | undefined;
    borderColor: string;
    comment:
      | {
          textValue: string;
          color: string;
          level: "positive" | "negative" | "neutral";
          tooltipText?: string[];
          hideTooltip: boolean;
        }
      | undefined;
  };

  type LatencyBarChartUI = {
    label: string;
    color: string;
    count: number;
    minMs: number | null;
    maxMs: number | null;
  };

  type LatencyLineChartUI = {
    time: string;
    normalResponse: number;
    slowerThanUsualResponse: number;
    unacceptablySlowResponse: number;
  };

  // Stat cell: "N/A" for non-numeric attributes, null when a chunk has no values
  type TableStatUI = number | string | null | undefined;

  // An attribute row; when expanded it is followed by a "chunk" row per analysis chunk
  type AttributeDistributionTableRowUI = {
    kind: "attribute" | "chunk";
    attribute: string;
    upperThreshold: number;
    min: TableStatUI;
    max: TableStatUI;
    mean: TableStatUI;
    outliers: TableStatUI;
    // attribute: peak over its chunks; chunk: its own score
    driftScore: number;
    // chunk rows only
    chunkRange?: string;
    alert?: boolean;
    // last chunk of the expanded block: keeps the row line that closes it
    lastChunk?: boolean;
    // attribute rows only
    chunkCount?: number;
    driftedChunks?: number;
  };

  type AttributeDistributionBarChartUI = {
    bins: string[];
    data: {
      baseline: number[];
      current: number[];
    };
  };

  type AttributeDistributionHorizontalBarChartUI = {
    attribute: string;
    observed: number;
    total: number;
    missing: number;
  };

  type AttributeDistributionLineChartUI = {
    time: string;
    score: number;
    // chunk start, for sorting; `time` is the axis label
    startMs: number;
    // chunk span for the tooltip (formatChunkRange)
    range: string;
  };
}
