export const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const getTimeGroupKey = (
  date: Date,
  rangeSelected: RangeOption | undefined,
): string => {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  if (rangeSelected === "lastHour") return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  if (rangeSelected === "lastDay") return `${dd}/${mm}/${yyyy} ${hh}:00`;
  if (rangeSelected === "lastWeek") return `${dd}/${mm}/${yyyy}`;

  // allTime: group by week (Monday as week start)
  const dayOfWeek = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
  const mdd = String(monday.getDate()).padStart(2, "0");
  const mmm = String(monday.getMonth() + 1).padStart(2, "0");
  return `${mdd}/${mmm}/${monday.getFullYear()}`;
};

// A drift chunk's span: dates only for day-or-longer chunks (one date when it is
// a single day), date and time for shorter ones. The 23 h cut-off matches the
// Drift Score chart's axis labels and absorbs DST days.
export const formatChunkRange = (start: Date, end: Date): string => {
  const subDay = end.getTime() - start.getTime() < 23 * 3_600_000;
  if (subDay)
    return `${getTimeGroupKey(start, "lastHour")} – ${getTimeGroupKey(end, "lastHour")}`;
  const from = getTimeGroupKey(start, "lastWeek");
  const to = getTimeGroupKey(end, "lastWeek");
  return from === to ? from : `${from} – ${to}`;
};

// Short chunk label for the attribute table: "28 Oct" for a day, "26 Oct – 1 Nov"
// for longer chunks, "28 Oct 14:00 – 18:59" for sub-day ones (same 23 h cut-off)
export const formatChunkLabel = (start: Date, end: Date): string => {
  const day = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const time = (d: Date) =>
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (end.getTime() - start.getTime() < 23 * 3_600_000) {
    const to = day(end) === day(start) ? time(end) : `${day(end)} ${time(end)}`;
    return `${day(start)} ${time(start)} – ${to}`;
  }
  return day(start) === day(end) ? day(start) : `${day(start)} – ${day(end)}`;
};

export const parseTimeGroupKey =(k: string): number => {
  const parts = k.split(" ");
  const dateParts = (parts[0] ?? "").split("/").map(Number);
  const timeParts = (parts[1] ?? "00:00").split(":").map(Number);
  return new Date(
    dateParts[2]!,
    dateParts[1]! - 1,
    dateParts[0]!,
    timeParts[0]!,
    timeParts[1]!,
  ).getTime();
};
