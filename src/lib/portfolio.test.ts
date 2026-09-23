import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Dec } from "./decimal";
import { formatINR } from "./format";
import { allocationRoom, buildPortfolio, listRealizations, xirr } from "./portfolio";
import type { GoalRow, HoldingRow, TxnRow } from "./types";

function holding(partial: Partial<HoldingRow> & Pick<HoldingRow, "id" | "assetClass" | "name">): HoldingRow {
  return {
    subtype: "",
    ticker: "",
    exchange: "",
    sector: "",
    institution: "",
    accountRef: "",
    currency: "INR",
    fxRate: "1",
    quantity: "0",
    avgCost: "0",
    currentPrice: "",
    priceSource: "manual",
    priceUpdatedAt: "",
    manualValue: "",
    interestRate: "",
    compounding: "quarterly",
    payoutType: "cumulative",
    startDate: "",
    maturityDate: "",
    purchaseDate: "",
    maturityAmount: "",
    accruedInterest: "",
    sipAmount: "",
    sipFrequency: "",
    sipStart: "",
    employeeContribution: "",
    employerContribution: "",
    contributionFrequency: "",
    rentalIncome: "",
    monthlyCost: "",
    outstandingLoan: "",
    renewalStatus: "",
    mfCategory: "",
    isEstimate: false,
    isSample: false,
    personalUse: false,
    countsAsInvestment: partial.assetClass !== "savings" && partial.assetClass !== "liability",
    notes: "",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...partial,
  };
}

function txn(partial: Partial<TxnRow> & Pick<TxnRow, "id" | "type" | "date" | "amount">): TxnRow {
  return {
    holdingId: null,
    quantity: "0",
    price: "0",
    fees: "0",
    category: "",
    cashflowKind: "",
    currency: "INR",
    notes: "",
    createdAt: "2024-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("equities", () => {
  const stock = holding({
    id: "s1",
    assetClass: "equity",
    name: "Example Ltd",
    ticker: "EX",
    currentPrice: "160",
    quantity: "999",
    avgCost: "1",
  });
  const txns = [
    txn({ id: "t1", holdingId: "s1", type: "buy", date: "2024-01-01", amount: "1000", quantity: "10", price: "100" }),
    txn({ id: "t2", holdingId: "s1", type: "buy", date: "2024-02-01", amount: "2000", quantity: "10", price: "200" }),
    txn({ id: "t3", holdingId: "s1", type: "sell", date: "2024-03-01", amount: "900", quantity: "5", price: "180" }),
  ];

  it("averages cost and applies a partial sale once", () => {
    const result = buildPortfolio({ holdings: [stock], transactions: txns, asOf: "2024-06-01" });
    const row = result.holdings[0];
    assert.equal(row.quantity, "15.0000");
    assert.equal(row.invested, "2250.00");
    assert.equal(row.avgCost, "150.0000");
    assert.equal(row.currentValue, "2400.00");
    assert.equal(row.unrealized, "150.00");
    assert.equal(row.unrealizedPct, "6.67");
    assert.equal(row.realized, "150.00");
    assert.equal(row.income, "0.00");
    assert.equal(row.totalReturn, "300.00");
    assert.equal(row.absoluteReturnPct, "10.00");
    assert.equal(result.cards.portfolioValue, "2400.00");
    assert.equal(result.cards.totalInvested, "2250.00");
  });

  it("does not also count the quantity typed on the holding", () => {
    const result = buildPortfolio({ holdings: [stock], transactions: txns, asOf: "2024-06-01" });
    assert.equal(result.holdings[0].quantity, "15.0000");
  });

  it("shows a negative unrealized result", () => {
    const down = { ...stock, currentPrice: "80" };
    const result = buildPortfolio({ holdings: [down], transactions: txns, asOf: "2024-06-01" });
    assert.equal(result.holdings[0].currentValue, "1200.00");
    assert.equal(result.holdings[0].unrealized, "-1050.00");
    assert.equal(result.holdings[0].unrealizedPct, "-46.67");
  });

  it("does not invent a missing price", () => {
    const blank = { ...stock, currentPrice: "" };
    const result = buildPortfolio({ holdings: [blank], transactions: txns, asOf: "2024-06-01" });
    assert.equal(result.holdings[0].currentValue, null);
    assert.equal(result.holdings[0].valueLabel, "Price missing");
    assert.equal(result.incomplete, true);
    assert.equal(result.cards.totalProfit, null);
    assert.equal(result.cards.portfolioValue, "0.00");
  });

  it("counts a dividend as income once", () => {
    const withDiv = [
      ...txns,
      txn({ id: "d1", holdingId: "s1", type: "dividend", date: "2024-04-01", amount: "100", cashflowKind: "income", category: "Dividend" }),
    ];
    const result = buildPortfolio({ holdings: [stock], transactions: withDiv, asOf: "2024-06-01" });
    assert.equal(result.holdings[0].income, "100.00");
    assert.equal(result.holdings[0].currentValue, "2400.00");
    assert.equal(result.holdings[0].totalReturn, "400.00");
    assert.equal(result.holdings[0].absoluteReturnPct, "13.33");
    assert.equal(result.cashflow.months.find((m) => m.month === "2024-04")?.income, "100.00");
  });

  it("skips a sale that exceeds recorded units", () => {
    const bad = [
      txn({ id: "t1", holdingId: "s1", type: "buy", date: "2024-01-01", amount: "1000", quantity: "10", price: "100" }),
      txn({ id: "t2", holdingId: "s1", type: "sell", date: "2024-02-01", amount: "2000", quantity: "15", price: "100" }),
    ];
    const result = buildPortfolio({
      holdings: [{ ...stock, currentPrice: "100" }],
      transactions: bad,
      asOf: "2024-06-01",
    });
    assert.equal(result.holdings[0].quantity, "10.0000");
    assert.match(result.holdings[0].warnings[0], /not applied/);
  });
});

