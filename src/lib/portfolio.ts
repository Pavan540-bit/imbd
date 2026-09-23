import { BUCKETS } from "./constants";
import { Dec, sumDec } from "./decimal";
import { addMonths, daysBetween, maskAccount, monthKey, todayISO } from "./format";
import type {
  AllocationRow,
  AllocationSlice,
  CashMonth,
  GoalRow,
  GoalView,
  HoldingRow,
  HoldingView,
  PortfolioResult,
  SnapshotRow,
  TxnRow,
  ValueKind,
} from "./types";

const LEDGER = new Set(["equity", "mutual_fund", "gold", "other_investment"]);
const IN_TYPES = new Set(["buy", "sip", "opening", "contribution"]);
const OUT_TYPES = new Set(["sell", "redemption", "withdrawal"]);
const INCOME_TYPES = new Set(["dividend", "interest", "idcw", "rental", "income"]);
const EXPENSE_TYPES = new Set(["expense", "repayment", "emi", "lump_sum"]);
const LOAN_PAYMENT_TYPES = new Set(["emi", "lump_sum", "repayment"]);

export type Replay = {
  quantity: Dec;
  cost: Dec;
  realized: Dec;
  income: Dec;
  gross: Dec;
  warnings: string[];
  realizations: { date: string; proceeds: string; cost: string; profit: string }[];
  flows: { date: string; amount: number; estimatedTerminal?: boolean }[];
};

export function money(n: Dec | null | undefined, dp = 2): string | null {
  if (n == null) return null;
  return n.toFixed(dp);
}

function nz(s: string | null | undefined): Dec {
  return Dec.parse(s || "0");
}

function inr(amount: Dec, fx: Dec): Dec | null {
  if (fx.isZero() || fx.isNeg()) return null;
  return amount.mul(fx);
}

export function principalApplied(t: TxnRow): Dec {
  if (!LOAN_PAYMENT_TYPES.has(t.type)) return Dec.zero;
  const principal = nz(t.price);
  return principal.isZero() ? nz(t.amount) : principal;
}

export function cashflowKindFor(type: string, explicit?: string): string {
  if (LOAN_PAYMENT_TYPES.has(type)) return "expense";
  if (explicit) return explicit;
  if (IN_TYPES.has(type)) return "investment";
  if (OUT_TYPES.has(type)) return "proceeds";
  if (INCOME_TYPES.has(type)) return "income";
  if (EXPENSE_TYPES.has(type)) return "expense";
  if (type === "transfer") return "transfer";
  if (type === "fee") return "investment";
  return "adjustment";
}

export function replay(txns: TxnRow[]): Replay {
  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let quantity = Dec.zero;
  let cost = Dec.zero;
  let realized = Dec.zero;
  let income = Dec.zero;
  let gross = Dec.zero;
  const warnings: string[] = [];
  const realizations: Replay["realizations"] = [];
  const flows: Replay["flows"] = [];

  for (const t of sorted) {
    const qty = nz(t.quantity);
    const fees = nz(t.fees);
    const price = nz(t.price);
    let amt = nz(t.amount);
    if (amt.isZero() && !qty.isZero() && !price.isZero()) amt = qty.mul(price);

    if (t.type === "buy" || t.type === "sip" || t.type === "opening" || t.type === "contribution") {
      const add = amt.add(fees);
      if (!qty.isZero()) quantity = quantity.add(qty);
      cost = cost.add(add);
      gross = gross.add(add);
      if (!add.isZero()) flows.push({ date: t.date, amount: -add.toNumber() });
    } else if (t.type === "sell" || t.type === "redemption" || t.type === "withdrawal") {
      if (!qty.isZero() && (quantity.isZero() || qty.gt(quantity))) {
        warnings.push(`A ${t.type} on ${t.date} is larger than the units held, so it was not applied.`);
        continue;
      }
      const sellQty = qty.isZero() ? quantity : qty;
      let removed = Dec.zero;
      if (!quantity.isZero() && !sellQty.isZero()) {
        const avg = cost.div(quantity);
        removed = avg ? avg.mul(sellQty) : Dec.zero;
        quantity = quantity.sub(sellQty);
        cost = cost.sub(removed);
        if (quantity.isZero() || quantity.abs().toNumber() < 1e-8) {
          quantity = Dec.zero;
          cost = Dec.zero;
        }
      } else if (qty.isZero() && t.type === "withdrawal") {
        removed = amt.gt(cost) ? cost : amt;
        cost = cost.sub(removed);
      }
      const proceeds = amt.sub(fees);
      const profit = proceeds.sub(removed);
      realized = realized.add(profit);
      realizations.push({
        date: t.date,
        proceeds: proceeds.toFixed(2),
        cost: removed.toFixed(2),
        profit: profit.toFixed(2),
      });
      if (!proceeds.isZero()) flows.push({ date: t.date, amount: proceeds.toNumber() });
    } else if (INCOME_TYPES.has(t.type)) {
      income = income.add(amt);
      if (!amt.isZero()) flows.push({ date: t.date, amount: amt.toNumber() });
    } else if (t.type === "fee") {
      const fee = fees.isZero() ? amt : fees;
      realized = realized.sub(fee);
      if (!fee.isZero()) flows.push({ date: t.date, amount: -fee.toNumber() });
    }
  }

  return { quantity, cost, realized, income, gross, warnings, realizations, flows };
}

