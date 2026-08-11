export function formatMoney(amount: number, currency = "CAD"): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function parseMonthKey(key: string): { start: Date; end: Date } {
  const [y, m] = key.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

export function currentMonthKey(): string {
  return monthKey(new Date());
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

/** YYYY-MM-DD for <input type="date">, using local calendar date. */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type DateRangePresetId =
  | "last_30"
  | "last_60"
  | "mtd"
  | "ytd"
  | `month:${string}`
  | "custom";

export interface DateRangeValue {
  start: Date;
  end: Date;
  preset: DateRangePresetId;
}

export function rangeForPreset(
  preset: Exclude<DateRangePresetId, "custom">,
  now = new Date(),
): DateRangeValue {
  const today = startOfDay(now);
  const end = endOfDay(now);

  if (preset === "last_30") {
    const start = startOfDay(new Date(today));
    start.setDate(start.getDate() - 29);
    return { start, end, preset };
  }
  if (preset === "last_60") {
    const start = startOfDay(new Date(today));
    start.setDate(start.getDate() - 59);
    return { start, end, preset };
  }
  if (preset === "mtd") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end,
      preset,
    };
  }
  if (preset === "ytd") {
    return {
      start: new Date(today.getFullYear(), 0, 1),
      end,
      preset,
    };
  }
  // month:YYYY-MM
  const key = preset.slice("month:".length);
  const { start, end: monthEnd } = parseMonthKey(key);
  return { start, end: monthEnd, preset };
}

export function formatDateRangeLabel(range: DateRangeValue): string {
  switch (range.preset) {
    case "last_30":
      return "Last 30 days";
    case "last_60":
      return "Last 60 days";
    case "mtd":
      return "Month to date";
    case "ytd":
      return "Year to date";
    default:
      if (range.preset.startsWith("month:")) {
        return range.preset.slice("month:".length);
      }
      if (toDateInputValue(range.start) === toDateInputValue(range.end)) {
        return formatDate(range.start);
      }
      return `${formatDate(range.start)} – ${formatDate(range.end)}`;
  }
}
