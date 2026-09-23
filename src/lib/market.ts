import { getHolding, listHoldings, setMeta, upsertHolding } from "./db";

export type RefreshResult = {
  updated: { name: string; price: string; source: string }[];
  skipped: { name: string; reason: string }[];
  refreshedAt: string;
};

function yahooSymbol(ticker: string, exchange: string): string {
  const t = ticker.trim().toUpperCase();
  if (t.endsWith(".NS") || t.endsWith(".BO")) return t;
  return exchange.toUpperCase() === "BSE" ? `${t}.BO` : `${t}.NS`;
}

async function yahooPrice(symbol: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    chart?: { result?: { meta?: { regularMarketPrice?: number } }[] };
  };
  const price = body.chart?.result?.[0]?.meta?.regularMarketPrice;
  return typeof price === "number" && price > 0 ? price : null;
}

async function amfiNavs(): Promise<Map<string, { nav: string; date: string }>> {
  const res = await fetch("https://www.amfiindia.com/spages/NAVAll.txt", {
    signal: AbortSignal.timeout(20000),
    headers: { "user-agent": "Mozilla/5.0", accept: "text/plain" },
  });
  if (!res.ok) throw new Error(`AMFI responded with ${res.status}`);
  const text = await res.text();
  const map = new Map<string, { nav: string; date: string }>();
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split(";");
    if (parts.length < 5) continue;
    const code = parts[0]?.trim();
    const nav = parts[4]?.trim();
    if (!/^\d+$/.test(code || "")) continue;
    if (!nav || !/^\d+(\.\d+)?$/.test(nav)) continue;
    map.set(code, { nav, date: parts[5]?.trim() || "" });
  }
  return map;
}

export async function refreshMarketPrices(): Promise<RefreshResult> {
  const holdings = listHoldings();
  const updated: RefreshResult["updated"] = [];
  const skipped: RefreshResult["skipped"] = [];
  const now = new Date().toISOString();
  let navs: Map<string, { nav: string; date: string }> | null = null;
  const needsAmfi = holdings.some((h) => h.assetClass === "mutual_fund" && h.ticker.trim());
  if (needsAmfi) {
    try {
      navs = await amfiNavs();
    } catch {
      navs = null;
    }
  }

  for (const holding of holdings) {
    if (holding.assetClass === "equity" && holding.ticker.trim()) {
      const symbol = yahooSymbol(holding.ticker, holding.exchange);
      try {
        const price = await yahooPrice(symbol);
        if (price == null) {
          skipped.push({ name: holding.name, reason: `No price returned for ${symbol}. The stored price was left unchanged.` });
          continue;
        }
        const current = getHolding(holding.id);
        if (!current) continue;
        upsertHolding({
          ...current,
          currentPrice: price.toFixed(2),
          priceSource: "market",
          priceUpdatedAt: now,
          manualValue: "",
          updatedAt: now,
        });
        updated.push({ name: holding.name, price: price.toFixed(2), source: `Yahoo Finance (${symbol})` });
      } catch {
        skipped.push({ name: holding.name, reason: `Could not reach Yahoo Finance for ${symbol}. The stored price was left unchanged.` });
      }
    } else if (holding.assetClass === "mutual_fund") {
      const code = holding.ticker.trim();
      if (!code) {
        skipped.push({ name: holding.name, reason: "Add the AMFI scheme code before a NAV can be fetched." });
        continue;
      }
      if (!navs) {
        skipped.push({ name: holding.name, reason: "AMFI NAV file could not be downloaded. The stored NAV was left unchanged." });
        continue;
      }
      const found = navs.get(code);
      if (!found) {
        skipped.push({ name: holding.name, reason: `Scheme code ${code} was not in the AMFI file. The stored NAV was left unchanged.` });
        continue;
      }
      const current = getHolding(holding.id);
      if (!current) continue;
      upsertHolding({
        ...current,
        currentPrice: found.nav,
        priceSource: "market",
        priceUpdatedAt: now,
        manualValue: "",
        updatedAt: now,
      });
      updated.push({ name: holding.name, price: found.nav, source: "AMFI NAV" });
    }
  }

  if (updated.length) setMeta("market_refreshed_at", now);
  return { updated, skipped, refreshedAt: updated.length ? now : "" };
}
