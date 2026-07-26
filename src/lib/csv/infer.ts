import type { ColumnMapping } from "@/lib/types";

const DATE_HEADERS = [
  "date",
  "transaction date",
  "trans date",
  "posted",
  "posted date",
  "posting date",
  "txn date",
  "value date",
];

const DESC_HEADERS = [
  "description",
  "memo",
  "name",
  "payee",
  "merchant",
  "details",
  "transaction",
  "narrative",
  "particulars",
];

const AMOUNT_HEADERS = ["amount", "cad$", "cad", "transaction amount", "amt"];
const DEBIT_HEADERS = ["debit", "withdrawal", "withdrawals", "money out"];
const CREDIT_HEADERS = ["credit", "deposit", "deposits", "money in"];
const INCOME_HEADERS = ["income"];
const EXPENSE_HEADERS = ["expense", "expenses", "spend", "spending"];

/** Columns that look monetary but are not the transaction amount. */
const NOISE_HEADERS = [
  "balance",
  "running balance",
  "current balance",
  "ending balance",
  "opening balance",
  "ledger balance",
  "available balance",
  "account balance",
  "outstanding balance",
  "reference",
  "ref",
  "card member",
  "account number",
  "account #",
  "cheque number",
  "check number",
  "status",
  "type",
  "category",
];

const BALANCE_TOKENS = [
  "balance",
  "running bal",
  "ledger",
  "outstanding",
  "available credit",
];

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ").trim();
}

function isNoiseHeader(header: string): boolean {
  const n = normalizeHeader(header);
  if (!n) return true;
  if (BALANCE_TOKENS.some((t) => n === t || n.includes(t))) return true;
  return NOISE_HEADERS.some((x) => n === x || n.includes(x));
}

/**
 * Match headers against candidates. Exact match wins; partial match only for
 * candidates/headers long enough to avoid false hits (e.g. "in" ⊂ "running").
 */
function findHeader(
  headers: string[],
  candidates: string[],
  opts?: { allowNoise?: boolean },
): string | null {
  const normalized = headers
    .filter((h) => opts?.allowNoise || !isNoiseHeader(h))
    .map((h) => ({ raw: h, n: normalizeHeader(h) }));

  for (const candidate of candidates) {
    const exact = normalized.find((h) => h.n === candidate);
    if (exact) return exact.raw;
  }
  for (const candidate of candidates) {
    if (candidate.length < 4) continue;
    const partial = normalized.find(
      (h) =>
        (h.n.includes(candidate) && candidate.length >= 4) ||
        (candidate.includes(h.n) && h.n.length >= 4),
    );
    if (partial) return partial.raw;
  }
  return null;
}

function looksLikeDate(value: string): boolean {
  if (!value) return false;
  const d = Date.parse(value);
  if (!Number.isNaN(d)) return true;
  // DD/MM/YYYY or MM/DD/YYYY
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(value)) return true;
  // YYYY-MM-DD
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(value)) return true;
  return false;
}

function looksLikeMoney(value: string): boolean {
  if (!value) return false;
  const cleaned = value.replace(/[$,\sCAD]/g, "").replace(/^\((.*)\)$/, "-$1");
  return /^-?\d+(\.\d{1,2})?$/.test(cleaned);
}

/**
 * Running totals are usually always filled, rarely zero, and mostly monotonic
 * across consecutive rows — unlike income/expense which are sparse and jump.
 */
function looksLikeRunningBalance(samples: string[]): boolean {
  const nums = samples
    .map((s) => parseMoney(s))
    .filter((n): n is number => n != null);
  if (nums.length < 5) return false;

  const filledRatio = nums.length / Math.max(samples.length, 1);
  if (filledRatio < 0.85) return false;

  const nonZero = nums.filter((n) => n !== 0).length;
  if (nonZero / nums.length < 0.9) return false;

  let up = 0;
  let down = 0;
  for (let i = 1; i < nums.length; i++) {
    const prev = nums[i - 1]!;
    const cur = nums[i]!;
    if (cur >= prev) up += 1;
    if (cur <= prev) down += 1;
  }
  const mono = Math.max(up, down) / (nums.length - 1);
  return mono >= 0.7;
}

