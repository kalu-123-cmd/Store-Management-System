/**
 * Currency configuration — change CURRENCY_SYMBOL and CURRENCY_CODE here
 * to update every price display across the entire app.
 */
export const CURRENCY_SYMBOL = 'ETB';
export const CURRENCY_CODE   = 'ETB';

/** Format a number as currency: ETB 1,234.56 */
export function fmt(n: number): string {
  return `${CURRENCY_SYMBOL} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format a number as compact currency: ETB 1.2k */
export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${CURRENCY_SYMBOL} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${CURRENCY_SYMBOL} ${(n / 1_000).toFixed(1)}k`;
  return `${CURRENCY_SYMBOL} ${n.toFixed(2)}`;
}

/** Format a number as integer currency (no decimals): ETB 1,234 */
export function fmtInt(n: number): string {
  return `${CURRENCY_SYMBOL} ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