describe("portfolio totals", () => {
  it("keeps savings, transfers, and liabilities out of investment profit", () => {
    const holdings = [
      holding({ id: "s1", assetClass: "equity", name: "Shares", quantity: "10", avgCost: "100", currentPrice: "150", purchaseDate: "2024-01-01" }),
      holding({ id: "c1", assetClass: "savings", name: "Savings", manualValue: "50000", countsAsInvestment: false }),
      holding({ id: "l1", assetClass: "liability", name: "Personal loan", subtype: "personal_loan", manualValue: "10000", countsAsInvestment: false }),
    ];
    const txns = [
      txn({ id: "i1", type: "income", date: "2024-05-01", amount: "100000", cashflowKind: "income", category: "Salary" }),
      txn({ id: "e1", type: "expense", date: "2024-05-02", amount: "40000", cashflowKind: "expense", category: "Household" }),
      txn({ id: "tr", type: "transfer", date: "2024-05-03", amount: "10000", cashflowKind: "transfer", category: "Transfer" }),
    ];
    const result = buildPortfolio({ holdings, transactions: txns, asOf: "2024-05-15" });
    assert.equal(result.cards.totalAssets, "51500.00");
    assert.equal(result.cards.totalLiabilities, "10000.00");
    assert.equal(result.cards.netWorth, "41500.00");
    assert.equal(result.cards.portfolioValue, "1500.00");
    assert.equal(result.cards.totalSavings, "50000.00");
    assert.equal(result.cards.totalInvested, "1000.00");
    assert.equal(result.cards.totalProfit, "500.00");
    assert.equal(result.holdings.find((h) => h.id === "l1")?.isLiability, true);
    const may = result.cashflow.months.find((m) => m.month === "2024-05")!;
    assert.equal(may.income, "100000.00");
    assert.equal(may.expense, "40000.00");
    assert.equal(may.surplus, "60000.00");
    assert.equal(may.savingsRate, "60.00");
    assert.equal(may.transfers, "10000.00");
    const equityPct = result.allocation.total.find((s) => s.id === "equity")!.pct;
    assert.equal(equityPct, "2.91");
    assert.equal(result.allocation.investable.some((s) => s.id === "savings"), false);
  });

  it("formats compact Indian rupees", () => {
    assert.equal(formatINR("125000"), "₹1,25,000.00");
    assert.equal(formatINR("1250000"), "₹12,50,000.00");
    assert.equal(formatINR("-1050.5"), "-₹1,050.50");
  });
});

