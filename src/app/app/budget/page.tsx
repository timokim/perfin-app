"use client";

import Link from "next/link";
import { useMemo } from "react";
import { computeBudget } from "@/lib/budget/compute";
import { useData } from "@/lib/data-context";
import { formatDate, formatMoney } from "@/lib/format";
import { AlertCircle, PiggyBank } from "lucide-react";

function toneForDue(due: number): string {
  if (due > 0.005) return "text-danger";
  if (due < -0.005) return "text-success";
  return "text-ink-muted";
}

export default function BudgetPage() {
  const { transactions, categories, budgetConfig, loading } = useData();

  const budget = useMemo(
    () => computeBudget(transactions, categories, budgetConfig, new Date()),
    [transactions, categories, budgetConfig],
  );

  const mappedCount = categories.filter(
    (c) => !c.archived && c.budgetBucket,
  ).length;

  if (loading) {
    return <p className="text-ink-muted animate-fade">Loading budget…</p>;
  }

  const discretionary = budget.split.find((s) => s.bucket === "discretionary");

  return (
    <div className="space-y-8">
      <div className="animate-rise">
        <h1 className="font-display text-3xl text-navy">Budget</h1>
        <p className="mt-1 text-ink-muted">
          Lifetime allocation from first Income-category deposit through today.
          Giving obligations use Income only (refunds excluded). Weekly 헌금 is{" "}
          {formatMoney(budgetConfig.weeklyOffering)} × weeks since first income.
        </p>
        {budget.firstIncomeDate && (
          <p className="mt-2 text-sm text-ink-muted">
            First income {formatDate(budget.firstIncomeDate)} ·{" "}
            {budget.weeks} week{budget.weeks === 1 ? "" : "s"} counted
          </p>
        )}
      </div>

      {!budget.firstIncomeDate && (
        <div className="surface flex items-start gap-3 rounded-2xl p-5 animate-rise stagger-1">
          <AlertCircle className="mt-0.5 shrink-0 text-amber" size={22} />
          <div>
            <p className="font-semibold text-navy">No Income categorized yet</p>
            <p className="mt-1 text-sm text-ink-muted">
              Assign paycheques to the{" "}
              <span className="font-semibold">Income</span> category so gross
              income and giving targets can be calculated.{" "}
              <Link
                href="/app/transactions"
                className="font-semibold text-navy underline"
              >
                Open transactions
              </Link>
            </p>
          </div>
        </div>
      )}

      {mappedCount === 0 && (
        <div className="surface flex items-start gap-3 rounded-2xl p-5 animate-rise stagger-1">
          <PiggyBank className="mt-0.5 shrink-0 text-amber" size={22} />
          <div>
            <p className="font-semibold text-navy">Map categories to buckets</p>
            <p className="mt-1 text-sm text-ink-muted">
              In Settings, assign categories to tithe, living costs, savings,
              etc. so paid amounts show up here.{" "}
              <Link
                href="/app/settings"
                className="font-semibold text-navy underline"
              >
                Open settings
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-rise stagger-2">
        {[
          {
            label: "Gross income",
            value: formatMoney(budget.grossIncome),
            tone: "text-success",
          },
          {
            label: "Living spent",
            value: formatMoney(budget.livingActual),
            tone: "text-navy",
          },
          {
            label: "Remaining",
            value: formatMoney(budget.remaining),
            tone: budget.remaining >= 0 ? "text-success" : "text-danger",
          },
          {
            label: "Discretionary (65%)",
            value: formatMoney(discretionary?.target ?? 0),
            tone: "text-navy",
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

      {budget.discretionaryOver && discretionary && (
        <div className="surface rounded-2xl border border-amber/40 bg-amber/5 p-4 animate-rise stagger-2">
          <p className="font-semibold text-navy">Discretionary over target</p>
          <p className="mt-1 text-sm text-ink-muted">
            You have spent {formatMoney(discretionary.actual)} of the{" "}
            {formatMoney(discretionary.target)} free-use allowance — consider
            cutting non-essential spend.
          </p>
        </div>
      )}

      <section className="surface rounded-2xl p-5 sm:p-6 animate-rise stagger-3">
        <h2 className="font-display text-xl text-navy">Giving obligations</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Owed from lifetime Income; paid from categorized spend in each bucket.
          Positive “still due” means you haven’t caught up yet.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th className="pb-2 font-semibold">Bucket</th>
                <th className="pb-2 text-right font-semibold">Owed</th>
                <th className="pb-2 text-right font-semibold">Paid</th>
                <th className="pb-2 text-right font-semibold">Still due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {budget.obligations.map((row) => (
                <tr key={row.bucket}>
                  <td className="py-3 font-semibold text-ink">{row.label}</td>
                  <td className="py-3 text-right tabular-nums text-ink-muted">
                    {formatMoney(row.owed)}
                  </td>
                  <td className="py-3 text-right tabular-nums text-ink-muted">
                    {formatMoney(row.paid)}
                  </td>
                  <td
                    className={`py-3 text-right tabular-nums font-semibold ${toneForDue(row.due)}`}
                  >
                    {formatMoney(row.due)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface rounded-2xl p-5 sm:p-6 animate-rise stagger-3">
        <h2 className="font-display text-xl text-navy">생계유지 (Living)</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Actual net spend in living buckets. Higher living costs shrink what is
          left for savings and discretionary use.
        </p>
        <ul className="mt-5 space-y-3">
          {budget.livingLines.map((row) => (
            <li
              key={row.bucket}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="font-semibold text-ink">{row.label}</span>
              <span className="tabular-nums text-ink-muted">
                {formatMoney(row.actual)}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
            <span className="font-semibold text-navy">Total living</span>
            <span className="font-display text-lg tabular-nums text-navy">
              {formatMoney(budget.livingActual)}
            </span>
          </li>
        </ul>
      </section>

      <section className="surface rounded-2xl p-5 sm:p-6 animate-rise stagger-3">
        <h2 className="font-display text-xl text-navy">Of the remaining</h2>
        <p className="mt-1 text-sm text-ink-muted">
          After giving targets and living spend: 30% save, 5% God projects, 65%
          free use. “Room left” is target minus actual categorized spend.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th className="pb-2 font-semibold">Split</th>
                <th className="pb-2 text-right font-semibold">Target</th>
                <th className="pb-2 text-right font-semibold">Actual</th>
                <th className="pb-2 text-right font-semibold">Room left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {budget.split.map((row) => (
                <tr key={row.bucket}>
                  <td className="py-3 font-semibold text-ink">{row.label}</td>
                  <td className="py-3 text-right tabular-nums text-ink-muted">
                    {formatMoney(row.target)}
                  </td>
                  <td className="py-3 text-right tabular-nums text-ink-muted">
                    {formatMoney(row.actual)}
                  </td>
                  <td
                    className={`py-3 text-right tabular-nums font-semibold ${toneForDue(row.remaining)}`}
                  >
                    {formatMoney(row.remaining)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
