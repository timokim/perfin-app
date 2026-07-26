import { parse, isValid } from "date-fns";
import type { ColumnMapping, NormalizedRow } from "@/lib/types";
import { parseMoney } from "./infer";

const DATE_FORMATS = [
  "yyyy-MM-dd",
  "yyyy/MM/dd",
  "MM/dd/yyyy",
  "M/d/yyyy",
  "dd/MM/yyyy",
  "d/M/yyyy",
  "MM-dd-yyyy",
  "dd-MM-yyyy",
  "MMM d, yyyy",
  "MMM dd, yyyy",
  "MMMM d, yyyy",
  "dd MMM yyyy",
  "d MMM yyyy",
];

export function parseTransactionDate(raw: string): Date | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();

  for (const fmt of DATE_FORMATS) {
    const d = parse(value, fmt, new Date());
    if (isValid(d)) return d;
  }

  const native = new Date(value);
  if (isValid(native) && !Number.isNaN(native.getTime())) {
    return native;
  }
  return null;
}

function moneyOrZero(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseMoney(raw);
  return n == null ? 0 : Math.abs(n);
}

export function normalizeRow(
  row: Record<string, string>,
  mapping: ColumnMapping,
): NormalizedRow | null {
  const date = parseTransactionDate(row[mapping.date] ?? "");
  if (!date) return null;

  const description = (row[mapping.description] ?? "").trim() || "Untitled";

  let income = 0;
  let expense = 0;

  switch (mapping.amountMode) {
    case "signed": {
      const n = parseMoney(row[mapping.amount ?? ""] ?? "");
      if (n == null || n === 0) {
        // allow zero-amount rows? skip them
        return null;
      }
      if (n < 0) expense = Math.abs(n);
      else income = n;
      break;
    }
    case "expense_only": {
      const n = parseMoney(row[mapping.amount ?? ""] ?? "");
      if (n == null || n === 0) return null;
      // Negative in an "expense only" file often means refund/credit
      if (n < 0) income = Math.abs(n);
      else expense = Math.abs(n);
      break;
    }
    case "debit_credit": {
      expense = moneyOrZero(row[mapping.debit ?? ""]);
      income = moneyOrZero(row[mapping.credit ?? ""]);
      if (expense === 0 && income === 0) return null;
      break;
    }
    case "income_expense": {
      income = moneyOrZero(row[mapping.income ?? ""]);
      expense = moneyOrZero(row[mapping.expense ?? ""]);
      if (expense === 0 && income === 0) return null;
      break;
    }
  }

  return { date, description, income, expense };
}

export function fingerprintRow(
  row: NormalizedRow,
  accountId: string,
): string {
  const day = row.date.toISOString().slice(0, 10);
  const amount = (row.income - row.expense).toFixed(2);
  const desc = row.description.toLowerCase().replace(/\s+/g, " ").trim();
  return `${day}|${amount}|${desc}|${accountId}`;
}

export function normalizeRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): NormalizedRow[] {
  const out: NormalizedRow[] = [];
  for (const row of rows) {
    const n = normalizeRow(row, mapping);
    if (n) out.push(n);
  }
  return out;
}
