import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  ReceiptText, Search, Share2, RotateCcw, 
  X, AlertCircle, Eye 
} from 'lucide-react';
import { formatCurrency, formatKolkataDateTime } from '../../lib/formatters';
import { openWhatsAppDirect } from '../../lib/whatsapp';
import { Bill } from '../../types';

interface BillHistoryScreenProps {
  onSelectBill: (bill: Bill) => void;
}

export const BillHistoryScreen: React.FC<BillHistoryScreenProps> = ({ onSelectBill }) => {
  const { bills, cancelBill, settings } = useStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Cancel Bill Modal
  const [cancellingBill, setCancellingBill] = useState<Bill | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  const filteredBills = bills.filter((b) => {
    if (filterStatus !== 'ALL' && b.status !== filterStatus) return false;
    const q = search.toLowerCase();
    return !q ||
      b.invoice_number.toLowerCase().includes(q) ||
      (b.customer_phone && b.customer_phone.includes(q)) ||
      (b.customer_name && b.customer_name.toLowerCase().includes(q));
  });

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingBill) return;
    if (!cancelReason.trim()) return setCancelMsg('Reason is required');

    setIsCancelling(true);
    const res = await cancelBill(cancellingBill.id, cancelReason);
    setIsCancelling(false);

    if (res.success) {
      setCancellingBill(null);
      setCancelReason('');
    } else {
      setCancelMsg(res.message || 'Failed to cancel bill');
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Top Header */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-amber-500" />
            <span>Bill History & Invoices</span>
          </h2>
          <p className="text-xs text-slate-500">
            Search invoices, customer phone, reprint, WhatsApp share, or process returns
          </p>
        </div>

        {/* Status Filter */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
          {['ALL', 'COMPLETED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterStatus === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice number, customer phone or name..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Invoice Number</th>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Payment</th>
                <th className="py-2.5 px-3">Grand Total</th>
                <th className="py-2.5 px-3">Realized Profit</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                    <button
                      onClick={() => onSelectBill(bill)}
                      className="text-amber-700 hover:underline"
                    >
                      {bill.invoice_number}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                    {formatKolkataDateTime(bill.bill_date)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">
                    <div>{bill.customer_name}</div>
                    {bill.customer_phone && (
                      <div className="text-[10px] text-slate-400 font-mono">+91 {bill.customer_phone}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-600">
                    {bill.payment_method}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    {formatCurrency(bill.grand_total, false)}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-emerald-600">
                    +{formatCurrency(bill.gross_profit, false)}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      bill.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {bill.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1">
                    {/* Instant WhatsApp Share */}
                    <button
                      onClick={() => openWhatsAppDirect(bill.customer_phone || '', bill, settings)}
                      className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold"
                      title="Share via WhatsApp"
                    >
                      <Share2 className="w-3.5 h-3.5 inline" />
                    </button>

                    {/* View Invoice */}
                    <button
                      onClick={() => onSelectBill(bill)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                      title="View & Print"
                    >
                      <Eye className="w-3.5 h-3.5 inline" />
                    </button>

                    {/* Cancel Bill */}
                    {bill.status === 'COMPLETED' && (
                      <button
                        onClick={() => {
                          setCancellingBill(bill);
                          setCancelReason('');
                          setCancelMsg(null);
                        }}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold"
                        title="Cancel Bill / Return"
                      >
                        <RotateCcw className="w-3.5 h-3.5 inline" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {filteredBills.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No bills found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Bill Dialog */}
      {cancellingBill && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden p-5 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-rose-600 text-base">Cancel & Return Bill</h3>
                <p className="text-xs text-slate-500 font-mono font-bold">
                  {cancellingBill.invoice_number} • {formatCurrency(cancellingBill.grand_total, false)}
                </p>
              </div>
              <button onClick={() => setCancellingBill(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} className="space-y-3 pt-3 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px]">
                <p className="font-bold">Important Stock & Financial Safety Notice:</p>
                <p className="mt-0.5">
                  Cancelling this bill will automatically reverse stock deductions and restock all {cancellingBill.items?.length || 1} items back to inventory. The invoice will be archived with a permanent audit record.
                </p>
              </div>

              {cancelMsg && (
                <div className="p-2 bg-red-50 text-red-700 rounded-lg flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cancelMsg}</span>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason for Cancellation / Return *</label>
                <textarea
                  rows={2}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Customer returned item, duplicate billing, or sizing issue"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancellingBill(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Keep Bill
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-md disabled:opacity-50"
                >
                  {isCancelling ? 'Reversing...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
