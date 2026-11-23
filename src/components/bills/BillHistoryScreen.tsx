import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  ReceiptText, Search, Share2, RotateCcw, 
  X, AlertCircle, Eye, Trash2, Users, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { formatCurrency, formatKolkataDateTime } from '../../lib/formatters';
import { openWhatsAppDirect } from '../../lib/whatsapp';
import { Bill } from '../../types';

interface BillHistoryScreenProps {
  onSelectBill: (bill: Bill) => void;
}

interface CustomerRecord {
  name: string;
  phone?: string;
  total_bills: number;
  total_spent: number;
  last_visit: string;
}

export const BillHistoryScreen: React.FC<BillHistoryScreenProps> = ({ onSelectBill }) => {
  const { bills, cancelBill, deleteBill, clearAllBillsAndSales, getCustomers, deleteCustomer, settings } = useStore();
  const [activeView, setActiveView] = useState<'bills' | 'customers'>('bills');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('all');

  // Cancel Bill Modal
  const [cancellingBill, setCancellingBill] = useState<Bill | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  // Clear All Bills Modal (Client Sale Handover)
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Delete Bill Modal
  const [deletingBill, setDeletingBill] = useState<Bill | null>(null);
  const [isDeletingBill, setIsDeletingBill] = useState(false);
  const [deleteBillError, setDeleteBillError] = useState<string | null>(null);

  // Customer Management
  const [customerList, setCustomerList] = useState<CustomerRecord[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerRecord | null>(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const loadCustomers = async () => {
    try {
      const data = await getCustomers();
      setCustomerList(data);
    } catch {
      setCustomerList([]);
    }
  };

  useEffect(() => {
    if (activeView === 'customers') {
      loadCustomers();
    }
  }, [activeView, bills]);

  // Date filtering for bills
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

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return customerList;
    return customerList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }, [customerList, customerSearch]);

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
      setActionSuccessMsg('Bill cancelled and inventory restored successfully.');
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } else {
      setCancelMsg(res.message || 'Failed to cancel bill');
    }
  };

  const handleConfirmDeleteBill = async () => {
    if (!deletingBill) return;
    setIsDeletingBill(true);
    setDeleteBillError(null);

    const res = await deleteBill(deletingBill.id);
    setIsDeletingBill(false);

    if (res.success) {
      const inv = deletingBill.invoice_number;
      setDeletingBill(null);
      setActionSuccessMsg(`Bill ${inv} deleted and inventory restored automatically.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } else {
      setDeleteBillError(res.message || 'Failed to delete bill');
    }
  };

  const handleConfirmDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    setIsDeletingCustomer(true);

    const res = await deleteCustomer(deletingCustomer.phone, deletingCustomer.name);
    setIsDeletingCustomer(false);

    if (res.success) {
      setDeletingCustomer(null);
      await loadCustomers();
      setActionSuccessMsg('Customer record removed safely.');
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } else {
      alert(res.message || 'Failed to delete customer');
    }
  };

  const handleConfirmClearAll = async () => {
    setIsClearingAll(true);
    const res = await clearAllBillsAndSales();
    setIsClearingAll(false);
    setIsClearAllModalOpen(false);
    if (res.success) {
      setActionSuccessMsg('All bills, sales history, and payments have been completely cleared for your client.');
      setTimeout(() => setActionSuccessMsg(null), 5000);
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Success Notification Banner */}
      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header & View Switcher */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-amber-500" />
            <span>Sales & Customer Management</span>
          </h2>
          <p className="text-xs text-slate-500">
            View completed bills, customer directory, reprint receipts, restore stock & manage records
          </p>
        </div>

        {/* Actions & View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {bills.length > 0 && activeView === 'bills' && (
            <button
              onClick={() => setIsClearAllModalOpen(true)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition border border-rose-200"
              title="Clear all bills to prepare for client sale"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Bills</span>
            </button>
          )}

          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveView('bills')}
              className={`px-3.5 py-1.5 rounded-lg transition flex items-center space-x-1.5 ${
                activeView === 'bills'
                  ? 'bg-slate-900 text-amber-300 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ReceiptText className="w-3.5 h-3.5" />
              <span>Bills History</span>
            </button>
            <button
              onClick={() => setActiveView('customers')}
              className={`px-3.5 py-1.5 rounded-lg transition flex items-center space-x-1.5 ${
                activeView === 'customers'
                  ? 'bg-slate-900 text-amber-300 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Customers ({customerList.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= BILLS VIEW ================= */}
      {activeView === 'bills' && (
        <>
          {/* Date Filter & Search Toolbar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
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

              {/* Status Filter */}
              <div className="flex items-center space-x-1.5 self-start sm:self-auto">
                {['ALL', 'COMPLETED', 'CANCELLED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      filterStatus === st
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Filters */}
            <div className="flex space-x-1 overflow-x-auto scrollbar-none pt-1 border-t border-slate-100">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'week', label: 'Past 7 Days' },
                { id: 'month', label: 'This Month' },
                { id: 'all', label: 'All Time' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDateFilter(tab.id as any)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition whitespace-nowrap ${
                    dateFilter === tab.id
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bills Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3 sm:px-4">Invoice #</th>
                    <th className="py-3 px-3 sm:px-4">Date & Time</th>
                    <th className="py-3 px-3 sm:px-4">Customer</th>
                    <th className="py-3 px-3 sm:px-4">Items Sold</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Payment</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Grand Total</th>
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
                                className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition"
                                title="Return / Cancel Bill"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            {/* Delete Bill Action Button */}
                            <button
                              onClick={() => {
                                setDeletingBill(bill);
                                setDeleteBillError(null);
                              }}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Bill & Restore Stock"
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
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No bills found for the selected period or search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ================= CUSTOMERS VIEW ================= */}
      {activeView === 'customers' && (
        <div className="space-y-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search customers by name or phone..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              {customerSearch && (
                <button
                  onClick={() => setCustomerSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="text-xs font-bold text-slate-500 whitespace-nowrap">
              Total: {filteredCustomers.length}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3 sm:px-4">Customer Name</th>
                    <th className="py-3 px-3 sm:px-4">Phone Number</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Bills</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Total Spent</th>
                    <th className="py-3 px-3 sm:px-4">Last Visit</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map((cust, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 sm:px-4 font-bold text-slate-900">
                        {cust.name}
                      </td>
                      <td className="py-3 px-3 sm:px-4 font-mono text-slate-600">
                        {cust.phone ? `+91 ${cust.phone}` : '—'}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center font-bold text-slate-800">
                        {cust.total_bills}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-right font-black text-slate-900">
                        {formatCurrency(cust.total_spent, false)}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-slate-500 text-[11px] whitespace-nowrap">
                        {formatKolkataDateTime(cust.last_visit)}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center">
                        <button
                          onClick={() => setDeletingCustomer(cust)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Customer Profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No customers recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE BILL CONFIRMATION MODAL ================= */}
      {deletingBill && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-200 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm tracking-tight">Delete Bill & Restore Stock</h3>
                  <p className="text-[11px] text-rose-100">{deletingBill.invoice_number}</p>
                </div>
              </div>
              <button
                onClick={() => setDeletingBill(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-rose-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              {deleteBillError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{deleteBillError}</span>
                </div>
              )}

              <p className="text-slate-700 leading-relaxed font-medium">
                Are you sure you want to permanently delete bill <span className="font-mono font-bold text-slate-900">{deletingBill.invoice_number}</span>?
              </p>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-800">{deletingBill.customer_name || 'Walk-in'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bill Amount:</span>
                  <span className="font-black text-slate-900">{formatCurrency(deletingBill.grand_total, false)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Method:</span>
                  <span className="font-bold text-slate-800">{deletingBill.payment_method}</span>
                </div>
              </div>

              {/* Items to be restored */}
              {deletingBill.items && deletingBill.items.length > 0 && (
                <div className="border border-emerald-200 bg-emerald-50/60 p-3 rounded-xl space-y-2">
                  <div className="font-bold text-emerald-900 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Inventory will automatically be restored:</span>
                  </div>
                  <ul className="space-y-1 pl-4 list-disc text-emerald-800 text-[11px]">
                    {deletingBill.items.map((it, i) => (
                      <li key={i}>
                        <span className="font-bold">{it.product_name}</span>: +{it.quantity} units returned to available stock
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                Dashboard metrics (sales amount, payment total, completed bill count) will decrease automatically across all 3 shop devices.
              </p>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingBill(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingBill}
                  onClick={handleConfirmDeleteBill}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeletingBill ? 'Deleting & Restoring...' : 'Confirm Delete & Restore'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE CUSTOMER CONFIRMATION MODAL ================= */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm tracking-tight text-rose-400">Delete Customer Profile</h3>
                <p className="text-[11px] text-slate-400">{deletingCustomer.name}</p>
              </div>
              <button
                onClick={() => setDeletingCustomer(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              <p className="text-slate-700 leading-relaxed font-medium">
                Are you sure you want to remove <span className="font-bold text-slate-900">{deletingCustomer.name}</span>
                {deletingCustomer.phone ? ` (+91 ${deletingCustomer.phone})` : ''}?
              </p>

              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-xl text-[11px] leading-relaxed">
                All personal phone numbers and names will be removed safely, while store accounting and sales totals are preserved without breaking database relationships.
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingCustomer(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingCustomer}
                  onClick={handleConfirmDeleteCustomer}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {isDeletingCustomer ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= CANCEL BILL MODAL ================= */}
      {cancellingBill && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm tracking-tight text-amber-400">Return / Cancel Bill</h3>
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
                  className="w-full px-3 py-2 border rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
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
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {isCancelling ? 'Processing...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clear All Bills Confirmation Modal (Client Sale Handover) */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Trash2 className="w-5 h-5 text-white shrink-0" />
                <div>
                  <h3 className="font-bold text-sm tracking-tight">Clear All Bills & Sales Data</h3>
                  <p className="text-[11px] text-rose-100">Prepare Web App for Client Handover</p>
                </div>
              </div>
              <button
                onClick={() => setIsClearAllModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-rose-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              <p className="text-slate-800 leading-relaxed font-semibold">
                Are you preparing to sell this web app to your client?
              </p>

              <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3 rounded-xl space-y-1.5 text-[11px] leading-relaxed">
                <div>This will permanently delete:</div>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Today's Sales & Bills:</strong> Resets to ₹0 and 0 completed bills.</li>
                  <li><strong>7-day and 30-day Sales History:</strong> Cleared completely.</li>
                  <li><strong>Payment Collections:</strong> Cash, UPI/GPay, and Card reset to ₹0.</li>
                  <li><strong>Customer Invoices:</strong> All past test receipts removed.</li>
                </ul>
              </div>

              <p className="text-[11px] text-slate-500">
                Your store settings, brand logo, and phone connections will remain intact. The client will start from 0.
              </p>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsClearAllModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isClearingAll}
                  onClick={handleConfirmClearAll}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isClearingAll ? 'Clearing All Bills...' : 'Confirm Clear All Bills (Start at ₹0)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
