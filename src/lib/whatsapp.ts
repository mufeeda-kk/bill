// WhatsApp Instant Bill Sharing Module
// Uses official click-to-chat: https://wa.me/COUNTRYCODEPHONENUMBER?text=ENCODED_MESSAGE
// Optimized for zero second fetch, no PDF delay, direct user click.

import { Bill, StoreSettings } from '../types';
import { formatCurrency, formatKolkataDateTime } from './formatters';

/**
 * Clean phone number to valid 10-12 digit Indian format without spaces, hyphens, or leading 0/+
 */
export function sanitizeIndianPhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  // Remove non-numeric characters
  let digits = rawPhone.replace(/\D/g, '');
  
  // If starts with 91 and has 12 digits, keep it
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  // If starts with 0 and has 11 digits, strip leading 0 and add 91
  if (digits.length === 11 && digits.startsWith('0')) {
    return '91' + digits.slice(1);
  }
  // If exactly 10 digits (standard Indian mobile number), prepend 91
  if (digits.length === 10) {
    return '91' + digits;
  }
  
  return digits;
}

/**
 * Generate formatted WhatsApp receipt text from completed bill data
 */
export function formatWhatsAppReceiptText(bill: Bill, store?: Partial<StoreSettings>): string {
  const storeName = store?.store_name || 'VINTAGE CLOTHING STORE';
  const tagline = store?.tagline || 'Exclusive Men & Women Fashion';
  const phone = store?.phone || '+91 98765 43210';
  const upi = store?.upi_id || 'vintageclothing@upi';

  const dateStr = formatKolkataDateTime(bill.bill_date || bill.created_at);

  // Line items
  const itemsText = (bill.items || []).map((item) => {
    return `• ${item.product_name} × ${item.quantity} — ${formatCurrency(item.line_total, false)}`;
  }).join('\n');

  const discountText = bill.discount_amount > 0 
    ? `\nDiscount: ${formatCurrency(bill.discount_amount, false)}` 
    : '';

  const balanceText = bill.balance_due > 0 
    ? `\n*Balance Due: ${formatCurrency(bill.balance_due, false)}*` 
    : `\nBalance: ₹0`;

  return `*${storeName.toUpperCase()}*
_${tagline}_
📍 ${phone}

🧾 *Invoice:* ${bill.invoice_number}
📅 *Date:* ${dateStr}
👤 *Customer:* ${bill.customer_name || 'Valued Customer'}

-----------------------------
*ITEMS:*
${itemsText}
-----------------------------
Subtotal: ${formatCurrency(bill.subtotal, false)}${discountText}
*Grand Total: ${formatCurrency(bill.grand_total, false)}*

Paid: ${formatCurrency(bill.amount_paid, false)}${balanceText}
Payment Method: ${bill.payment_method}
${bill.payment_method === 'UPI' ? `UPI ID: ${upi}\n` : ''}
Thank you for shopping with us!
Visit again! 🙏`;
}

/**
 * Generate full wa.me link ready for immediate user opening
 */
export function generateWhatsAppLink(
  phoneNumber: string, 
  bill: Bill, 
  store?: Partial<StoreSettings>
): string {
  const cleanedPhone = sanitizeIndianPhoneNumber(phoneNumber);
  const message = formatWhatsAppReceiptText(bill, store);
  const encoded = encodeURIComponent(message);
  
  if (cleanedPhone) {
    return `https://wa.me/${cleanedPhone}?text=${encoded}`;
  }
  // Fallback if no phone number provided yet
  return `https://wa.me/?text=${encoded}`;
}

/**
 * Directly trigger WhatsApp open safely on Android / desktop browser
 */
export function openWhatsAppDirect(
  phoneNumber: string, 
  bill: Bill, 
  store?: Partial<StoreSettings>
): boolean {
  try {
    const url = generateWhatsAppLink(phoneNumber, bill, store);
    // Window open from direct user button tap avoids browser popup blocking
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      // If popup blocker intervened, redirect current location safely
      window.location.href = url;
    }
    return true;
  } catch (err) {
    console.error('Failed to open WhatsApp:', err);
    return false;
  }
}
