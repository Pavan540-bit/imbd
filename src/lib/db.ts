import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AllocationRow, AuditRow, GoalRow, HoldingRow, SnapshotRow, TxnRow } from "./types";

type Sql = DatabaseSync;

const globalDb = globalThis as unknown as { __portfolioDb?: Sql; __portfolioDirty?: boolean; __portfolioRemoteStamp?: string };

export function dbFile(): string {
  if (process.env.VERCEL) return path.join("/tmp", "portfolio.sqlite");
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "portfolio.sqlite");
}

export function storageMode(): "local" | "blob" | "ephemeral" {
  if (!process.env.VERCEL) return "local";
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "ephemeral";
}

function closeDatabase() {
  globalDb.__portfolioDb?.close();
  globalDb.__portfolioDb = undefined;
}

function database(): Sql {
  if (!globalDb.__portfolioDb) {
    const db = new DatabaseSync(dbFile());
    db.exec(process.env.VERCEL ? "PRAGMA journal_mode = DELETE; PRAGMA foreign_keys = ON;" : "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    migrate(db);
    globalDb.__portfolioDb = db;
  }
  return globalDb.__portfolioDb;
}

function markDirty() {
  globalDb.__portfolioDirty = true;
}

export async function prepareDatabase() {
  if (storageMode() === "blob" && !globalDb.__portfolioDirty) {
    const { remotePortfolioStamp, downloadPortfolioDb } = await import("./blob-store");
    const stamp = await remotePortfolioStamp();
    const missing = !fs.existsSync(dbFile());
    if (stamp && (stamp !== (globalDb.__portfolioRemoteStamp || "") || missing)) {
      closeDatabase();
      await downloadPortfolioDb(dbFile());
      globalDb.__portfolioRemoteStamp = stamp;
    }
  }
  database();
}

export async function flushDatabase() {
  if (!globalDb.__portfolioDirty || storageMode() !== "blob") {
    globalDb.__portfolioDirty = false;
    return;
  }
  const db = database();
  db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  const { uploadPortfolioDb } = await import("./blob-store");
  const stamp = await uploadPortfolioDb(dbFile());
  if (stamp) globalDb.__portfolioRemoteStamp = stamp;
  globalDb.__portfolioDirty = false;
}

function migrate(db: Sql) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS holdings (
      id TEXT PRIMARY KEY,
      asset_class TEXT NOT NULL,
      subtype TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      ticker TEXT NOT NULL DEFAULT '',
      exchange TEXT NOT NULL DEFAULT '',
      sector TEXT NOT NULL DEFAULT '',
      institution TEXT NOT NULL DEFAULT '',
      account_ref TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'INR',
      fx_rate TEXT NOT NULL DEFAULT '1',
      quantity TEXT NOT NULL DEFAULT '0',
      avg_cost TEXT NOT NULL DEFAULT '0',
      current_price TEXT NOT NULL DEFAULT '',
      price_source TEXT NOT NULL DEFAULT 'manual',
      price_updated_at TEXT NOT NULL DEFAULT '',
      manual_value TEXT NOT NULL DEFAULT '',
      interest_rate TEXT NOT NULL DEFAULT '',
      compounding TEXT NOT NULL DEFAULT 'quarterly',
      payout_type TEXT NOT NULL DEFAULT 'cumulative',
      start_date TEXT NOT NULL DEFAULT '',
      maturity_date TEXT NOT NULL DEFAULT '',
      purchase_date TEXT NOT NULL DEFAULT '',
      maturity_amount TEXT NOT NULL DEFAULT '',
      accrued_interest TEXT NOT NULL DEFAULT '',
      sip_amount TEXT NOT NULL DEFAULT '',
      sip_frequency TEXT NOT NULL DEFAULT '',
      sip_start TEXT NOT NULL DEFAULT '',
      employee_contribution TEXT NOT NULL DEFAULT '',
      employer_contribution TEXT NOT NULL DEFAULT '',
      contribution_frequency TEXT NOT NULL DEFAULT '',
      rental_income TEXT NOT NULL DEFAULT '',
      monthly_cost TEXT NOT NULL DEFAULT '',
      outstanding_loan TEXT NOT NULL DEFAULT '',
      renewal_status TEXT NOT NULL DEFAULT '',
      mf_category TEXT NOT NULL DEFAULT '',
      is_estimate INTEGER NOT NULL DEFAULT 0,
      is_sample INTEGER NOT NULL DEFAULT 0,
      personal_use INTEGER NOT NULL DEFAULT 0,
      counts_as_investment INTEGER NOT NULL DEFAULT 1,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      holding_id TEXT,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      quantity TEXT NOT NULL DEFAULT '0',
      price TEXT NOT NULL DEFAULT '0',
      amount TEXT NOT NULL DEFAULT '0',
      fees TEXT NOT NULL DEFAULT '0',
      category TEXT NOT NULL DEFAULT '',
      cashflow_kind TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'INR',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_amount TEXT NOT NULL,
      target_date TEXT NOT NULL DEFAULT '',
      monthly_contribution TEXT NOT NULL DEFAULT '0',
      notes TEXT NOT NULL DEFAULT '',
      is_sample INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS goal_allocations (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      holding_id TEXT NOT NULL,
      amount TEXT NOT NULL,
      UNIQUE (goal_id, holding_id),
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
      FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      total_assets TEXT NOT NULL,
      total_liabilities TEXT NOT NULL,
      net_worth TEXT NOT NULL,
      breakdown_json TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tx_holding ON transactions(holding_id, date);
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
  `);
}

function b(value: number | null | undefined): boolean {
  return value === 1;
}

function holdingFrom(row: Record<string, unknown>): HoldingRow {
  return {
    id: String(row.id),
    assetClass: String(row.asset_class),
    subtype: String(row.subtype ?? ""),
    name: String(row.name),
    ticker: String(row.ticker ?? ""),
    exchange: String(row.exchange ?? ""),
    sector: String(row.sector ?? ""),
    institution: String(row.institution ?? ""),
    accountRef: String(row.account_ref ?? ""),
    currency: String(row.currency ?? "INR"),
    fxRate: String(row.fx_rate ?? "1"),
    quantity: String(row.quantity ?? "0"),
    avgCost: String(row.avg_cost ?? "0"),
    currentPrice: String(row.current_price ?? ""),
    priceSource: String(row.price_source ?? "manual"),
    priceUpdatedAt: String(row.price_updated_at ?? ""),
    manualValue: String(row.manual_value ?? ""),
    interestRate: String(row.interest_rate ?? ""),
    compounding: String(row.compounding ?? "quarterly"),
    payoutType: String(row.payout_type ?? "cumulative"),
    startDate: String(row.start_date ?? ""),
    maturityDate: String(row.maturity_date ?? ""),
    purchaseDate: String(row.purchase_date ?? ""),
    maturityAmount: String(row.maturity_amount ?? ""),
    accruedInterest: String(row.accrued_interest ?? ""),
    sipAmount: String(row.sip_amount ?? ""),
    sipFrequency: String(row.sip_frequency ?? ""),
    sipStart: String(row.sip_start ?? ""),
    employeeContribution: String(row.employee_contribution ?? ""),
    employerContribution: String(row.employer_contribution ?? ""),
    contributionFrequency: String(row.contribution_frequency ?? ""),
    rentalIncome: String(row.rental_income ?? ""),
    monthlyCost: String(row.monthly_cost ?? ""),
    outstandingLoan: String(row.outstanding_loan ?? ""),
    renewalStatus: String(row.renewal_status ?? ""),
    mfCategory: String(row.mf_category ?? ""),
    isEstimate: b(row.is_estimate as number),
    isSample: b(row.is_sample as number),
    personalUse: b(row.personal_use as number),
    countsAsInvestment: b(row.counts_as_investment as number),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function listHoldings(): HoldingRow[] {
  const rows = database().prepare("SELECT * FROM holdings ORDER BY name COLLATE NOCASE").all() as Record<string, unknown>[];
  return rows.map(holdingFrom);
}

export function getHolding(id: string): HoldingRow | null {
  const row = database().prepare("SELECT * FROM holdings WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? holdingFrom(row) : null;
}

export function upsertHolding(row: HoldingRow) {
  markDirty();
  database()
    .prepare(
      `INSERT INTO holdings (
        id, asset_class, subtype, name, ticker, exchange, sector, institution, account_ref, currency, fx_rate,
        quantity, avg_cost, current_price, price_source, price_updated_at, manual_value, interest_rate, compounding,
        payout_type, start_date, maturity_date, purchase_date, maturity_amount, accrued_interest, sip_amount,
        sip_frequency, sip_start, employee_contribution, employer_contribution, contribution_frequency, rental_income,
        monthly_cost, outstanding_loan, renewal_status, mf_category, is_estimate, is_sample, personal_use,
        counts_as_investment, notes, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        asset_class=excluded.asset_class, subtype=excluded.subtype, name=excluded.name, ticker=excluded.ticker,
        exchange=excluded.exchange, sector=excluded.sector, institution=excluded.institution, account_ref=excluded.account_ref,
        currency=excluded.currency, fx_rate=excluded.fx_rate, quantity=excluded.quantity, avg_cost=excluded.avg_cost,
        current_price=excluded.current_price, price_source=excluded.price_source, price_updated_at=excluded.price_updated_at,
        manual_value=excluded.manual_value, interest_rate=excluded.interest_rate, compounding=excluded.compounding,
        payout_type=excluded.payout_type, start_date=excluded.start_date, maturity_date=excluded.maturity_date,
        purchase_date=excluded.purchase_date, maturity_amount=excluded.maturity_amount, accrued_interest=excluded.accrued_interest,
        sip_amount=excluded.sip_amount, sip_frequency=excluded.sip_frequency, sip_start=excluded.sip_start,
        employee_contribution=excluded.employee_contribution, employer_contribution=excluded.employer_contribution,
        contribution_frequency=excluded.contribution_frequency, rental_income=excluded.rental_income,
        monthly_cost=excluded.monthly_cost, outstanding_loan=excluded.outstanding_loan, renewal_status=excluded.renewal_status,
        mf_category=excluded.mf_category, is_estimate=excluded.is_estimate, is_sample=excluded.is_sample,
        personal_use=excluded.personal_use, counts_as_investment=excluded.counts_as_investment, notes=excluded.notes,
        updated_at=excluded.updated_at`,
    )
    .run(
      row.id, row.assetClass, row.subtype, row.name, row.ticker, row.exchange, row.sector, row.institution, row.accountRef,
      row.currency || "INR", row.fxRate || "1", row.quantity || "0", row.avgCost || "0", row.currentPrice, row.priceSource || "manual",
      row.priceUpdatedAt, row.manualValue, row.interestRate, row.compounding || "quarterly", row.payoutType || "cumulative",
      row.startDate, row.maturityDate, row.purchaseDate, row.maturityAmount, row.accruedInterest, row.sipAmount, row.sipFrequency,
      row.sipStart, row.employeeContribution, row.employerContribution, row.contributionFrequency, row.rentalIncome, row.monthlyCost,
      row.outstandingLoan, row.renewalStatus, row.mfCategory, row.isEstimate ? 1 : 0, row.isSample ? 1 : 0, row.personalUse ? 1 : 0,
      row.countsAsInvestment ? 1 : 0, row.notes, row.createdAt, row.updatedAt,
    );
}

export function deleteHolding(id: string) {
  markDirty();
  database().prepare("DELETE FROM holdings WHERE id = ?").run(id);
}

export function listTransactions(): TxnRow[] {
  const rows = database().prepare("SELECT * FROM transactions ORDER BY date DESC, id DESC").all() as Record<string, unknown>[];
  return rows.map(txnFrom);
}

function txnFrom(row: Record<string, unknown>): TxnRow {
  return {
    id: String(row.id),
    holdingId: row.holding_id ? String(row.holding_id) : null,
    type: String(row.type),
    date: String(row.date),
    quantity: String(row.quantity ?? "0"),
    price: String(row.price ?? "0"),
    amount: String(row.amount ?? "0"),
    fees: String(row.fees ?? "0"),
    category: String(row.category ?? ""),
    cashflowKind: String(row.cashflow_kind ?? ""),
    currency: String(row.currency ?? "INR"),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at),
  };
}

export function upsertTransaction(row: TxnRow) {
  markDirty();
  database()
    .prepare(
      `INSERT INTO transactions (id, holding_id, type, date, quantity, price, amount, fees, category, cashflow_kind, currency, notes, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         holding_id=excluded.holding_id, type=excluded.type, date=excluded.date, quantity=excluded.quantity,
         price=excluded.price, amount=excluded.amount, fees=excluded.fees, category=excluded.category,
         cashflow_kind=excluded.cashflow_kind, currency=excluded.currency, notes=excluded.notes`,
    )
    .run(
      row.id, row.holdingId, row.type, row.date, row.quantity || "0", row.price || "0", row.amount || "0", row.fees || "0",
      row.category, row.cashflowKind, row.currency || "INR", row.notes, row.createdAt,
    );
}

export function deleteTransaction(id: string) {
  markDirty();
  database().prepare("DELETE FROM transactions WHERE id = ?").run(id);
}

export function listGoals(): GoalRow[] {
  const rows = database().prepare("SELECT * FROM goals ORDER BY name COLLATE NOCASE").all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    targetAmount: String(row.target_amount),
    targetDate: String(row.target_date ?? ""),
    monthlyContribution: String(row.monthly_contribution ?? "0"),
    notes: String(row.notes ?? ""),
    isSample: b(row.is_sample as number),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export function upsertGoal(row: GoalRow) {
  markDirty();
  database()
    .prepare(
      `INSERT INTO goals (id, name, target_amount, target_date, monthly_contribution, notes, is_sample, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, target_amount=excluded.target_amount, target_date=excluded.target_date,
         monthly_contribution=excluded.monthly_contribution, notes=excluded.notes, updated_at=excluded.updated_at`,
    )
    .run(row.id, row.name, row.targetAmount, row.targetDate, row.monthlyContribution || "0", row.notes, row.isSample ? 1 : 0, row.createdAt, row.updatedAt);
}

export function deleteGoal(id: string) {
  markDirty();
  database().prepare("DELETE FROM goals WHERE id = ?").run(id);
}

export function listAllocations(): AllocationRow[] {
  const rows = database().prepare("SELECT * FROM goal_allocations").all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    goalId: String(row.goal_id),
    holdingId: String(row.holding_id),
    amount: String(row.amount),
  }));
}

export function upsertAllocation(row: AllocationRow) {
  markDirty();
  database()
    .prepare(
      `INSERT INTO goal_allocations (id, goal_id, holding_id, amount) VALUES (?,?,?,?)
       ON CONFLICT(goal_id, holding_id) DO UPDATE SET amount=excluded.amount`,
    )
    .run(row.id, row.goalId, row.holdingId, row.amount);
}

export function deleteAllocation(goalId: string, holdingId: string) {
  markDirty();
  database().prepare("DELETE FROM goal_allocations WHERE goal_id = ? AND holding_id = ?").run(goalId, holdingId);
}

export function listSnapshots(): SnapshotRow[] {
  const rows = database().prepare("SELECT * FROM snapshots ORDER BY date").all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    date: String(row.date),
    totalAssets: String(row.total_assets),
    totalLiabilities: String(row.total_liabilities),
    netWorth: String(row.net_worth),
    breakdownJson: String(row.breakdown_json ?? "{}"),
    note: String(row.note ?? ""),
    createdAt: String(row.created_at),
  }));
}

export function upsertSnapshot(row: SnapshotRow) {
  markDirty();
  database()
    .prepare(
      `INSERT INTO snapshots (id, date, total_assets, total_liabilities, net_worth, breakdown_json, note, created_at)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(date) DO UPDATE SET
         total_assets=excluded.total_assets, total_liabilities=excluded.total_liabilities, net_worth=excluded.net_worth,
         breakdown_json=excluded.breakdown_json, note=excluded.note, created_at=excluded.created_at`,
    )
    .run(row.id, row.date, row.totalAssets, row.totalLiabilities, row.netWorth, row.breakdownJson, row.note, row.createdAt);
}

export function deleteSnapshot(id: string) {
  markDirty();
  database().prepare("DELETE FROM snapshots WHERE id = ?").run(id);
}

export function addAudit(entry: AuditRow) {
  markDirty();
  database()
    .prepare("INSERT INTO audit_log (id, entity, entity_id, action, summary, created_at) VALUES (?,?,?,?,?,?)")
    .run(entry.id, entry.entity, entry.entityId, entry.action, entry.summary, entry.createdAt);
}

export function listAudit(): AuditRow[] {
  const rows = database().prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100").all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    entity: String(row.entity),
    entityId: String(row.entity_id),
    action: String(row.action),
    summary: String(row.summary),
    createdAt: String(row.created_at),
  }));
}

export function getMeta(key: string): string {
  const row = database().prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? "";
}

export function setMeta(key: string, value: string) {
  markDirty();
  database().prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
}

export function deleteSample() {
  markDirty();
  const db = database();
  db.prepare("DELETE FROM holdings WHERE is_sample = 1").run();
  db.prepare("DELETE FROM goals WHERE is_sample = 1").run();
}

export function replaceAll(data: {
  holdings: HoldingRow[];
  transactions: TxnRow[];
  goals: GoalRow[];
  allocations: AllocationRow[];
  snapshots: SnapshotRow[];
}) {
  markDirty();
  const db = database();
  db.exec("DELETE FROM goal_allocations; DELETE FROM transactions; DELETE FROM snapshots; DELETE FROM goals; DELETE FROM holdings;");
  for (const row of data.holdings) upsertHolding(row);
  for (const row of data.transactions) upsertTransaction(row);
  for (const row of data.goals) upsertGoal(row);
  for (const row of data.allocations) upsertAllocation(row);
  for (const row of data.snapshots) upsertSnapshot(row);
}