describe("returns", () => {
  it("computes XIRR from dated cash flows", () => {
    const solved = xirr([
      { date: "2023-01-01", amount: -10000 },
      { date: "2024-01-01", amount: 11000 },
    ]);
    assert.ok("rate" in solved);
    if ("rate" in solved) assert.ok(Math.abs(solved.rate - 0.1) < 0.0001);
  });

  it("uses a purchase date when no ledger exists and refuses undated holdings", () => {
    const dated = holding({
      id: "s1",
      assetClass: "equity",
      name: "Dated",
      quantity: "1",
      avgCost: "10000",
      currentPrice: "11000",
      purchaseDate: "2023-01-01",
    });
    const undated = holding({
      id: "s2",
      assetClass: "equity",
      name: "Undated",
      quantity: "1",
      avgCost: "10000",
      currentPrice: "11000",
    });
    const result = buildPortfolio({ holdings: [dated, undated], transactions: [], asOf: "2024-01-01" });
    assert.equal(result.holdings[0].xirr, "10.00");
    assert.match(result.holdings[0].xirrNote, /not the absolute return/i);
    assert.equal(result.holdings[1].xirr, null);
    assert.equal(result.holdings[1].xirrNote, "Insufficient transaction data");
  });

  it("does not call absolute return an annualized figure", () => {
    const dated = holding({
      id: "s1",
      assetClass: "equity",
      name: "Dated",
      quantity: "1",
      avgCost: "10000",
      currentPrice: "11000",
      purchaseDate: "2023-01-01",
    });
    const result = buildPortfolio({ holdings: [dated], transactions: [], asOf: "2024-01-01" });
    assert.equal(result.holdings[0].absoluteReturnPct, "10.00");
    assert.equal(result.holdings[0].unrealizedPct, "10.00");
    assert.notEqual(result.holdings[0].xirrNote, "");
  });
});

describe("deposits, property, and goals", () => {
  it("projects FD interest and prefers an entered value", () => {
    const fd = holding({
      id: "fd1",
      assetClass: "fd",
      name: "Bank FD",
      institution: "Sample Bank",
      avgCost: "100000",
      interestRate: "8",
      compounding: "quarterly",
      payoutType: "cumulative",
      startDate: "2023-01-01",
      maturityDate: "2024-01-01",
    });
    const projected = buildPortfolio({ holdings: [fd], transactions: [], asOf: "2024-01-01" });
    assert.equal(projected.holdings[0].currentValue, "108243.22");
    assert.equal(projected.holdings[0].valueLabel, "Projected estimate");
    assert.equal(projected.holdings[0].xirr, null);
    assert.match(projected.holdings[0].xirrNote, /Projected/);

    const entered = buildPortfolio({
      holdings: [{ ...fd, manualValue: "110000", isEstimate: false }],
      transactions: [],
      asOf: "2024-01-01",
    });
    assert.equal(entered.holdings[0].currentValue, "110000.00");
    assert.equal(entered.holdings[0].valueLabel, "Entered value");
  });

  it("does not subtract a property loan from net worth unless it is a liability", () => {
    const property = holding({
      id: "p1",
      assetClass: "real_estate",
      name: "Plot",
      avgCost: "2000000",
      manualValue: "2500000",
      outstandingLoan: "500000",
      isEstimate: true,
      purchaseDate: "2020-01-01",
    });
    const result = buildPortfolio({ holdings: [property], transactions: [], asOf: "2024-06-01" });
    assert.equal(result.cards.totalAssets, "2500000.00");
    assert.equal(result.cards.totalLiabilities, "0.00");
    assert.equal(result.cards.netWorth, "2500000.00");
    assert.equal(result.holdings[0].propertyEquity, "2000000.00");
    assert.equal(result.propertyLoanNotInLiabilities[0].amount, "500000.00");
  });

  it("tracks goal progress without counting the asset twice", () => {
    const fund = holding({
      id: "m1",
      assetClass: "mutual_fund",
      name: "Index fund",
      mfCategory: "index",
      quantity: "100",
      avgCost: "100",
      currentPrice: "120",
      purchaseDate: "2024-01-01",
    });
    const goal: GoalRow = {
      id: "g1",
      name: "Emergency fund",
      targetAmount: "200000",
      targetDate: "2027-01-01",
      monthlyContribution: "10000",
      notes: "",
      isSample: false,
      createdAt: "",
      updatedAt: "",
    };
    const result = buildPortfolio({
      holdings: [fund],
      transactions: [],
      goals: [goal],
      allocations: [{ id: "a1", goalId: "g1", holdingId: "m1", amount: "50000" }],
      asOf: "2024-06-01",
    });
    assert.equal(result.cards.totalAssets, "12000.00");
    assert.equal(result.goals[0].progressPct, "25.00");
    assert.equal(result.goals[0].remaining, "150000.00");
    assert.equal(result.goals[0].estimatedCompletion, "2025-09-01");
    assert.match(result.goals[0].completionNote, /not included/);
    const room = allocationRoom("12000.00", [{ id: "a", goalId: "g1", holdingId: "m1", amount: "5000" }], "m1");
    assert.equal(room?.toFixed(2), "7000.00");
  });
});

