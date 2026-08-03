// Decimal-safe money helpers. Amounts are stored and exchanged as fixed
// 2-decimal strings (matching numeric(14,2) columns). Internally we operate on
// integer cents (bigint) to avoid floating-point drift.

export const AMOUNT_RE = /^\d+(\.\d+)?$/;

/** Validate a non-negative decimal amount string; returns trimmed value or null. */
export function validAmount(value: string | null | undefined): string | null {
  const v = (value ?? "0").trim();
  return AMOUNT_RE.test(v) ? v : null;
}

/** Like validAmount but throws on corrupt DB-sourced amounts. */
export function amountOrThrow(value: string | null | undefined): string {
  const v = (value ?? "0").trim();
  if (!AMOUNT_RE.test(v)) throw new Error(`Invalid amount: ${value}`);
  return v;
}

/** Parse a non-negative amount string to integer cents (bigint), or null if invalid. */
export function toCents(value: string | null | undefined): bigint | null {
  const v = (value ?? "0").trim();
  if (!AMOUNT_RE.test(v)) return null;
  const [intPart, fracPartRaw = ""] = v.split(".");
  const fracPart = (fracPartRaw + "00").slice(0, 2);
  return BigInt(intPart) * 100n + BigInt(fracPart);
}

/** Format integer cents (bigint, may be negative) as a 2-decimal string. */
export function fromCents(cents: bigint): string {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const int = abs / 100n;
  const frac = abs % 100n;
  return `${neg ? "-" : ""}${int.toString()}.${frac.toString().padStart(2, "0")}`;
}
