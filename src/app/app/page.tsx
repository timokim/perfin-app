"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useData } from "@/lib/data-context";
import {
  currentMonthKey,
  formatMoney,
  monthKey,
  parseMonthKey,
} from "@/lib/format";
import { AlertCircle, Upload } from "lucide-react";

export default function DashboardPage() {
  const { transactions, categories, accounts, loading } = useData();
  const [month, setMonth] = useState(currentMonthKey());

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    keys.add(currentMonthKey());
    for (const tx of transactions) keys.add(monthKey(tx.date));
    return Array.from(keys).sort().reverse();
  }, [transactions]);

  const stats = useMemo(() => {
    const { start, end } = parseMonthKey(month);
    const inMonth = transactions.filter(
      (t) => t.date >= start && t.date <= end,
    );
    let income = 0;
    let expense = 0;
    let uncategorized = 0;
    const byCategory = new Map<string | null, number>();

    for (const t of inMonth) {
      income += t.income;
      expense += t.expense;
      if (!t.categoryId && t.expense > 0) uncategorized += 1;
      if (t.expense > 0) {
        const key = t.categoryId;
        byCategory.set(key, (byCategory.get(key) ?? 0) + t.expense);
      }
    }

    const categoryRows = Array.from(byCategory.entries())
      .map(([id, amount]) => {
        const cat = id
          ? categories.find((c) => c.id === id)
          : null;
        return {
          id,
          name: cat?.name ?? "Uncategorized",
          color: cat?.color ?? "#9ca3af",
          amount,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const max = categoryRows[0]?.amount ?? 1;

    return {
      income,
      expense,
      net: income - expense,
      uncategorized,
      count: inMonth.length,
      categoryRows,
      max,
      hasAccounts: accounts.some((a) => !a.archived),
    };
  }, [transactions, categories, accounts, month]);

  if (loading) {
    return <p className="text-ink-muted animate-fade">Loading dashboard…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 animate-rise">
        <div>
          <h1 className="font-display text-3xl text-navy">Dashboard</h1>
          <p className="mt-1 text-ink-muted">
            Spending by category for the month you pick.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="month">
            Month
          </label>
          <select
            id="month"
            className="select w-auto min-w-[10rem]"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!stats.hasAccounts && (
        <div className="surface flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 animate-rise stagger-1">
          <div>
            <p className="font-semibold text-navy">Add an account first</p>
            <p className="text-sm text-ink-muted">
              Create Amex, TD Chequing, etc. before importing CSVs.
            </p>
          </div>
          <Link href="/app/settings" className="btn btn-primary">
            Open settings
          </Link>
        </div>
      )}

      {stats.uncategorized > 0 && (
        <Link
          href="/app/transactions?uncategorized=1"
          className="surface flex items-center gap-3 rounded-2xl p-4 transition hover:bg-white/80 animate-rise stagger-1"
        >
          <AlertCircle className="text-amber shrink-0" size={22} />
          <div className="flex-1">
            <p className="font-semibold text-navy">
              Review {stats.uncategorized} uncategorized{" "}
              {stats.uncategorized === 1 ? "transaction" : "transactions"}
            </p>
            <p className="text-sm text-ink-muted">
              Assign categories so your dashboard stays accurate.
            </p>
          </div>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-3 animate-rise stagger-2">
        {[
          { label: "Income", value: formatMoney(stats.income), tone: "text-success" },
          { label: "Expenses", value: formatMoney(stats.expense), tone: "text-navy" },
          {
            label: "Net",
            value: formatMoney(stats.net),
            tone: stats.net >= 0 ? "text-success" : "text-danger",
          },
        ].map((card) => (
          <div key={card.label} className="surface rounded-2xl p-5">
            <p className="text-sm font-semibold text-ink-muted">{card.label}</p>
            <p className={`font-display mt-2 text-3xl ${card.tone}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <section className="surface rounded-2xl p-5 sm:p-6 animate-rise stagger-3">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-navy">Spend by category</h2>
          <Link href="/app/import" className="btn btn-ghost !py-2 text-sm">
            <Upload size={16} />
            Import CSV
          </Link>
        </div>

        {stats.categoryRows.length === 0 ? (
          <p className="py-8 text-center text-ink-muted">
            No expenses this month yet.{" "}
            <Link href="/app/import" className="font-semibold text-navy underline">
              Import a CSV
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <ul className="space-y-4">
            {stats.categoryRows.map((row) => (
              <li key={row.id ?? "uncategorized"}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold text-ink">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: row.color }}
                    />
                    {row.name}
                  </span>
                  <span className="tabular-nums text-ink-muted">
                    {formatMoney(row.amount)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-paper-deep">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(4, (row.amount / stats.max) * 100)}%`,
                      background: row.color,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
