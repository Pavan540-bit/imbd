"use client";

import { useMemo, useState } from "react";
import { toCsv } from "@/lib/csv";
import { classLabel } from "@/lib/constants";
import { formatINDate, formatINR } from "@/lib/format";
import { financialYearRange, listRealizations, summarizeCashflow } from "@/lib/portfolio";
import type { PortfolioResult } from "@/lib/types";
import { fieldClass } from "../ui";

const REPORTS = [
  { id: "monthly", label: "Monthly portfolio summary" },
  { id: "annual", label: "Annual investment summary" },
  { id: "allocation", label: "Asset allocation" },
  { id: "equity", label: "Equity holdings" },
  { id: "funds", label: "Mutual funds" },
  { id: "fd", label: "FD maturity" },
  { id: "cash", label: "Income and expenses" },
  { id: "networth", label: "Net-worth statement" },
  { id: "gains", label: "Capital gains" },
] as const;

export function ReportsScreen({ data }: { data: PortfolioResult }) {
  const fy = financialYearRange(data.asOf);
  const [report, setReport] = useState<(typeof REPORTS)[number]["id"]>("monthly");
  const [from, setFrom] = useState(fy.from);
  const [to, setTo] = useState(data.asOf);
  const content = useMemo(() => build(data, report, from, to), [data, report, from, to]);

  function exportCsv() {
    const csv = toCsv(content.rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <select className={fieldClass + " max-w-xs"} value={report} onChange={(e) => setReport(e.target.value as typeof report)} aria-label="Report">
          {REPORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <input className={fieldClass + " max-w-[160px]"} type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <input className={fieldClass + " max-w-[160px]"} type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        <button className="h-10 rounded-lg border px-3 text-sm" onClick={() => { setFrom(fy.from); setTo(fy.to); }}> {fy.label}</button>
        <button className="h-10 rounded-lg border px-3 text-sm" onClick={exportCsv}>Export CSV</button>
      </div>
      <p className="text-sm text-muted-foreground">{content.note}</p>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <tbody>
            {content.rows.map((row, index) => (
              <tr key={index} className={index === 0 ? "border-b text-left text-muted-foreground" : "border-b"}>
                {row.map((cell, cellIndex) => index === 0 ? <th key={cellIndex} className="px-3 py-2 font-medium">{cell}</th> : <td key={cellIndex} className="px-3 py-2">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function build(data: PortfolioResult, report: string, from: string, to: string): { note: string; rows: string[][] } {
  if (report === "allocation") {
    return {
      note: "Current allocation of recorded values. This is not a historical reconstruction.",
      rows: [["Category", "Value", "Share %"], ...data.allocation.total.map((s) => [s.label, formatINR(s.value), s.pct])],
    };
  }
  if (report === "equity" || report === "funds") {
    const cls = report === "equity" ? "equity" : "mutual_fund";
    const rows = data.holdings.filter((h) => h.assetClass === cls);
    return {
      note: "Current holdings. Prices are manual unless a market refresh stored one.",
      rows: [["Name", "Symbol", "Quantity", "Invested", "Value", "Unrealized", "Basis"], ...rows.map((h) => [h.name, h.ticker, h.quantity || "", formatINR(h.invested), formatINR(h.currentValue), formatINR(h.unrealized), h.valueLabel])],
    };
  }
  if (report === "fd") {
    const rows = data.holdings.filter((h) => h.assetClass === "fd");
    return {
      note: "Projected interest and maturity stay labeled as estimates unless you entered the bank's figures.",
      rows: [["Name", "Institution", "Principal", "Value", "Value basis", "Accrued", "Accrued basis", "Maturity", "Maturity basis", "Maturity date"], ...rows.map((h) => [h.name, h.institution, formatINR(h.invested), formatINR(h.currentValue), h.valueLabel, formatINR(h.fd?.accrued), h.fd?.accruedLabel || "", formatINR(h.fd?.maturity), h.fd?.maturityLabel || "", formatINDate(h.maturityDate)])],
    };
  }
  if (report === "cash") {
    const summary = summarizeCashflow(data.transactions, from, to);
    return {
      note: `Recorded cash flow from ${formatINDate(from)} to ${formatINDate(to)}. Transfers are excluded from income and expenses.`,
      rows: [
        ["Item", "Amount"],
        ["Income", formatINR(summary.income)],
        ["Expenses", formatINR(summary.expense)],
        ["Surplus", formatINR(summary.surplus)],
        ["Savings rate %", summary.savingsRate ?? ""],
        ["Investment contributions", formatINR(summary.invested)],
        ["Withdrawals", formatINR(summary.withdrawals)],
        ["Transfers", formatINR(summary.transfers)],
        ...summary.byCategory.map((c) => [`${c.kind}: ${c.category}`, formatINR(c.amount)]),
      ],
    };
  }
  if (report === "gains") {
    const gains = listRealizations(data.holdings.map((h) => h.form), data.transactions, from, to);
    return {
      note: "Realized result of recorded sales in the date range, using average cost. This is not a tax computation.",
      rows: [["Date", "Holding", "Proceeds", "Cost removed", "Realized P/L"], ...gains.map((g) => [formatINDate(g.date), g.name, formatINR(g.proceeds), formatINR(g.cost), formatINR(g.profit)])],
    };
  }
  if (report === "networth") {
    const snaps = data.snapshots.filter((s) => s.date >= from && s.date <= to);
    return {
      note: "Saved snapshots only. Months without a snapshot are omitted.",
      rows: [["Date", "Assets", "Liabilities", "Net worth", "Note"], ...snaps.map((s) => [formatINDate(s.date), formatINR(s.totalAssets), formatINR(s.totalLiabilities), formatINR(s.netWorth), s.note]), ["Today (live, not a snapshot)", formatINR(data.cards.totalAssets), formatINR(data.cards.totalLiabilities), formatINR(data.cards.netWorth), data.incomplete ? "Incomplete values excluded" : ""]],
    };
  }
  if (report === "annual") {
    const summary = summarizeCashflow(data.transactions, from, to);
    const gains = listRealizations(data.holdings.map((h) => h.form), data.transactions, from, to);
    const realized = gains.reduce((sum, g) => sum + Number(g.profit), 0).toFixed(2);
    return {
      note: "Uses transactions dated in the selected range. Portfolio market values are current, not reconstructed for the year.",
      rows: [
        ["Item", "Amount"],
        ["Contributions", formatINR(summary.invested)],
        ["Withdrawals", formatINR(summary.withdrawals)],
        ["Dividends, interest, and other income", formatINR(summary.income)],
        ["Realized P/L on sales", formatINR(realized)],
        ["Current investable value", formatINR(data.cards.portfolioValue)],
      ],
    };
  }
  return {
    note: `Current portfolio as of ${formatINDate(data.asOf)}. A past month is not reconstructed unless you saved a snapshot.`,
    rows: [
      ["Item", "Amount"],
      ["Total assets", formatINR(data.cards.totalAssets)],
      ["Total liabilities", formatINR(data.cards.totalLiabilities)],
      ["Net worth", formatINR(data.cards.netWorth)],
      ["Invested", formatINR(data.cards.totalInvested)],
      ["Portfolio value", formatINR(data.cards.portfolioValue)],
      ["Absolute P/L", formatINR(data.cards.totalProfit)],
      ...data.holdings.map((h) => [h.name, `${classLabel(h.assetClass)} · ${formatINR(h.currentValue)} · ${h.valueLabel}`]),
    ],
  };
}
