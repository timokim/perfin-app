export type AccountType = "checking" | "credit" | "savings" | "other";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  archived?: boolean;
  createdAt: Date;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  iconKey?: string;
  archived?: boolean;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  date: Date;
  description: string;
  /** Optional user note; bank description is often opaque. */
  note: string;
  income: number;
  expense: number;
  accountId: string;
  categoryId: string | null;
  importId: string;
  fingerprint: string;
  createdAt: Date;
}

export interface ImportRecord {
  id: string;
  filename: string;
  accountId: string;
  mapping: ColumnMapping;
  rowCount: number;
  importedCount: number;
  skippedCount: number;
  createdAt: Date;
}

export type AmountMode =
  | "signed"
  | "debit_credit"
  | "income_expense"
  | "expense_only";

export interface ColumnMapping {
  date: string;
  description: string;
  amountMode: AmountMode;
  /** Used when amountMode is "signed" or "expense_only" */
  amount?: string;
  debit?: string;
  credit?: string;
  income?: string;
  expense?: string;
}

export interface NormalizedRow {
  date: Date;
  description: string;
  income: number;
  expense: number;
  note?: string;
}

export const DEFAULT_CATEGORIES: Omit<Category, "id" | "createdAt">[] = [
  { name: "Food", color: "#c45c26", iconKey: "utensils" },
  { name: "Home", color: "#2f6f5e", iconKey: "home" },
  { name: "Utility", color: "#3d5a80", iconKey: "zap" },
  { name: "Transport", color: "#5c4b7a", iconKey: "car" },
  { name: "Income", color: "#2d6a4f", iconKey: "wallet" },
  { name: "Ignore", color: "#9ca3af", iconKey: "eye-off" },
  { name: "Misc", color: "#6b7280", iconKey: "tag" },
];

/** Built-in category names matched case-insensitively. */
export const SPECIAL_CATEGORY_NAMES = {
  income: "income",
  ignore: "ignore",
} as const;

export function isSpecialCategoryName(
  name: string | null | undefined,
  kind: keyof typeof SPECIAL_CATEGORY_NAMES,
): boolean {
  return (name ?? "").trim().toLowerCase() === SPECIAL_CATEGORY_NAMES[kind];
}
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Chequing",
  credit: "Credit card",
  savings: "Savings",
  other: "Other",
};

export const ACCOUNT_COLORS = [
  "#1b3a4b",
  "#c45c26",
  "#2f6f5e",
  "#3d5a80",
  "#8b5a2b",
  "#5c4b7a",
  "#b45309",
  "#0f766e",
];

export const CATEGORY_COLORS = [
  "#c45c26",
  "#2f6f5e",
  "#3d5a80",
  "#5c4b7a",
  "#2d6a4f",
  "#6b7280",
  "#b45309",
  "#9f1239",
  "#1d4ed8",
  "#854d0e",
];
