export const useMockData = (rangeSelected: Ref<RangeOption | undefined>) => {
  const mockedResponseTimesReport = computed((): ResponseTimesReportItemAPI[] => {
    const stepByRange: Record<RangeOption, { spanMinutes: number; stepMinutes: number }> = {
      lastHour: { spanMinutes: 60, stepMinutes: 1 },
      lastDay: { spanMinutes: 60 * 24, stepMinutes: 15 },
      lastWeek: { spanMinutes: 60 * 24 * 7, stepMinutes: 60 },
      allTime: { spanMinutes: 60 * 24 * 90, stepMinutes: 6 * 60 },
    };

    const { spanMinutes, stepMinutes } = stepByRange[rangeSelected.value ?? "allTime"];
    const now = new Date();
    const totalSteps = Math.floor(spanMinutes / stepMinutes);
    const items: ResponseTimesReportItemAPI[] = [];

    for (let i = 0; i < totalSteps; i++) {
      const offsetFromNow = (totalSteps - 1 - i) * stepMinutes * 60 * 1000;
      const observedAt = new Date(now.getTime() - offsetFromNow);
      const rand = Math.random();
      items.push({
        observedAt: observedAt.toISOString(),
        latency: Math.floor(Math.random() * 500) + 1,
        normalResponse: rand > 0.3 ? 1 : 0,
        slowerThanUsualResponse: rand > 0.7 && rand <= 0.9 ? 1 : 0,
        unacceptablySlowResponse: rand > 0.9 ? 1 : 0,
      });
    }

    return items;
  });

  const mockedDriftReport = computed((): DataDriftReportItemAPI[] => {
    const chunkByRange: Record<RangeOption, { spanMinutes: number; chunkMinutes: number }> = {
      lastHour: { spanMinutes: 60, chunkMinutes: 5 },
      lastDay: { spanMinutes: 60 * 24, chunkMinutes: 30 },
      lastWeek: { spanMinutes: 60 * 24 * 7, chunkMinutes: 120 },
      allTime: { spanMinutes: 60 * 24 * 90, chunkMinutes: 6 * 60 },
    };

    const { spanMinutes, chunkMinutes } = chunkByRange[rangeSelected.value ?? "allTime"];
    const now = new Date();
    const totalChunks = Math.floor(spanMinutes / chunkMinutes);
    const items: DataDriftReportItemAPI[] = [];
    let rowIndex = 0;

    for (let i = 0; i < totalChunks; i++) {
      const offsetFromNow = (totalChunks - 1 - i) * chunkMinutes * 60 * 1000;
      const chunkEnd = new Date(now.getTime() - offsetFromNow);
      const chunkStart = new Date(chunkEnd.getTime() - chunkMinutes * 60 * 1000);
      const chunkSize = 76 + Math.floor(Math.random() * 20);
      const chunkStartIndex = rowIndex;
      const chunkEndIndex = rowIndex + chunkSize;
      rowIndex = chunkEndIndex + 1;

      items.push({
        chunkIndex: i,
        chunkKey: `[${chunkStartIndex}:${chunkEndIndex}]`,
        chunkStartIndex,
        chunkEndIndex,
        chunkStartDate: chunkStart.toISOString(),
        chunkEndDate: chunkEnd.toISOString(),
        chunkPeriod: "analysis",
        columns: [
          {
            name: "leafRelativeHumidity",
            value: parseFloat((Math.random() * 0.6).toFixed(6)),
            metric: "jensen_shannon",
            lowerThreshold: null,
            upperThreshold: 0.37304798132813055,
            alert: Math.random() > 0.75,
          },
          {
            name: "leafTemperature",
            value: parseFloat((Math.random() * 0.6).toFixed(6)),
            metric: "jensen_shannon",
            lowerThreshold: null,
            upperThreshold: 0.5499492733624036,
            alert: Math.random() > 0.75,
          },
        ],
      });
    }

    return items;
  });

  return { mockedResponseTimesReport, mockedDriftReport };
};
