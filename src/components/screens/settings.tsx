"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearSampleData, importBackup, importHoldingsCsv, loadSampleData, refreshPrices } from "@/app/actions";
import { formatINDate } from "@/lib/format";
import type { AuditRow } from "@/lib/types";
import { ErrorNote, fieldClass, submitClass } from "../ui";

export function SettingsScreen({ refreshedAt, audit }: { refreshedAt: string; audit: AuditRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(work: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await work();
    setPending(false);
    if (!result.ok) setError(result.error || "Request failed.");
    else setMessage(result.message || "Saved.");
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <Section title="Market prices">
        <p className="text-sm text-muted-foreground">
          Equity prices are requested from Yahoo Finance. Mutual fund NAVs are requested from AMFI using the scheme code. A failed request leaves the stored price unchanged. Prices are called “last fetched”, not live.
          {refreshedAt ? ` Last successful refresh: ${formatINDate(refreshedAt.slice(0, 10))} ${refreshedAt.slice(11, 16)} UTC.` : " No market refresh has succeeded yet."}
        </p>
        <button className={submitClass(pending)} disabled={pending} onClick={() => run(() => refreshPrices())}>Refresh prices</button>
      </Section>
      <Section title="Demonstration data">
        <p className="text-sm text-muted-foreground">Sample rows are labeled and are not your portfolio. Your own records are kept when you remove the sample.</p>
        <div className="flex flex-wrap gap-2">
          <button className="h-10 rounded-lg border px-3 text-sm" onClick={() => run(() => loadSampleData())}>Load labeled sample</button>
          <button className="h-10 rounded-lg border px-3 text-sm" onClick={() => run(() => clearSampleData())}>Remove sample</button>
        </div>
      </Section>
      <Section title="Import holdings CSV">
        <p className="text-sm text-muted-foreground">Columns: asset_class, name, ticker, quantity, avg_cost, current_price, current_value, currency, fx_rate, purchase_date, institution, principal, interest_rate, start_date, maturity_date.</p>
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); run(() => importHoldingsCsv(new FormData(e.currentTarget))); }}>
          <input className="text-sm" type="file" name="file" accept=".csv,text/csv" required aria-label="Holdings CSV" />
          <button className="h-10 rounded-lg border px-3 text-sm">Import</button>
        </form>
      </Section>
      <Section title="Backup">
        <p className="text-sm text-muted-foreground">Records are stored in a SQLite database at data/portfolio.sqlite on this machine. Download a JSON backup before moving computers.</p>
        <a className="inline-flex h-10 items-center rounded-lg border px-3 text-sm" href="/api/backup">Download backup</a>
        <form className="mt-3 grid gap-2" onSubmit={(e) => { e.preventDefault(); run(() => importBackup(new FormData(e.currentTarget))); }}>
          <input type="file" name="file" accept="application/json,.json" required aria-label="Backup JSON" />
          <select name="mode" className={fieldClass + " max-w-xs"} defaultValue="merge" aria-label="Import mode">
            <option value="merge">Merge into current data</option>
            <option value="replace">Replace all data</option>
          </select>
          <input name="confirmReplace" className={fieldClass + " max-w-xs"} placeholder="Type REPLACE to overwrite" />
          <button className="h-10 w-fit rounded-lg border px-3 text-sm">Import backup</button>
        </form>
      </Section>
      <Section title="How figures are calculated">
        <ul className="grid list-disc gap-2 pl-5 text-sm text-muted-foreground">
          <li>Unrealized result = current value − remaining average cost. It is separate from realized gains.</li>
          <li>Absolute return includes realized gains and income, divided by capital invested. It is not annualized.</li>
          <li>XIRR uses dated cash flows. If dates are missing, the page says “Insufficient transaction data”.</li>
          <li>Deposit projections are estimates. An amount you type is labeled as entered.</li>
          <li>A property loan reduces net worth only when it is also saved as a liability.</li>
          <li>Transfers between your accounts are not income or expenses.</li>
        </ul>
      </Section>
      <Section title="Recent changes">
        {audit.length ? (
          <ul className="grid gap-2 text-sm">
            {audit.map((row) => (
              <li key={row.id} className="border-b py-1">{formatINDate(row.createdAt.slice(0, 10))} · {row.summary}</li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Edits and deletions are listed here.</p>}
      </Section>
      <ErrorNote error={error} />
      {message ? <p className="text-sm text-emerald-800 dark:text-emerald-200">{message}</p> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}
