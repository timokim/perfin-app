"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import {
  bulkUpdateTransactionCategory,
  deleteTransactions,
  updateTransactionCategory,
  updateTransactionNote,
} from "@/lib/firebase/data";
import { formatDate, formatMoney } from "@/lib/format";
import { CategoryPicker } from "@/components/CategoryPicker";
import { Trash2 } from "lucide-react";

function NoteEditor({
  value,
  onSave,
}: {
  value: string;
  onSave: (note: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  async function commit() {
    const next = draft.trim();
    if (next === value.trim()) return;
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      className="input !mt-1 !py-1 text-xs text-ink-muted"
      placeholder="Add a note…"
      value={draft}
      disabled={saving}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      aria-label="Transaction note"
    />
  );
}

function TransactionsInner() {
  const { user } = useAuth();
  const { transactions, activeAccounts, activeCategories, loading } = useData();
  const searchParams = useSearchParams();
  const [uncategorizedOnly, setUncategorizedOnly] = useState(
    searchParams.get("uncategorized") === "1",
  );
  const [accountFilter, setAccountFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (uncategorizedOnly && t.categoryId) return false;
      if (accountFilter && t.accountId !== accountFilter) return false;
      if (categoryFilter === "none" && t.categoryId) return false;
      if (
        categoryFilter &&
        categoryFilter !== "none" &&
        t.categoryId !== categoryFilter
      ) {
        return false;
      }
      if (query) {
        const q = query.toLowerCase();
        const hay = `${t.description} ${t.note}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    transactions,
    uncategorizedOnly,
    accountFilter,
    categoryFilter,
    query,
  ]);

  const accountMap = useMemo(
    () => new Map(activeAccounts.map((a) => [a.id, a])),
    [activeAccounts],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t) => t.id)));
    }
  }

  async function assignOne(id: string, categoryId: string | null) {
    if (!user) return;
    await updateTransactionCategory(user.uid, id, categoryId);
  }

  async function saveNote(id: string, note: string) {
    if (!user) return;
    await updateTransactionNote(user.uid, id, note);
  }

  async function assignBulk() {
    if (!user || selected.size === 0) return;
    setBusy(true);
    try {
      const categoryId = bulkCategory === "" ? null : bulkCategory;
      await bulkUpdateTransactionCategory(
        user.uid,
        Array.from(selected),
        categoryId,
      );
      setSelected(new Set());
      setBulkCategory("");
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    if (!user || selected.size === 0) return;
    const count = selected.size;
    if (
      !window.confirm(
        `Delete ${count} transaction${count === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteTransactions(user.uid, Array.from(selected));
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-ink-muted">Loading transactions…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="animate-rise">
        <h1 className="font-display text-3xl text-navy">Transactions</h1>
        <p className="mt-1 text-ink-muted">
          Assign categories, add notes, or select rows to bulk-assign or delete.
        </p>
      </div>

      <div className="surface flex flex-wrap items-end gap-3 rounded-2xl p-4 animate-rise stagger-1">
        <div className="min-w-[12rem] flex-1">
          <label className="label" htmlFor="search">
            Search
          </label>
          <input
            id="search"
            className="input"
            placeholder="Merchant, memo, or note…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="acct">
            Account
          </label>
          <select
            id="acct"
            className="select w-auto min-w-[9rem]"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="">All</option>
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cat">
            Category
          </label>
          <select
            id="cat"
            className="select w-auto min-w-[9rem]"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="none">Uncategorized</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            checked={uncategorizedOnly}
            onChange={(e) => setUncategorizedOnly(e.target.checked)}
          />
          Uncategorized only
        </label>
      </div>

      {selected.size > 0 && (
        <div className="surface flex flex-wrap items-center gap-3 rounded-2xl p-4 animate-fade">
          <p className="text-sm font-semibold text-navy">
            {selected.size} selected
          </p>
          <select
            className="select w-auto min-w-[10rem]"
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
          >
            <option value="">Uncategorized</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary !py-2"
            disabled={busy}
            onClick={() => void assignBulk()}
          >
            Assign category
          </button>
          <button
            type="button"
            className="btn btn-ghost !py-2 text-danger"
            disabled={busy}
            onClick={() => void removeSelected()}
          >
            <Trash2 size={16} />
            Delete
          </button>
          <button
            type="button"
            className="btn btn-ghost !py-2"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      <div className="surface overflow-hidden rounded-2xl animate-rise stagger-2">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="bg-paper-deep/60 text-ink-muted">
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={
                      filtered.length > 0 && selected.size === filtered.length
                    }
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-3 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Description</th>
                <th className="px-3 py-3 font-semibold">Account</th>
                <th className="px-3 py-3 font-semibold text-right">Income</th>
                <th className="px-3 py-3 font-semibold text-right">Expense</th>
                <th className="px-3 py-3 font-semibold">Category</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-ink-muted"
                  >
                    No transactions match. Import a CSV or clear filters.
                  </td>
                </tr>
              )}
              {filtered.map((t) => {
                const account = accountMap.get(t.accountId);
                return (
                  <tr
                    key={t.id}
                    className={`border-t border-line ${
                      selected.has(t.id) ? "bg-amber/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 align-top">
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => toggle(t.id)}
                        aria-label={`Select ${t.description}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                      {formatDate(t.date)}
                    </td>
                    <td className="px-3 py-2.5 max-w-[18rem] align-top">
                      <p className="font-medium">{t.description}</p>
                      <NoteEditor
                        key={`${t.id}:${t.note}`}
                        value={t.note}
                        onSave={(note) => saveNote(t.id, note)}
                      />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            background: account?.color ?? "#9ca3af",
                          }}
                        />
                        {account?.name ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-success align-top">
                      {t.income ? formatMoney(t.income) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums align-top">
                      {t.expense ? formatMoney(t.expense) : "—"}
                    </td>
                    <td className="px-3 py-2.5 min-w-[9rem] align-top">
                      <CategoryPicker
                        categories={activeCategories}
                        value={t.categoryId}
                        onChange={(id) => void assignOne(t.id, id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-4 py-3 text-xs text-ink-muted">
          Showing {filtered.length} of {transactions.length} transactions
        </div>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
      <TransactionsInner />
    </Suspense>
  );
}
