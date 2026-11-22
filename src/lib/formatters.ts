// Currency and Timezone formatters for VINTAGE CLOTHING STORE
// Timezone: Asia/Kolkata
// Currency: INR (₹)

export const CURRENCY_SYMBOL = '₹';
export const SHOP_TIMEZONE = 'Asia/Kolkata';

/**
 * Format numeric value to Indian Rupee currency string
 * e.g. 125000 -> ₹1,25,000.00 or ₹1,25,000
 */
export function formatCurrency(amount: number | undefined | null, includeDecimals = true): string {
  const val = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(val);
}

/**
 * Format Date to Asia/Kolkata time string
 */
export function formatKolkataDateTime(dateString: string | Date | undefined | null): string {
  if (!dateString) return '-';
  try {
    const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: SHOP_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return String(dateString);
  }
}

/**
 * Format Date to Kolkata Date only
 */
export function formatKolkataDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return '-';
  try {
    const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: SHOP_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return String(dateString);
  }
}

/**
 * Format Date to Kolkata Time only
 */
export function formatKolkataTime(dateString: string | Date | undefined | null): string {
  if (!dateString) return '-';
  try {
    const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: SHOP_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return String(dateString);
  }
}

/**
 * Generate unique SKU for product e.g. VCS-SHI-001
 */
export function generateSKU(categoryName: string, existingCount: number): string {
  const prefix = 'VCS';
  const cleanCat = (categoryName || 'GEN').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  const num = String(existingCount + 1).padStart(3, '0');
  return `${prefix}-${cleanCat}-${num}`;
}
