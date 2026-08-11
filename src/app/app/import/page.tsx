"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { parseCsvFile } from "@/lib/csv/parse";
import { inferColumnMapping } from "@/lib/csv/infer";
import { fingerprintRow, normalizeRow } from "@/lib/csv/normalize";
import { importTransactions } from "@/lib/firebase/data";
import { formatDate, formatMoney } from "@/lib/format";
import type { AmountMode, ColumnMapping, NormalizedRow } from "@/lib/types";
import { CheckCircle2, FileSpreadsheet, Upload, X } from "lucide-react";

type Step = "upload" | "map" | "preview" | "done";

type PreviewRow = NormalizedRow & {
  sourceIndex: number;
  fingerprint: string;
  /** Already in Firestore for this account. */
  alreadyImported: boolean;
  /** Same fingerprint appears earlier in this CSV. */
  duplicateInFile: boolean;
};

const AMOUNT_MODE_LABELS: Record<AmountMode, string> = {
  signed: "Single amount (signed +/-)",
  expense_only: "Single amount (charges positive)",
  debit_credit: "Debit + Credit columns",
  income_expense: "Income + Expense columns",
};

export default function ImportPage() {
  const { user } = useAuth();
  const { activeAccounts, transactions } = useData();
  const [step, setStep] = useState<Step>("upload");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [accountId, setAccountId] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);

  const existingFingerprints = useMemo(() => {
    if (!accountId) return new Set<string>();
    return new Set(
      transactions
        .filter((t) => t.accountId === accountId)
        .map((t) => t.fingerprint),
    );
  }, [transactions, accountId]);

  const allNormalized = useMemo((): PreviewRow[] => {
    if (!mapping) return [];
    const out: PreviewRow[] = [];
    const seenInFile = new Set<string>();
    // Fingerprints need an account; before one is chosen, treat rows as not-yet-imported.
    const accountKey = accountId || "__pending__";
    rows.forEach((row, sourceIndex) => {
      const n = normalizeRow(row, mapping);
      if (!n) return;
      const fp = fingerprintRow(n, accountKey);
      const duplicateInFile = seenInFile.has(fp);
      seenInFile.add(fp);
      out.push({
        ...n,
        sourceIndex,
        note: notes[sourceIndex] ?? "",
        fingerprint: fp,
        alreadyImported: Boolean(accountId) && existingFingerprints.has(fp),
        duplicateInFile,
      });
    });
    return out;
  }, [rows, mapping, notes, accountId, existingFingerprints]);

  const included = useMemo(
    () => allNormalized.filter((r) => !excluded.has(r.sourceIndex)),
    [allNormalized, excluded],
  );

  const newToImport = useMemo(
    () =>
      included.filter((r) => !r.alreadyImported && !r.duplicateInFile),
    [included],
  );

  const alreadyImportedCount = useMemo(
    () => included.filter((r) => r.alreadyImported).length,
    [included],
  );

  const duplicateInFileCount = useMemo(
    () =>
      included.filter((r) => !r.alreadyImported && r.duplicateInFile).length,
    [included],
  );

  const onFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const parsed = await parseCsvFile(file);
      if (!parsed.headers.length || !parsed.rows.length) {
        throw new Error("CSV looks empty. Check the file and try again.");
      }
      const inferred = inferColumnMapping(parsed.headers, parsed.rows);
      setFilename(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(inferred);
      setExcluded(new Set());
      setNotes({});
      setStep("map");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read CSV");
    }
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void onFile(file);
  }

  async function runImport() {
    if (!user || !mapping || !accountId || newToImport.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const record = await importTransactions(user.uid, {
        filename,
        accountId,
        mapping,
        rows: newToImport.map(
          ({
            sourceIndex: _s,
            fingerprint: _f,
            alreadyImported: _a,
            duplicateInFile: _d,
            ...row
          }) => row,
        ),
      });
      setResult({
        imported: record.importedCount,
        skipped:
          record.skippedCount +
          alreadyImportedCount +
          duplicateInFileCount,
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep("upload");
    setFilename("");
    setHeaders([]);
    setRows([]);
    setMapping(null);
    setAccountId("");
    setResult(null);
    setError(null);
    setExcluded(new Set());
    setNotes({});
  }

  function updateMapping<K extends keyof ColumnMapping>(
    key: K,
    value: ColumnMapping[K],
  ) {
    setMapping((m) => (m ? { ...m, [key]: value } : m));
  }

  function removeRow(sourceIndex: number) {
    setExcluded((prev) => new Set(prev).add(sourceIndex));
  }

  function restoreRemoved() {
    setExcluded(new Set());
  }

  function setNote(sourceIndex: number, note: string) {
    setNotes((prev) => ({ ...prev, [sourceIndex]: note }));
  }

  return (
    <div className="space-y-8">
      <div className="animate-rise">
        <h1 className="font-display text-3xl text-navy">Import CSV</h1>
        <p className="mt-1 text-ink-muted">
          Outlay infers date, description, and amount columns — confirm the
          mapping, trim rows, add notes, then import. Re-importing the same
          file skips duplicates.
        </p>
      </div>

      {activeAccounts.length === 0 && (
        <div className="surface rounded-2xl p-5">
          <p className="font-semibold text-navy">Create an account first</p>
          <p className="mt-1 text-sm text-ink-muted">
            Imports are attributed to an account you define (Amex, TD, etc.).
          </p>
          <Link href="/app/settings" className="btn btn-primary mt-4">
            Go to settings
          </Link>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {step === "upload" && (
        <div
          className={`surface rounded-2xl border-2 border-dashed p-10 text-center transition animate-rise stagger-1 ${
            dragOver
              ? "border-amber bg-amber/5"
              : "border-line hover:border-navy/40"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <Upload className="mx-auto text-navy" size={36} />
          <p className="mt-4 font-semibold text-navy">
            Drop a CSV here, or choose a file
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Works with Amex, Wealthsimple, TD, and most bank exports.
          </p>
          <label className="btn btn-amber mt-6 cursor-pointer">
            <FileSpreadsheet size={16} />
            Choose CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </label>
        </div>
      )}

      {step === "map" && mapping && (
        <div className="space-y-6 animate-rise">
          <div className="surface rounded-2xl p-5 sm:p-6">
            <p className="text-sm text-ink-muted">
              File: <span className="font-semibold text-ink">{filename}</span> ·{" "}
              {rows.length} rows
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="map-date">
                  Date column
                </label>
                <select
                  id="map-date"
                  className="select"
                  value={mapping.date}
                  onChange={(e) => updateMapping("date", e.target.value)}
                >
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="map-desc">
                  Description column
                </label>
                <select
                  id="map-desc"
                  className="select"
                  value={mapping.description}
                  onChange={(e) => updateMapping("description", e.target.value)}
                >
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="map-mode">
                  Amount shape
                </label>
                <select
                  id="map-mode"
                  className="select"
                  value={mapping.amountMode}
                  onChange={(e) =>
                    updateMapping("amountMode", e.target.value as AmountMode)
                  }
                >
                  {(Object.keys(AMOUNT_MODE_LABELS) as AmountMode[]).map(
                    (m) => (
                      <option key={m} value={m}>
                        {AMOUNT_MODE_LABELS[m]}
                      </option>
                    ),
                  )}
                </select>
                <p className="mt-1.5 text-xs text-ink-muted">
                  Balance / running-total columns are ignored automatically.
                </p>
              </div>

              {(mapping.amountMode === "signed" ||
                mapping.amountMode === "expense_only") && (
                <div>
                  <label className="label" htmlFor="map-amount">
                    Amount column
                  </label>
                  <select
                    id="map-amount"
                    className="select"
                    value={mapping.amount ?? ""}
                    onChange={(e) => updateMapping("amount", e.target.value)}
                  >
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {mapping.amountMode === "debit_credit" && (
                <>
                  <div>
                    <label className="label" htmlFor="map-debit">
                      Debit / withdrawal
                    </label>
                    <select
                      id="map-debit"
                      className="select"
                      value={mapping.debit ?? ""}
                      onChange={(e) => updateMapping("debit", e.target.value)}
                    >
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="map-credit">
                      Credit / deposit
                    </label>
                    <select
                      id="map-credit"
                      className="select"
                      value={mapping.credit ?? ""}
                      onChange={(e) => updateMapping("credit", e.target.value)}
                    >
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {mapping.amountMode === "income_expense" && (
                <>
                  <div>
                    <label className="label" htmlFor="map-income">
                      Income column
                    </label>
                    <select
                      id="map-income"
                      className="select"
                      value={mapping.income ?? ""}
                      onChange={(e) => updateMapping("income", e.target.value)}
                    >
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="map-expense">
                      Expense column
                    </label>
                    <select
                      id="map-expense"
                      className="select"
                      value={mapping.expense ?? ""}
                      onChange={(e) => updateMapping("expense", e.target.value)}
                    >
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="sm:col-span-2">
                <label className="label" htmlFor="map-account">
                  Account for these rows
                </label>
                <select
                  id="map-account"
                  className="select"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  required
                >
                  <option value="">Select account…</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!accountId || allNormalized.length === 0}
                onClick={() => setStep("preview")}
              >
                Review {allNormalized.length} rows
              </button>
            </div>
            {allNormalized.length === 0 && (
              <p className="mt-3 text-sm text-amber">
                No rows could be normalized with this mapping. Adjust columns
                and try again.
              </p>
            )}
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4 animate-rise">
          <div className="surface overflow-hidden rounded-2xl">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="font-display text-xl text-navy">Review</h2>
                <p className="text-sm text-ink-muted">
                  <span className="font-semibold text-navy">
                    {newToImport.length} new
                  </span>
                  {alreadyImportedCount > 0
                    ? ` · ${alreadyImportedCount} already imported`
                    : ""}
                  {duplicateInFileCount > 0
                    ? ` · ${duplicateInFileCount} duplicate in file`
                    : ""}
                  {excluded.size > 0 ? ` · ${excluded.size} removed` : ""}. Add
                  notes for opaque bank memos; remove junk rows before
                  importing.
                </p>
              </div>
              {excluded.size > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost !py-2 text-sm"
                  onClick={restoreRemoved}
                >
                  Restore removed
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="bg-paper-deep/60 text-ink-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold">Note</th>
                    <th className="px-4 py-3 font-semibold text-right">Income</th>
                    <th className="px-4 py-3 font-semibold text-right">
                      Expense
                    </th>
                    <th className="px-4 py-3 font-semibold text-right">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {included.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-12 text-center text-ink-muted"
                      >
                        All rows removed. Restore some to continue.
                      </td>
                    </tr>
                  )}
                  {included.map((row) => {
                    const isNew =
                      !row.alreadyImported && !row.duplicateInFile;
                    return (
                      <tr
                        key={row.sourceIndex}
                        className={`border-t border-line ${
                          isNew ? "" : "bg-paper-deep/25 text-ink-muted"
                        }`}
                      >
                        <td className="px-4 py-2.5 whitespace-nowrap align-top">
                          {row.alreadyImported ? (
                            <span className="text-xs font-semibold text-ink-muted">
                              Already imported
                            </span>
                          ) : row.duplicateInFile ? (
                            <span className="text-xs font-semibold text-amber">
                              Duplicate in file
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-success">
                              New
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap align-top">
                          {formatDate(row.date)}
                        </td>
                        <td className="px-4 py-2.5 max-w-[14rem] align-top font-medium">
                          <span className="line-clamp-2">{row.description}</span>
                        </td>
                        <td className="px-4 py-2 align-top">
                          {isNew ? (
                            <input
                              className="input !py-1.5 text-sm"
                              placeholder="Add a note…"
                              value={row.note ?? ""}
                              onChange={(e) =>
                                setNote(row.sourceIndex, e.target.value)
                              }
                              aria-label={`Note for ${row.description}`}
                            />
                          ) : (
                            <span className="text-xs">—</span>
                          )}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right tabular-nums align-top ${
                            isNew ? "text-success" : ""
                          }`}
                        >
                          {row.income ? formatMoney(row.income) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums align-top">
                          {row.expense ? formatMoney(row.expense) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right align-top">
                          <button
                            type="button"
                            className="inline-flex rounded-md p-1.5 text-ink-muted hover:bg-red-50 hover:text-danger"
                            onClick={() => removeRow(row.sourceIndex)}
                            aria-label={`Remove ${row.description}`}
                            title="Remove row"
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep("map")}
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn-amber"
              disabled={busy || newToImport.length === 0}
              onClick={() => void runImport()}
            >
              {busy
                ? "Importing…"
                : newToImport.length === 0
                  ? "Nothing new to import"
                  : `Import ${newToImport.length} new transaction${newToImport.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="surface rounded-2xl p-8 text-center animate-rise">
          <CheckCircle2 className="mx-auto text-success" size={40} />
          <h2 className="font-display mt-4 text-2xl text-navy">Import complete</h2>
          <p className="mt-2 text-ink-muted">
            Added {result.imported} transactions
            {result.skipped > 0
              ? ` · skipped ${result.skipped} duplicates (same date, amount, and description for this account)`
              : ""}
            .
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/app/transactions?uncategorized=1" className="btn btn-primary">
              Categorize them
            </Link>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
