"use client";

import { useState } from "react";
import { ImportCsvPanel } from "@/components/ImportCsvPanel";
import { ManualTransactionForm } from "@/components/ManualTransactionForm";
import { FileSpreadsheet, PenLine } from "lucide-react";

type Mode = "csv" | "manual";

export default function AddTransactionsPage() {
  const [mode, setMode] = useState<Mode>("csv");

  return (
    <div className="space-y-8">
      <div className="animate-rise">
        <h1 className="font-display text-3xl text-navy">Add</h1>
        <p className="mt-1 text-ink-muted">
          Import a bank CSV or enter a transaction by hand.
        </p>
      </div>

      <div
        className="surface inline-flex rounded-xl p-1 animate-rise stagger-1"
        role="tablist"
        aria-label="How to add transactions"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "csv"}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            mode === "csv"
              ? "bg-navy text-white"
              : "text-ink-muted hover:text-navy"
          }`}
          onClick={() => setMode("csv")}
        >
          <FileSpreadsheet size={16} />
          Import CSV
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "manual"}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            mode === "manual"
              ? "bg-navy text-white"
              : "text-ink-muted hover:text-navy"
          }`}
          onClick={() => setMode("manual")}
        >
          <PenLine size={16} />
          Manual entry
        </button>
      </div>

      <div className="animate-rise stagger-2">
        {mode === "csv" ? <ImportCsvPanel /> : <ManualTransactionForm />}
      </div>
    </div>
  );
}
