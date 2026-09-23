"use server";

import { revalidatePath } from "next/cache";
import { csvObjects } from "@/lib/csv";
import {
  addAudit,
  deleteAllocation,
  deleteGoal,
  deleteHolding,
  deleteSample,
  deleteSnapshot,
  deleteTransaction,
  getHolding,
  getMeta,
  listAllocations,
  listGoals,
  listHoldings,
  listSnapshots,
  listTransactions,
  replaceAll,
  setMeta,
  upsertAllocation,
  upsertGoal,
  upsertHolding,
  upsertSnapshot,
  upsertTransaction,
} from "@/lib/db";
import { Dec } from "@/lib/decimal";
import { todayISO } from "@/lib/format";
import { refreshMarketPrices } from "@/lib/market";
import { allocationRoom, cashflowKindFor, defaultCountsAsInvestment } from "@/lib/portfolio";
import { insertSample } from "@/lib/sample";
import { loadPortfolio } from "@/lib/store";
import type { GoalRow, HoldingRow, SnapshotRow, TxnRow } from "@/lib/types";

export type ActionResult = { ok: boolean; message?: string; error?: string; duplicate?: boolean };

function refresh() {
  revalidatePath("/", "layout");
}

function id() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function checked(form: FormData, key: string): boolean {
  const value = form.get(key);
  return value === "on" || value === "true" || value === "1";
}

