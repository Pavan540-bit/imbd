export type HoldingRow = {
  id: string;
  assetClass: string;
  subtype: string;
  name: string;
  ticker: string;
  exchange: string;
  sector: string;
  institution: string;
  accountRef: string;
  currency: string;
  fxRate: string;
  quantity: string;
  avgCost: string;
  currentPrice: string;
  priceSource: string;
  priceUpdatedAt: string;
  manualValue: string;
  interestRate: string;
  compounding: string;
  payoutType: string;
  startDate: string;
  maturityDate: string;
  purchaseDate: string;
  maturityAmount: string;
  accruedInterest: string;
  sipAmount: string;
  sipFrequency: string;
  sipStart: string;
  employeeContribution: string;
  employerContribution: string;
  contributionFrequency: string;
  rentalIncome: string;
  monthlyCost: string;
  outstandingLoan: string;
  renewalStatus: string;
  mfCategory: string;
  isEstimate: boolean;
  isSample: boolean;
  personalUse: boolean;
  countsAsInvestment: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type TxnRow = {
  id: string;
  holdingId: string | null;
  type: string;
  date: string;
  quantity: string;
  price: string;
  amount: string;
  fees: string;
  category: string;
  cashflowKind: string;
  currency: string;
  notes: string;
  createdAt: string;
};

export type GoalRow = {
  id: string;
  name: string;
  targetAmount: string;
  targetDate: string;
  monthlyContribution: string;
  notes: string;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AllocationRow = {
  id: string;
  goalId: string;
  holdingId: string;
  amount: string;
};

export type SnapshotRow = {
  id: string;
  date: string;
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  breakdownJson: string;
  note: string;
  createdAt: string;
};

export type AuditRow = {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  summary: string;
  createdAt: string;
};

export type ValueKind = "market" | "manual" | "estimate" | "entered" | "missing" | "balance" | "liability";

export type HoldingView = {
  id: string;
  assetClass: string;
  bucket: string;
  subtype: string;
  name: string;
  ticker: string;
  exchange: string;
  sector: string;
  institution: string;
  accountRefMasked: string;
  quantity: string | null;
  avgCost: string | null;
  invested: string | null;
  grossInvested: string | null;
  currentPrice: string | null;
  priceSource: string;
  priceUpdatedAt: string;
  currentValue: string | null;
  valueKind: ValueKind;
  valueLabel: string;
  unrealized: string | null;
  unrealizedPct: string | null;
  realized: string;
  income: string;
  totalReturn: string | null;
  absoluteReturnPct: string | null;
  xirr: string | null;
  xirrNote: string;
  allocationPct: string | null;
  currency: string;
  fxRate: string;
  valueInCurrency: string | null;
  isLiability: boolean;
  isEstimate: boolean;
  isSample: boolean;
  personalUse: boolean;
  investable: boolean;
  financial: boolean;
  liquid: boolean;
  equityLike: boolean;
  updatedAt: string;
  maturityDate: string;
  purchaseDate: string;
  notes: string;
  warnings: string[];
  fd: {
    principal: string | null;
    accrued: string | null;
    accruedLabel: string;
    maturity: string | null;
    maturityLabel: string;
  } | null;
  propertyEquity: string | null;
  loan: {
    scheduledEmi: string | null;
    emiPaid: string;
    lumpSumPaid: string;
    principalReduced: string;
    openingOutstanding: string;
  } | null;
  form: HoldingRow;
};

export type GoalView = {
  id: string;
  name: string;
  targetAmount: string;
  targetDate: string;
  monthlyContribution: string;
  notes: string;
  isSample: boolean;
  allocated: string;
  remaining: string | null;
  progressPct: string | null;
  estimatedCompletion: string | null;
  completionNote: string;
  allocations: { holdingId: string; holdingName: string; amount: string }[];
  form: GoalRow;
};

export type CashMonth = {
  month: string;
  income: string;
  expense: string;
  surplus: string;
  invested: string;
  withdrawals: string;
  transfers: string;
  savingsRate: string | null;
};

export type AllocationSlice = {
  id: string;
  label: string;
  value: string;
  pct: string;
};

export type PortfolioResult = {
  asOf: string;
  incomplete: boolean;
  incompleteNames: string[];
  hasSample: boolean;
  marketRefreshedAt: string;
  cards: {
    totalAssets: string | null;
    totalLiabilities: string;
    netWorth: string | null;
    totalInvested: string | null;
    portfolioValue: string | null;
    totalProfit: string | null;
    totalProfitPct: string | null;
    profitPartial: boolean;
    totalSavings: string;
    monthlyInvestment: string;
    previousMonthInvestment: string;
    liquidValue: string;
    liquidPct: string | null;
    grossInvested: string;
    realized: string;
    income: string;
    unrealized: string | null;
  };
  holdings: HoldingView[];
  transactions: TxnRow[];
  goals: GoalView[];
  snapshots: SnapshotRow[];
  insights: { id: string; text: string }[];
  allocation: Record<"total" | "investable" | "financial" | "equity", AllocationSlice[]>;
  cashflow: { months: CashMonth[]; current: CashMonth };
  performance: {
    byCategory: {
      label: string;
      invested: string | null;
      value: string | null;
      unrealized: string | null;
      realized: string;
      income: string;
      absolutePct: string | null;
    }[];
    portfolioXirr: string | null;
    portfolioXirrNote: string;
  };
  netWorth: {
    current: string | null;
    opening: { date: string; value: string } | null;
    change: string | null;
    changePct: string | null;
    openingNote: string;
  };
  deposits: {
    principal: string;
    accrued: string | null;
    accruedPartial: boolean;
    maturity: string | null;
    maturityPartial: boolean;
    byBank: { bank: string; principal: string; value: string | null }[];
    upcoming: { id: string; name: string; institution: string; date: string; principal: string }[];
  };
  propertyLoanNotInLiabilities: { name: string; amount: string }[];
};
