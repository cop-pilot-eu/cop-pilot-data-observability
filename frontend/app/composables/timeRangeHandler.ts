export const useTimeRangeHandler = () => {
  const getDateRange = (
    range: RangeOption,
  ): { from: Date | string; to: Date | string } => {
    const to = new Date();
    const from = new Date();

    switch (range) {
      case "lastHour":
        from.setHours(from.getHours() - 1);
        break;
      case "lastDay":
        from.setHours(from.getHours() - 24);
        break;
      case "lastWeek":
        from.setDate(from.getDate() - 7);
        break;
      case "allTime":
        from.setFullYear(2000, 0, 1);
        break;
    }

    const fromString = from.toISOString();
    const toString = to.toISOString();

    return { from: fromString, to: toString };
  };

  return { getDateRange };
};