function isDate(value: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function nonNegative(value: string, label: string): string | null {
  if (!value) return null;
  if (!/^\d+(\.\d+)?$/.test(value)) return `${label} must be a positive number.`;
  if (Dec.parse(value).isNeg()) return `${label} cannot be negative.`;
  return null;
}

const LEDGER = new Set(["equity", "mutual_fund", "gold", "other_investment"]);

function holdingFromForm(form: FormData, existing?: HoldingRow | null): HoldingRow {
  const assetClass = text(form, "assetClass") || "equity";
  const subtype = text(form, "subtype");
  const stamp = now();
  return {
    id: existing?.id || text(form, "id") || id(),
    assetClass,
    subtype,
    name: text(form, "name"),
    ticker: text(form, "ticker").toUpperCase(),
    exchange: text(form, "exchange"),
    sector: text(form, "sector"),
    institution: text(form, "institution"),
    accountRef: text(form, "accountRef"),
    currency: (text(form, "currency") || "INR").toUpperCase(),
    fxRate: text(form, "fxRate") || "1",
    quantity: text(form, "quantity") || "0",
    avgCost: text(form, "avgCost") || "0",
    currentPrice: text(form, "currentPrice"),
    priceSource: text(form, "currentPrice") && text(form, "currentPrice") !== existing?.currentPrice ? "manual" : existing?.priceSource || "manual",
    priceUpdatedAt: text(form, "currentPrice") && text(form, "currentPrice") !== existing?.currentPrice ? stamp : existing?.priceUpdatedAt || "",
    manualValue: text(form, "manualValue"),
    interestRate: text(form, "interestRate"),
    compounding: text(form, "compounding") || "quarterly",
    payoutType: text(form, "payoutType") || "cumulative",
    startDate: text(form, "startDate"),
    maturityDate: text(form, "maturityDate"),
    purchaseDate: text(form, "purchaseDate"),
    maturityAmount: text(form, "maturityAmount"),
    accruedInterest: text(form, "accruedInterest"),
    sipAmount: text(form, "sipAmount"),
    sipFrequency: text(form, "sipFrequency"),
    sipStart: text(form, "sipStart"),
    employeeContribution: text(form, "employeeContribution"),
    employerContribution: text(form, "employerContribution"),
    contributionFrequency: text(form, "contributionFrequency"),
    rentalIncome: text(form, "rentalIncome"),
    monthlyCost: text(form, "monthlyCost"),
    outstandingLoan: text(form, "outstandingLoan"),
    renewalStatus: text(form, "renewalStatus"),
    mfCategory: text(form, "mfCategory"),
    isEstimate: checked(form, "isEstimate"),
    isSample: existing?.isSample ?? false,
    personalUse: (text(form, "flagsPresent") ? checked(form, "personalUse") : false) || subtype === "vehicle",
    countsAsInvestment: text(form, "flagsPresent")
      ? checked(form, "countsAsInvestment")
      : defaultCountsAsInvestment(assetClass, subtype),
    notes: text(form, "notes"),
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
  };
}

function validateHolding(row: HoldingRow): string | null {
  if (!row.name) return "Name is required.";
  if (!row.assetClass) return "Category is required.";
  for (const [value, label] of [
    [row.quantity, "Quantity"],
    [row.avgCost, "Average cost"],
    [row.currentPrice, "Current price"],
    [row.manualValue, "Current value"],
    [row.interestRate, "Interest rate"],
    [row.fxRate, "Exchange rate"],
    [row.sipAmount, "SIP amount"],
    [row.outstandingLoan, "Outstanding loan"],
    [row.maturityAmount, "Maturity amount"],
    [row.accruedInterest, "Accrued interest"],
    [row.employeeContribution, "Employee contribution"],
    [row.employerContribution, "Employer contribution"],
  ] as const) {
    const err = nonNegative(value, label);
    if (err) return err;
  }
  for (const [value, label] of [
    [row.purchaseDate, "Purchase date"],
    [row.startDate, "Start date"],
    [row.maturityDate, "Maturity date"],
    [row.sipStart, "SIP start date"],
  ] as const) {
    if (!isDate(value)) return `${label} must be a real date.`;
  }
  if (row.currency !== "INR" && (row.fxRate === "" || Dec.parse(row.fxRate).isZero())) {
    return "Enter the rupees per unit of foreign currency. Totals stay blank until a rate is stored.";
  }
  if (row.startDate && row.maturityDate && row.maturityDate < row.startDate) return "Maturity date is before the start date.";
  if (row.assetClass === "liability" && !row.manualValue) return "Enter the outstanding balance for a liability.";
  return null;
}

function syncOpening(row: HoldingRow) {
  if (!LEDGER.has(row.assetClass)) return;
  const txns = listTransactions().filter((t) => t.holdingId === row.id);
  const positional = txns.filter((t) => ["buy", "sip", "opening", "sell", "redemption", "contribution", "withdrawal"].includes(t.type));
  const qty = Dec.parse(row.quantity);
  const avg = Dec.parse(row.avgCost);
  const amount = qty.mul(avg).toFixed(2);
  const opening = positional.find((t) => t.type === "opening");
  if (positional.length === 0) {
    if (qty.isZero() || !row.purchaseDate) return;
    upsertTransaction({
      id: id(),
      holdingId: row.id,
      type: "opening",
      date: row.purchaseDate,
      quantity: qty.toFixed(4),
      price: avg.toFixed(4),
      amount,
      fees: "0",
      category: "Opening balance",
      cashflowKind: "investment",
      currency: row.currency || "INR",
      notes: "Opening lot created from the holding form.",
      createdAt: now(),
    });
  } else if (positional.length === 1 && opening) {
    upsertTransaction({
      ...opening,
      date: row.purchaseDate || opening.date,
      quantity: qty.toFixed(4),
      price: avg.toFixed(4),
      amount,
      currency: row.currency || "INR",
    });
  }
}

export async function saveHolding(form: FormData): Promise<ActionResult> {
  const existing = text(form, "id") ? getHolding(text(form, "id")) : null;
  const row = holdingFromForm(form, existing);
  const error = validateHolding(row);
  if (error) return { ok: false, error };
  if (existing && LEDGER.has(row.assetClass)) {
    const positional = listTransactions().filter(
      (t) => t.holdingId === row.id && ["buy", "sip", "opening", "sell", "redemption", "contribution", "withdrawal"].includes(t.type),
    );
    if (positional.length > 1) {
      row.quantity = existing.quantity;
      row.avgCost = existing.avgCost;
    }
  }
  upsertHolding(row);
  syncOpening(row);
  addAudit({
    id: id(),
    entity: "holding",
    entityId: row.id,
    action: existing ? "update" : "create",
    summary: `${existing ? "Updated" : "Added"} ${row.name} (${row.assetClass}).`,
    createdAt: now(),
  });
  refresh();
  return { ok: true };
}

export async function removeHolding(form: FormData): Promise<ActionResult> {
  const holdingId = text(form, "id");
  const holding = getHolding(holdingId);
  if (!holding) return { ok: false, error: "Holding was not found." };
  if (text(form, "confirm") !== "yes") return { ok: false, error: "Deletion was not confirmed." };
  deleteHolding(holdingId);
  addAudit({
    id: id(),
    entity: "holding",
    entityId: holdingId,
    action: "delete",
    summary: `Deleted ${holding.name} (${holding.assetClass}). Linked transactions were removed with it.`,
    createdAt: now(),
  });
  refresh();
  return { ok: true };
}

function txnFromForm(form: FormData, existing?: TxnRow | null): TxnRow {
  const type = text(form, "type") || "buy";
  return {
    id: existing?.id || text(form, "id") || id(),
    holdingId: text(form, "holdingId") || null,
    type,
    date: text(form, "date"),
    quantity: text(form, "quantity") || "0",
    price: text(form, "price") || "0",
    amount: text(form, "amount") || "0",
    fees: text(form, "fees") || "0",
    category: text(form, "category"),
    cashflowKind: text(form, "cashflowKind") || cashflowKindFor(type),
    currency: "INR",
    notes: text(form, "notes"),
    createdAt: existing?.createdAt || now(),
  };
}

export async function saveTransaction(form: FormData): Promise<ActionResult> {
  const existingId = text(form, "id");
  const existing = existingId ? listTransactions().find((t) => t.id === existingId) : null;
  const row = txnFromForm(form, existing);
  if (!row.date || !isDate(row.date)) return { ok: false, error: "A valid date is required." };
  if (!row.type) return { ok: false, error: "Type is required." };
  const amountErr = nonNegative(row.amount, "Amount");
  if (amountErr) return { ok: false, error: amountErr };
  const qtyErr = nonNegative(row.quantity, "Quantity");
  if (qtyErr) return { ok: false, error: qtyErr };
  if (Dec.parse(row.amount).isZero() && Dec.parse(row.quantity).isZero()) return { ok: false, error: "Enter an amount or a quantity." };
  if (["buy", "sip", "sell", "opening", "redemption"].includes(row.type) && !row.holdingId) {
    return { ok: false, error: "Choose the holding this transaction belongs to." };
  }
  if (["emi", "lump_sum", "repayment"].includes(row.type)) {
    if (!row.holdingId) return { ok: false, error: "Choose the loan this payment belongs to." };
    const loan = getHolding(row.holdingId);
    if (!loan || loan.assetClass !== "liability") return { ok: false, error: "EMI and lump sums can only be added to an existing loan." };
    const paid = Dec.parse(row.amount);
    const principal = Dec.parse(row.price);
    if (paid.isZero()) return { ok: false, error: "Enter the amount paid." };
    if (principal.gt(paid)) return { ok: false, error: "The principal applied to the outstanding balance cannot be more than the amount paid." };
    row.cashflowKind = "expense";
    if (!row.category) row.category = row.type === "lump_sum" ? "Lump sum" : "EMI";
  }
  const dup = listTransactions().find(
    (t) =>
      t.id !== row.id &&
      t.holdingId === row.holdingId &&
      t.type === row.type &&
      t.date === row.date &&
      Dec.parse(t.amount).cmp(Dec.parse(row.amount)) === 0 &&
      Dec.parse(t.quantity).cmp(Dec.parse(row.quantity)) === 0,
  );
  if (dup && text(form, "confirmDuplicate") !== "yes") {
    return { ok: false, duplicate: true, error: "A transaction with the same holding, type, date, amount, and quantity already exists." };
  }
  if (row.holdingId && ["buy", "sip", "contribution"].includes(row.type)) {
    const holding = getHolding(row.holdingId);
    const positional = listTransactions().filter(
      (t) => t.holdingId === row.holdingId && t.id !== row.id && ["buy", "sip", "opening", "sell", "redemption", "contribution", "withdrawal"].includes(t.type),
    );
    if (holding && LEDGER.has(holding.assetClass) && positional.length === 0 && Dec.parse(holding.quantity).gt(Dec.zero)) {
      if (!holding.purchaseDate) {
        return { ok: false, error: "Set a purchase date on the holding before adding another transaction, so the original units are not assigned a guessed date." };
      }
      upsertTransaction({
        id: id(),
        holdingId: holding.id,
        type: "opening",
        date: holding.purchaseDate,
        quantity: holding.quantity,
        price: holding.avgCost,
        amount: Dec.parse(holding.quantity).mul(Dec.parse(holding.avgCost)).toFixed(2),
        fees: "0",
        category: "Opening balance",
        cashflowKind: "investment",
        currency: holding.currency,
        notes: "Opening lot preserved before an additional transaction.",
        createdAt: now(),
      });
    }
  }
  upsertTransaction(row);
  addAudit({
    id: id(),
    entity: "transaction",
    entityId: row.id,
    action: existing ? "update" : "create",
    summary: `${existing ? "Updated" : "Added"} ${row.type} of ₹${row.amount} on ${row.date}.`,
    createdAt: now(),
  });
  refresh();
  return { ok: true };
}

export async function removeTransaction(form: FormData): Promise<ActionResult> {
  const txnId = text(form, "id");
  if (text(form, "confirm") !== "yes") return { ok: false, error: "Deletion was not confirmed." };
  deleteTransaction(txnId);
  addAudit({ id: id(), entity: "transaction", entityId: txnId, action: "delete", summary: "Deleted a transaction.", createdAt: now() });
  refresh();
  return { ok: true };
}

export async function saveGoal(form: FormData): Promise<ActionResult> {
  const existing = listGoals().find((g) => g.id === text(form, "id"));
  const target = text(form, "targetAmount");
  if (!text(form, "name")) return { ok: false, error: "Goal name is required." };
  const err = nonNegative(target, "Target amount");
  if (err || !target) return { ok: false, error: err || "Target amount is required." };
  const monthlyErr = nonNegative(text(form, "monthlyContribution"), "Monthly contribution");
  if (monthlyErr) return { ok: false, error: monthlyErr };
  if (!isDate(text(form, "targetDate"))) return { ok: false, error: "Target date must be a real date." };
  const row: GoalRow = {
    id: existing?.id || id(),
    name: text(form, "name"),
    targetAmount: target,
    targetDate: text(form, "targetDate"),
    monthlyContribution: text(form, "monthlyContribution") || "0",
    notes: text(form, "notes"),
    isSample: existing?.isSample ?? false,
    createdAt: existing?.createdAt || now(),
    updatedAt: now(),
  };
  upsertGoal(row);
  addAudit({ id: id(), entity: "goal", entityId: row.id, action: existing ? "update" : "create", summary: `${existing ? "Updated" : "Added"} goal ${row.name}.`, createdAt: now() });
  refresh();
  return { ok: true };
}

export async function removeGoal(form: FormData): Promise<ActionResult> {
  if (text(form, "confirm") !== "yes") return { ok: false, error: "Deletion was not confirmed." };
  deleteGoal(text(form, "id"));
  refresh();
  return { ok: true };
}

export async function saveAllocation(form: FormData): Promise<ActionResult> {
  const goalId = text(form, "goalId");
  const holdingId = text(form, "holdingId");
  const amount = text(form, "amount");
  if (!goalId || !holdingId) return { ok: false, error: "Choose a goal and a holding." };
  const err = nonNegative(amount, "Amount");
  if (err || !amount || Dec.parse(amount).isZero()) return { ok: false, error: err || "Enter an amount to assign." };
  const portfolio = loadPortfolio();
  const holding = portfolio.holdings.find((h) => h.id === holdingId);
  if (!holding || holding.isLiability) return { ok: false, error: "Liabilities cannot be assigned to a goal." };
  const room = allocationRoom(holding.currentValue, listAllocations(), holdingId, goalId);
  if (room == null) return { ok: false, error: "This holding has no current value, so it cannot be assigned yet." };
  if (Dec.parse(amount).gt(room)) return { ok: false, error: `Only ₹${room.toFixed(2)} of this holding is still unassigned.` };
  upsertAllocation({ id: id(), goalId, holdingId, amount: Dec.parse(amount).toFixed(2) });
  refresh();
  return { ok: true };
}

export async function removeAllocation(form: FormData): Promise<ActionResult> {
  deleteAllocation(text(form, "goalId"), text(form, "holdingId"));
  refresh();
  return { ok: true };
}

export async function saveSnapshot(form: FormData): Promise<ActionResult> {
  const date = text(form, "date") || todayISO();
  if (!isDate(date)) return { ok: false, error: "Snapshot date is invalid." };
  const existing = listSnapshots().find((s) => s.date === date);
  if (existing && text(form, "confirmReplace") !== "yes") {
    return { ok: false, error: `A snapshot already exists for ${date}. Confirm to replace it.` };
  }
  const portfolio = loadPortfolio(date);
  if (portfolio.incomplete) {
    return { ok: false, error: "A snapshot was not saved because some holdings have no current value. Enter those values first so the history is not invented." };
  }
  const row: SnapshotRow = {
    id: existing?.id || id(),
    date,
    totalAssets: portfolio.cards.totalAssets || "0.00",
    totalLiabilities: portfolio.cards.totalLiabilities,
    netWorth: portfolio.cards.netWorth || "0.00",
    breakdownJson: JSON.stringify(portfolio.allocation.total),
    note: text(form, "note"),
    createdAt: now(),
  };
  upsertSnapshot(row);
  addAudit({ id: id(), entity: "snapshot", entityId: row.id, action: "create", summary: `Recorded net worth snapshot for ${date}.`, createdAt: now() });
  refresh();
  return { ok: true, message: "Snapshot saved from the values recorded on this date's holdings. Past prices are not reconstructed." };
}

export async function removeSnapshot(form: FormData): Promise<ActionResult> {
  if (text(form, "confirm") !== "yes") return { ok: false, error: "Deletion was not confirmed." };
  deleteSnapshot(text(form, "id"));
  refresh();
  return { ok: true };
}

export async function refreshPrices(): Promise<ActionResult & { detail?: Awaited<ReturnType<typeof refreshMarketPrices>> }> {
  const detail = await refreshMarketPrices();
  refresh();
  if (!detail.updated.length && detail.skipped.length) {
    return { ok: false, error: detail.skipped[0]?.reason || "No prices were updated.", detail };
  }
  return {
    ok: true,
    message: detail.updated.length ? `Updated ${detail.updated.length} price${detail.updated.length === 1 ? "" : "s"}.` : "No equity or mutual fund holdings had a symbol to refresh.",
    detail,
  };
}

export async function loadSampleData(): Promise<ActionResult> {
  deleteSample();
  insertSample();
  setMeta("sample_loaded", "1");
  refresh();
  return { ok: true, message: "Demonstration records were added. They are labeled Sample and are not your portfolio." };
}

export async function clearSampleData(): Promise<ActionResult> {
  deleteSample();
  setMeta("sample_loaded", "");
  refresh();
  return { ok: true, message: "Demonstration records were removed." };
}

export async function importHoldingsCsv(form: FormData): Promise<ActionResult> {
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a CSV file." };
  const textBody = await file.text();
  const rows = csvObjects(textBody);
  if (!rows.length) return { ok: false, error: "The CSV file has no data rows." };
  let count = 0;
  const errors: string[] = [];
  for (const [index, raw] of rows.entries()) {
    const assetClass = (raw.asset_class || raw.category || "").trim();
    const row: HoldingRow = {
      id: id(),
      assetClass,
      subtype: raw.subtype || "",
      name: raw.name || "",
      ticker: (raw.ticker || raw.symbol || raw.scheme_code || "").toUpperCase(),
      exchange: raw.exchange || "",
      sector: raw.sector || "",
      institution: raw.institution || raw.bank || "",
      accountRef: raw.account_ref || raw.folio || "",
      currency: (raw.currency || "INR").toUpperCase(),
      fxRate: raw.fx_rate || "1",
      quantity: raw.quantity || raw.units || "0",
      avgCost: raw.avg_cost || raw.average_cost || raw.principal || "0",
      currentPrice: raw.current_price || raw.nav || "",
      priceSource: "manual",
      priceUpdatedAt: "",
      manualValue: raw.current_value || raw.balance || "",
      interestRate: raw.interest_rate || "",
      compounding: raw.compounding || "quarterly",
      payoutType: raw.payout_type || "cumulative",
      startDate: raw.start_date || "",
      maturityDate: raw.maturity_date || "",
      purchaseDate: raw.purchase_date || "",
      maturityAmount: raw.maturity_amount || "",
      accruedInterest: "",
      sipAmount: raw.sip_amount || "",
      sipFrequency: raw.sip_frequency || "",
      sipStart: "",
      employeeContribution: raw.employee_contribution || "",
      employerContribution: raw.employer_contribution || "",
      contributionFrequency: "",
      rentalIncome: "",
      monthlyCost: "",
      outstandingLoan: raw.outstanding_loan || "",
      renewalStatus: "",
      mfCategory: raw.mf_category || "",
      isEstimate: raw.is_estimate === "1" || raw.is_estimate === "true",
      isSample: false,
      personalUse: raw.personal_use === "1",
      countsAsInvestment: raw.counts_as_investment ? raw.counts_as_investment !== "0" : defaultCountsAsInvestment(assetClass, raw.subtype || ""),
      notes: raw.notes || "",
      createdAt: now(),
      updatedAt: now(),
    };
    const error = validateHolding(row);
    if (error) {
      errors.push(`Row ${index + 2}: ${error}`);
      continue;
    }
    upsertHolding(row);
    syncOpening(row);
    count += 1;
  }
  addAudit({ id: id(), entity: "import", entityId: "csv", action: "import", summary: `Imported ${count} holdings from CSV.`, createdAt: now() });
  refresh();
  if (!count) return { ok: false, error: errors[0] || "Nothing was imported." };
  return { ok: true, message: `Imported ${count} holdings.${errors.length ? ` ${errors.length} rows were skipped. ${errors[0]}` : ""}` };
}

export async function importBackup(form: FormData): Promise<ActionResult> {
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a backup JSON file." };
  let parsed: {
    holdings?: HoldingRow[];
    transactions?: TxnRow[];
    goals?: GoalRow[];
    allocations?: { id: string; goalId: string; holdingId: string; amount: string }[];
    snapshots?: SnapshotRow[];
  };
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (!Array.isArray(parsed.holdings)) return { ok: false, error: "Backup is missing holdings." };
  const mode = text(form, "mode");
  if (mode === "replace") {
    if (text(form, "confirmReplace") !== "REPLACE") return { ok: false, error: "Type REPLACE to overwrite the current portfolio." };
    replaceAll({
      holdings: parsed.holdings,
      transactions: parsed.transactions ?? [],
      goals: parsed.goals ?? [],
      allocations: parsed.allocations ?? [],
      snapshots: parsed.snapshots ?? [],
    });
  } else {
    for (const row of parsed.holdings) upsertHolding(row);
    for (const row of parsed.transactions ?? []) upsertTransaction(row);
    for (const row of parsed.goals ?? []) upsertGoal(row);
    for (const row of parsed.allocations ?? []) upsertAllocation(row);
    for (const row of parsed.snapshots ?? []) upsertSnapshot(row);
  }
  refresh();
  return { ok: true, message: mode === "replace" ? "Portfolio replaced from backup." : "Backup merged into the current portfolio." };
}

export async function backupPayload() {
  return {
    version: 1,
    exportedAt: now(),
    holdings: listHoldings(),
    transactions: listTransactions(),
    goals: listGoals(),
    allocations: listAllocations(),
    snapshots: listSnapshots(),
    marketRefreshedAt: getMeta("market_refreshed_at"),
  };
}
