"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { removeHolding } from "@/app/actions";
import { toCsv } from "@/lib/csv";
import { ASSET_CLASSES, classLabel } from "@/lib/constants";
import { formatINDate, formatQty } from "@/lib/format";
import type { HoldingView, PortfolioResult, TxnRow } from "@/lib/types";
import { HoldingForm } from "../holding-form";
import { LoanPaymentForm, TransactionForm } from "../txn-form";
import { Dialog, Empty, ErrorNote, Money, Pct, fieldClass } from "../ui";

export function HoldingsScreen({ data, initialBucket = "" }: { data: PortfolioResult; initialBucket?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [assetClass, setAssetClass] = useState(initialBucket);
  const [sort, setSort] = useState("value");
  const [editing, setEditing] = useState<HoldingView | null | "new">(null);
  const [history, setHistory] = useState<HoldingView | null>(null);
  const [addingTxn, setAddingTxn] = useState<HoldingView | null>(null);
  const [loanPay, setLoanPay] = useState<{ loan: HoldingView; mode: "emi" | "lump_sum" } | null>(null);
  const [removing, setRemoving] = useState<HoldingView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = data.holdings.filter((h) => {
      const matchesQuery = !q || h.name.toLowerCase().includes(q) || h.ticker.toLowerCase().includes(q);
      const matchesClass = !assetClass || h.assetClass === assetClass || h.bucket === assetClass;
      return matchesQuery && matchesClass;
    });
    const dir = (n: number) => n;
    filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "allocation") return dir(Number(b.allocationPct || -1) - Number(a.allocationPct || -1));
      if (sort === "return") return dir(Number(b.unrealizedPct || -9999) - Number(a.unrealizedPct || -9999));
      return dir(Number(b.currentValue || -1) - Number(a.currentValue || -1));
    });
    return filtered;
  }, [data.holdings, query, assetClass, sort]);

  function exportCsv() {
    const csv = toCsv([
      ["Name", "Class", "Quantity", "Invested", "Price", "Value", "P/L", "P/L %", "Allocation %", "Value basis", "Updated"],
      ...rows.map((h) => [h.name, classLabel(h.assetClass), h.quantity, h.invested, h.currentPrice, h.currentValue, h.unrealized, h.unrealizedPct, h.allocationPct, h.valueLabel, h.updatedAt.slice(0, 10)]),
    ]);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "holdings.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className={fieldClass + " max-w-xs"} placeholder="Search name or ticker" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search holdings" />
        <select className={fieldClass + " max-w-xs"} value={assetClass} onChange={(e) => setAssetClass(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {ASSET_CLASSES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <select className={fieldClass + " max-w-[180px]"} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort holdings">
          <option value="value">Sort by value</option>
          <option value="allocation">Sort by allocation</option>
          <option value="return">Sort by return</option>
          <option value="name">Sort by name</option>
        </select>
        <button className="h-10 rounded-lg border px-3 text-sm" onClick={exportCsv}>Export CSV</button>
        <button className="h-10 rounded-lg bg-primary px-3 text-sm text-primary-foreground" onClick={() => setEditing("new")}>Add asset</button>
      </div>
      {!data.holdings.length ? (
        <Empty title="No holdings yet" body="Add a stock, fund, deposit, account, property, or liability. Nothing is prefilled as your portfolio." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {["Asset", "Class", "Qty", "Invested", "Price / valuation", "Value", "P/L ₹", "P/L %", "Allocation", "Updated", "Actions"].map((h) => (
                  <th key={h} className="px-3 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id} className="border-b align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium">{h.name} {h.isSample ? <span className="text-[10px] text-amber-700">Sample</span> : null}</p>
                    <p className="text-xs text-muted-foreground">{[h.ticker, h.exchange, h.accountRefMasked].filter(Boolean).join(" · ")}</p>
                    {h.loan ? (
                      <p className="text-xs text-muted-foreground">
                        EMI <Money value={h.loan.scheduledEmi} /> · paid <Money value={h.loan.emiPaid} /> · lump sums <Money value={h.loan.lumpSumPaid} />
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">{classLabel(h.assetClass)}</td>
                  <td className="px-3 py-3 tabular">{formatQty(h.quantity)}</td>
                  <td className="px-3 py-3"><Money value={h.invested} /></td>
                  <td className="px-3 py-3">
                    <span className="tabular">{h.currentPrice || "—"}</span>
                    <span className="block text-[11px] text-muted-foreground">{h.valueLabel}{h.priceUpdatedAt ? ` · ${formatINDate(h.priceUpdatedAt.slice(0, 10))}` : ""}</span>
                  </td>
                  <td className="px-3 py-3"><Money value={h.currentValue} /></td>
                  <td className="px-3 py-3"><Money value={h.unrealized} signed /></td>
                  <td className="px-3 py-3"><Pct value={h.unrealizedPct} signed /></td>
                  <td className="px-3 py-3 tabular">{h.allocationPct ? `${h.allocationPct}%` : "—"}</td>
                  <td className="px-3 py-3">{formatINDate(h.updatedAt.slice(0, 10))}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button className="underline" onClick={() => setEditing(h)}>Edit</button>
                      {h.isLiability ? (
                        <>
                          <button className="underline" onClick={() => setLoanPay({ loan: h, mode: "emi" })}>EMI</button>
                          <button className="underline" onClick={() => setLoanPay({ loan: h, mode: "lump_sum" })}>Lump sum</button>
                        </>
                      ) : null}
                      <button className="underline" onClick={() => setHistory(h)}>History</button>
                      <button className="underline" onClick={() => setAddingTxn(h)}>Add txn</button>
                      <button className="text-rose-700 underline" onClick={() => setRemoving(h)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing ? (
        <Dialog title={editing === "new" ? "Add asset" : `Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <HoldingForm
            initial={editing === "new" ? null : editing.form}
            quantityLocked={editing !== "new" && data.transactions.filter((t) => t.holdingId === editing.id && ["buy", "sip", "opening", "sell", "redemption", "contribution", "withdrawal"].includes(t.type)).length > 1}
            computedQuantity={editing === "new" ? null : editing.quantity}
            computedAvgCost={editing === "new" ? null : editing.avgCost}
            onDone={() => { setEditing(null); router.refresh(); }}
          />
        </Dialog>
      ) : null}
      {loanPay ? (
        <Dialog title={loanPay.mode === "emi" ? `EMI for ${loanPay.loan.name}` : `Lump sum for ${loanPay.loan.name}`} onClose={() => setLoanPay(null)}>
          <LoanPaymentForm loan={loanPay.loan} mode={loanPay.mode} onDone={() => { setLoanPay(null); router.refresh(); }} />
        </Dialog>
      ) : null}
      {addingTxn ? (
        <Dialog title={`Transaction for ${addingTxn.name}`} onClose={() => setAddingTxn(null)}>
          <TransactionForm holdings={data.holdings} initialHoldingId={addingTxn.id} onDone={() => { setAddingTxn(null); router.refresh(); }} />
        </Dialog>
      ) : null}
      {history ? (
        <Dialog title={`${history.name} transactions`} onClose={() => setHistory(null)}>
          <HistoryList txns={data.transactions.filter((t) => t.holdingId === history.id)} />
          {history.warnings.map((w) => <p key={w} className="mt-2 text-sm text-amber-800">{w}</p>)}
        </Dialog>
      ) : null}
      {removing ? (
        <Dialog title={`Delete ${removing.name}`} onClose={() => setRemoving(null)}>
          <p className="mb-3 text-sm">This removes the holding and its transactions. This cannot be undone.</p>
          <ErrorNote error={error} />
          <button
            className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-sm text-white"
            onClick={async () => {
              const form = new FormData();
              form.set("id", removing.id);
              form.set("confirm", "yes");
              const result = await removeHolding(form);
              if (!result.ok) setError(result.error);
              else {
                setRemoving(null);
                router.refresh();
              }
            }}
          >
            Delete holding
          </button>
        </Dialog>
      ) : null}
    </div>
  );
}

function HistoryList({ txns }: { txns: TxnRow[] }) {
  if (!txns.length) return <p className="text-sm text-muted-foreground">No transactions recorded for this holding.</p>;
  return (
    <ul className="grid gap-2 text-sm">
      {txns.map((t) => (
        <li key={t.id} className="rounded-lg border px-3 py-2">
          <span className="font-medium">{t.type === "emi" ? "EMI" : t.type === "lump_sum" ? "Lump sum" : t.type}</span> · {formatINDate(t.date)} · <Money value={t.amount} />
          {t.type === "emi" || t.type === "lump_sum" || t.type === "repayment" ? <span> · principal <Money value={Number(t.price) ? t.price : t.amount} /></span> : null}
          {Number(t.quantity) ? ` · ${formatQty(t.quantity)} units` : ""}
          {t.notes ? <span className="block text-muted-foreground">{t.notes}</span> : null}
        </li>
      ))}
    </ul>
  );
}
