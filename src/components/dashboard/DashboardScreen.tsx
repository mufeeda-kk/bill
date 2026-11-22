import React, { useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  ShoppingBag, Smartphone, CreditCard, 
  Shirt, Boxes, AlertTriangle, ArrowRight, Plus, 
  Receipt, Share2, Eye 
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
    bills, products, settings 
  } = useStore();

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
          <button
            onClick={() => onNavigate('bills')}
            className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center space-x-1"
          >
            <span>View All Bills</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
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
    </div>
  );
};
