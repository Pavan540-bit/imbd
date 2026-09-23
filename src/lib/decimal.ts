/** Fixed-point decimal. Scale 8 avoids binary floating point in money math. */

const SCALE = 8;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const TEN = BigInt(10);
const FACTOR = TEN ** BigInt(SCALE);

export class Dec {
  constructor(readonly v: bigint) {}

  static zero = new Dec(ZERO);

  static parse(input: string | number | null | undefined): Dec {
    if (input == null) return Dec.zero;
    let s = String(input).trim().replace(/,/g, "").replace(/₹/g, "");
    if (s === "" || s === "-" || s === "." || s === "-.") return Dec.zero;
    let neg = false;
    if (s.startsWith("-")) {
      neg = true;
      s = s.slice(1);
    }
    if (!/^\d+(\.\d+)?$/.test(s)) return Dec.zero;
    const [whole, frac = ""] = s.split(".");
    const fracPadded = (frac + "0".repeat(SCALE)).slice(0, SCALE);
    const extra = frac.slice(SCALE, SCALE + 1);
    let bi = BigInt(whole || "0") * FACTOR + BigInt(fracPadded || "0");
    if (extra !== "" && extra >= "5") bi += ONE;
    return new Dec(neg ? -bi : bi);
  }

  static fromNumber(n: number): Dec {
    if (!Number.isFinite(n)) return Dec.zero;
    return Dec.parse(n.toFixed(SCALE));
  }

  add(o: Dec): Dec {
    return new Dec(this.v + o.v);
  }

  sub(o: Dec): Dec {
    return new Dec(this.v - o.v);
  }

  neg(): Dec {
    return new Dec(-this.v);
  }

  abs(): Dec {
    return this.v < ZERO ? this.neg() : this;
  }

  mul(o: Dec): Dec {
    const n = this.v * o.v;
    const neg = n < ZERO;
    const an = neg ? -n : n;
    const q = an / FACTOR;
    const r = an % FACTOR;
    const rounded = r * TWO >= FACTOR ? q + ONE : q;
    return new Dec(neg ? -rounded : rounded);
  }

  div(o: Dec): Dec | null {
    if (o.v === ZERO) return null;
    const n = this.v * FACTOR;
    const neg = (n < ZERO) !== (o.v < ZERO);
    const an = n < ZERO ? -n : n;
    const ad = o.v < ZERO ? -o.v : o.v;
    const q = an / ad;
    const r = an % ad;
    const rounded = r * TWO >= ad ? q + ONE : q;
    return new Dec(neg ? -rounded : rounded);
  }

  cmp(o: Dec): number {
    if (this.v < o.v) return -1;
    if (this.v > o.v) return 1;
    return 0;
  }

  isZero(): boolean {
    return this.v === ZERO;
  }

  isNeg(): boolean {
    return this.v < ZERO;
  }

  gt(o: Dec): boolean {
    return this.v > o.v;
  }

  gte(o: Dec): boolean {
    return this.v >= o.v;
  }

  toFixed(dp = 2): string {
    const neg = this.v < ZERO;
    let x = neg ? -this.v : this.v;
    const cut = SCALE - dp;
    if (cut > 0) {
      const base = TEN ** BigInt(cut);
      const q = x / base;
      const r = x % base;
      x = r * TWO >= base ? q + ONE : q;
    }
    const shown = TEN ** BigInt(dp);
    const whole = x / shown;
    const frac = (x % shown).toString().padStart(dp, "0");
    return `${neg ? "-" : ""}${whole.toString()}${dp > 0 ? `.${frac}` : ""}`;
  }

  toNumber(): number {
    return Number(this.toFixed(8));
  }
}

export function sumDec(values: Dec[]): Dec {
  return values.reduce((a, b) => a.add(b), Dec.zero);
}
