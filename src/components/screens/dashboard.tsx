"use client";

import { Landmark, PiggyBank, Scale, TrendingDown, TrendingUp, Vault, Wallet, WalletCards } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { classLabel } from "@/lib/constants";
import { formatINDate, formatINR, formatPct } from "@/lib/format";
import type { PortfolioResult } from "@/lib/types";
import { AllocationCharts } from "../charts";
import { Money, Pct, Stat } from "../ui";

export function DashboardScreen({ data }: { data: PortfolioResult }) {
  const [bucket, setBucket] = useState<string | null>(null);
  const listed = data.holdings.filter((h) => !h.isLiability && (!bucket || h.bucket === bucket));
  const monthDelta = (Number(data.cards.monthlyInvestment) - Number(data.cards.previousMonthInvestment)).toFixed(2);
  return (
    <div className="grid gap-6">
      {data.incomplete ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          Totals exclude holdings without a current value: {data.incompleteNames.join(", ")}. Missing prices are left blank.
        </p>
      ) : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total assets" value={data.cards.totalAssets} icon={<Wallet size={16} />} hint="Sum of recorded asset values. Liabilities are not included. Holdings without a value are omitted." note={data.incomplete ? "Incomplete" : "All recorded assets have a value"} />
        <Stat label="Total liabilities" value={data.cards.totalLiabilities} icon={<Scale size={16} />} hint="Outstanding balances entered as liabilities. A loan is never treated as an investment." />
        <Stat label="Net worth" value={data.cards.netWorth} icon={<Landmark size={16} />} hint="Total recorded assets minus total liabilities." note={data.netWorth.opening ? `Change since ${formatINDate(data.netWorth.opening.date)}: ${data.netWorth.changePct ?? "—"}%` : data.netWorth.openingNote} />
        <Stat label="Total invested" value={data.cards.totalInvested} icon={<Vault size={16} />} hint="Remaining cost of investable holdings. Savings balances and fresh deposits are not profit." note={data.cards.profitPartial ? "Some cost figures are missing" : "Remaining cost basis"} />
        <Stat label="Portfolio value" value={data.cards.portfolioValue} icon={<WalletCards size={16} />} hint="Current value of investable holdings. Savings, cash, and personal-use assets are excluded." note={data.incomplete ? "Excludes missing prices" : undefined} />
        <Stat label="Total profit / loss" value={data.cards.totalProfit} signed icon={Number(data.cards.totalProfit) < 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />} hint="Unrealized result plus realized gains and investment income. The percentage is the absolute return on capital invested, not an annualized return." note={data.cards.totalProfit == null ? "Incomplete" : `Absolute return ${formatPct(data.cards.totalProfitPct, true)}`} />
        <Stat label="Total savings" value={data.cards.totalSavings} icon={<PiggyBank size={16} />} hint="Savings accounts and cash. This is liquidity, not an investment return." note={data.cards.liquidPct ? `${data.cards.liquidPct}% of recorded assets` : undefined} />
        <Stat label="Monthly investment" value={data.cards.monthlyInvestment} icon={<TrendingUp size={16} />} hint="Purchases, SIPs, and contributions recorded this month. This is money invested, not profit." note={`Previous month ${formatINR(data.cards.previousMonthInvestment)}; difference ${formatINR(monthDelta)}`} />
      </section>
      <section className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border bg-card p-4 lg:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Asset allocation</h2>
            <Link href="/allocation" className="text-sm text-primary">Open allocation</Link>
          </div>
          <AllocationCharts slices={data.allocation.total} onSelect={setBucket} />
        </div>
        <div className="rounded-2xl border bg-card p-4 lg:col-span-2">
          <h2 className="font-semibold">Recorded insights</h2>
          {data.insights.length ? (
            <ul className="mt-3 grid gap-3 text-sm leading-6">
              {data.insights.map((item) => (
                <li key={item.id} className="rounded-xl bg-muted/70 px-3 py-2">{item.text}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Add holdings to see allocation, liquidity, and maturity notes based on your records.</p>
          )}
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{bucket ? `Holdings in this allocation` : "Holdings"}</h2>
          {bucket ? <button className="text-sm text-primary" onClick={() => setBucket(null)}>Show all</button> : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Class</th>
                <th className="py-2 font-medium">Value</th>
                <th className="py-2 font-medium">P/L</th>
                <th className="py-2 font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {listed.slice(0, 8).map((h) => (
                <tr key={h.id} className="border-b">
                  <td className="py-2">
                    {h.name}
                    {h.isSample ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900">Sample</span> : null}
                  </td>
                  <td className="py-2">{classLabel(h.assetClass)}</td>
                  <td className="py-2"><Money value={h.currentValue} /><span className="mt-0.5 block text-[11px] text-muted-foreground">{h.valueLabel}</span></td>
                  <td className="py-2"><Money value={h.unrealized} signed /> <Pct value={h.unrealizedPct} signed /></td>
                  <td className="py-2 tabular">{h.allocationPct ? `${h.allocationPct}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!listed.length ? <p className="py-6 text-sm text-muted-foreground">No holdings in this view yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
