"use client";

import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import {
  createAccount,
  createCategory,
  deleteAccount,
  deleteCategory,
  updateAccount,
  updateCategory,
} from "@/lib/firebase/data";
import {
  ACCOUNT_COLORS,
  ACCOUNT_TYPE_LABELS,
  CATEGORY_COLORS,
  type AccountType,
} from "@/lib/types";
import { Pencil, Plus, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { accounts, categories } = useData();
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("checking");
  const [accountColor, setAccountColor] = useState(ACCOUNT_COLORS[0]);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name)),
    [accounts],
  );
  const sortedCategories = useMemo(
    () =>
      [...categories].sort(
        (a, b) =>
          Number(a.archived) - Number(b.archived) ||
          a.name.localeCompare(b.name),
      ),
    [categories],
  );

  async function addAccount(e: FormEvent) {
    e.preventDefault();
    if (!user || !accountName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createAccount(user.uid, {
        name: accountName.trim(),
        type: accountType,
        color: accountColor,
      });
      setAccountName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    if (!user || !categoryName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createCategory(user.uid, {
        name: categoryName.trim(),
        color: categoryColor,
      });
      setCategoryName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setBusy(false);
    }
  }

  async function renameAccount(id: string, current: string) {
    if (!user) return;
    const next = window.prompt("Account name", current);
    if (!next || !next.trim() || next.trim() === current) return;
    await updateAccount(user.uid, id, { name: next.trim() });
  }

  async function renameCategory(id: string, current: string) {
    if (!user) return;
    const next = window.prompt("Category name", current);
    if (!next || !next.trim() || next.trim() === current) return;
    await updateCategory(user.uid, id, { name: next.trim() });
  }

  return (
    <div className="space-y-10">
      <div className="animate-rise">
        <h1 className="font-display text-3xl text-navy">Settings</h1>
        <p className="mt-1 text-ink-muted">
          Define the accounts and spending categories you assign to transactions.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <section className="surface rounded-2xl p-5 sm:p-6 animate-rise stagger-1">
        <h2 className="font-display text-xl text-navy">Accounts</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Chequing, credit cards, savings — whatever you import against.
        </p>

        <form
          onSubmit={addAccount}
          className="mt-5 grid gap-3 sm:grid-cols-[1fr_10rem_auto_auto] sm:items-end"
        >
          <div>
            <label className="label" htmlFor="acct-name">
              Name
            </label>
            <input
              id="acct-name"
              className="input"
              placeholder="Amex Cobalt"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="acct-type">
              Type
            </label>
            <select
              id="acct-type"
              className="select"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
            >
              {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex gap-1.5">
              {ACCOUNT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  className={`h-8 w-8 rounded-full border-2 ${
                    accountColor === c ? "border-navy" : "border-transparent"
                  }`}
                  style={{ background: c }}
                  onClick={() => setAccountColor(c)}
                />
              ))}
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <Plus size={16} />
            Add
          </button>
        </form>

        <ul className="mt-6 divide-y divide-line">
          {sortedAccounts.length === 0 && (
            <li className="py-6 text-center text-ink-muted">
              No accounts yet. Add one above.
            </li>
          )}
          {sortedAccounts.map((a) => (
            <li
              key={a.id}
              className={`flex items-center gap-3 py-3 ${a.archived ? "opacity-50" : ""}`}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: a.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{a.name}</p>
                <p className="text-xs text-ink-muted">
                  {ACCOUNT_TYPE_LABELS[a.type]}
                  {a.archived ? " · archived" : ""}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost !px-2 !py-2"
                onClick={() => renameAccount(a.id, a.name)}
                title="Rename"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="btn btn-ghost !px-2 !py-2"
                onClick={() =>
                  user &&
                  updateAccount(user.uid, a.id, { archived: !a.archived })
                }
              >
                {a.archived ? "Restore" : "Archive"}
              </button>
              <button
                type="button"
                className="btn btn-ghost !px-2 !py-2 text-danger"
                onClick={() => {
                  if (
                    user &&
                    window.confirm(`Delete account “${a.name}”?`)
                  ) {
                    deleteAccount(user.uid, a.id);
                  }
                }}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface rounded-2xl p-5 sm:p-6 animate-rise stagger-2">
        <h2 className="font-display text-xl text-navy">Categories</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Food, Home, Utility, Misc — yours to define and edit.
        </p>

        <form
          onSubmit={addCategory}
          className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
        >
          <div>
            <label className="label" htmlFor="cat-name">
              Name
            </label>
            <input
              id="cat-name"
              className="input"
              placeholder="Groceries"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  className={`h-8 w-8 rounded-full border-2 ${
                    categoryColor === c ? "border-navy" : "border-transparent"
                  }`}
                  style={{ background: c }}
                  onClick={() => setCategoryColor(c)}
                />
              ))}
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <Plus size={16} />
            Add
          </button>
        </form>

        <ul className="mt-6 divide-y divide-line">
          {sortedCategories.map((c) => (
            <li
              key={c.id}
              className={`flex items-center gap-3 py-3 ${c.archived ? "opacity-50" : ""}`}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: c.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                {c.archived && (
                  <p className="text-xs text-ink-muted">archived</p>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost !px-2 !py-2"
                onClick={() => renameCategory(c.id, c.name)}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="btn btn-ghost !px-2 !py-2"
                onClick={() =>
                  user &&
                  updateCategory(user.uid, c.id, { archived: !c.archived })
                }
              >
                {c.archived ? "Restore" : "Archive"}
              </button>
              <button
                type="button"
                className="btn btn-ghost !px-2 !py-2 text-danger"
                onClick={() => {
                  if (
                    user &&
                    window.confirm(`Delete category “${c.name}”?`)
                  ) {
                    deleteCategory(user.uid, c.id);
                  }
                }}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
