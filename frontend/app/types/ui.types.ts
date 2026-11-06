declare global {
  type CardData = {
    title: string;
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
    range: string;
    count: number;
  };

  type LatencyLineChartUI = {
    time: string;
    normalResponse: number;
    slowerThanUsualResponse: number;
    unacceptablySlowResponse: number;
  };

  type AttributeDistributionTableRowUI = {
    attribute: string;
    type: string;
    min: number;
    max: number;
    mean: number;
    unexpected: number;
    driftScore: number;
    driftAlert: boolean;
    upperThreshold: number;
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
    valid: number;
    total: number;
    missing: number;
  };

  type AttributeDistributionLineChartUI = {
    time: string;
    score: number;
    // chunk bounds (dd/mm/yyyy hh:mm) for the tooltip; `time` is the axis label
    from: string;
    to: string;
  };
}
