import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  ReceiptText, Search, Share2, RotateCcw, 
  X, AlertCircle, Eye, Trash2, ArrowLeftRight, 
  AlertTriangle, Shirt, Check 
} from 'lucide-react';
import { formatCurrency, formatKolkataDateTime } from '../../lib/formatters';
import { openWhatsAppDirect } from '../../lib/whatsapp';
import { Bill } from '../../types';

interface BillHistoryScreenProps {
  onSelectBill: (bill: Bill) => void;
  onNavigate?: (tab: string) => void;
}

export const BillHistoryScreen: React.FC<BillHistoryScreenProps> = ({ onSelectBill, onNavigate }) => {
  const { 
    bills, cancelBill, deleteBill, exchangeBillItem, 
    clearAllBills, settings, setCartDiscount 
  } = useStore();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('all');

  // Cancel Modal State
  const [cancellingBill, setCancellingBill] = useState<Bill | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  // Delete Modal State
  const [deletingBill, setDeletingBill] = useState<Bill | null>(null);
  const [restockOnDelete, setRestockOnDelete] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  // Exchange Modal State
  const [exchangingBill, setExchangingBill] = useState<Bill | null>(null);
  const [exchangeItemId, setExchangeItemId] = useState<string>('');
  const [exchangeQty, setExchangeQty] = useState<number>(1);
  const [exchangeReason, setExchangeReason] = useState<string>('Size mismatch');
  const [isExchanging, setIsExchanging] = useState(false);
  const [exchangeMsg, setExchangeMsg] = useState<string | null>(null);

  // Clear All Bills Modal State
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearPasscode, setClearPasscode] = useState('');
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [clearAllMsg, setClearAllMsg] = useState<string | null>(null);

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

  // Open Exchange Modal
  const handleOpenExchange = (bill: Bill) => {
    setExchangingBill(bill);
    setExchangeItemId(bill.items?.[0]?.id || '');
    setExchangeQty(1);
    setExchangeReason('Size mismatch');
    setExchangeMsg(null);
  };

  // Confirm Exchange Action
  const handleConfirmExchange = async (goToPos: boolean = false) => {
    if (!exchangingBill || !exchangeItemId) return;
    setIsExchanging(true);
    setExchangeMsg(null);

    const res = await exchangeBillItem(
      exchangingBill.id,
      exchangeItemId,
      exchangeQty,
      exchangeReason
    );
    setIsExchanging(false);

    if (res.success) {
      const selectedItem = (exchangingBill.items || []).find((i) => i.id === exchangeItemId);
      const returnCredit = selectedItem ? selectedItem.unit_selling_price * exchangeQty : 0;
      setExchangingBill(null);

      if (goToPos && onNavigate) {
        // Pre-fill return discount in POS billing
        setCartDiscount(returnCredit);
        onNavigate('billing');
      }
    } else {
      setExchangeMsg(res.message || 'Exchange failed');
    }
  };

  // Confirm Delete Bill Action
  const handleConfirmDelete = async () => {
    if (!deletingBill) return;
    setIsDeleting(true);
    setDeleteMsg(null);

    const res = await deleteBill(deletingBill.id, restockOnDelete);
    setIsDeleting(false);

    if (res.success) {
      setDeletingBill(null);
    } else {
      setDeleteMsg(res.message || 'Failed to delete bill');
    }
  };

  // Confirm Cancel Bill Action
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

  // Confirm Clear All Bills (Start Fresh)
  const handleConfirmClearAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clearPasscode.trim() !== (settings.enrollment_passcode || 'VCS786')) {
      setClearAllMsg('Invalid shop passcode. Default is VCS786');
      return;
    }

    setIsClearingAll(true);
    setClearAllMsg(null);
    const res = await clearAllBills();
    setIsClearingAll(false);

    if (res.success) {
      setShowClearAllModal(false);
      setClearPasscode('');
    } else {
      setClearAllMsg(res.message || 'Failed to clear bills');
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
            Completed bills, customer details, print receipts, garment exchange & bill deletion
          </p>
        </div>

        {/* Clear All / Start Fresh Button */}
        {bills.length > 0 && (
          <button
            onClick={() => {
              setClearAllMsg(null);
              setClearPasscode('');
              setShowClearAllModal(true);
            }}
            className="self-start sm:self-auto px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center space-x-1.5 shadow-sm transition"
            title="Wipe sample bills and start fresh"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All Bills (Start Fresh)</span>
          </button>
        )}
      </div>

      {/* Date Filter Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto overflow-x-auto scrollbar-none">
        {[
          { id: 'today', label: 'Today' },
          { id: 'yesterday', label: 'Yesterday' },
          { id: 'week', label: '7 Days' },
          { id: 'month', label: 'This Month' },
          { id: 'all', label: `All Bills (${bills.length})` },
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
          {['ALL', 'COMPLETED', 'RETURNED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition ${
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
                          : bill.status === 'RETURNED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {bill.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {/* 1. View & Print */}
                        <button
                          onClick={() => onSelectBill(bill)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                          title="View & Print Bill"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* 2. Exchange Option */}
                        <button
                          onClick={() => handleOpenExchange(bill)}
                          className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition"
                          title="Exchange Garment"
                        >
                          <ArrowLeftRight className="w-4 h-4" />
                        </button>

                        {/* 3. WhatsApp Share */}
                        {bill.customer_phone && (
                          <button
                            onClick={() => openWhatsAppDirect(bill.customer_phone || '', bill, settings)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            title="Share on WhatsApp"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* 4. Cancel / Return Full Bill */}
                        {bill.status === 'COMPLETED' && (
                          <button
                            onClick={() => {
                              setCancellingBill(bill);
                              setCancelReason('');
                              setCancelMsg(null);
                            }}
                            className="p-1.5 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition"
                            title="Return Entire Bill"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}

                        {/* 5. Delete Bill Option */}
                        <button
                          onClick={() => {
                            setDeletingBill(bill);
                            setRestockOnDelete(true);
                            setDeleteMsg(null);
                          }}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Bill"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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

      {/* 1. EXCHANGE GARMENT MODAL */}
      {exchangingBill && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ArrowLeftRight className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm">Garment Exchange / Return</h3>
                  <p className="text-[11px] text-amber-200 font-mono">{exchangingBill.invoice_number}</p>
                </div>
              </div>
              <button
                onClick={() => setExchangingBill(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              {exchangeMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{exchangeMsg}</span>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-800 block mb-1.5">
                  Select Garment Being Returned / Exchanged:
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {(exchangingBill.items || []).map((it) => {
                    const isSelected = exchangeItemId === it.id;
                    return (
                      <div
                        key={it.id}
                        onClick={() => {
                          setExchangeItemId(it.id);
                          setExchangeQty(1);
                        }}
                        className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900">{it.product_name}</div>
                          <div className="text-[11px] text-slate-500">
                            Purchased: {it.quantity} pcs @ {formatCurrency(it.unit_selling_price, false)}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 block">{formatCurrency(it.line_total, false)}</span>
                          {isSelected && <span className="text-[10px] text-amber-700 font-bold">Selected</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quantity to exchange */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Return Quantity</label>
                  <input
                    type="number"
                    min="1"
                    max={
                      (exchangingBill.items || []).find((i) => i.id === exchangeItemId)?.quantity || 1
                    }
                    value={exchangeQty}
                    onChange={(e) => setExchangeQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 border rounded-xl font-bold text-slate-900 text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Reason for Exchange</label>
                  <input
                    type="text"
                    value={exchangeReason}
                    onChange={(e) => setExchangeReason(e.target.value)}
                    placeholder="e.g. Size mismatch / Colour"
                    className="w-full px-3 py-1.5 border rounded-xl font-medium text-slate-900 text-xs"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  disabled={isExchanging || !exchangeItemId}
                  onClick={() => handleConfirmExchange(false)}
                  className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-sm transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isExchanging ? 'Processing...' : 'Restock Item & Mark Exchanged'}</span>
                </button>

                <button
                  type="button"
                  disabled={isExchanging || !exchangeItemId}
                  onClick={() => handleConfirmExchange(true)}
                  className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 active:scale-98 text-amber-300 font-black rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-sm transition disabled:opacity-50"
                >
                  <Shirt className="w-4 h-4 text-amber-400" />
                  <span>Exchange for New Garment in POS (Apply Credit) ➔</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. DELETE BILL MODAL */}
      {deletingBill && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-sm">Delete Bill</h3>
              </div>
              <button
                onClick={() => setDeletingBill(null)}
                className="text-rose-100 hover:text-white p-1 rounded-lg hover:bg-rose-700/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              {deleteMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{deleteMsg}</span>
                </div>
              )}

              <p className="text-slate-700 leading-relaxed font-medium">
                Are you sure you want to permanently delete bill <strong>{deletingBill.invoice_number}</strong> ({formatCurrency(deletingBill.grand_total, false)})?
              </p>

              <label className="flex items-center space-x-2 p-2 bg-slate-50 border rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={restockOnDelete}
                  onChange={(e) => setRestockOnDelete(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="text-slate-800 font-semibold">
                  Restock sold garments back into store inventory
                </span>
              </label>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingBill(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. CANCEL FULL BILL MODAL */}
      {cancellingBill && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm tracking-tight text-orange-400">Return / Cancel Bill</h3>
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
                Cancelling this bill will automatically restock all garments back into your inventory.
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
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {isCancelling ? 'Processing...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. CLEAR ALL BILLS (START FRESH) MODAL */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-sm">Clear All Bills (Start Fresh)</h3>
              </div>
              <button
                onClick={() => setShowClearAllModal(false)}
                className="text-rose-100 hover:text-white p-1 rounded-lg hover:bg-rose-700/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmClearAll} className="p-4 space-y-3.5 text-xs">
              {clearAllMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{clearAllMsg}</span>
                </div>
              )}

              <p className="text-slate-600 leading-relaxed font-medium">
                This will delete all <strong>{bills.length} bills</strong> and reset today's sales to <strong>₹0</strong> across all devices so you can start fresh with real sales.
              </p>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Enter Shop Passcode to Confirm:
                </label>
                <input
                  type="password"
                  required
                  value={clearPasscode}
                  onChange={(e) => setClearPasscode(e.target.value)}
                  placeholder="Default: VCS786"
                  className="w-full px-3 py-2 border rounded-xl text-sm font-mono font-bold tracking-widest text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearAllModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClearingAll}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {isClearingAll ? 'Clearing...' : 'Clear All & Reset to ₹0'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
