"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import {
  listenAccounts,
  listenBudgetConfig,
  listenCategories,
  listenTransactions,
} from "@/lib/firebase/data";
import {
  DEFAULT_BUDGET_CONFIG,
  type Account,
  type BudgetConfig,
  type Category,
  type Transaction,
} from "@/lib/types";

interface DataContextValue {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgetConfig: BudgetConfig;
  loading: boolean;
  activeAccounts: Account[];
  activeCategories: Category[];
}

const DataContext = createContext<DataContextValue | null>(null);

const EMPTY: DataContextValue = {
  accounts: [],
  categories: [],
  transactions: [],
  budgetConfig: { ...DEFAULT_BUDGET_CONFIG, updatedAt: new Date(0) },
  loading: false,
  activeAccounts: [],
  activeCategories: [],
};

function AuthenticatedDataProvider({
  uid,
  children,
}: {
  uid: string;
  children: ReactNode;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig>({
    ...DEFAULT_BUDGET_CONFIG,
    updatedAt: new Date(0),
  });
  const [ready, setReady] = useState({
    a: false,
    c: false,
    t: false,
    b: false,
  });

  useEffect(() => {
    const unsubA = listenAccounts(uid, (a) => {
      setAccounts(a);
      setReady((r) => ({ ...r, a: true }));
    });
    const unsubC = listenCategories(uid, (c) => {
      setCategories(c);
      setReady((r) => ({ ...r, c: true }));
    });
    const unsubT = listenTransactions(uid, (t) => {
      setTransactions(t);
      setReady((r) => ({ ...r, t: true }));
    });
    const unsubB = listenBudgetConfig(uid, (b) => {
      setBudgetConfig(b);
      setReady((r) => ({ ...r, b: true }));
    });
    return () => {
      unsubA();
      unsubC();
      unsubT();
      unsubB();
    };
  }, [uid]);

  const value = useMemo(() => {
    const activeAccounts = accounts.filter((a) => !a.archived);
    const activeCategories = categories.filter((c) => !c.archived);
    return {
      accounts,
      categories,
      transactions,
      budgetConfig,
      loading: !(ready.a && ready.c && ready.t && ready.b),
      activeAccounts,
      activeCategories,
    };
  }, [accounts, categories, transactions, budgetConfig, ready]);

  return (
    <DataContext.Provider value={value}>{children}</DataContext.Provider>
  );
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <DataContext.Provider value={EMPTY}>{children}</DataContext.Provider>
    );
  }

  return (
    <AuthenticatedDataProvider uid={user.uid}>
      {children}
    </AuthenticatedDataProvider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
