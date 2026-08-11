"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarRange, ChevronDown } from "lucide-react";
import {
  endOfDay,
  formatDateRangeLabel,
  parseDateInputValue,
  rangeForPreset,
  startOfDay,
  toDateInputValue,
  type DateRangePresetId,
  type DateRangeValue,
} from "@/lib/format";

const QUICK_PRESETS: {
  id: Exclude<DateRangePresetId, "custom" | `month:${string}`>;
  label: string;
}[] = [
  { id: "last_30", label: "Last 30 days" },
  { id: "last_60", label: "Last 60 days" },
  { id: "mtd", label: "Month to date" },
  { id: "ytd", label: "Year to date" },
];

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  /** Calendar months available as presets, newest first (YYYY-MM). */
  monthOptions: string[];
}

export function DateRangePicker({
  value,
  onChange,
  monthOptions,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(toDateInputValue(value.start));
  const [draftEnd, setDraftEnd] = useState(toDateInputValue(value.end));
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    setDraftStart(toDateInputValue(value.start));
    setDraftEnd(toDateInputValue(value.end));
  }, [open, value.start, value.end]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }

    function updatePosition() {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const panelWidth = panel?.offsetWidth || Math.min(window.innerWidth - 16, 352);
      const left = Math.min(
        Math.max(8, rect.right - panelWidth),
        window.innerWidth - panelWidth - 8,
      );
      setPanelPos({
        top: rect.bottom + 8,
        left,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function applyPreset(preset: Exclude<DateRangePresetId, "custom">) {
    onChange(rangeForPreset(preset));
    setOpen(false);
  }

  function applyCustom() {
    const startRaw = parseDateInputValue(draftStart);
    const endRaw = parseDateInputValue(draftEnd);
    if (!startRaw || !endRaw) return;
    const start = startOfDay(startRaw);
    const end = endOfDay(endRaw);
    if (start > end) return;
    onChange({ start, end, preset: "custom" });
    setOpen(false);
  }

  const activePreset = value.preset;

  const panel =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label="Select time range"
        className="fixed z-[1000] w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-line bg-[#f7fafc] shadow-[0_16px_40px_rgba(15,36,48,0.18)] animate-fade"
        style={{
          top: panelPos?.top ?? -9999,
          left: panelPos?.left ?? -9999,
          visibility: panelPos ? "visible" : "hidden",
        }}
      >
        <div className="grid sm:grid-cols-[11rem_1fr]">
          <div className="border-b border-line bg-[#f7fafc] p-2 sm:border-b-0 sm:border-r">
            <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Quick ranges
            </p>
            <ul className="space-y-0.5">
              {QUICK_PRESETS.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium transition ${
                      activePreset === p.id
                        ? "bg-navy text-white"
                        : "text-ink hover:bg-paper-deep/70"
                    }`}
                    onClick={() => applyPreset(p.id)}
                  >
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>

            {monthOptions.length > 0 && (
              <>
                <p className="mt-3 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Months
                </p>
                <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                  {monthOptions.map((m) => {
                    const id = `month:${m}` as const;
                    return (
                      <li key={m}>
                        <button
                          type="button"
                          className={`w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium tabular-nums transition ${
                            activePreset === id
                              ? "bg-navy text-white"
                              : "text-ink hover:bg-paper-deep/70"
                          }`}
                          onClick={() => applyPreset(id)}
                        >
                          {m}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          <div className="bg-[#f7fafc] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Custom
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="label" htmlFor="range-start">
                  Start
                </label>
                <input
                  id="range-start"
                  type="date"
                  className="input"
                  value={draftStart}
                  max={draftEnd || undefined}
                  onChange={(e) => setDraftStart(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="range-end">
                  End
                </label>
                <input
                  id="range-end"
                  type="date"
                  className="input"
                  value={draftEnd}
                  min={draftStart || undefined}
                  onChange={(e) => setDraftEnd(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={applyCustom}
                disabled={!draftStart || !draftEnd || draftStart > draftEnd}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="relative" ref={rootRef}>
      <label className="label" htmlFor="date-range-trigger">
        Time range
      </label>
      <button
        ref={triggerRef}
        id="date-range-trigger"
        type="button"
        className="btn btn-ghost !justify-between gap-3 min-w-[14rem]"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex items-center gap-2">
          <CalendarRange size={16} className="shrink-0 text-ink-muted" />
          <span className="tabular-nums">{formatDateRangeLabel(value)}</span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-ink-muted transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {panel}
    </div>
  );
}
