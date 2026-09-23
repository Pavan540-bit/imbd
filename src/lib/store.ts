import { getMeta, listAllocations, listAudit, listGoals, listHoldings, listSnapshots, listTransactions } from "./db";
import { buildPortfolio } from "./portfolio";
import type { PortfolioResult } from "./types";

export function loadPortfolio(asOf?: string): PortfolioResult {
  return buildPortfolio({
    holdings: listHoldings(),
    transactions: listTransactions(),
    goals: listGoals(),
    allocations: listAllocations(),
    snapshots: listSnapshots(),
    asOf,
    marketRefreshedAt: getMeta("market_refreshed_at"),
  });
}

export function loadAudit() {
  return listAudit();
}
