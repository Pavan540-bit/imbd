"use client";

import { useState } from "react";
import Link from "next/link";
import { ALLOCATION_MODES, classLabel } from "@/lib/constants";
import type { AllocationMode } from "@/lib/constants";
import type { PortfolioResult } from "@/lib/types";
import { AllocationCharts } from "../charts";
import { Money } from "../ui";

export function AllocationScreen({ data }: { data: PortfolioResult }) {
  const [mode, setMode] = useState<AllocationMode>("total");
  const [bucket, setBucket] = useState<string | null>(null);
  const slices = data.allocation[mode];
  const rows = data.holdings.filter((h) => {
    if (h.isLiability || h.currentValue == null) return false;
    if (bucket && h.bucket !== bucket) return false;
    if (mode === "investable") return h.investable && !h.personalUse;
    if (mode === "financial") return h.financial;
    if (mode === "equity") return h.equityLike;
    return true;
  });
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {ALLOCATION_MODES.map((item) => (
          <button key={item.id} className={`rounded-full border px-3 py-1.5 text-sm ${mode === item.id ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => { setMode(item.id); setBucket(null); }}>
            {item.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Share = category value ÷ recorded assets in this view × 100. Hybrid funds are left out of equity-only because their equity portion is not recorded. Click a segment to list those holdings.
      </p>
      <div className="rounded-2xl border bg-card p-4">
        <AllocationCharts slices={slices} onSelect={setBucket} />
      </div>
      <div className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 font-semibold">{bucket ? "Selected holdings" : "Holdings in this view"}</h2>
        <ul className="grid gap-2 text-sm">
          {rows.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
              <span>{h.name} <span className="text-muted-foreground">· {classLabel(h.assetClass)} · {h.valueLabel}</span></span>
              <span><Money value={h.currentValue} /> · {h.allocationPct ?? "—"}%</span>
            </li>
          ))}
        </ul>
        {!rows.length ? <p className="text-sm text-muted-foreground">Nothing with a recorded value in this view.</p> : null}
        <Link className="mt-3 inline-block text-sm text-primary" href={bucket ? `/holdings?bucket=${bucket}` : "/holdings"}>Open in holdings</Link>
      </div>
    </div>
  );
}
