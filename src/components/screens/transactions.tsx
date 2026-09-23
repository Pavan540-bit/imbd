"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeTransaction } from "@/app/actions";
import { classLabel } from "@/lib/constants";
import { formatINDate } from "@/lib/format";
import type { PortfolioResult } from "@/lib/types";
import { TransactionForm } from "../txn-form";
import { Dialog, Empty, Money, fieldClass } from "../ui";

export function TransactionsScreen({ data }: { data: PortfolioResult }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("");
  const [month, setMonth] = useState("");
  const rows = data.transactions.filter((t) => (!kind || (t.cashflowKind || t.type) === kind) && (!month || t.date.startsWith(month)));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <select className={fieldClass + " max-w-xs"} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter transactions">
          <option value="">All treatments</option>
          <option value="income">Income</option>
          <option value="expense">Expenses</option>
          <option value="investment">Contributions</option>
          <option value="proceeds">Sales and withdrawals</option>
          <option value="transfer">Transfers</option>
        </select>
        <input className={fieldClass + " max-w-[180px]"} type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Filter by month" />
        <button className="h-10 rounded-lg bg-primary px-3 text-sm text-primary-foreground" onClick={() => setOpen(true)}>Add transaction</button>
      </div>
      <p className="text-sm text-muted-foreground">Transfers between your own accounts are stored separately and are not counted as income or expenses.</p>
      {!rows.length ? <Empty title="No transactions" body="Purchases, SIPs, dividends, salary, and household expenses recorded here drive cost, XIRR, and cash flow." /> : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {["Date", "Type", "Holding", "Amount", "Treatment", "Notes", ""].map((h) => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const holding = data.holdings.find((h) => h.id === t.holdingId);
                return (
                  <tr key={t.id} className="border-b">
                    <td className="px-3 py-3">{formatINDate(t.date)}</td>
                    <td className="px-3 py-3">{t.type}</td>
                    <td className="px-3 py-3">{holding ? `${holding.name}` : "—"}{holding ? <span className="block text-xs text-muted-foreground">{classLabel(holding.assetClass)}</span> : null}</td>
                    <td className="px-3 py-3"><Money value={t.amount} /></td>
                    <td className="px-3 py-3">{t.cashflowKind || t.type}</td>
                    <td className="px-3 py-3 text-muted-foreground">{t.notes}</td>
                    <td className="px-3 py-3">
                      <button
                        className="text-xs text-rose-700 underline"
                        onClick={async () => {
                          if (!window.confirm("Delete this transaction?")) return;
                          const form = new FormData();
                          form.set("id", t.id);
                          form.set("confirm", "yes");
                          await removeTransaction(form);
                          router.refresh();
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {open ? (
        <Dialog title="Add transaction" onClose={() => setOpen(false)}>
          <TransactionForm holdings={data.holdings} onDone={() => { setOpen(false); router.refresh(); }} />
        </Dialog>
      ) : null}
    </div>
  );
}
