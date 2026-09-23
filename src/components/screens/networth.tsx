"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeSnapshot, saveSnapshot } from "@/app/actions";
import { formatINDate, formatPct } from "@/lib/format";
import type { PortfolioResult } from "@/lib/types";
import { NetWorthChart } from "../charts";
import { ErrorNote, Money, fieldClass, submitClass } from "../ui";

export function NetWorthScreen({ data }: { data: PortfolioResult }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [view, setView] = useState<"all" | "year">("all");
  const year = data.asOf.slice(0, 4);
  const saved = data.snapshots.filter((s) => view === "all" || s.date.startsWith(year));
  const points = saved.map((s) => ({ date: s.date, value: Number(s.netWorth), kind: "Saved snapshot" }));
  if (data.cards.netWorth && !saved.some((s) => s.date === data.asOf)) {
    points.push({ date: data.asOf, value: Number(data.cards.netWorth), kind: "Today, from current records — not a saved snapshot" });
  }
  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border bg-card p-4"><h2 className="text-sm text-muted-foreground">Current net worth</h2><p className="mt-2 text-xl font-semibold"><Money value={data.cards.netWorth} /></p></article>
        <article className="rounded-2xl border bg-card p-4"><h2 className="text-sm text-muted-foreground">Start of year</h2><p className="mt-2 text-xl font-semibold"><Money value={data.netWorth.opening?.value} /></p><p className="text-xs text-muted-foreground">{data.netWorth.openingNote}</p></article>
        <article className="rounded-2xl border bg-card p-4"><h2 className="text-sm text-muted-foreground">Change</h2><p className="mt-2 text-xl font-semibold"><Money value={data.netWorth.change} signed /></p></article>
        <article className="rounded-2xl border bg-card p-4"><h2 className="text-sm text-muted-foreground">Percentage change</h2><p className="mt-2 text-xl font-semibold tabular">{formatPct(data.netWorth.changePct, true)}</p></article>
      </section>
      <div className="flex gap-2">
        <button className={`rounded-full border px-3 py-1 text-sm ${view === "all" ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setView("all")}>All snapshots</button>
        <button className={`rounded-full border px-3 py-1 text-sm ${view === "year" ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setView("year")}>{year}</button>
      </div>
      <div className="rounded-2xl border bg-card p-4">
        <NetWorthChart points={points} />
        <p className="mt-2 text-xs text-muted-foreground">Only saved snapshots are history. Today’s bar is the live total and is labeled so it is not read as a past balance.</p>
      </div>
      <form
        className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[160px_1fr_auto]"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          const form = new FormData(event.currentTarget);
          let result = await saveSnapshot(form);
          if (!result.ok && result.error.includes("already exists")) {
            if (window.confirm(result.error)) {
              form.set("confirmReplace", "yes");
              result = await saveSnapshot(form);
            }
          }
          setPending(false);
          if (!result.ok) setError(result.error);
          else router.refresh();
        }}
      >
        <input className={fieldClass} type="date" name="date" defaultValue={data.asOf} aria-label="Snapshot date" />
        <input className={fieldClass} name="note" placeholder="Note (optional)" />
        <button className={submitClass(pending)} disabled={pending}>Save snapshot</button>
        <div className="sm:col-span-3"><ErrorNote error={error} /></div>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Saved snapshots">
          {saved.length ? saved.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 border-b py-2 text-sm">
              <span>{formatINDate(s.date)} · <Money value={s.netWorth} />{s.note ? ` · ${s.note}` : ""}</span>
              <button className="text-xs text-rose-700" onClick={async () => {
                if (!window.confirm("Delete this snapshot?")) return;
                const form = new FormData();
                form.set("id", s.id);
                form.set("confirm", "yes");
                await removeSnapshot(form);
                router.refresh();
              }}>Delete</button>
            </div>
          )) : <p className="text-sm text-muted-foreground">No snapshots recorded. Past months are not filled in.</p>}
        </Panel>
        <Panel title="Latest saved allocation">
          {data.snapshots.length ? (
            <AllocationNote json={data.snapshots[data.snapshots.length - 1].breakdownJson} />
          ) : <p className="text-sm text-muted-foreground">Allocation history appears after you save a snapshot.</p>}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-card p-4"><h2 className="mb-2 font-semibold">{title}</h2>{children}</section>;
}

function AllocationNote({ json }: { json: string }) {
  let rows: { label?: string; pct?: string; value?: string }[] = [];
  try { rows = JSON.parse(json); } catch { rows = []; }
  return (
    <ul className="text-sm">
      {rows.map((row) => (
        <li key={row.label} className="flex justify-between border-b py-1"><span>{row.label}</span><span className="tabular">{row.pct}% · <Money value={row.value} /></span></li>
      ))}
    </ul>
  );
}