export function xirr(flows: { date: string; amount: number }[]): { rate: number } | { error: string } {
  const usable = flows.filter((f) => f.date && Number.isFinite(f.amount) && f.amount !== 0);
  if (usable.length < 2) return { error: "Insufficient transaction data" };
  if (!usable.some((f) => f.amount < 0) || !usable.some((f) => f.amount > 0)) {
    return { error: "Insufficient transaction data" };
  }
  const times = usable.map((f) => Date.parse(`${f.date.slice(0, 10)}T00:00:00Z`));
  if (times.some((t) => Number.isNaN(t))) return { error: "Insufficient transaction data" };
  const t0 = Math.min(...times);
  const years = times.map((t) => (t - t0) / (365 * 86_400_000));
  if (Math.max(...years) < 1 / 365) return { error: "Insufficient transaction data" };

  let rate = 0.1;
  for (let i = 0; i < 60; i++) {
    let npv = 0;
    let deriv = 0;
    for (let j = 0; j < usable.length; j++) {
      const den = (1 + rate) ** years[j];
      if (!Number.isFinite(den) || den === 0) return { error: "Insufficient transaction data" };
      npv += usable[j].amount / den;
      deriv += (-years[j] * usable[j].amount) / (den * (1 + rate));
    }
    if (Math.abs(npv) < 1e-7) return { rate };
    if (!Number.isFinite(deriv) || deriv === 0) break;
    const next = rate - npv / deriv;
    if (!Number.isFinite(next) || next <= -0.999999) break;
    if (Math.abs(next - rate) < 1e-10) return { rate: next };
    rate = next;
  }
  return { error: "Insufficient transaction data" };
}

function compoundingPerYear(freq: string): number {
  switch (freq) {
    case "yearly":
      return 1;
    case "half-yearly":
      return 2;
    case "monthly":
      return 12;
    case "daily":
      return 365;
    default:
      return 4;
  }
}

function projectGrowth(principal: number, ratePct: number, perYear: number, days: number): number {
  if (days <= 0 || principal <= 0) return principal;
  const r = ratePct / 100;
  const t = days / 365;
  const factor = perYear <= 0 ? 1 + r * t : (1 + r / perYear) ** (perYear * t);
  return principal * factor;
}

export type DepositEstimate = {
  value: Dec | null;
  accrued: Dec | null;
  maturity: Dec | null;
  valueLabel: string;
  accruedLabel: string;
  maturityLabel: string;
  projected: boolean;
};

export function estimateDeposit(h: HoldingRow, txns: TxnRow[], asOf: string): DepositEstimate {
  const rate = nz(h.interestRate).toNumber();
  const perYear = compoundingPerYear(h.compounding);
  const payout = h.payoutType || "cumulative";
  const cumulative = payout === "cumulative" || payout === "at_maturity";
  const lots: { principal: number; start: string }[] = [];
  const contribs = txns.filter((t) => IN_TYPES.has(t.type));
  if (contribs.length) {
    for (const t of contribs) {
      const amt = nz(t.amount).isZero() ? nz(t.quantity).mul(nz(t.price)) : nz(t.amount);
      if (!amt.isZero()) lots.push({ principal: amt.toNumber(), start: t.date || h.startDate });
    }
  } else if (!nz(h.avgCost).isZero()) {
    lots.push({ principal: nz(h.avgCost).toNumber(), start: h.startDate || h.purchaseDate });
  }

  let projectedValue = 0;
  let principalSum = 0;
  let canProject = lots.length > 0 && h.interestRate !== "" && lots.every((l) => l.start);
  for (const lot of lots) {
    principalSum += lot.principal;
    const days = lot.start ? daysBetween(lot.start, asOf) : null;
    if (days == null) {
      canProject = false;
      continue;
    }
    if (cumulative) projectedValue += projectGrowth(lot.principal, rate, perYear, Math.max(0, days));
    else projectedValue += lot.principal;
  }
  const accruedNum = canProject ? projectedValue - principalSum : null;

  let maturityNum: number | null = null;
  if (canProject && h.maturityDate && lots.every((l) => l.start)) {
    maturityNum = 0;
    for (const lot of lots) {
      const days = daysBetween(lot.start, h.maturityDate);
      if (days == null) {
        maturityNum = null;
        break;
      }
      maturityNum += cumulative
        ? projectGrowth(lot.principal, rate, perYear, Math.max(0, days))
        : lot.principal;
    }
  }

  const manual = h.manualValue.trim();
  const enteredAccrued = h.accruedInterest.trim();
  const enteredMaturity = h.maturityAmount.trim();

  const value = manual
    ? nz(manual)
    : canProject
      ? Dec.fromNumber(projectedValue)
      : null;
  const accrued = enteredAccrued
    ? nz(enteredAccrued)
    : accruedNum == null
      ? null
      : Dec.fromNumber(Math.max(0, accruedNum));
  const maturity = enteredMaturity
    ? nz(enteredMaturity)
    : maturityNum == null
      ? null
      : Dec.fromNumber(maturityNum);

  return {
    value,
    accrued,
    maturity,
    valueLabel: manual ? (h.isEstimate ? "Manual estimate" : "Entered value") : canProject ? "Projected estimate" : "Not enough dates to project",
    accruedLabel: enteredAccrued ? "Entered accrued interest" : canProject ? "Projected accrued interest" : "Not enough dates to project",
    maturityLabel: enteredMaturity ? "Entered maturity amount" : maturity ? "Projected maturity amount" : "Not enough dates to project",
    projected: !manual && canProject,
  };
}

function bucketOf(h: HoldingRow): string {
  if (h.assetClass === "liability") return "liability";
  if (BUCKETS.some((b) => b.id === h.assetClass)) return h.assetClass;
  return "other_asset";
}

function positionAmount(t: TxnRow): Dec {
  const amt = nz(t.amount);
  if (!amt.isZero()) return amt;
  return nz(t.quantity).mul(nz(t.price));
}

