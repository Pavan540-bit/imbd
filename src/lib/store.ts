import { getMeta, listAllocations, listAudit, listGoals, listHoldings, listSnapshots, listTransactions, prepareDatabase } from "./db";
import { buildPortfolio } from "./portfolio";
import type { PortfolioResult } from "./types";

export async function loadPortfolio(asOf?: string): Promise<PortfolioResult> {
  await prepareDatabase();
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

export async function loadAudit() {
  await prepareDatabase();
  return listAudit();
}
