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
  // Prefer explicit patterns before Date.parse (avoids accepting random words).
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(value)) return true;
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(value)) return true;
  if (/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}$/.test(value)) return true;
  const d = Date.parse(value);
  if (!Number.isNaN(d) && /\d/.test(value)) return true;
  return false;
}

function looksLikeMoney(value: string): boolean {
  if (!value) return false;
  const cleaned = value.replace(/[$,\sCAD]/g, "").replace(/^\((.*)\)$/, "-$1");
  return /^-?\d+(\.\d{1,2})?$/.test(cleaned);
}

const KNOWN_HEADER_TOKENS = [
  ...DATE_HEADERS,
  ...DESC_HEADERS,
  ...AMOUNT_HEADERS,
  ...DEBIT_HEADERS,
  ...CREDIT_HEADERS,
  ...INCOME_HEADERS,
  ...EXPENSE_HEADERS,
  ...NOISE_HEADERS,
];

/**
 * True when the first CSV row looks like column names rather than a transaction.
 * Headerless bank exports often start with a date in column 1.
 */
export function rowLooksLikeHeader(cells: string[]): boolean {
  const nonempty = cells.map((c) => c.trim()).filter(Boolean);
  if (nonempty.length === 0) return false;

  // Data row: starts with a transaction date.
  if (looksLikeDate(nonempty[0]!)) return false;

  const moneyHits = nonempty.filter(looksLikeMoney).length;
  // Data row: multiple numeric amount/balance fields.
  if (moneyHits >= 2) return false;

  const normalized = nonempty.map(normalizeHeader);
  const knownHits = normalized.filter((n) =>
    KNOWN_HEADER_TOKENS.some(
      (k) => n === k || (k.length >= 4 && (n.includes(k) || k.includes(n))),
    ),
  ).length;
  if (knownHits >= 1) return true;

  // Mostly short non-numeric labels → header row.
  const labelLike = nonempty.filter(
    (c) => !looksLikeMoney(c) && !looksLikeDate(c) && c.length <= 40,
  ).length;
  return labelLike >= Math.ceil(nonempty.length * 0.6);
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

function columnSamples(
  rows: Record<string, string>[],
  header: string,
  limit = 40,
): string[] {
  return rows.slice(0, limit).map((r) => r[header] ?? "");
}

function isSparseMoneyColumn(samples: string[]): boolean {
  if (looksLikeRunningBalance(samples)) return false;
  const moneyHits = samples.filter(looksLikeMoney).length;
  if (moneyHits < 2) return false;
  const blankRatio =
    samples.filter((s) => !s.trim()).length / Math.max(samples.length, 1);
  // Withdrawal/deposit columns are often empty on the other side of each row.
  return blankRatio >= 0.15 && moneyHits / samples.length <= 0.9;
}

/**
 * Find complementary debit/credit (or expense/income) columns from values when
 * headers are synthetic or unnamed — common in headerless bank CSVs.
 */
function inferDebitCreditFromShape(
  headers: string[],
  rows: Record<string, string>[],
  exclude: Set<string>,
): { debit: string; credit: string } | null {
  const candidates = headers.filter((h) => {
    if (exclude.has(h) || isNoiseHeader(h)) return false;
    return isSparseMoneyColumn(columnSamples(rows, h));
  });
  if (candidates.length < 2) return null;

  let bestPair: { debit: string; credit: string; score: number } | null = null;

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]!;
      const b = candidates[j]!;
      const sampleCount = Math.min(rows.length, 40);
      let complementary = 0;
      let bothFilled = 0;
      let aOnly = 0;
      let bOnly = 0;

      for (let r = 0; r < sampleCount; r++) {
        const av = looksLikeMoney(rows[r]?.[a] ?? "");
        const bv = looksLikeMoney(rows[r]?.[b] ?? "");
        if (av && bv) bothFilled += 1;
        else if (av || bv) {
          complementary += 1;
          if (av) aOnly += 1;
          else bOnly += 1;
        }
      }

      const decided = complementary + bothFilled;
      if (decided < 3) continue;
      // Prefer pairs that are usually one-or-the-other, not both.
      const score = complementary - bothFilled * 2;
      if (score < 2) continue;
      if (aOnly === 0 || bOnly === 0) continue;

      // Assign debit vs credit using running-balance correlation when possible.
      const balanceHeader = headers.find((h) => {
        if (exclude.has(h) || h === a || h === b) return false;
        return looksLikeRunningBalance(columnSamples(rows, h));
      });

      let debit = a;
      let credit = b;
      if (balanceHeader) {
        let aDown = 0;
        let aUp = 0;
        let bDown = 0;
        let bUp = 0;
        for (let r = 1; r < sampleCount; r++) {
          const prevBal = parseMoney(rows[r - 1]?.[balanceHeader] ?? "");
          const bal = parseMoney(rows[r]?.[balanceHeader] ?? "");
          if (prevBal == null || bal == null) continue;
          const delta = bal - prevBal;
          if (looksLikeMoney(rows[r]?.[a] ?? "")) {
            if (delta < 0) aDown += 1;
            if (delta > 0) aUp += 1;
          }
          if (looksLikeMoney(rows[r]?.[b] ?? "")) {
            if (delta < 0) bDown += 1;
            if (delta > 0) bUp += 1;
          }
        }
        const aIsDebit = aDown - aUp >= bDown - bUp;
        debit = aIsDebit ? a : b;
        credit = aIsDebit ? b : a;
      } else {
        // Bank exports usually list withdrawals/debits before deposits/credits.
        const aIndex = headers.indexOf(a);
        const bIndex = headers.indexOf(b);
        if (aIndex <= bIndex) {
          debit = a;
          credit = b;
        } else {
          debit = b;
          credit = a;
        }
      }

      if (!bestPair || score > bestPair.score) {
        bestPair = { debit, credit, score };
      }
    }
  }

  return bestPair
    ? { debit: bestPair.debit, credit: bestPair.credit }
    : null;
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
  const shaped = inferDebitCreditFromShape(headers, rows, exclude);
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
  } else if (shaped) {
    mapping.amountMode = "debit_credit";
    mapping.debit = shaped.debit;
    mapping.credit = shaped.credit;
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
