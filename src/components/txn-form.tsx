"use client";

import { useState } from "react";
import { saveTransaction } from "@/app/actions";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, TXN_TYPES } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import type { HoldingView } from "@/lib/types";
import { ErrorNote, Field, SelectField, fieldClass, submitClass } from "./ui";

export function TransactionForm({
  holdings,
  initialHoldingId,
  kind,
  onDone,
}: {
  holdings: HoldingView[];
  initialHoldingId?: string;
  kind?: "income" | "expense" | "any";
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const defaultType = kind === "income" ? "income" : kind === "expense" ? "expense" : "buy";
  const categories = kind === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    if (duplicate) form.set("confirmDuplicate", "yes");
    const result = await saveTransaction(form);
    setPending(false);
    if (!result.ok) {
      setDuplicate(Boolean(result.duplicate));
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <SelectField label="Type" name="type" defaultValue={defaultType} options={kind === "income" ? [{ id: "income", label: "Income" }] : kind === "expense" ? [{ id: "expense", label: "Expense" }, { id: "repayment", label: "Loan repayment" }] : TXN_TYPES.map((t) => ({ id: t.id, label: t.label }))} />
      <Field label="Date" name="date" type="date" defaultValue={todayISO()} required />
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block font-medium">Holding, if this belongs to one</span>
        <select name="holdingId" defaultValue={initialHoldingId || ""} className={fieldClass}>
          <option value="">Not linked</option>
          {holdings.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </label>
      <Field label="Amount (₹)" name="amount" type="number" step="any" />
      <Field label="Quantity or units" name="quantity" type="number" step="any" />
      <Field label="Price per unit, or principal applied on a loan" name="price" type="number" step="any" hint="For an EMI or lump sum, this is the portion that reduces the outstanding balance. Leave blank to apply the full amount." />
      <Field label="Fees" name="fees" type="number" step="any" />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Category</span>
        <input name="category" list="cats" className={fieldClass} />
        <datalist id="cats">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <SelectField
        label="Cash-flow treatment"
        name="cashflowKind"
        defaultValue={kind === "income" ? "income" : kind === "expense" ? "expense" : ""}
        options={[
          { id: "", label: "Choose from the type" },
          { id: "income", label: "Income" },
          { id: "expense", label: "Expense" },
          { id: "investment", label: "Investment contribution" },
          { id: "proceeds", label: "Sale or withdrawal" },
          { id: "transfer", label: "Transfer between my accounts" },
        ]}
      />
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block font-medium">Notes</span>
        <textarea name="notes" className="min-h-16 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
      </label>
      {duplicate ? (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="confirmDuplicate" value="yes" defaultChecked />
          Save even though a matching transaction already exists
        </label>
      ) : null}
      <div className="sm:col-span-2">
        <ErrorNote error={error} />
      </div>
      <button className={submitClass(pending)} disabled={pending}>
        {pending ? "Saving…" : "Save transaction"}
      </button>
    </form>
  );
}

export function LoanPaymentForm({
  loan,
  mode,
  onDone,
}: {
  loan: HoldingView;
  mode: "emi" | "lump_sum";
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const preset = mode === "emi" ? loan.loan?.scheduledEmi || "" : "";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await saveTransaction(new FormData(event.currentTarget));
    setPending(false);
    if (!result.ok) {
      setError(result.error || "Could not save the payment.");
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <input type="hidden" name="type" value={mode} />
      <input type="hidden" name="holdingId" value={loan.id} />
      <input type="hidden" name="cashflowKind" value="expense" />
      <input type="hidden" name="category" value={mode === "emi" ? "EMI" : "Lump sum"} />
      <p className="text-sm text-muted-foreground">
        {mode === "emi"
          ? "This EMI is an expense and reduces the loan only by the principal portion."
          : "This lump sum is an expense and reduces the outstanding balance."}
      </p>
      <Field label="Date" name="date" type="date" defaultValue={todayISO()} required />
      <Field label="Amount paid (₹)" name="amount" type="number" step="any" defaultValue={preset} required />
      <Field
        label="Principal applied to outstanding (₹)"
        name="price"
        type="number"
        step="any"
        defaultValue={mode === "lump_sum" ? "" : preset}
        hint={mode === "emi" ? "If part of the EMI is interest, enter only the principal. Leave blank to reduce the balance by the full EMI." : "Leave blank to reduce the outstanding by the full lump sum."}
      />
      <label className="text-sm">
        <span className="mb-1 block font-medium">Notes</span>
        <textarea name="notes" className="min-h-16 w-full rounded-lg border bg-background px-3 py-2" />
      </label>
      <ErrorNote error={error} />
      <button className={submitClass(pending)} disabled={pending}>
        {pending ? "Saving…" : mode === "emi" ? "Save EMI" : "Save lump sum"}
      </button>
    </form>
  );
}