function scoreColumn(
  header: string,
  samples: string[],
  kind: "date" | "money" | "text",
): number {
  if (isNoiseHeader(header)) return -100;
  if (kind === "money" && looksLikeRunningBalance(samples)) return -100;

  const n = normalizeHeader(header);
  let score = 0;

  if (kind === "date") {
    if (DATE_HEADERS.some((c) => n === c || n.includes(c))) score += 5;
    const hits = samples.filter(looksLikeDate).length;
    score += hits;
  } else if (kind === "money") {
    if (
      [
        ...AMOUNT_HEADERS,
        ...DEBIT_HEADERS,
        ...CREDIT_HEADERS,
        ...INCOME_HEADERS,
        ...EXPENSE_HEADERS,
      ].some((c) => n === c || (c.length >= 4 && n.includes(c)))
    ) {
      score += 5;
    }
    const hits = samples.filter(looksLikeMoney).length;
    score += hits;
    // Prefer sparse amount columns (many blanks) over always-filled balances
    const blankRatio =
      samples.filter((s) => !s.trim()).length / Math.max(samples.length, 1);
    if (blankRatio > 0.2) score += 2;
  } else {
    if (DESC_HEADERS.some((c) => n === c || n.includes(c))) score += 5;
    const avgLen =
      samples.reduce((a, s) => a + s.length, 0) / Math.max(samples.length, 1);
    if (avgLen > 8) score += 2;
  }
  return score;
}

function bestColumn(
  headers: string[],
  rows: Record<string, string>[],
  kind: "date" | "money" | "text",
  exclude: Set<string>,
): string | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const header of headers) {
    if (exclude.has(header) || isNoiseHeader(header)) continue;
    const samples = rows.slice(0, 15).map((r) => r[header] ?? "");
    if (kind === "money" && looksLikeRunningBalance(samples)) continue;
    const score = scoreColumn(header, samples, kind);
    if (score > bestScore) {
      bestScore = score;
      best = header;
    }
  }
  return bestScore > 0 ? best : null;
}

export function inferColumnMapping(
  headers: string[],
  rows: Record<string, string>[],
): ColumnMapping {
  const exclude = new Set<string>();

  const date =
    findHeader(headers, DATE_HEADERS) ??
    bestColumn(headers, rows, "date", exclude) ??
    headers.find((h) => !isNoiseHeader(h)) ??
    headers[0] ??
    "";
  if (date) exclude.add(date);

  const description =
    findHeader(headers, DESC_HEADERS) ??
    bestColumn(headers, rows, "text", exclude) ??
    headers.find((h) => !exclude.has(h) && !isNoiseHeader(h)) ??
    "";
  if (description) exclude.add(description);

  const incomeCol = findHeader(headers, INCOME_HEADERS);
  const expenseCol = findHeader(headers, EXPENSE_HEADERS);
  const debitCol = findHeader(headers, DEBIT_HEADERS);
  const creditCol = findHeader(headers, CREDIT_HEADERS);
  const amountCol =
    findHeader(headers, AMOUNT_HEADERS) ??
    bestColumn(headers, rows, "money", exclude);

  const mapping: ColumnMapping = {
    date,
    description,
    amountMode: "signed",
  };

  // Prefer split columns when both sides exist — never fall back to balance.
  if (incomeCol && expenseCol) {
    mapping.amountMode = "income_expense";
    mapping.income = incomeCol;
    mapping.expense = expenseCol;
  } else if (debitCol && creditCol) {
    mapping.amountMode = "debit_credit";
    mapping.debit = debitCol;
    mapping.credit = creditCol;
  } else if (amountCol) {
    const samples = rows
      .slice(0, 30)
      .map((r) => r[amountCol] ?? "")
      .filter(Boolean);
    const hasNegative = samples.some((s) => {
      const n = parseMoney(s);
      return n != null && n < 0;
    });
    const hasPositive = samples.some((s) => {
      const n = parseMoney(s);
      return n != null && n > 0;
    });
    if (hasNegative && hasPositive) {
      mapping.amountMode = "signed";
    } else if (hasNegative || hasPositive) {
      // Credit card exports often list charges as positive
      mapping.amountMode = "expense_only";
    } else {
      mapping.amountMode = "signed";
    }
    mapping.amount = amountCol;
  } else {
    mapping.amountMode = "signed";
    mapping.amount =
      headers.find((h) => !exclude.has(h) && !isNoiseHeader(h)) ?? "";
  }

  return mapping;
}

export function parseMoney(raw: string): number | null {
  if (!raw || !raw.trim()) return null;
  let s = raw.trim();
  const parenNegative = /^\(.*\)$/.test(s);
  s = s.replace(/[$,\sCAD]/gi, "").replace(/[()]/g, "");
  if (!s || s === "-" || s === "+") return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return parenNegative ? -Math.abs(n) : n;
}
