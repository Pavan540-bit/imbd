"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { CHART_COLORS } from "@/lib/constants";
import { formatINR, formatINDate } from "@/lib/format";
import type { AllocationSlice } from "@/lib/types";

export function AllocationCharts({
  slices,
  onSelect,
}: {
  slices: AllocationSlice[];
  onSelect?: (id: string) => void;
}) {
  const data = slices.map((slice) => ({ ...slice, amount: Number(slice.value) }));
  if (!data.length) return <p className="text-sm text-muted-foreground">No recorded values in this view.</p>;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="amount" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={2} onClick={(_, index) => onSelect?.(data[index]?.id)}>
              {data.map((slice, index) => (
                <Cell key={slice.id} fill={CHART_COLORS[index % CHART_COLORS.length]} className="cursor-pointer" />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatINR(Number(value).toFixed(2))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 24, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" width={128} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => formatINR(Number(value).toFixed(2))} />
            <Bar dataKey="amount" radius={4} onClick={(_, index) => onSelect?.(data[index]?.id)}>
              {data.map((slice, index) => (
                <Cell key={slice.id} fill={CHART_COLORS[index % CHART_COLORS.length]} className="cursor-pointer" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="text-sm lg:col-span-2">
        <caption className="mb-2 text-left text-xs text-muted-foreground">Allocation of recorded values. Select a row to list those holdings.</caption>
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 font-medium">Category</th>
            <th className="py-2 font-medium">Value</th>
            <th className="py-2 font-medium">Share</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((slice) => (
            <tr key={slice.id} className="border-b">
              <td className="py-2">
                <button type="button" className="underline-offset-2 hover:underline" onClick={() => onSelect?.(slice.id)}>
                  {slice.label}
                </button>
              </td>
              <td className="py-2 tabular">{formatINR(slice.value)}</td>
              <td className="py-2 tabular">{slice.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FlowChart({ rows }: { rows: { month: string; income: string; expense: string }[] }) {
  const data = rows.map((row) => ({
    month: row.month.slice(2),
    Income: Number(row.income),
    Expenses: Number(row.expense),
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value) => formatINR(Number(value).toFixed(2))} />
          <Bar dataKey="Income" fill="#0f766e" radius={3} />
          <Bar dataKey="Expenses" fill="#be123c" radius={3} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function NetWorthChart({ points }: { points: { date: string; value: number; kind: string }[] }) {
  if (!points.length) return <p className="text-sm text-muted-foreground">No snapshots yet.</p>;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points.map((p) => ({ ...p, label: formatINDate(p.date) }))}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value, _name, item) => [formatINR(Number(value).toFixed(2)), item?.payload?.kind || "Net worth"]} />
          <Bar dataKey="value" fill="#0f5c56" radius={3} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
