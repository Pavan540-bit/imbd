"use client";

import {
  ArrowLeftRight,
  Briefcase,
  Eye,
  EyeOff,
  FileText,
  Landmark,
  LayoutDashboard,
  Menu,
  Moon,
  PieChart,
  Settings,
  Sun,
  Target,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { usePrivacy } from "./providers";

const ICONS = {
  "/": LayoutDashboard,
  "/holdings": Briefcase,
  "/transactions": ArrowLeftRight,
  "/allocation": PieChart,
  "/performance": TrendingUp,
  "/cashflow": Wallet,
  "/networth": Landmark,
  "/goals": Target,
  "/reports": FileText,
  "/settings": Settings,
} as const;

const CRUMBS: Record<string, string> = {
  "/": "Dashboard",
  "/holdings": "My Holdings",
  "/transactions": "Transactions",
  "/allocation": "Asset Allocation",
  "/performance": "Performance",
  "/cashflow": "Income & Expenses",
  "/networth": "Net Worth",
  "/goals": "Financial Goals",
  "/reports": "Reports",
  "/settings": "Settings",
};

export function Shell({ children, hasSample }: { children: React.ReactNode; hasSample: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { hidden, toggle } = usePrivacy();
  const { resolvedTheme, setTheme } = useTheme();
  const title = CRUMBS[pathname] || "Portfolio";

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Primary">
      {NAV.map((item) => {
        const Icon = ICONS[item.href];
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={16} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="px-5 py-5">
          <p className="text-xs uppercase tracking-[0.16em] text-sidebar-foreground/60">India · INR</p>
          <p className="mt-1 text-lg font-semibold">Portfolio</p>
        </div>
        {nav}
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden" role="presentation">
          <button className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col bg-sidebar text-sidebar-foreground">
            <div className="flex items-center justify-between px-4 py-4">
              <p className="font-semibold">Portfolio</p>
              <button aria-label="Close menu" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-lg border p-2 md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
              <Menu size={16} />
            </button>
            <div>
              <p className="text-xs text-muted-foreground">{pathname === "/" ? "Home" : "Dashboard"}</p>
              <h1 className="text-lg font-semibold leading-tight">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border px-3 py-2 text-sm" onClick={toggle} aria-pressed={hidden}>
              {hidden ? <EyeOff size={16} className="inline" /> : <Eye size={16} className="inline" />}
              <span className="ml-2 hidden sm:inline">{hidden ? "Show balances" : "Hide balances"}</span>
            </button>
            <button
              className="rounded-lg border p-2"
              aria-label="Toggle color theme"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>
        {hasSample ? (
          <div className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100 md:px-6">
            Demonstration data is included and labeled Sample. These figures are not your portfolio. Remove them in Settings.
          </div>
        ) : null}
        <main className="px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}
