"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { createManualTransaction } from "@/lib/firebase/data";
import {
  parseDateInputValue,
  startOfDay,
  toDateInputValue,
} from "@/lib/format";
import { ACCOUNT_TYPE_LABELS, isSpecialCategoryName } from "@/lib/types";
import { CheckCircle2 } from "lucide-react";

type Kind = "expense" | "income";

export function ManualTransactionForm() {
  const { user } = useAuth();
  const { activeAccounts, activeCategories } = useData();
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () =>
      activeCategories.filter(
        (c) => !isSpecialCategoryName(c.name, "ignore"),
      ),
    [activeCategories],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSavedId(null);

    const parsedDate = parseDateInputValue(date);
    if (!parsedDate) {
      setError("Enter a valid date.");
      return;
    }
    if (!description.trim()) {
      setError("Enter a description.");
      return;
    }
    if (!accountId) {
      setError("Choose an account.");
      return;
    }
    const value = Number(amount.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    setBusy(true);
    try {
      const id = await createManualTransaction(user.uid, {
        date: startOfDay(parsedDate),
        description: description.trim(),
        note: note.trim() || undefined,
        accountId,
        categoryId: categoryId || null,
        income: kind === "income" ? value : 0,
        expense: kind === "expense" ? value : 0,
      });
      setSavedId(id);
      setDescription("");
      setNote("");
      setAmount("");
      setCategoryId("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save transaction",
      );
    } finally {
      setBusy(false);
    }
  }

  if (activeAccounts.length === 0) {
    return (
      <div className="surface rounded-2xl p-6">
        <p className="font-semibold text-navy">Add an account first</p>
        <p className="mt-1 text-sm text-ink-muted">
          Manual entries need an account (cash, wallet, etc.).
        </p>
        <Link href="/app/settings" className="btn btn-primary mt-4">
          Open settings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl text-navy">Manual entry</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Record cash, transfers, or anything that never shows up on a bank
          CSV.
        </p>
      </div>

      {savedId && (
        <div className="surface flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 size={20} />
            <p className="font-semibold">Transaction saved</p>
          </div>
          <Link
            href="/app/transactions"
            className="btn btn-ghost !py-2 text-sm"
          >
            View transactions
          </Link>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className="surface grid gap-4 rounded-2xl p-5 sm:p-6 sm:grid-cols-2"
      >
        <div>
          <label className="label" htmlFor="manual-date">
            Date
          </label>
          <input
            id="manual-date"
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="manual-account">
            Account
          </label>
          <select
            id="manual-account"
            className="select"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
          >
            <option value="">Select account…</option>
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({ACCOUNT_TYPE_LABELS[a.type]})
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="manual-description">
            Description
          </label>
          <input
            id="manual-description"
            className="input"
            placeholder="Cash for farmers market"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div>
          <span className="label">Type</span>
          <div className="mt-2 flex gap-2">
            {(
              [
                { id: "expense", label: "Expense" },
                { id: "income", label: "Income" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`btn flex-1 !py-2 ${
                  kind === opt.id ? "btn-primary" : "btn-ghost"
                }`}
                onClick={() => setKind(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="manual-amount">
            Amount
          </label>
          <input
            id="manual-amount"
            className="input"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="manual-category">
            Category
          </label>
          <select
            id="manual-category"
            className="select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Uncategorized</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="manual-note">
            Note
          </label>
          <input
            id="manual-note"
            className="input"
            placeholder="Optional"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save transaction"}
          </button>
        </div>
      </form>
    </div>
  );
}
