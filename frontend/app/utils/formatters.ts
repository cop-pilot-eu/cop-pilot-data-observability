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

export const parseTimeGroupKey = (k: string): number => {
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
