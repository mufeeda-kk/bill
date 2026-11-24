import React, { useMemo, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  ShoppingBag, Smartphone, CreditCard, 
  Shirt, Boxes, AlertTriangle, ArrowRight, Plus, 
  Receipt, Share2, Eye, Trash2, CheckCircle2, X, AlertCircle, Copy
} from 'lucide-react';
import { formatCurrency, formatKolkataDateTime } from '../../lib/formatters';
import { openWhatsAppDirect } from '../../lib/whatsapp';
import { MANUAL_MANAGEMENT_SQL } from '../../lib/migrationSql';
import { Bill } from '../../types';

interface DashboardScreenProps {
  onNavigate: (tab: string) => void;
  onSelectBill: (bill: Bill) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate, onSelectBill }) => {
  const { 
    dashboardMetrics, dateRange, setDateRange, 
    bills, products, settings, deleteBill, clearAllBillsAndSales 
  } = useStore();

  const [deletingBill, setDeletingBill] = useState<Bill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Clear All Bills Modal (Client Sale Handover)
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  const handleConfirmClearAll = async () => {
    setIsClearingAll(true);
    const res = await clearAllBillsAndSales();
    setIsClearingAll(false);
    setIsClearAllModalOpen(false);
    if (res.success) {
      setSuccessMsg('All bills, sales history, and payments have been completely cleared for your client.');
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingBill) return;
    setIsDeleting(true);
    setDeleteError(null);

    const res = await deleteBill(deletingBill.id);
    setIsDeleting(false);

    if (res.success) {
      const inv = deletingBill.invoice_number;
      setDeletingBill(null);
      setSuccessMsg(`Bill ${inv} deleted and stock restored.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setDeleteError(res.message || 'Failed to delete bill');
    }
  };

  const m = dashboardMetrics || {
    total_sales: 0,
    total_bills: 0,
    gross_profit: 0,
    total_cogs: 0,
    total_expenses: 0,
    net_profit: 0,
    gross_margin_percentage: 0,
    net_margin_percentage: 0,
    total_products: 0,
    total_available_stock: 0,
    total_stock_value: 0,
    low_stock_count: 0,
    out_of_stock_count: 0,
    today_cash: 0,
    today_gpay: 0,
    today_card: 0,
  };

  // Recent 5 bills
  const recentBills = useMemo(() => bills.slice(0, 5), [bills]);

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Success Notification Banner */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between text-xs font-bold animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Welcome & Date Filter Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Daily Shop Overview
          </h2>
          <p className="text-xs text-slate-500">
            Real-time daily sales, payment collection breakdown & stock
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto overflow-x-auto scrollbar-none">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: '7 Days' },
            { id: 'month', label: 'This Month' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateRange(tab.id as 'today' | 'yesterday' | 'week' | 'month')}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                dateRange === tab.id
                  ? 'bg-slate-900 text-amber-300 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* QUICK ACTIONS HERO BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={() => onNavigate('billing')}
          className="col-span-2 sm:col-span-1 p-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-black text-sm shadow-md transition active:scale-98 flex items-center justify-between"
        >
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5" />
            <span>New POS Bill</span>
          </div>
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => onNavigate('products')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 shadow-xs transition flex items-center justify-center space-x-2"
        >
          <Plus className="w-4 h-4 text-amber-600" />
          <span>Add Product</span>
        </button>

        <button
          onClick={() => onNavigate('inventory')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 shadow-xs transition flex items-center justify-center space-x-2"
        >
          <Boxes className="w-4 h-4 text-amber-600" />
          <span>Manage Stock</span>
        </button>

        <button
          onClick={() => onNavigate('model-sales')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 shadow-xs transition flex items-center justify-center space-x-2"
        >
          <Shirt className="w-4 h-4 text-amber-600" />
          <span>Model Sales</span>
        </button>
      </div>

      {/* 7 CORE USEFUL METRIC CARDS AS REQUESTED */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Today's Sales */}
        <div className="bg-slate-900 text-white p-4 rounded-xl shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Today's Sales</span>
            <ShoppingBag className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-2">
            {formatCurrency(m.total_sales, false)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {m.total_bills} bills completed
          </div>
        </div>

        {/* 2. Today's Cash Received */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Cash Received</span>
            <span className="text-base">💵</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
            {formatCurrency(m.today_cash || 0, false)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            Cash in drawer
          </div>
        </div>

        {/* 3. Today's GPay / UPI Received */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">GPay / UPI Received</span>
            <Smartphone className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-600 mt-2">
            {formatCurrency(m.today_gpay || 0, false)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            Direct UPI settlements
          </div>
        </div>

        {/* 4. Today's Card Received */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Card Received</span>
            <CreditCard className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-600 mt-2">
            {formatCurrency(m.today_card || 0, false)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            Card machine total
          </div>
        </div>

        {/* 5. Total Products */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Products</span>
            <Shirt className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
            {products.filter((p) => p.is_active).length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            Active clothing models
          </div>
        </div>

        {/* 6. Total Available Stock */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Available Stock</span>
            <Boxes className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
            {m.total_available_stock} <span className="text-xs font-normal text-slate-500">units</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            Valuation: {formatCurrency(m.total_stock_value, false)}
          </div>
        </div>

        {/* 7. Low Stock Products */}
        <div 
          onClick={() => onNavigate('inventory')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-amber-400 transition"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Low Stock Products</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-900 mt-2">
            {m.low_stock_count} <span className="text-xs font-normal text-amber-700">items</span>
          </div>
          <div className="text-[11px] text-amber-700 font-bold mt-1">
            Tap to restock inventory ➔
          </div>
        </div>
      </div>

      {/* RECENT BILLS SECTION */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="w-4 h-4 text-amber-500" />
            <h3 className="font-black text-sm text-slate-900">Recent Bills</h3>
          </div>
          <div className="flex items-center space-x-3">
            {recentBills.length > 0 && (
              <button
                onClick={() => setIsClearAllModalOpen(true)}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center space-x-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                title="Clear all bills to prepare for client sale"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Bills</span>
              </button>
            )}
            <button
              onClick={() => onNavigate('bills')}
              className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center space-x-1"
            >
              <span>View All Bills</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {recentBills.map((b) => (
            <div
              key={b.id}
              className="p-3 sm:p-4 flex items-center justify-between hover:bg-slate-50 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-xs text-slate-900">{b.invoice_number}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold">
                    {b.payment_method === 'UPI' && b.notes?.includes('[Payment Method: CARD]')
                      ? 'CARD'
                      : b.payment_method}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {formatKolkataDateTime(b.bill_date)} • {b.customer_name || 'Walk-in'} • {b.items?.length || 0} items
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="font-black text-sm text-slate-900">{formatCurrency(b.grand_total, false)}</div>
                  <div className="text-[10px] text-emerald-600 font-bold">Paid</div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onSelectBill(b)}
                    className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                    title="View Receipt"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {b.customer_phone && (
                    <button
                      onClick={() => openWhatsAppDirect(b.customer_phone || '', b, settings)}
                      className="p-1.5 text-emerald-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50"
                      title="Share to WhatsApp"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setDeletingBill(b);
                      setDeleteError(null);
                    }}
                    className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                    title="Delete Bill & Restore Stock"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {recentBills.length === 0 && (
            <div className="py-8 text-center text-slate-400 text-xs">
              No bills recorded today yet.
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
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
              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl space-y-2">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="font-semibold text-[11px] leading-tight">{deleteError}</span>
                  </div>
                  {(deleteError.toLowerCase().includes('sql') || deleteError.toLowerCase().includes('policy') || deleteError.toLowerCase().includes('database')) && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(MANUAL_MANAGEMENT_SQL);
                        alert('SQL Migration copied to clipboard! Open your Supabase Dashboard -> SQL Editor, paste and click Run.');
                      }}
                      className="w-full py-1.5 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 shadow-sm transition active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SQL Migration for Supabase</span>
                    </button>
                  )}
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

              {/* Items returning to stock */}
              {deletingBill.items && deletingBill.items.length > 0 && (
                <div className="border border-emerald-200 bg-emerald-50/60 p-3 rounded-xl space-y-2">
                  <div className="font-bold text-emerald-900 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Inventory will automatically be restored:</span>
                  </div>
                  <ul className="space-y-1 pl-4 list-disc text-emerald-800 text-[11px]">
                    {deletingBill.items.map((it, i) => (
                      <li key={i}>
                        <span className="font-bold">{it.product_name}</span>: +{it.quantity} units returned to inventory
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                Today's sales total, payment receipts, and completed bills count will update immediately.
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
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Deleting...' : 'Confirm Delete & Restore'}</span>
                </button>
              </div>
            </div>
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
