import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { storeService } from '../../services/storeService';
import { ProfitLossReport } from '../../types';

export const ProfitLossScreen: React.FC = () => {
  const { dateRange, setDateRange, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate } = useStore();
  const [report, setReport] = useState<ProfitLossReport | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      const now = new Date();
      let start = new Date(now);
      let end = new Date(now);

      if (dateRange === 'today') {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else if (dateRange === 'yesterday') {
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(now.getDate() - 1);
        end.setHours(23, 59, 59, 999);
      } else if (dateRange === 'week') {
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
      } else if (dateRange === 'month') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
      } else if (dateRange === 'custom') {
        start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
      }

      const res = await storeService.getProfitLossReport(start, end);
      setReport(res);
    };

    fetchReport();
  }, [dateRange, customStartDate, customEndDate]);

  const summary = report?.summary || {
    total_revenue: 0,
    total_cogs: 0,
    gross_profit: 0,
    total_bills: 0,
    total_discounts: 0,
  };

  const totalExpenses = (report?.expenses_by_category || []).reduce(
    (sum, e) => sum + e.total_amount,
    0
  );

  const netProfit = summary.gross_profit - totalExpenses;
  const grossMargin = summary.total_revenue > 0
    ? Math.round((summary.gross_profit / summary.total_revenue) * 10000) / 100
    : 0;
  const netMargin = summary.total_revenue > 0
    ? Math.round((netProfit / summary.total_revenue) * 10000) / 100
    : 0;

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Header & Date Range Tabs */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            <span>Profit & Loss Statement (P&L)</span>
          </h2>
          <p className="text-xs text-slate-500">
            Realized gross profit (Revenue − FIFO COGS) and shop net profit
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto overflow-x-auto scrollbar-none">
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
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
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

      {dateRange === 'custom' && (
        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-amber-900">Custom Period:</span>
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

      {/* Main Financial KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Revenue */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Gross Sales Revenue
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
            {formatCurrency(summary.total_revenue, false)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {summary.total_bills} completed invoices
          </div>
        </div>

        {/* Cost of Goods Sold (COGS) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Cost of Goods (COGS)
          </span>
          <div className="text-xl sm:text-2xl font-black text-rose-600 mt-2">
            {formatCurrency(summary.total_cogs, false)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Actual purchase cost of sold units
          </div>
        </div>

        {/* Realized Gross Profit */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Gross Profit
          </span>
          <div className="text-xl sm:text-2xl font-black text-blue-600 mt-2">
            {formatCurrency(summary.gross_profit, false)}
          </div>
          <div className="text-[11px] text-blue-600 font-bold mt-1">
            Margin: {grossMargin}%
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Net Profit (After Expenses)
          </span>
          <div className={`text-xl sm:text-2xl font-black mt-2 ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(netProfit, false)}
          </div>
          <div className="text-[11px] text-slate-500 font-bold mt-1">
            Net Margin: {netMargin}%
          </div>
        </div>
      </div>

      {/* Two Column Layout: Category Profitability & Operating Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category-wise Sales & Profit Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              <span>Category Profitability</span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Units Sold</th>
                  <th className="py-2 px-3">Revenue</th>
                  <th className="py-2 px-3">Profit</th>
                  <th className="py-2 px-3 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(report?.category_breakdown || []).map((cat, idx) => {
                  const m = cat.revenue > 0 ? Math.round((cat.profit / cat.revenue) * 100) : 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {cat.category_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-bold">
                        {cat.units_sold}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {formatCurrency(cat.revenue, false)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-600">
                        {formatCurrency(cat.profit, false)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-700">
                        {m}%
                      </td>
                    </tr>
                  );
                })}

                {(report?.category_breakdown || []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No category sales in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operating Expenses Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-rose-500" />
              <span>Shop Expenses Breakdown</span>
            </h3>
            <span className="text-xs font-black text-rose-600">
              Total: {formatCurrency(totalExpenses, false)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Expense Category</th>
                  <th className="py-2 px-3">Transactions</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(report?.expenses_by_category || []).map((exp, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {exp.category}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {exp.count} entries
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(exp.total_amount, false)}
                    </td>
                  </tr>
                ))}

                {(report?.expenses_by_category || []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-400">
                      No operating expenses recorded for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
