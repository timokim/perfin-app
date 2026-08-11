import {
  isSpecialCategoryName,
  type BudgetBucket,
  type BudgetConfig,
  type Category,
  type Transaction,
} from "@/lib/types";

export interface ObligationLine {
  bucket: BudgetBucket;
  label: string;
  owed: number;
  paid: number;
  due: number;
}

export interface SplitLine {
  bucket: BudgetBucket;
  label: string;
  target: number;
  actual: number;
  remaining: number;
}

export interface BudgetComputation {
  asOf: Date;
  firstIncomeDate: Date | null;
  weeks: number;
  grossIncome: number;
  livingActual: number;
  livingByBucket: Record<
    "living_mortgage" | "living_utility" | "living_food",
    number
  >;
  obligationsOwedTotal: number;
  remaining: number;
  obligations: ObligationLine[];
  livingLines: { bucket: BudgetBucket; label: string; actual: number }[];
  split: SplitLine[];
  discretionaryOver: boolean;
}

const LIVING_BUCKETS = [
  "living_mortgage",
  "living_utility",
  "living_food",
] as const;

const OBLIGATION_META: {
  bucket: BudgetBucket;
  label: string;
  kind: "pct" | "weekly";
  pctKey?: keyof Pick<
    BudgetConfig,
    "tithePct" | "parentsPct" | "godGivingPct"
  >;
}[] = [
  { bucket: "tithe", label: "십일조 (Tithe)", kind: "pct", pctKey: "tithePct" },
  { bucket: "parents", label: "Parents", kind: "pct", pctKey: "parentsPct" },
  {
    bucket: "god_giving",
    label: "God giving",
    kind: "pct",
    pctKey: "godGivingPct",
  },
  { bucket: "offering", label: "헌금 (Weekly offering)", kind: "weekly" },
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Inclusive week count from first income day through asOf. */
export function weeksSinceFirstIncome(
  firstIncomeDate: Date,
  asOf: Date,
): number {
  const start = startOfDay(firstIncomeDate).getTime();
  const end = startOfDay(asOf).getTime();
  if (end < start) return 0;
  const days = Math.floor((end - start) / (24 * 60 * 60 * 1000));
  return Math.floor(days / 7) + 1;
}

function netSpend(expense: number, income: number): number {
  return expense - income;
}

export function computeBudget(
  transactions: Transaction[],
  categories: Category[],
  config: BudgetConfig,
  asOf: Date = new Date(),
): BudgetComputation {
  const incomeCategoryIds = new Set(
    categories
      .filter((c) => isSpecialCategoryName(c.name, "income"))
      .map((c) => c.id),
  );
  const ignoreCategoryIds = new Set(
    categories
      .filter((c) => isSpecialCategoryName(c.name, "ignore"))
      .map((c) => c.id),
  );

  const bucketByCategoryId = new Map<string, BudgetBucket>();
  for (const c of categories) {
    if (c.budgetBucket) bucketByCategoryId.set(c.id, c.budgetBucket);
  }

  let grossIncome = 0;
  let firstIncomeDate: Date | null = null;
  const paidByBucket = new Map<BudgetBucket, number>();

  for (const t of transactions) {
    if (t.date > asOf) continue;
    if (t.categoryId && ignoreCategoryIds.has(t.categoryId)) continue;

    if (t.categoryId && incomeCategoryIds.has(t.categoryId)) {
      if (t.income > 0) {
        grossIncome += t.income;
        if (!firstIncomeDate || t.date < firstIncomeDate) {
          firstIncomeDate = t.date;
        }
      }
      continue;
    }

    if (!t.categoryId) continue;
    const bucket = bucketByCategoryId.get(t.categoryId);
    if (!bucket) continue;
    const prev = paidByBucket.get(bucket) ?? 0;
    paidByBucket.set(bucket, prev + netSpend(t.expense, t.income));
  }

  const weeks = firstIncomeDate
    ? weeksSinceFirstIncome(firstIncomeDate, asOf)
    : 0;

  const obligations: ObligationLine[] = OBLIGATION_META.map((meta) => {
    const owed =
      meta.kind === "weekly"
        ? config.weeklyOffering * weeks
        : grossIncome * (config[meta.pctKey!] ?? 0);
    const paid = Math.max(0, paidByBucket.get(meta.bucket) ?? 0);
    return {
      bucket: meta.bucket,
      label: meta.label,
      owed,
      paid,
      due: owed - paid,
    };
  });

  const livingByBucket = {
    living_mortgage: Math.max(0, paidByBucket.get("living_mortgage") ?? 0),
    living_utility: Math.max(0, paidByBucket.get("living_utility") ?? 0),
    living_food: Math.max(0, paidByBucket.get("living_food") ?? 0),
  };
  const livingActual =
    livingByBucket.living_mortgage +
    livingByBucket.living_utility +
    livingByBucket.living_food;

  const livingLines = LIVING_BUCKETS.map((bucket) => ({
    bucket,
    label:
      bucket === "living_mortgage"
        ? "Mortgage"
        : bucket === "living_utility"
          ? "Utilities"
          : "Food",
    actual: livingByBucket[bucket],
  }));

  const obligationsOwedTotal = obligations.reduce((s, o) => s + o.owed, 0);
  const remaining =
    grossIncome - obligationsOwedTotal - livingActual;

  const splitDefs: {
    bucket: BudgetBucket;
    label: string;
    pct: number;
  }[] = [
    { bucket: "save", label: "Savings (30%)", pct: config.savePct },
    {
      bucket: "god_projects",
      label: "God projects (5%)",
      pct: config.godProjectsPct,
    },
    {
      bucket: "discretionary",
      label: "Discretionary (65%)",
      pct: config.discretionaryPct,
    },
  ];

  const baseRemaining = Math.max(0, remaining);
  const split: SplitLine[] = splitDefs.map((def) => {
    const target = baseRemaining * def.pct;
    const actual = Math.max(0, paidByBucket.get(def.bucket) ?? 0);
    return {
      bucket: def.bucket,
      label: def.label,
      target,
      actual,
      remaining: target - actual,
    };
  });

  const discretionary = split.find((s) => s.bucket === "discretionary");

  return {
    asOf,
    firstIncomeDate,
    weeks,
    grossIncome,
    livingActual,
    livingByBucket,
    obligationsOwedTotal,
    remaining,
    obligations,
    livingLines,
    split,
    discretionaryOver: Boolean(
      discretionary && discretionary.actual > discretionary.target,
    ),
  };
}
