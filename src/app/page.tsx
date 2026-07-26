"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function LandingPage() {
  const { user, loading, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/app");
  }, [loading, user, router]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231b3a4b' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 pb-16 pt-8">
        <header className="flex items-center justify-between animate-fade">
          <span className="font-display text-3xl text-navy sm:text-4xl">Outlay</span>
          <Link href="/login" className="btn btn-ghost">
            Sign in
          </Link>
        </header>

        <section className="mt-16 flex flex-1 flex-col justify-center gap-10 lg:mt-0 lg:flex-row lg:items-center lg:gap-16">
          <div className="max-w-xl animate-rise">
            <h1 className="font-display text-5xl leading-[1.05] tracking-tight text-navy sm:text-6xl">
              Outlay
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-muted">
              Drop in bank and credit-card CSVs. Assign categories you define.
              See where the money actually went.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn btn-amber">
                Open your ledger
              </Link>
              {!configured && (
                <span className="self-center text-sm text-ink-muted">
                  Add Firebase env vars to get started
                </span>
              )}
            </div>
          </div>

          <div className="relative w-full max-w-md animate-rise stagger-2">
            <div
              className="absolute -inset-4 rounded-[2rem] opacity-70"
              style={{
                background:
                  "linear-gradient(135deg, rgba(27,58,75,0.35), rgba(217,119,6,0.25))",
              }}
            />
            <div className="relative overflow-hidden rounded-[1.5rem] border border-line bg-navy-deep text-white shadow-2xl">
              <div className="border-b border-white/10 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-soft/90">
                  This month
                </p>
                <p className="font-display mt-1 text-3xl">$2,847.20</p>
              </div>
              <ul className="space-y-3 px-5 py-5 text-sm">
                {[
                  { name: "Food", pct: 72, amount: "$612" },
                  { name: "Home", pct: 55, amount: "$480" },
                  { name: "Transport", pct: 38, amount: "$210" },
                  { name: "Misc", pct: 24, amount: "$95" },
                ].map((row, i) => (
                  <li key={row.name} className={`animate-rise stagger-${i + 1}`}>
                    <div className="mb-1 flex justify-between text-white/80">
                      <span>{row.name}</span>
                      <span>{row.amount}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-amber-soft"
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
