import { Dec } from "./decimal";

export function formatINR(amount: string | null | undefined, hidden = false): string {
  if (hidden) return "₹ •••••";
  if (amount == null || amount === "") return "—";
  const neg = amount.startsWith("-");
  const raw = neg ? amount.slice(1) : amount;
  const [wholeRaw, fracRaw = ""] = raw.split(".");
  if (!/^\d+$/.test(wholeRaw || "0")) return "—";
  const frac = (fracRaw + "00").slice(0, 2);
  const grouped = groupIndian(wholeRaw || "0");
  return `${neg ? "-" : ""}₹${grouped}.${frac}`;
}

export function formatINRCompact(amount: string | null | undefined, hidden = false): string {
  if (hidden) return "₹ •••••";
  if (amount == null || amount === "") return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return formatINR(amount, false);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${trimNum(abs / 1_00_00_000)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${trimNum(abs / 1_00_000)} L`;
  return formatINR(amount, false);
}

function trimNum(n: number): string {
  const s = n.toFixed(2);
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function groupIndian(whole: string): string {
  const digits = whole.replace(/^0+(?=\d)/, "");
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, digits.length - 3);
  const tail = digits.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${tail}`;
}

export function formatPct(amount: string | null | undefined, withSign = false): string {
  if (amount == null || amount === "") return "—";
  const n = Dec.parse(amount);
  const text = `${n.toFixed(2)}%`;
  if (!withSign) return text;
  if (n.isZero()) return "0.00%";
  return n.isNeg() ? text : `+${text}`;
}

export function formatQty(amount: string | null | undefined): string {
  if (amount == null || amount === "") return "—";
  const s = Dec.parse(amount).toFixed(4).replace(/\.?0+$/, "");
  return s === "" ? "0" : s;
}

export function formatINDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, last);
  const out = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), day));
  return out.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number | null {
  const da = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const db = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round((db - da) / 86_400_000);
}

export function maskAccount(ref: string): string {
  const t = ref.trim();
  if (!t) return "";
  if (t.length <= 4) return "••••";
  return `•••• ${t.slice(-4)}`;
}

export function signedTone(amount: string | null | undefined): "gain" | "loss" | "flat" {
  if (amount == null || amount === "") return "flat";
  const n = Dec.parse(amount);
  if (n.isZero()) return "flat";
  return n.isNeg() ? "loss" : "gain";
}
