import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "./client";
import {
  accountsCol,
  budgetSettingsDoc,
  categoriesCol,
  importsCol,
  transactionsCol,
  userDoc,
} from "./paths";
import {
  DEFAULT_BUDGET_CONFIG,
  DEFAULT_CATEGORIES,
  isBudgetBucket,
  type Account,
  type AccountType,
  type BudgetBucket,
  type BudgetConfig,
  type Category,
  type ColumnMapping,
  type ImportRecord,
  type NormalizedRow,
  type Transaction,
} from "@/lib/types";
import { fingerprintRow } from "@/lib/csv/normalize";

function parseBudgetConfig(data: Record<string, unknown>): BudgetConfig {
  return {
    tithePct: Number(data.tithePct) || DEFAULT_BUDGET_CONFIG.tithePct,
    parentsPct: Number(data.parentsPct) || DEFAULT_BUDGET_CONFIG.parentsPct,
    godGivingPct:
      Number(data.godGivingPct) || DEFAULT_BUDGET_CONFIG.godGivingPct,
    weeklyOffering:
      Number(data.weeklyOffering) || DEFAULT_BUDGET_CONFIG.weeklyOffering,
    savePct: Number(data.savePct) || DEFAULT_BUDGET_CONFIG.savePct,
    godProjectsPct:
      Number(data.godProjectsPct) || DEFAULT_BUDGET_CONFIG.godProjectsPct,
    discretionaryPct:
      Number(data.discretionaryPct) || DEFAULT_BUDGET_CONFIG.discretionaryPct,
    currency:
      typeof data.currency === "string" && data.currency
        ? data.currency
        : DEFAULT_BUDGET_CONFIG.currency,
    updatedAt: tsToDate(data.updatedAt),
  };
}

function tsToDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }
  return new Date();
}

export async function ensureUserSeeded(uid: string): Promise<void> {
  const db = getClientDb();
  const userRef = doc(db, userDoc(uid));
  const catsSnap = await getDocs(collection(db, categoriesCol(uid)));
  const budgetRef = doc(db, budgetSettingsDoc(uid));

  await setDoc(
    userRef,
    { createdAt: Timestamp.now(), seededAt: Timestamp.now() },
    { merge: true },
  );

  // Budget config: create defaults if missing (new and existing users).
  const budgetSnap = await getDoc(budgetRef);
  if (!budgetSnap.exists()) {
    await setDoc(budgetRef, {
      ...DEFAULT_BUDGET_CONFIG,
      updatedAt: Timestamp.now(),
    });
  }

  if (catsSnap.empty) {
    const batch = writeBatch(db);
    for (const cat of DEFAULT_CATEGORIES) {
      const ref = doc(collection(db, categoriesCol(uid)));
      batch.set(ref, {
        ...cat,
        archived: false,
        createdAt: Timestamp.now(),
      });
    }
    await batch.commit();
    return;
  }

  // Existing users: ensure dashboard specials exist (Ignore, Income).
  const existing = new Set(
    catsSnap.docs.map((d) =>
      String(d.data().name ?? "")
        .trim()
        .toLowerCase(),
    ),
  );
  const required = DEFAULT_CATEGORIES.filter((cat) => {
    const key = cat.name.trim().toLowerCase();
    return key === "ignore" || key === "income";
  });
  const missing = required.filter(
    (cat) => !existing.has(cat.name.trim().toLowerCase()),
  );
  if (missing.length === 0) return;

  const batch = writeBatch(db);
  for (const cat of missing) {
    const ref = doc(collection(db, categoriesCol(uid)));
    batch.set(ref, {
      ...cat,
      archived: false,
      createdAt: Timestamp.now(),
    });
  }
  await batch.commit();
}

