declare global {
  type SelectOptionAPI = {
    title: string;
    value: string;
  };

  type StatsPayload = {
    from: Date | string;
    to: Date | string;
    clusterId: string;
    brokerId: string;
    entityId: string;
  };

  type DataQualityReportAPI = {
    numberOfAttributes: number;
    numberOfRecords: number;
    totalMissingValues: number;
    completeness: number;
    avgLatencyMs: number;
    completenessDiffPercentage: number;
    avgLatencyDiffPercentage: number;
  };

  type AttributeQualityItemAPI = {
    dtype: string;
    count: number;
    missing: number;
    mean: number;
    min: number;
    max: number;
    outliers: number;
  };

  type AttributeQualityReportAPI = Record<string, AttributeQualityItemAPI>;

  type DriftColumnAPI = {
    name: string;
    value: number;
    metric: string;
    lowerThreshold: number | null;
    upperThreshold: number;
    alert: boolean;
  };

  type DataDriftReportItemAPI = {
    chunkIndex: number;
    chunkKey: string;
    chunkStartIndex: number;
    chunkEndIndex: number;
    chunkStartDate: string;
    chunkEndDate: string;
    chunkPeriod: string;
    columns: DriftColumnAPI[];
  };

  type DataDistributionReportItemAPI = {
    attribute: string;
    bin: string;
    binEdges: number[];
    reference: number;
    analysis: number;
  };

  type DataDriftSummaryItemAPI = {
    chunkStartDate: string;
    chunkEndDate: string;
    name: string;
    value: number;
    upperThreshold: number;
    alert: boolean;
  };

  type LatencyDistributionReportItemAPI = {
    bin: string;
    binEdges: number[];
    latency: number;
  };

  type ResponseTimesReportItemAPI = {
    observedAt: string;
    latency: number;
    normalResponse: number;
    slowerThanUsualResponse: number;
    unacceptablySlowResponse: number;
  };

  type LoadStatsResponseAPI = {
    dataQualityReport: DataQualityReportAPI;
    attributeQualityReport: AttributeQualityReportAPI;
    dataDriftReport: DataDriftReportItemAPI[];
    dataDistributionReport: DataDistributionReportItemAPI[];
    dataDriftSummary: DataDriftSummaryItemAPI[];
    latencyDistributionReport: LatencyDistributionReportItemAPI[];
    responseTimesReport: ResponseTimesReportItemAPI[];
  };
}