export function buildPortfolio(input: {
  holdings: HoldingRow[];
  transactions: TxnRow[];
  goals?: GoalRow[];
  allocations?: AllocationRow[];
  snapshots?: SnapshotRow[];
  asOf?: string;
  marketRefreshedAt?: string;
}): PortfolioResult {
  const asOf = input.asOf || todayISO();
  const goals = input.goals ?? [];
  const allocations = input.allocations ?? [];
  const snapshots = [...(input.snapshots ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const txByHolding = new Map<string, TxnRow[]>();
  for (const t of input.transactions) {
    if (!t.holdingId) continue;
    const list = txByHolding.get(t.holdingId) ?? [];
    list.push(t);
    txByHolding.set(t.holdingId, list);
  }

  const views: HoldingView[] = input.holdings.map((h) => valueHolding(h, txByHolding.get(h.id) ?? [], asOf));

  const assets = views.filter((h) => !h.isLiability);
  const liabilities = views.filter((h) => h.isLiability);
  const missing = assets.filter((h) => h.currentValue == null);
  const incomplete = missing.length > 0 || liabilities.some((h) => h.currentValue == null);

  const assetSum = sumPresent(assets.map((h) => h.currentValue)).total;
  const liabilitySum = sumPresent(liabilities.map((h) => h.currentValue)).total;
  const netWorth = assetSum.sub(liabilitySum);

  for (const h of assets) {
    if (h.currentValue != null && !assetSum.isZero()) {
      h.allocationPct = nz(h.currentValue).div(assetSum)!.mul(Dec.parse("100")).toFixed(2);
    }
  }

  const investments = assets.filter((h) => h.investable && !h.liquid);
  const investedRoll = sumPresent(investments.map((h) => h.invested));
  const valueRoll = sumPresent(investments.map((h) => h.currentValue));
  const unrealizedRoll = sumPresent(investments.map((h) => h.unrealized));
  const totalInvested = investedRoll.total;
  const portfolioValue = valueRoll.total;
  const unrealized = unrealizedRoll.partial ? null : unrealizedRoll.total;
  const realized = sumDec(investments.map((h) => nz(h.realized)));
  const income = sumDec(investments.map((h) => nz(h.income)));
  const gross = sumDec(investments.map((h) => nz(h.grossInvested)));
  const profitPartial = unrealizedRoll.partial || valueRoll.partial;
  const totalProfit = unrealized == null ? null : unrealized.add(realized).add(income);
  const totalProfitPct =
    totalProfit && !gross.isZero() ? totalProfit.div(gross)!.mul(Dec.parse("100")).toFixed(2) : null;

  const savings = assets.filter((h) => h.liquid);
  const totalSavings = sumDec(savings.map((h) => nz(h.currentValue)));
  const liquidPct = assetSum && !assetSum.isZero() ? totalSavings.div(assetSum)!.mul(Dec.parse("100")).toFixed(2) : null;

  const thisMonth = asOf.slice(0, 7);
  const prev = addMonths(`${thisMonth}-01`, -1).slice(0, 7);
  const monthlyInvestment = contributionInMonth(input.transactions, thisMonth);
  const previousMonthInvestment = contributionInMonth(input.transactions, prev);

  const allocation = {
    total: slices(assets, () => true),
    investable: slices(assets, (h) => h.investable && !h.personalUse),
    financial: slices(assets, (h) => h.financial),
    equity: slices(assets, (h) => h.equityLike),
  };

  const xirrFlows: { date: string; amount: number }[] = [];
  let excludedXirr = 0;
  for (const h of investments) {
    if (h.xirr == null) excludedXirr += 1;
    const raw = input.holdings.find((row) => row.id === h.id)!;
    const flows = holdingFlows(raw, txByHolding.get(h.id) ?? [], h, asOf);
    if (flows) xirrFlows.push(...flows);
  }
  const px = xirr(xirrFlows);
  const portfolioXirr = "rate" in px ? (px.rate * 100).toFixed(2) : null;
  const portfolioXirrNote =
    "rate" in px
      ? excludedXirr
        ? `Annualized XIRR from dated cash flows. ${excludedXirr} investment${excludedXirr === 1 ? "" : "s"} lacked enough dated data and ${excludedXirr === 1 ? "is" : "are"} excluded. This is not the absolute return percentage.`
        : "Annualized XIRR from dated cash flows. This is not the absolute return percentage."
      : "Insufficient transaction data";

  const byCategory = BUCKETS.map((b) => {
    const rows = investments.filter((h) => h.bucket === b.id);
    if (!rows.length) return null;
    const inv = sumPresent(rows.map((h) => h.invested));
    const val = sumPresent(rows.map((h) => h.currentValue));
    const un = sumPresent(rows.map((h) => h.unrealized));
    const re = sumDec(rows.map((h) => nz(h.realized)));
    const inc = sumDec(rows.map((h) => nz(h.income)));
    const g = sumDec(rows.map((h) => nz(h.grossInvested)));
    const tr = un.partial ? null : un.total.add(re).add(inc);
    return {
      label: b.label,
      invested: inv.partial ? null : money(inv.total),
      value: val.partial ? null : money(val.total),
      unrealized: un.partial ? null : money(un.total),
      realized: re.toFixed(2),
      income: inc.toFixed(2),
      absolutePct: !un.partial && tr && !g.isZero() ? tr.div(g)!.mul(Dec.parse("100")).toFixed(2) : null,
    };
  }).filter((x): x is NonNullable<typeof x> => x != null);

  const months = cashMonths(input.transactions, asOf);
  const current = months.find((m) => m.month === thisMonth) ?? emptyMonth(thisMonth);

  const year = asOf.slice(0, 4);
  const jan = `${year}-01-01`;
  const openingSnap = [...snapshots].reverse().find((s) => s.date >= `${Number(year) - 1}-12-01` && s.date <= jan);
  const opening = openingSnap ? { date: openingSnap.date, value: openingSnap.netWorth } : null;
  const change = opening && netWorth ? netWorth.sub(nz(opening.value)) : null;
  const changePct = change && opening && !nz(opening.value).isZero() ? change.div(nz(opening.value))!.mul(Dec.parse("100")).toFixed(2) : null;

  const deposits = depositSummary(views, asOf);
  const propertyLoanNotInLiabilities = propertyLoanGaps(views);
  const insights = makeInsights({
    assets,
    views,
    allocation: allocation.total,
    liquidPct,
    totalSavings,
    deposits,
    monthlyInvestment,
    previousMonthInvestment,
    incompleteNames: missing.map((h) => h.name),
    netWorth,
    opening,
    change,
    propertyLoanNotInLiabilities,
    asOf,
  });

  const goalViews = goals.map((g) => toGoal(g, allocations, views, asOf));

  return {
    asOf,
    incomplete,
    incompleteNames: missing.map((h) => h.name),
    hasSample: views.some((h) => h.isSample) || goals.some((g) => g.isSample),
    marketRefreshedAt: input.marketRefreshedAt || "",
    cards: {
      totalAssets: money(assetSum),
      totalLiabilities: liabilitySum.toFixed(2),
      netWorth: money(netWorth),
      totalInvested: money(totalInvested),
      portfolioValue: money(portfolioValue),
      totalProfit: money(totalProfit),
      totalProfitPct,
      profitPartial,
      totalSavings: totalSavings.toFixed(2),
      monthlyInvestment: monthlyInvestment.toFixed(2),
      previousMonthInvestment: previousMonthInvestment.toFixed(2),
      liquidValue: totalSavings.toFixed(2),
      liquidPct,
      grossInvested: gross.toFixed(2),
      realized: realized.toFixed(2),
      income: income.toFixed(2),
      unrealized: money(unrealized),
    },
    holdings: views,
    transactions: [...input.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    goals: goalViews,
    snapshots,
    insights,
    allocation,
    cashflow: { months, current },
    performance: { byCategory, portfolioXirr, portfolioXirrNote },
    netWorth: {
      current: money(netWorth),
      opening,
      change: money(change),
      changePct,
      openingNote: opening
        ? `Compared with the snapshot recorded on ${opening.date}.`
        : "No snapshot recorded for the start of this year.",
    },
    deposits,
    propertyLoanNotInLiabilities,
  };
}

function valueHolding(h: HoldingRow, txns: TxnRow[], asOf: string): HoldingView {
  const fx = h.currency === "INR" || !h.fxRate ? Dec.parse("1") : nz(h.fxRate);
  const fxOk = h.currency === "INR" || (!fx.isZero() && !fx.isNeg());
  const bucket = bucketOf(h);
  const warnings: string[] = [];
  if (!fxOk) warnings.push("No exchange rate is stored, so this holding is excluded from rupee totals.");

  const ledger = LEDGER.has(h.assetClass);
  const positionTx = txns.filter((t) => IN_TYPES.has(t.type) || OUT_TYPES.has(t.type) || t.type === "fee" || INCOME_TYPES.has(t.type));
  const hasPosition = txns.some((t) => IN_TYPES.has(t.type) || OUT_TYPES.has(t.type));
  const played = replay(positionTx);
  warnings.push(...played.warnings);

  let quantity: Dec | null = null;
  let cost: Dec | null = null;
  let gross = played.gross;
  let realized = played.realized;
  let income = played.income;

  if (ledger && hasPosition) {
    quantity = played.quantity;
    cost = played.cost;
  } else if (ledger) {
    quantity = nz(h.quantity);
    const avg = nz(h.avgCost);
    if (quantity.isZero()) {
      cost = null;
      gross = Dec.zero;
    } else {
      cost = quantity.mul(avg);
      gross = cost;
      if (h.purchaseDate && !cost.isZero()) {
        played.flows.push({ date: h.purchaseDate, amount: -cost.toNumber() });
      }
    }
  } else if (h.assetClass === "retirement") {
    const contrib = nz(h.employeeContribution).add(nz(h.employerContribution));
    cost = contrib.isZero() ? null : contrib;
    gross = contrib;
    income = played.income;
    realized = played.realized;
  } else if (h.assetClass === "fd") {
    const fromTx = sumDec(txns.filter((t) => IN_TYPES.has(t.type)).map(positionAmount));
    cost = fromTx.isZero() ? (h.avgCost.trim() ? nz(h.avgCost) : null) : fromTx;
    gross = cost ?? Dec.zero;
    income = played.income;
  } else if (h.assetClass === "savings") {
    cost = null;
    gross = Dec.zero;
  } else if (h.assetClass === "real_estate" || h.assetClass === "other_asset") {
    cost = h.avgCost.trim() ? nz(h.avgCost) : null;
    gross = cost ?? Dec.zero;
    income = played.income;
    realized = played.realized;
  } else if (h.assetClass === "liability") {
    cost = null;
  }

  const deposit = h.assetClass === "fd" ? estimateDeposit(h, txns, asOf) : null;
  let value: Dec | null = null;
  let valueKind: ValueKind = "missing";
  let valueLabel = "Price missing";
  let price: string | null = h.currentPrice.trim() ? h.currentPrice : null;

  if (!fxOk) {
    value = null;
    valueKind = "missing";
    valueLabel = "Exchange rate missing";
  } else if (h.assetClass === "fd" && deposit) {
    value = deposit.value ? inr(deposit.value, fx) : null;
    valueKind = deposit.projected ? "estimate" : deposit.value ? (h.isEstimate ? "estimate" : "entered") : "missing";
    valueLabel = deposit.valueLabel;
  } else if (h.assetClass === "savings" || h.assetClass === "liability" || h.assetClass === "retirement" || h.assetClass === "real_estate" || h.assetClass === "other_asset") {
    if (h.manualValue.trim()) {
      value = inr(nz(h.manualValue), fx);
      if (h.assetClass === "liability") {
        valueKind = "liability";
        valueLabel = "Outstanding balance";
        const reduced = sumDec(txns.map(principalApplied));
        if (!reduced.isZero()) {
          const next = value.sub(reduced);
          if (next.isNeg()) {
            value = Dec.zero;
            warnings.push("Recorded EMI and lump sums exceed the outstanding balance, so the balance is shown as zero.");
          } else value = next;
          valueLabel = "Outstanding after EMI and lump sums";
        }
      } else if (h.assetClass === "savings") {
        valueKind = "balance";
        valueLabel = "Entered balance";
      } else if (h.isEstimate) {
        valueKind = "estimate";
        valueLabel = "Manual estimate";
      } else {
        valueKind = "entered";
        valueLabel = "Entered value";
      }
    } else {
      value = null;
      valueKind = "missing";
      valueLabel = "Value not entered";
    }
  } else if (h.manualValue.trim()) {
    value = inr(nz(h.manualValue), fx);
    valueKind = h.isEstimate ? "estimate" : "manual";
    valueLabel = h.isEstimate ? "Manual estimate" : "Entered value";
  } else if (quantity && !quantity.isZero()) {
    if (price) {
      const native = quantity.mul(nz(price));
      value = inr(native, fx);
      valueKind = h.priceSource === "market" ? "market" : "manual";
      valueLabel = h.priceSource === "market" ? "Last fetched price" : "Manually entered price";
    } else {
      value = null;
      valueKind = "missing";
      valueLabel = "Price missing";
    }
  } else if (quantity && quantity.isZero()) {
    value = Dec.zero;
    valueKind = "entered";
    valueLabel = "No units held";
    if (price) warnings.push("A price is stored, but the quantity is zero, so it is not treated as the holding value. Enter the units or a current total value.");
  }

  const valueInCurrency =
    h.currency !== "INR" && price && quantity ? quantity.mul(nz(price)).toFixed(2) : h.currency !== "INR" && h.manualValue ? h.manualValue : null;

  let unrealized: Dec | null = null;
  if (value != null && cost != null && h.assetClass !== "liability" && h.assetClass !== "savings") {
    unrealized = value.sub(cost);
    if (h.assetClass === "fd" && deposit?.projected) {
      warnings.push("Unrealized result uses a projected deposit value.");
    }
    if (h.assetClass === "real_estate" && h.isEstimate) {
      warnings.push("Unrealized result uses an estimated property value.");
    }
  }

  if (fxOk && h.currency !== "INR") {
    if (cost) cost = cost.mul(fx);
    gross = gross.mul(fx);
    realized = realized.mul(fx);
    income = income.mul(fx);
    if (unrealized && value) unrealized = value.sub(cost ?? Dec.zero);
  }

  const unrealizedPct =
    unrealized && cost && !cost.isZero() ? unrealized.div(cost)!.mul(Dec.parse("100")).toFixed(2) : null;
  const totalReturn = unrealized == null ? null : unrealized.add(realized).add(income);
  const absoluteReturnPct =
    totalReturn && !gross.isZero() ? totalReturn.div(gross)!.mul(Dec.parse("100")).toFixed(2) : null;

  const flows = holdingFlows(h, txns, { currentValue: money(value), valueKind, purchaseDate: h.purchaseDate } as HoldingView, asOf, fx);
  let xirrRate: string | null = null;
  let xirrNote = "Insufficient transaction data";
  if (h.assetClass === "fd" && deposit?.projected) {
    xirrNote = "Projected deposit values are excluded from XIRR.";
  } else if (flows) {
    const solved = xirr(flows);
    if ("rate" in solved) {
      xirrRate = (solved.rate * 100).toFixed(2);
      xirrNote =
        valueKind === "market"
          ? "Annualized XIRR using dated cash flows and the last fetched price as today’s value."
          : valueKind === "estimate"
            ? "Annualized XIRR using dated cash flows and an estimated current value."
            : "Annualized XIRR using dated cash flows. This is not the absolute return.";
    }
  }

  const personalUse = h.personalUse || h.subtype === "vehicle";
  const liquid = h.assetClass === "savings";
  const investable = h.assetClass !== "liability" && h.countsAsInvestment && !liquid && !personalUse;
  const financial = h.assetClass !== "liability" && h.assetClass !== "real_estate" && !personalUse;
  const equityLike =
    h.assetClass === "equity" || (h.assetClass === "mutual_fund" && (h.mfCategory === "equity" || h.mfCategory === "index"));

  let propertyEquity: string | null = null;
  if (h.assetClass === "real_estate" && value && h.outstandingLoan.trim()) {
    propertyEquity = value.sub(nz(h.outstandingLoan)).toFixed(2);
  }

  return {
    id: h.id,
    assetClass: h.assetClass,
    bucket,
    subtype: h.subtype,
    name: h.name,
    ticker: h.ticker,
    exchange: h.exchange,
    sector: h.sector,
    institution: h.institution,
    accountRefMasked: maskAccount(h.accountRef),
    quantity: quantity ? quantity.toFixed(4) : null,
    avgCost: quantity && cost && !quantity.isZero() ? cost.div(quantity)!.toFixed(4) : cost ? cost.toFixed(2) : null,
    invested: cost ? cost.toFixed(2) : null,
    grossInvested: gross.toFixed(2),
    currentPrice: price,
    priceSource: h.priceSource || "manual",
    priceUpdatedAt: h.priceUpdatedAt,
    currentValue: money(value),
    valueKind,
    valueLabel,
    unrealized: money(unrealized),
    unrealizedPct,
    realized: realized.toFixed(2),
    income: income.toFixed(2),
    totalReturn: money(totalReturn),
    absoluteReturnPct,
    xirr: xirrRate,
    xirrNote,
    allocationPct: null,
    currency: h.currency || "INR",
    fxRate: h.fxRate || "1",
    valueInCurrency,
    isLiability: h.assetClass === "liability",
    isEstimate: h.isEstimate || valueKind === "estimate",
    isSample: h.isSample,
    personalUse,
    investable,
    financial,
    liquid,
    equityLike,
    updatedAt: h.updatedAt,
    maturityDate: h.maturityDate,
    purchaseDate: h.purchaseDate || h.startDate,
    notes: h.notes,
    warnings,
    fd: deposit
      ? {
          principal: cost ? cost.toFixed(2) : null,
          accrued: money(deposit.accrued),
          accruedLabel: deposit.accruedLabel,
          maturity: money(deposit.maturity),
          maturityLabel: deposit.maturityLabel,
        }
      : null,
    propertyEquity,
    loan: loanSummary(h, txns),
    form: h,
  };
}

function loanSummary(h: HoldingRow, txns: TxnRow[]): HoldingView["loan"] {
  if (h.assetClass !== "liability") return null;
  const emi = sumDec(txns.filter((t) => t.type === "emi").map((t) => nz(t.amount)));
  const lump = sumDec(txns.filter((t) => t.type === "lump_sum").map((t) => nz(t.amount)));
  const reduced = sumDec(txns.map(principalApplied));
  return {
    scheduledEmi: h.monthlyCost.trim() ? nz(h.monthlyCost).toFixed(2) : null,
    emiPaid: emi.toFixed(2),
    lumpSumPaid: lump.toFixed(2),
    principalReduced: reduced.toFixed(2),
    openingOutstanding: nz(h.manualValue).toFixed(2),
  };
}

function holdingFlows(
  h: HoldingRow,
  txns: TxnRow[],
  view: Pick<HoldingView, "currentValue" | "valueKind" | "purchaseDate">,
  asOf: string,
  fx: Dec = Dec.parse("1"),
): { date: string; amount: number }[] | null {
  if (h.assetClass === "savings" || h.assetClass === "liability") return null;
  if (h.assetClass === "fd") {
    const est = estimateDeposit(h, txns, asOf);
    if (est.projected || !view.currentValue) return null;
  }
  if (!view.currentValue) return null;
  const played = replay(txns);
  const flows = [...played.flows];
  if (!flows.length && h.purchaseDate && h.avgCost.trim()) {
    const cost = LEDGER.has(h.assetClass) ? nz(h.quantity).mul(nz(h.avgCost)) : nz(h.avgCost);
    if (!cost.isZero()) flows.push({ date: h.purchaseDate, amount: -cost.toNumber() });
  }
  if (!flows.length && h.startDate && h.avgCost.trim()) {
    flows.push({ date: h.startDate, amount: -nz(h.avgCost).toNumber() });
  }
  const fxN = h.currency === "INR" ? 1 : fx.toNumber();
  const converted = flows.map((f) => ({ date: f.date, amount: f.amount * fxN }));
  const terminal = nz(view.currentValue).toNumber();
  if (terminal !== 0) converted.push({ date: asOf, amount: terminal });
  return converted.length >= 2 ? converted : null;
}

function sumPresent(values: (string | null)[]): { total: Dec; partial: boolean } {
  return {
    total: sumDec(values.filter((v): v is string => v != null).map((v) => nz(v))),
    partial: values.some((v) => v == null),
  };
}

function slices(rows: HoldingView[], pred: (h: HoldingView) => boolean): AllocationSlice[] {
  const picked = rows.filter((h) => pred(h) && h.currentValue != null);
  const total = sumDec(picked.map((h) => nz(h.currentValue)));
  return BUCKETS.map((b) => {
    const value = sumDec(picked.filter((h) => h.bucket === b.id).map((h) => nz(h.currentValue)));
    return {
      id: b.id,
      label: b.label,
      value: value.toFixed(2),
      pct: total.isZero() ? "0.00" : value.div(total)!.mul(Dec.parse("100")).toFixed(2),
    };
  }).filter((s) => !nz(s.value).isZero());
}

function contributionInMonth(txns: TxnRow[], month: string): Dec {
  return sumDec(
    txns
      .filter((t) => t.date.startsWith(month) && (t.type === "buy" || t.type === "sip" || t.type === "opening" || t.type === "contribution"))
      .map((t) => positionAmount(t).add(nz(t.fees))),
  );
}

export function summarizeCashflow(txns: TxnRow[], from?: string, to?: string) {
  const rows = txns.filter((t) => (!from || t.date >= from) && (!to || t.date <= to));
  let income = Dec.zero;
  let expense = Dec.zero;
  let invested = Dec.zero;
  let withdrawals = Dec.zero;
  let transfers = Dec.zero;
  const cats = new Map<string, Dec>();
  for (const t of rows) {
    const kind = t.cashflowKind || cashflowKindFor(t.type);
    const amt = positionAmount(t);
    const key = `${kind}:${t.category || t.type}`;
    if (kind === "income") {
      income = income.add(amt);
      cats.set(key, (cats.get(key) ?? Dec.zero).add(amt));
    } else if (kind === "expense") {
      expense = expense.add(amt);
      cats.set(key, (cats.get(key) ?? Dec.zero).add(amt));
    } else if (kind === "investment" && IN_TYPES.has(t.type)) invested = invested.add(amt.add(nz(t.fees)));
    else if (kind === "proceeds") withdrawals = withdrawals.add(amt);
    else if (kind === "transfer") transfers = transfers.add(amt);
  }
  const surplus = income.sub(expense);
  return {
    income: income.toFixed(2),
    expense: expense.toFixed(2),
    surplus: surplus.toFixed(2),
    invested: invested.toFixed(2),
    withdrawals: withdrawals.toFixed(2),
    transfers: transfers.toFixed(2),
    savingsRate: income.isZero() ? null : surplus.div(income)!.mul(Dec.parse("100")).toFixed(2),
    byCategory: [...cats.entries()].map(([key, amount]) => {
      const [kind, category] = key.split(":");
      return { kind, category, amount: amount.toFixed(2) };
    }),
  };
}

function emptyMonth(month: string): CashMonth {
  return { month, income: "0.00", expense: "0.00", surplus: "0.00", invested: "0.00", withdrawals: "0.00", transfers: "0.00", savingsRate: null };
}

function cashMonths(txns: TxnRow[], asOf: string): CashMonth[] {
  const start = addMonths(`${asOf.slice(0, 7)}-01`, -11);
  const out: CashMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const month = addMonths(start, i).slice(0, 7);
    const s = summarizeCashflow(txns, `${month}-01`, `${month}-31`);
    out.push({
      month,
      income: s.income,
      expense: s.expense,
      surplus: s.surplus,
      invested: s.invested,
      withdrawals: s.withdrawals,
      transfers: s.transfers,
      savingsRate: s.savingsRate,
    });
  }
  return out;
}

function toGoal(g: GoalRow, allocations: AllocationRow[], holdings: HoldingView[], asOf: string): GoalView {
  const mine = allocations.filter((a) => a.goalId === g.id);
  const allocated = sumDec(mine.map((a) => nz(a.amount)));
  const target = nz(g.targetAmount);
  const remaining = target.sub(allocated);
  const progress = target.isZero() ? null : allocated.div(target)!.mul(Dec.parse("100")).toFixed(2);
  const monthly = nz(g.monthlyContribution);
  let estimated: string | null = null;
  let completionNote = "Add a monthly contribution to estimate a completion date. This estimate does not assume investment returns.";
  if (!remaining.isNeg() && remaining.isZero()) {
    completionNote = "The allocated amount has reached the target. This does not predict future market values.";
  } else if (monthly.gt(Dec.zero) && remaining.gt(Dec.zero)) {
    const months = Math.ceil(remaining.toNumber() / monthly.toNumber());
    estimated = addMonths(asOf, months);
    completionNote = `If ₹${monthly.toFixed(2)} is added each month and the allocated amount does not change for other reasons, the remaining ₹${remaining.toFixed(2)} would be covered in ${months} month${months === 1 ? "" : "s"}. Investment returns are not included.`;
  }
  return {
    id: g.id,
    name: g.name,
    targetAmount: target.toFixed(2),
    targetDate: g.targetDate,
    monthlyContribution: monthly.toFixed(2),
    notes: g.notes,
    isSample: g.isSample,
    allocated: allocated.toFixed(2),
    remaining: remaining.toFixed(2),
    progressPct: progress,
    estimatedCompletion: estimated,
    completionNote,
    allocations: mine.map((a) => ({
      holdingId: a.holdingId,
      holdingName: holdings.find((h) => h.id === a.holdingId)?.name ?? "Removed holding",
      amount: nz(a.amount).toFixed(2),
    })),
    form: g,
  };
}

export function allocationRoom(holdingValue: string | null, allocations: AllocationRow[], holdingId: string, ignoreGoalId?: string): Dec | null {
  if (holdingValue == null) return null;
  const used = sumDec(
    allocations.filter((a) => a.holdingId === holdingId && a.goalId !== ignoreGoalId).map((a) => nz(a.amount)),
  );
  return nz(holdingValue).sub(used);
}

function depositSummary(views: HoldingView[], asOf: string): PortfolioResult["deposits"] {
  const fds = views.filter((h) => h.assetClass === "fd");
  const principal = sumDec(fds.map((h) => nz(h.invested)));
  const accruedKnown = fds.every((h) => h.fd?.accrued != null);
  const maturityKnown = fds.every((h) => h.fd?.maturity != null);
  const accrued = sumDec(fds.filter((h) => h.fd?.accrued != null).map((h) => nz(h.fd!.accrued)));
  const maturity = sumDec(fds.filter((h) => h.fd?.maturity != null).map((h) => nz(h.fd!.maturity)));
  const banks = new Map<string, { principal: Dec; value: Dec; complete: boolean }>();
  for (const h of fds) {
    const key = h.institution || "Unspecified";
    const row = banks.get(key) ?? { principal: Dec.zero, value: Dec.zero, complete: true };
    row.principal = row.principal.add(nz(h.invested));
    if (h.currentValue == null) row.complete = false;
    else row.value = row.value.add(nz(h.currentValue));
    banks.set(key, row);
  }
  const upcoming = fds
    .filter((h) => h.maturityDate && daysBetween(asOf, h.maturityDate) != null && daysBetween(asOf, h.maturityDate)! >= 0 && daysBetween(asOf, h.maturityDate)! <= 90)
    .map((h) => ({ id: h.id, name: h.name, institution: h.institution, date: h.maturityDate, principal: h.invested ?? "0.00" }));
  return {
    principal: principal.toFixed(2),
    accrued: fds.length && accruedKnown ? accrued.toFixed(2) : fds.length ? accrued.toFixed(2) : null,
    accruedPartial: fds.length > 0 && !accruedKnown,
    maturity: fds.length && maturityKnown ? maturity.toFixed(2) : null,
    maturityPartial: fds.length > 0 && !maturityKnown,
    byBank: [...banks.entries()].map(([bank, row]) => ({
      bank,
      principal: row.principal.toFixed(2),
      value: row.complete ? row.value.toFixed(2) : null,
    })),
    upcoming,
  };
}

function propertyLoanGaps(views: HoldingView[]) {
  const liabilityNames = views.filter((h) => h.isLiability).map((h) => `${h.name} ${h.subtype}`.toLowerCase());
  const hasHomeLoan = liabilityNames.some((n) => n.includes("home") || n.includes("housing") || n.includes("property"));
  if (hasHomeLoan) return [];
  return views
    .filter((h) => h.assetClass === "real_estate" && h.form.outstandingLoan.trim() && nz(h.form.outstandingLoan).gt(Dec.zero))
    .map((h) => ({ name: h.name, amount: nz(h.form.outstandingLoan).toFixed(2) }));
}

function makeInsights(args: {
  assets: HoldingView[];
  views: HoldingView[];
  allocation: AllocationSlice[];
  liquidPct: string | null;
  totalSavings: Dec;
  deposits: PortfolioResult["deposits"];
  monthlyInvestment: Dec;
  previousMonthInvestment: Dec;
  incompleteNames: string[];
  netWorth: Dec | null;
  opening: { date: string; value: string } | null;
  change: Dec | null;
  propertyLoanNotInLiabilities: { name: string; amount: string }[];
  asOf: string;
}): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  const ranked = [...args.allocation].sort((a, b) => nz(b.value).cmp(nz(a.value)));
  if (ranked[0] && nz(ranked[0].value).gt(Dec.zero)) {
    out.push({
      id: "largest",
      text: `${ranked[0].label} is the largest allocation at ${ranked[0].pct}% of recorded asset value.`,
    });
  }
  if (args.liquidPct) {
    out.push({
      id: "liquid",
      text: `Savings and cash are ${args.liquidPct}% of total assets (₹${args.totalSavings.toFixed(2)}).`,
    });
  }
  const valued = args.assets.filter((h) => h.currentValue != null && h.allocationPct != null);
  const concentrated = [...valued].sort((a, b) => nz(b.allocationPct).cmp(nz(a.allocationPct)))[0];
  if (concentrated && nz(concentrated.allocationPct).gte(Dec.parse("25"))) {
    out.push({
      id: "concentration",
      text: `${concentrated.name} is ${concentrated.allocationPct}% of total assets, the highest single-holding share among recorded values.`,
    });
  }
  for (const m of args.deposits.upcoming) {
    out.push({
      id: `fd-${m.id}`,
      text: `${m.name} at ${m.institution || "the recorded institution"} matures on ${m.date}. Principal recorded: ₹${m.principal}.`,
    });
  }
  if (args.change && args.opening && args.netWorth) {
    out.push({
      id: "nw",
      text: `Net worth is ₹${args.netWorth.toFixed(2)} compared with ₹${args.opening.value} on the snapshot dated ${args.opening.date}, a change of ₹${args.change.toFixed(2)}.`,
    });
  }
  const delta = args.monthlyInvestment.sub(args.previousMonthInvestment);
  if (!args.monthlyInvestment.isZero() || !args.previousMonthInvestment.isZero()) {
    out.push({
      id: "contrib",
      text: `Recorded investment contributions are ₹${args.monthlyInvestment.toFixed(2)} in ${monthKey(args.asOf)} and were ₹${args.previousMonthInvestment.toFixed(2)} the previous month (${delta.isNeg() ? "lower" : "higher"} by ₹${delta.abs().toFixed(2)}).`,
    });
  }
  if (args.incompleteNames.length) {
    out.push({
      id: "missing",
      text: `Current value is missing for ${args.incompleteNames.join(", ")}. Those holdings are omitted from totals instead of being given a substitute price.`,
    });
  }
  for (const gap of args.propertyLoanNotInLiabilities) {
    out.push({
      id: `loan-${gap.name}`,
      text: `${gap.name} has an outstanding property loan of ₹${gap.amount} recorded on the property. It is used only to estimate equity and is not in liabilities, so it does not reduce net worth.`,
    });
  }
  return out;
}

export function listRealizations(holdings: HoldingRow[], txns: TxnRow[], from?: string, to?: string) {
  const out: { holdingId: string; name: string; date: string; proceeds: string; cost: string; profit: string }[] = [];
  for (const h of holdings) {
    const mine = txns.filter((t) => t.holdingId === h.id);
    for (const r of replay(mine).realizations) {
      if (from && r.date < from) continue;
      if (to && r.date > to) continue;
      out.push({ holdingId: h.id, name: h.name, ...r });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function financialYearRange(asOf: string): { from: string; to: string; label: string } {
  const [y, m] = asOf.split("-").map(Number);
  const startYear = m >= 4 ? y : y - 1;
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31`, label: `FY ${startYear}–${String(startYear + 1).slice(2)}` };
}

export function defaultCountsAsInvestment(assetClass: string, subtype: string): boolean {
  if (assetClass === "liability" || assetClass === "savings") return false;
  if (assetClass === "other_asset" && (subtype === "vehicle" || subtype === "")) return false;
  return true;
}