export function listenAccounts(
  uid: string,
  cb: (accounts: Account[]) => void,
): Unsubscribe {
  const db = getClientDb();
  const q = query(collection(db, accountsCol(uid)), orderBy("name"));
  return onSnapshot(q, (snap) => {
    const accounts: Account[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name as string,
        type: data.type as AccountType,
        color: data.color as string,
        archived: Boolean(data.archived),
        createdAt: tsToDate(data.createdAt),
      };
    });
    cb(accounts);
  });
}

export function listenCategories(
  uid: string,
  cb: (categories: Category[]) => void,
): Unsubscribe {
  const db = getClientDb();
  const q = query(collection(db, categoriesCol(uid)), orderBy("name"));
  return onSnapshot(q, (snap) => {
    const categories: Category[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name as string,
        color: data.color as string,
        iconKey: data.iconKey as string | undefined,
        archived: Boolean(data.archived),
        budgetBucket: isBudgetBucket(data.budgetBucket)
          ? data.budgetBucket
          : null,
        createdAt: tsToDate(data.createdAt),
      };
    });
    cb(categories);
  });
}

export function listenBudgetConfig(
  uid: string,
  cb: (config: BudgetConfig) => void,
): Unsubscribe {
  const db = getClientDb();
  const ref = doc(db, budgetSettingsDoc(uid));
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      cb({ ...DEFAULT_BUDGET_CONFIG, updatedAt: new Date() });
      return;
    }
    cb(parseBudgetConfig(snap.data() as Record<string, unknown>));
  });
}

export async function updateBudgetConfig(
  uid: string,
  patch: Partial<Omit<BudgetConfig, "updatedAt">>,
): Promise<void> {
  const db = getClientDb();
  await setDoc(
    doc(db, budgetSettingsDoc(uid)),
    { ...patch, updatedAt: Timestamp.now() },
    { merge: true },
  );
}

export function listenTransactions(
  uid: string,
  cb: (transactions: Transaction[]) => void,
): Unsubscribe {
  const db = getClientDb();
  const q = query(
    collection(db, transactionsCol(uid)),
    orderBy("date", "desc"),
  );
  return onSnapshot(q, (snap) => {
    const transactions: Transaction[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        date: tsToDate(data.date),
        description: data.description as string,
        note: typeof data.note === "string" ? data.note : "",
        income: Number(data.income) || 0,
        expense: Number(data.expense) || 0,
        accountId: data.accountId as string,
        categoryId: (data.categoryId as string | null) ?? null,
        importId: data.importId as string,
        fingerprint: data.fingerprint as string,
        createdAt: tsToDate(data.createdAt),
      };
    });
    cb(transactions);
  });
}

