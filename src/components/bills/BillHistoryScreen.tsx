import React, { useState, useMemo } from 'react';
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
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('all');

  // Cancel Bill Modal
  const [cancellingBill, setCancellingBill] = useState<Bill | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  // Date filtering
  const filteredBills = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (dateFilter === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'yesterday') {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'week') {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'all') {
      start.setFullYear(2020, 0, 1);
    }

    const sTime = start.getTime();
    const eTime = end.getTime();

    return bills.filter((b) => {
      if (filterStatus !== 'ALL' && b.status !== filterStatus) return false;
      const bTime = new Date(b.bill_date).getTime();
      if (bTime < sTime || bTime > eTime) return false;

      const q = search.toLowerCase().trim();
      if (!q) return true;

      const inInvoice = b.invoice_number.toLowerCase().includes(q);
      const inPhone = Boolean(b.customer_phone && b.customer_phone.includes(q));
      const inName = Boolean(b.customer_name && b.customer_name.toLowerCase().includes(q));
      const inItems = Boolean(b.items?.some((it) => it.product_name.toLowerCase().includes(q)));

      return inInvoice || inPhone || inName || inItems;
    });
  }, [bills, filterStatus, dateFilter, search]);

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
            <span>Sales & Bill History</span>
          </h2>
          <p className="text-xs text-slate-500">
            View completed bills, customer details, purchased items, reprint receipts & WhatsApp
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto overflow-x-auto scrollbar-none">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: '7 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'all', label: 'All Bills' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                dateFilter === tab.id
                  ? 'bg-slate-900 text-amber-300 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Status Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice number, phone, customer, or clothing item..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {['ALL', 'COMPLETED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterStatus === st
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-amber-300 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3 sm:px-4">Bill Number</th>
                <th className="py-3 px-3 sm:px-4">Date & Time</th>
                <th className="py-3 px-3 sm:px-4">Customer</th>
                <th className="py-3 px-3 sm:px-4">Items Purchased</th>
                <th className="py-3 px-3 sm:px-4 text-center">Payment</th>
                <th className="py-3 px-3 sm:px-4 text-right">Total Amount</th>
                <th className="py-3 px-3 sm:px-4 text-center">Status</th>
                <th className="py-3 px-3 sm:px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBills.map((bill) => {
                const isCard = bill.payment_method === 'UPI' && bill.notes?.includes('[Payment Method: CARD]');
                const paymentLabel = isCard ? 'CARD' : bill.payment_method;
                const itemsCount = bill.items?.reduce((s, it) => s + it.quantity, 0) || 0;
                const itemsSummary = (bill.items || []).map((i) => `${i.product_name} (${i.quantity})`).join(', ');

                return (
                  <tr key={bill.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 sm:px-4 font-mono font-bold text-slate-900">
                      <button
                        onClick={() => onSelectBill(bill)}
                        className="text-amber-700 hover:text-amber-800 hover:underline"
                      >
                        {bill.invoice_number}
                      </button>
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-slate-500 whitespace-nowrap text-[11px]">
                      {formatKolkataDateTime(bill.bill_date)}
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-slate-800">
                      <div className="font-semibold">{bill.customer_name}</div>
                      {bill.customer_phone && (
                        <div className="text-[10px] text-slate-400 font-mono">+91 {bill.customer_phone}</div>
                      )}
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-slate-600 max-w-xs truncate" title={itemsSummary}>
                      <span className="font-bold text-slate-900">{itemsCount} pcs</span>
                      <span className="text-[11px] text-slate-400 ml-1.5 truncate">
                        {itemsSummary ? `(${itemsSummary})` : ''}
                      </span>
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-center">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                        paymentLabel === 'CASH'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : paymentLabel === 'CARD'
                          ? 'bg-purple-50 text-purple-800 border border-purple-200'
                          : paymentLabel === 'SPLIT'
                          ? 'bg-amber-50 text-amber-900 border border-amber-200'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}>
                        {paymentLabel}
                      </span>
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-right font-black text-slate-900 text-sm">
                      {formatCurrency(bill.grand_total, false)}
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        bill.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {bill.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => onSelectBill(bill)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                          title="View & Print Bill"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {bill.customer_phone && (
                          <button
                            onClick={() => openWhatsAppDirect(bill.customer_phone || '', bill, settings)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            title="Share on WhatsApp"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        )}
                        {bill.status === 'COMPLETED' && (
                          <button
                            onClick={() => {
                              setCancellingBill(bill);
                              setCancelReason('');
                              setCancelMsg(null);
                            }}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                            title="Return / Cancel Bill"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredBills.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No bills found for the selected period or search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Modal */}
      {cancellingBill && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm tracking-tight text-rose-400">Return / Cancel Bill</h3>
                <p className="text-[11px] text-slate-400">{cancellingBill.invoice_number}</p>
              </div>
              <button
                onClick={() => setCancellingBill(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} className="p-4 space-y-3.5 text-xs">
              {cancelMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cancelMsg}</span>
                </div>
              )}

              <p className="text-slate-600 leading-relaxed">
                Cancelling this bill will automatically restock all garments back into your inventory and log the audit movement.
              </p>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Reason for cancellation / return</label>
                <input
                  type="text"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Size mismatch returned by customer"
                  className="w-full px-3 py-2 border rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancellingBill(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Keep Bill
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {isCancelling ? 'Processing...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
