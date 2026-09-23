export const ASSET_CLASSES = [
  { id: "equity", label: "Equities / stocks" },
  { id: "mutual_fund", label: "Mutual funds" },
  { id: "fd", label: "Fixed and recurring deposits" },
  { id: "savings", label: "Savings and cash" },
  { id: "retirement", label: "EPF, PPF, and NPS" },
  { id: "gold", label: "Gold" },
  { id: "real_estate", label: "Real estate and land" },
  { id: "other_investment", label: "Bonds and other investments" },
  { id: "other_asset", label: "Other assets" },
  { id: "liability", label: "Liabilities" },
] as const;

export const BUCKETS = [
  { id: "equity", label: "Direct equities" },
  { id: "mutual_fund", label: "Mutual funds" },
  { id: "fd", label: "Fixed deposits" },
  { id: "savings", label: "Savings and cash" },
  { id: "retirement", label: "EPF, PPF, and NPS" },
  { id: "gold", label: "Gold" },
  { id: "real_estate", label: "Real estate" },
  { id: "other_investment", label: "Bonds and other investments" },
  { id: "other_asset", label: "Other assets" },
] as const;

export const ALLOCATION_MODES = [
  { id: "total", label: "Total assets" },
  { id: "investable", label: "Investable assets" },
  { id: "financial", label: "Financial assets" },
  { id: "equity", label: "Equity only" },
] as const;

export type AllocationMode = (typeof ALLOCATION_MODES)[number]["id"];

export const CHART_COLORS = [
  "#0f766e",
  "#0369a1",
  "#b45309",
  "#6d28d9",
  "#be123c",
  "#3f6212",
  "#a16207",
  "#0e7490",
  "#44403c",
];

export const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/holdings", label: "My Holdings" },
  { href: "/transactions", label: "Transactions" },
  { href: "/allocation", label: "Asset Allocation" },
  { href: "/performance", label: "Performance" },
  { href: "/cashflow", label: "Income & Expenses" },
  { href: "/networth", label: "Net Worth" },
  { href: "/goals", label: "Financial Goals" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
] as const;

export const INCOME_CATEGORIES = [
  "Salary",
  "Dividend",
  "FD interest",
  "Rental income",
  "Other income",
];

export const EXPENSE_CATEGORIES = [
  "Household",
  "Insurance",
  "Taxes",
  "EMI",
  "Lump sum",
  "Loan repayment",
  "SIP contribution",
  "Other expense",
];

export const TXN_TYPES = [
  { id: "buy", label: "Purchase" },
  { id: "sip", label: "SIP installment" },
  { id: "sell", label: "Sale / redemption" },
  { id: "dividend", label: "Dividend / IDCW" },
  { id: "interest", label: "Interest" },
  { id: "rental", label: "Rental income" },
  { id: "contribution", label: "Contribution" },
  { id: "withdrawal", label: "Withdrawal" },
  { id: "fee", label: "Fee" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
  { id: "emi", label: "Monthly EMI" },
  { id: "lump_sum", label: "Lump sum on a loan" },
  { id: "repayment", label: "Loan repayment" },
  { id: "transfer", label: "Transfer between my accounts" },
] as const;

export function classLabel(id: string): string {
  return ASSET_CLASSES.find((c) => c.id === id)?.label ?? id;
}

export function bucketLabel(id: string): string {
  return BUCKETS.find((b) => b.id === id)?.label ?? id;
}