export async function createAccount(
  uid: string,
  input: { name: string; type: AccountType; color: string },
): Promise<string> {
  const db = getClientDb();
  const ref = await addDoc(collection(db, accountsCol(uid)), {
    ...input,
    archived: false,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateAccount(
  uid: string,
  id: string,
  patch: Partial<Pick<Account, "name" | "type" | "color" | "archived">>,
): Promise<void> {
  const db = getClientDb();
  await updateDoc(doc(db, accountsCol(uid), id), patch);
}

export async function deleteAccount(uid: string, id: string): Promise<void> {
  const db = getClientDb();
  await deleteDoc(doc(db, accountsCol(uid), id));
}

export async function createCategory(
  uid: string,
  input: {
    name: string;
    color: string;
    iconKey?: string;
    budgetBucket?: BudgetBucket | null;
  },
): Promise<string> {
  const db = getClientDb();
  const ref = await addDoc(collection(db, categoriesCol(uid)), {
    name: input.name,
    color: input.color,
    iconKey: input.iconKey ?? null,
    budgetBucket: input.budgetBucket ?? null,
    archived: false,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateCategory(
  uid: string,
  id: string,
  patch: Partial<
    Pick<Category, "name" | "color" | "iconKey" | "archived" | "budgetBucket">
  >,
): Promise<void> {
  const db = getClientDb();
  const cleaned: Record<string, unknown> = { ...patch };
  if ("budgetBucket" in patch && patch.budgetBucket === undefined) {
    delete cleaned.budgetBucket;
  }
  if (patch.budgetBucket === null) {
    cleaned.budgetBucket = null;
  }
  await updateDoc(doc(db, categoriesCol(uid), id), cleaned);
}

export async function deleteCategory(uid: string, id: string): Promise<void> {
  const db = getClientDb();
  await deleteDoc(doc(db, categoriesCol(uid), id));
}

export async function updateTransactionCategory(
  uid: string,
  id: string,
  categoryId: string | null,
): Promise<void> {
  const db = getClientDb();
  await updateDoc(doc(db, transactionsCol(uid), id), { categoryId });
}

export async function updateTransactionNote(
  uid: string,
  id: string,
  note: string,
): Promise<void> {
  const db = getClientDb();
  await updateDoc(doc(db, transactionsCol(uid), id), { note: note.trim() });
}

export async function bulkUpdateTransactionCategory(
  uid: string,
  ids: string[],
  categoryId: string | null,
): Promise<void> {
  const db = getClientDb();
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.update(doc(db, transactionsCol(uid), id), { categoryId });
  }
  await batch.commit();
}

export async function deleteTransaction(
  uid: string,
  id: string,
): Promise<void> {
  const db = getClientDb();
  await deleteDoc(doc(db, transactionsCol(uid), id));
}

export async function deleteTransactions(
  uid: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const db = getClientDb();
  const CHUNK = 400;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + CHUNK)) {
      batch.delete(doc(db, transactionsCol(uid), id));
    }
    await batch.commit();
  }
}

async function existingFingerprints(
  uid: string,
  accountId: string,
): Promise<Set<string>> {
  const db = getClientDb();
  const q = query(
    collection(db, transactionsCol(uid)),
    where("accountId", "==", accountId),
  );
  const snap = await getDocs(q);
  return new Set(snap.docs.map((d) => d.data().fingerprint as string));
}

export async function importTransactions(
  uid: string,
  input: {
    filename: string;
    accountId: string;
    mapping: ColumnMapping;
    rows: NormalizedRow[];
  },
): Promise<ImportRecord> {
  const db = getClientDb();
  const existing = await existingFingerprints(uid, input.accountId);
  const importRef = doc(collection(db, importsCol(uid)));

  let importedCount = 0;
  let skippedCount = 0;
  const seen = new Set<string>();

  // Firestore batches max 500 ops; reserve 1 for import doc
  const CHUNK = 400;
  let batch = writeBatch(db);
  let ops = 0;

  const flush = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    ops = 0;
  };

  for (const row of input.rows) {
    const fp = fingerprintRow(row, input.accountId);
    if (existing.has(fp) || seen.has(fp)) {
      skippedCount += 1;
      continue;
    }
    seen.add(fp);
    const txRef = doc(collection(db, transactionsCol(uid)));
    batch.set(txRef, {
      date: Timestamp.fromDate(row.date),
      description: row.description,
      note: row.note?.trim() ?? "",
      income: row.income,
      expense: row.expense,
      accountId: input.accountId,
      categoryId: null,
      importId: importRef.id,
      fingerprint: fp,
      createdAt: Timestamp.now(),
    });
    importedCount += 1;
    ops += 1;
    if (ops >= CHUNK) await flush();
  }

  batch.set(importRef, {
    filename: input.filename,
    accountId: input.accountId,
    mapping: input.mapping,
    rowCount: input.rows.length,
    importedCount,
    skippedCount,
    createdAt: Timestamp.now(),
  });
  ops += 1;
  await flush();

  return {
    id: importRef.id,
    filename: input.filename,
    accountId: input.accountId,
    mapping: input.mapping,
    rowCount: input.rows.length,
    importedCount,
    skippedCount,
    createdAt: new Date(),
  };
}
