/**
 * Currency + VAT configuration.
 * Reads from localStorage so the Settings page can change it live.
 * Falls back to ETB / 15% if not set.
 */

function getSymbol(): string {
  try { return localStorage.getItem('storeos-currency') || 'ETB'; } catch { return 'ETB'; }
}

/** Current VAT rate as a decimal, e.g. 0.15 for 15% */
export function getVatRate(): number {
  try {
    const v = parseFloat(localStorage.getItem('storeos-vat-rate') || '15');
    return isNaN(v) ? 0.15 : v / 100;
  } catch { return 0.15; }
}

export function getCurrencySymbol(): string { return getSymbol(); }

/** Format a number as currency: ETB 1,234.56 */
export function fmt(n: number): string {
  const sym = getSymbol();
  return `${sym} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format a number as compact currency: ETB 1.2k */
export function fmtCompact(n: number): string {
  const sym = getSymbol();
  if (n >= 1_000_000) return `${sym} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${sym} ${(n / 1_000).toFixed(1)}k`;
  return `${sym} ${n.toFixed(2)}`;
}

/** Format a number as integer currency (no decimals): ETB 1,234 */
export function fmtInt(n: number): string {
  const sym = getSymbol();
  return `${sym} ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

// Keep legacy named exports for backward compatibility
export const CURRENCY_SYMBOL = 'ETB';
export const CURRENCY_CODE   = 'ETB';
