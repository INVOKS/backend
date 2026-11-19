/**
 * Helper zona waktu Asia/Jakarta (WIB, UTC+7).
 * Semua representasi waktu disimpan dan dibandingkan dalam format string
 * "YYYY-MM-DD HH:mm:ss" untuk menghindari konversi diam-diam ke UTC.
 */

export const OPERATIONAL_START_HOUR = 7;
export const OPERATIONAL_END_HOUR = 19;
export const TOTAL_OPERATIONAL_SLOTS =
  OPERATIONAL_END_HOUR - OPERATIONAL_START_HOUR; // 12 slot

export function getNowJakartaString(): string {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "00";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get(
    "minute"
  )}:${get("second")}`;
}

export function getTodayJakartaDateString(): string {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "00";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatInputSlotToDbString(inputSlot: string): string {
  // Input: "YYYY-MM-DDTHH:mm" atau "YYYY-MM-DDTHH:mm:ss", boleh dengan akhiran "+07:00"
  // Output: "YYYY-MM-DD HH:mm:ss"
  const stripped = inputSlot.trim().replace(/\+07:00$/, "");
  const withoutT = stripped.replace("T", " ");
  const base = withoutT.slice(0, 16); // "YYYY-MM-DD HH:mm"
  return `${base}:00`;
}

export function toApiDateTime(dtStr: string): string {
  // Input: "YYYY-MM-DD HH:mm:ss" atau "YYYY-MM-DDTHH:mm"
  // Output: "YYYY-MM-DDTHH:mm:ss+07:00"
  const clean = dtStr.trim().replace(" ", "T");
  const withoutOffset = clean.replace(/\+07:00$/, "").replace(/Z$/, "");
  const withSeconds =
    withoutOffset.length === 16 ? `${withoutOffset}:00` : withoutOffset;
  return `${withSeconds}+07:00`;
}

export function isSlotPast(startAt: string): boolean {
  // Memakai aturan yang sama persis untuk validator dan availability:
  // start_at <= nowJakarta
  const dbStr =
    startAt.includes("T") || startAt.includes("+07:00")
      ? formatInputSlotToDbString(startAt)
      : startAt;
  return dbStr <= getNowJakartaString();
}

export function addOneHourJakarta(dtStr: string): string {
  // Input: "YYYY-MM-DD HH:mm:ss"
  // Output: "YYYY-MM-DD HH:mm:ss" (+1 jam)
  const parts = dtStr.split(" ");
  const datePart = parts[0] ?? "";
  const timePart = parts[1] ?? "";

  const dParts = datePart.split("-").map(Number);
  const y = dParts[0] ?? 2026;
  const m = dParts[1] ?? 1;
  const d = dParts[2] ?? 1;

  const tParts = timePart.split(":").map(Number);
  const hour = tParts[0] ?? 0;
  const min = tParts[1] ?? 0;
  const sec = tParts[2] ?? 0;

  const dateObj = new Date(Date.UTC(y, m - 1, d, hour + 1, min, sec));
  const nextY = dateObj.getUTCFullYear();
  const nextM = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const nextD = String(dateObj.getUTCDate()).padStart(2, "0");
  const nextH = String(dateObj.getUTCHours()).padStart(2, "0");

  return `${nextY}-${nextM}-${nextD} ${nextH}:00:00`;
}

export function addMinutesJakarta(dtStr: string, minutes: number): string {
  // Input: "YYYY-MM-DD HH:mm:ss"
  // Output: "YYYY-MM-DD HH:mm:ss" (+minutes menit)
  const parts = dtStr.split(" ");
  const datePart = parts[0] ?? "";
  const timePart = parts[1] ?? "";

  const dParts = datePart.split("-").map(Number);
  const y = dParts[0] ?? 2026;
  const m = dParts[1] ?? 1;
  const d = dParts[2] ?? 1;

  const tParts = timePart.split(":").map(Number);
  const hour = tParts[0] ?? 0;
  const min = tParts[1] ?? 0;
  const sec = tParts[2] ?? 0;

  const dateObj = new Date(Date.UTC(y, m - 1, d, hour, min + minutes, sec));
  const nextY = dateObj.getUTCFullYear();
  const nextM = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const nextD = String(dateObj.getUTCDate()).padStart(2, "0");
  const nextH = String(dateObj.getUTCHours()).padStart(2, "0");
  const nextMin = String(dateObj.getUTCMinutes()).padStart(2, "0");
  const nextSec = String(dateObj.getUTCSeconds()).padStart(2, "0");

  return `${nextY}-${nextM}-${nextD} ${nextH}:${nextMin}:${nextSec}`;
}

export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parts = dateStr.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const d = parts[2] ?? 0;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  return (
    dateObj.getUTCFullYear() === y &&
    dateObj.getUTCMonth() === m - 1 &&
    dateObj.getUTCDate() === d
  );
}

export function isValidMonthString(monthStr: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(monthStr)) return false;
  const parts = monthStr.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  return m >= 1 && m <= 12 && y >= 2000 && y <= 2100;
}

export function getMonthDifferenceFromNowJakarta(targetMonth: string): number {
  const today = getTodayJakartaDateString();
  const currParts = today.split("-").map(Number);
  const tgtParts = targetMonth.split("-").map(Number);
  const currY = currParts[0] ?? 2026;
  const currM = currParts[1] ?? 1;
  const tgtY = tgtParts[0] ?? 2026;
  const tgtM = tgtParts[1] ?? 1;
  return (tgtY - currY) * 12 + (tgtM - currM);
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function generateBookingCode(): string {
  const today = getTodayJakartaDateString().replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RB-${today}-${rand}`;
}

export function generateBorrowingCode(): string {
  const today = getTodayJakartaDateString().replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `IB-${today}-${rand}`;
}

export type TimeStatus = "upcoming" | "ongoing" | "completed" | "cancelled";

export function calculateBookingTimeStatus(
  slots: Array<{ startAt: string; endAt: string }>,
  status: "booked" | "cancelled"
): TimeStatus {
  if (status === "cancelled") return "cancelled";
  if (slots.length === 0) return "completed";

  const nowStr = getNowJakartaString();
  const starts = slots.map((s) => s.startAt).sort();
  const ends = slots.map((s) => s.endAt).sort();
  const earliest = starts[0] ?? "";
  const latest = ends[ends.length - 1] ?? "";

  if (nowStr < earliest) return "upcoming";
  if (nowStr >= latest) return "completed";
  return "ongoing";
}

export function calculateSlotTimeStatus(
  startAt: string,
  endAt: string
): "upcoming" | "ongoing" | "completed" {
  const nowStr = getNowJakartaString();
  if (nowStr < startAt) return "upcoming";
  if (nowStr >= endAt) return "completed";
  return "ongoing";
}
