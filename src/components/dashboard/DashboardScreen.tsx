import React, { useMemo, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  ShoppingBag, Smartphone, CreditCard, 
  Shirt, Boxes, AlertTriangle, ArrowRight, Plus, 
  Receipt, Share2, Eye, TrendingUp, Trash2, X 
} from 'lucide-react';
import { formatCurrency, formatKolkataDateTime } from '../../lib/formatters';
import { openWhatsAppDirect } from '../../lib/whatsapp';
import { Bill } from '../../types';

interface DashboardScreenProps {
  onNavigate: (tab: string) => void;
  onSelectBill: (bill: Bill) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate, onSelectBill }) => {
  const { 
    dashboardMetrics, dateRange, setDateRange, 
    bills, products, settings, clearAllBills 
  } = useStore();

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearPasscode, setClearPasscode] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const handleClearAllBills = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clearPasscode.trim() !== (settings.enrollment_passcode || 'VCS786')) {
      setClearError('Invalid passcode. Default is VCS786');
      return;
    }
    setIsClearing(true);
    setClearError(null);
    const res = await clearAllBills();
    setIsClearing(false);
    if (res.success) {
      setIsClearModalOpen(false);
      setClearPasscode('');
    } else {
      setClearError(res.message || 'Failed to clear bills');
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
        <button
          onClick={() => onNavigate('billing')}
          className="col-span-2 sm:col-span-1 p-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-black text-xs sm:text-sm shadow-md transition active:scale-98 flex items-center justify-between"
        >
          <div className="flex items-center space-x-1.5">
            <ShoppingBag className="w-4 h-4" />
            <span>New POS Bill</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onNavigate('products')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 shadow-xs transition flex items-center justify-center space-x-1.5 active:scale-95"
        >
          <Plus className="w-3.5 h-3.5 text-amber-600" />
          <span>Add Product</span>
        </button>

        <button
          onClick={() => onNavigate('inventory')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 shadow-xs transition flex items-center justify-center space-x-1.5 active:scale-95"
        >
          <Boxes className="w-3.5 h-3.5 text-amber-600" />
          <span>Stock</span>
        </button>

        <button
          onClick={() => onNavigate('model-sales')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 shadow-xs transition flex items-center justify-center space-x-1.5 active:scale-95"
        >
          <Shirt className="w-3.5 h-3.5 text-amber-600" />
          <span>Model Sales</span>
        </button>

        {/* Dedicated Profit & Loss Quick Button */}
        <button
          onClick={() => onNavigate('profit-loss')}
          className="col-span-2 sm:col-span-1 p-3 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 rounded-xl font-black text-xs shadow-xs transition flex items-center justify-center space-x-1.5 active:scale-95"
        >
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span>Profit & Loss</span>
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

        {/* 8. Dedicated Profit & Loss Overview Card */}
        <div 
          onClick={() => onNavigate('profit-loss')}
          className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-4 rounded-xl shadow-md cursor-pointer hover:ring-2 hover:ring-amber-400 transition col-span-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Profit & Loss (P&L Overview)
            </span>
            <span className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full text-slate-300 font-bold flex items-center gap-1">
              View Statement <ArrowRight className="w-3 h-3" />
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-800 text-center">
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Revenue</span>
              <span className="text-sm sm:text-base font-bold text-slate-100">{formatCurrency(m.total_sales, false)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Cost (COGS)</span>
              <span className="text-sm sm:text-base font-bold text-rose-400">{formatCurrency(m.total_cogs, false)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Net Profit</span>
              <span className={`text-base sm:text-lg font-black ${m.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(m.net_profit, false)}
              </span>
              <span className="text-[10px] text-emerald-300 font-bold block">
                {m.net_margin_percentage}% margin
              </span>
            </div>
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

          <div className="flex items-center space-x-2">
            {bills.length > 0 && (
              <button
                onClick={() => {
                  setClearError(null);
                  setClearPasscode('');
                  setIsClearModalOpen(true);
                }}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                title="Clear all test bills to start fresh"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Bills (Start Fresh)</span>
              </button>
            )}

            <button
              onClick={() => onNavigate('bills')}
              className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center space-x-1"
            >
              <span>View All</span>
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

      {/* Clear All Test Bills Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-sm">Clear All Bills & Start Fresh</h3>
              </div>
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="text-rose-100 hover:text-white p-1 rounded-lg hover:bg-rose-700/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleClearAllBills} className="p-4 space-y-3.5 text-xs">
              {clearError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{clearError}</span>
                </div>
              )}

              <p className="text-slate-600 leading-relaxed font-medium">
                This will clear all <strong>{bills.length} test bills</strong> and reset today's sales and payment totals to <strong>₹0</strong> across all devices so you can start fresh.
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
                  onClick={() => setIsClearModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClearing}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {isClearing ? 'Clearing...' : 'Clear All & Reset to ₹0'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
