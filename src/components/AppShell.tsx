"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Upload,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/app/import", label: "Import", icon: Upload },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, configured, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && configured && !user) {
      router.replace("/login");
    }
  }, [loading, configured, user, router]);

  if (!configured) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center animate-rise">
        <h1 className="font-display text-3xl text-navy">Firebase not configured</h1>
        <p className="mt-3 text-ink-muted">
          Copy <code className="text-navy">.env.example</code> to{" "}
          <code className="text-navy">.env.local</code> and add your Firebase web
          config. See the README for setup steps.
        </p>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted animate-fade">
        Loading your ledger…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-[rgba(232,238,242,0.85)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/app" className="font-display text-2xl tracking-tight text-navy">
            Outlay
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/app"
                  ? pathname === "/app"
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-navy text-white"
                      : "text-ink-muted hover:bg-white/60 hover:text-navy"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            className="btn btn-ghost !py-2 !px-3 text-sm"
            onClick={() => signOut().then(() => router.push("/"))}
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-line/60 px-2 py-2 md:hidden">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/app"
                ? pathname === "/app"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                  active ? "bg-navy text-white" : "text-ink-muted"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