describe("loans", () => {
  it("reduces an existing loan by EMI principal and a lump sum once", () => {
    const loan = holding({
      id: "l1",
      assetClass: "liability",
      name: "Home loan",
      subtype: "home_loan",
      manualValue: "500000",
      monthlyCost: "20000",
      countsAsInvestment: false,
    });
    const txns = [
      txn({ id: "e1", holdingId: "l1", type: "emi", date: "2024-05-05", amount: "20000", price: "12000", cashflowKind: "expense", category: "EMI" }),
      txn({ id: "p1", holdingId: "l1", type: "lump_sum", date: "2024-05-20", amount: "50000", cashflowKind: "expense", category: "Lump sum" }),
    ];
    const result = buildPortfolio({ holdings: [loan], transactions: txns, asOf: "2024-05-31" });
    const row = result.holdings[0];
    assert.equal(row.currentValue, "438000.00");
    assert.equal(row.valueLabel, "Outstanding after EMI and lump sums");
    assert.equal(row.loan?.scheduledEmi, "20000.00");
    assert.equal(row.loan?.emiPaid, "20000.00");
    assert.equal(row.loan?.lumpSumPaid, "50000.00");
    assert.equal(row.loan?.principalReduced, "62000.00");
    assert.equal(result.cards.totalLiabilities, "438000.00");
    assert.equal(result.cards.totalAssets, "0.00");
    const may = result.cashflow.months.find((m) => m.month === "2024-05")!;
    assert.equal(may.expense, "70000.00");
    assert.equal(may.income, "0.00");
    assert.equal(result.cards.monthlyInvestment, "0.00");
  });
});

describe("realized gains", () => {
  it("lists sale proceeds separately from income", () => {
    const stock = holding({ id: "s1", assetClass: "equity", name: "Example Ltd" });
    const txns = [
      txn({ id: "t1", holdingId: "s1", type: "buy", date: "2024-01-01", amount: "1000", quantity: "10", price: "100" }),
      txn({ id: "t2", holdingId: "s1", type: "sell", date: "2024-03-01", amount: "900", quantity: "5", price: "180", cashflowKind: "proceeds" }),
    ];
    const rows = listRealizations([stock], txns, "2024-01-01", "2024-12-31");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].profit, "400.00");
    const result = buildPortfolio({ holdings: [{ ...stock, currentPrice: "100" }], transactions: txns, asOf: "2024-06-01" });
    assert.equal(result.cashflow.months.find((m) => m.month === "2024-03")?.income, "0.00");
    assert.equal(result.cards.monthlyInvestment, "0.00");
  });
});

describe("decimal", () => {
  it("rounds money half up", () => {
    assert.equal(Dec.parse("1.005").toFixed(2), "1.01");
    assert.equal(Dec.parse("10").mul(Dec.parse("2.5")).toFixed(2), "25.00");
  });
});
