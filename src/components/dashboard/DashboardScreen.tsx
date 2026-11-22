import React from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  TrendingUp, ShoppingBag, Receipt, DollarSign, 
  Boxes, AlertTriangle, XCircle, 
  Truck, Shirt, ArrowRight, Share2 
} from 'lucide-react';
import { formatCurrency, formatKolkataTime } from '../../lib/formatters';
import { openWhatsAppDirect } from '../../lib/whatsapp';
import { Bill } from '../../types';

interface DashboardScreenProps {
  onNavigate: (tab: string) => void;
  onSelectBill: (bill: Bill) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate, onSelectBill }) => {
  const { 
    dashboardMetrics, dateRange, setDateRange, 
    customStartDate, setCustomStartDate, customEndDate, setCustomEndDate,
    bills, settings 
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
  };

  // Recent 5 bills
  const recentBills = bills.slice(0, 5);

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Top Banner & Date Filter Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Shop Performance Overview
          </h2>
          <p className="text-xs text-slate-500">
            Real-time sales, inventory value & profit/loss
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-none self-start sm:self-auto">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: '7 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'custom', label: 'Custom' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateRange(tab.id as 'today' | 'yesterday' | 'week' | 'month' | 'custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                dateRange === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Pickers if selected */}
      {dateRange === 'custom' && (
        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-amber-900">Custom Range:</span>
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => setCustomStartDate(e.target.value)}
            className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs"
          />
          <span className="text-amber-800">to</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => setCustomEndDate(e.target.value)}
            className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs"
          />
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Sales */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sales</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 mt-2">
            {formatCurrency(m.total_sales, false)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
            <span>{m.total_bills} bills completed</span>
          </div>
        </div>

        {/* Gross Profit */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Profit</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-blue-600 mt-2">
            {formatCurrency(m.gross_profit, false)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
            <span>Margin: {m.gross_margin_percentage}%</span>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Shop Expenses</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-rose-600 mt-2">
            {formatCurrency(m.total_expenses, false)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">
            <span>COGS: {formatCurrency(m.total_cogs, false)}</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Profit</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-lg sm:text-2xl font-black mt-2 ${m.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(m.net_profit, false)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">
            <span>Net Margin: {m.net_margin_percentage}%</span>
          </div>
        </div>
      </div>

      {/* Secondary Row: Inventory Stats & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Inventory Valuation Card */}
        <div className="bg-slate-900 text-white p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Inventory</span>
              <Boxes className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-300">
              {m.total_available_stock} Units
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Purchase Cost Value: <span className="font-bold text-white">{formatCurrency(m.total_stock_value, false)}</span>
            </div>
          </div>

          {/* Low Stock & Out of Stock Badges */}
          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800">
            <div className="bg-slate-800/80 p-2 rounded-lg flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-amber-300">{m.low_stock_count} Items</div>
                <div className="text-[10px] text-slate-400">Low Stock</div>
              </div>
            </div>

            <div className="bg-slate-800/80 p-2 rounded-lg flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-rose-300">{m.out_of_stock_count} Items</div>
                <div className="text-[10px] text-slate-400">Out of Stock</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
            Quick Actions
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onNavigate('billing')}
              className="p-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm flex flex-col items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
            >
              <ShoppingBag className="w-5 h-5" />
              <span>Quick Billing</span>
            </button>

            <button
              onClick={() => onNavigate('stock-purchase')}
              className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
            >
              <Truck className="w-5 h-5 text-amber-400" />
              <span>Add Stock</span>
            </button>

            <button
              onClick={() => onNavigate('products')}
              className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1.5 active:scale-95 transition"
            >
              <Shirt className="w-5 h-5 text-slate-700" />
              <span>Add Product</span>
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Primary shop timezone: Asia/Kolkata</span>
            <button 
              onClick={() => onNavigate('profit-loss')}
              className="text-amber-600 font-bold hover:underline flex items-center gap-0.5"
            >
              <span>Full P&L Report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Bills Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="w-4 h-4 text-slate-600" />
            <h3 className="font-bold text-sm text-slate-900">Recent Completed Bills</h3>
          </div>
          <button
            onClick={() => onNavigate('bills')}
            className="text-xs text-amber-600 hover:underline font-bold"
          >
            View All Bills ({bills.length})
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-100">
              <tr>
                <th className="py-2.5 px-3">Invoice</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Items</th>
                <th className="py-2.5 px-3">Total</th>
                <th className="py-2.5 px-3">Profit</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                    <button
                      onClick={() => onSelectBill(bill)}
                      className="hover:underline text-amber-700"
                    >
                      {bill.invoice_number}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                    {formatKolkataTime(bill.bill_date)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">
                    <div>{bill.customer_name}</div>
                    {bill.customer_phone && (
                      <div className="text-[10px] text-slate-400 font-mono">+91 {bill.customer_phone}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {bill.items?.length || 1} items
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    {formatCurrency(bill.grand_total, false)}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-emerald-600">
                    +{formatCurrency(bill.gross_profit, false)}
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
                    <button
                      onClick={() => onSelectBill(bill)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}

              {recentBills.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No bills recorded yet. Tap Quick Billing to create your first bill!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
