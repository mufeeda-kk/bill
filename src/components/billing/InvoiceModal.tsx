import React, { useState } from 'react';
import { Bill, StoreSettings } from '../../types';
import { 
  X, Printer, CheckCircle2, MessageCircle, 
  Share2, ArrowRight, Smartphone, Trash2, AlertTriangle 
} from 'lucide-react';
import { formatCurrency, formatKolkataDateTime } from '../../lib/formatters';
import { openWhatsAppDirect, sanitizeIndianPhoneNumber } from '../../lib/whatsapp';
import { useStore } from '../../context/StoreContext';

interface InvoiceModalProps {
  bill: Bill | null;
  settings: StoreSettings;
  onClose: () => void;
  onNewBill: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  bill,
  settings,
  onClose,
  onNewBill,
}) => {
  if (!bill) return null;

  const { deleteBill } = useStore();
  const [phoneInput, setPhoneInput] = useState<string>(bill.customer_phone || '');
  const [whatsappSent, setWhatsappSent] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Instant 1-click WhatsApp open
  const handleWhatsAppShare = () => {
    const cleaned = sanitizeIndianPhoneNumber(phoneInput);
    openWhatsAppDirect(cleaned, bill, settings);
    setWhatsappSent(true);
  };

  // Direct Browser Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Banner (Success & Invoice #) */}
        <div className="bg-emerald-600 text-white p-4 text-center relative shrink-0">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 text-emerald-100 hover:text-white p-1 rounded-full hover:bg-emerald-700/50"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-1.5 shadow-inner">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-base font-black tracking-tight">BILL COMPLETED!</h2>
          <p className="text-emerald-100 text-xs font-mono font-bold mt-0.5">
            {bill.invoice_number}
          </p>
        </div>

        {/* PRIMARY ACTION: ULTRA-FAST 1-CLICK WHATSAPP SHARING */}
        <div className="p-3 bg-emerald-50 border-b border-emerald-100 shrink-0">
          <label className="text-[11px] font-bold text-emerald-950 flex items-center justify-between mb-1">
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              Customer WhatsApp Number
            </span>
            <span className="text-emerald-700 font-semibold text-[10px]">+91 India</span>
          </label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Smartphone className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-600" />
              <input
                type="tel"
                maxLength={10}
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 10-digit mobile"
                className="w-full pl-8 pr-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* BIG PROMINENT GREEN WHATSAPP BUTTON */}
            <button
              onClick={handleWhatsAppShare}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition active:scale-95 shrink-0"
            >
              <Share2 className="w-4 h-4" />
              <span>{whatsappSent ? 'SENT / RESEND' : 'SEND WA'}</span>
            </button>
          </div>
        </div>

        {/* RECEIPT PREVIEW (Thermal POS Format 58mm/80mm Compatible) */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 printable-invoice text-slate-800 text-xs font-mono">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-inner">
            {/* Store Header */}
            <div className="text-center pb-3 border-b border-dashed border-slate-300">
              <img 
                src="/logo.jpg" 
                alt="Vintage Clothing Store" 
                className="w-16 h-16 object-contain mx-auto mb-1.5"
              />
              <h3 className="font-black text-sm text-slate-900 font-sans tracking-tight">
                {settings.store_name || 'VINTAGE CLOTHING STORE'}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">{settings.tagline || 'Exclusive Fashion'}</p>
              <p className="text-[10px] text-slate-500">{settings.phone}</p>
              <p className="text-[10px] text-slate-500">{settings.address}</p>
            </div>

            {/* Bill Meta */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-bold text-slate-900">{bill.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span>{formatKolkataDateTime(bill.bill_date || bill.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-medium">{bill.customer_name || 'Walk-in'}</span>
              </div>
              {bill.customer_phone && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span>+91 {bill.customer_phone}</span>
                </div>
              )}
              {bill.device_name && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Terminal:</span>
                  <span>{bill.device_name}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-2.5 border-b border-dashed border-slate-300">
              <div className="flex justify-between font-bold text-[10px] text-slate-400 mb-1">
                <span>ITEM</span>
                <span>QTY × RATE</span>
                <span>TOTAL</span>
              </div>

              <div className="space-y-1.5">
                {(bill.items || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-baseline text-[11px]">
                    <div className="max-w-[140px] truncate">
                      <span className="font-medium text-slate-900">{item.product_name}</span>
                      <div className="text-[9px] text-slate-400 font-sans">{item.sku}</div>
                    </div>
                    <div className="text-slate-500 text-[10px]">
                      {item.quantity} × {formatCurrency(item.unit_selling_price, false)}
                    </div>
                    <div className="font-bold text-slate-900 text-right">
                      {formatCurrency(item.line_total, false)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatCurrency(bill.subtotal, false)}</span>
              </div>
              {bill.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span>-{formatCurrency(bill.discount_amount, false)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                <span>GRAND TOTAL</span>
                <span className="text-amber-600">{formatCurrency(bill.grand_total, false)}</span>
              </div>
              <div className="flex justify-between text-slate-600 pt-1">
                <span>Paid ({bill.payment_method})</span>
                <span>{formatCurrency(bill.amount_paid, false)}</span>
              </div>
              {bill.balance_due > 0 && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Balance Due</span>
                  <span>{formatCurrency(bill.balance_due, false)}</span>
                </div>
              )}
            </div>

            {/* Footer Message */}
            <div className="pt-3 text-center text-[10px] text-slate-500 space-y-0.5">
              <p className="font-semibold text-slate-700">Thank you for shopping with us!</p>
              <p>Items exchangeable within 7 days with this bill.</p>
              {settings.upi_id && (
                <p className="text-[9px] text-slate-400">UPI: {settings.upi_id}</p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-3 bg-white border-t border-slate-200 space-y-2 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onNewBill();
              }}
              className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 transition active:scale-95 shadow-sm"
            >
              <span>Start New Bill</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Delete Option on Bill */}
          {!confirmDelete ? (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-[11px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 hover:underline"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete This Bill</span>
              </button>
            </div>
          ) : (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
              <span className="font-bold text-rose-800 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Confirm delete?
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    await deleteBill(bill.id, true);
                    setIsDeleting(false);
                    onClose();
                  }}
                  className="px-3 py-1 bg-rose-600 text-white rounded-lg font-black hover:bg-rose-700 shadow-sm active:scale-95"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
