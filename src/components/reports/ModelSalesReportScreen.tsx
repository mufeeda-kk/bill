import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  Shirt, Award, TrendingUp, AlertTriangle, Search, 
  Calendar, ChevronDown, CheckCircle2, ArrowUpDown
} from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { ProductSalesStat } from '../../types';

export const ModelSalesReportScreen: React.FC = () => {
  const { bills, products, categories } = useStore();

  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>('month');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'units' | 'revenue' | 'stock'>('units');

  // Compute date bounds
  const dateBounds = useMemo(() => {
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
    } else if (dateFilter === 'custom') {
      const s = new Date(customStart);
      s.setHours(0, 0, 0, 0);
      const e = new Date(customEnd);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }

    return { start, end };
  }, [dateFilter, customStart, customEnd]);

  // Aggregate actual sales per product model from real database bills
  const salesStats: ProductSalesStat[] = useMemo(() => {
    const map = new Map<string, ProductSalesStat>();

    // Seed map with all active products so shop sees entire catalogue stock
    products.forEach((prod) => {
      map.set(prod.id, {
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        category_name: prod.category_name || 'Uncategorized',
        units_sold: 0,
        total_sales: 0,
        total_profit: 0,
        available_stock: prod.available_stock,
        current_selling_price: prod.current_selling_price,
        current_cost_price: prod.current_cost_price,
        low_stock_threshold: prod.low_stock_threshold,
      });
    });

    const sTime = dateBounds.start.getTime();
    const eTime = dateBounds.end.getTime();

    // Iterate real completed bills
    bills.forEach((bill) => {
      if (bill.status !== 'COMPLETED') return;
      const bTime = new Date(bill.bill_date).getTime();
      if (bTime < sTime || bTime > eTime) return;

      const items = bill.items || [];
      items.forEach((item) => {
        let entry = map.get(item.product_id);
        if (!entry) {
          // In case item was from an archived product
          entry = {
            product_id: item.product_id,
            product_name: item.product_name,
            sku: item.sku,
            category_name: 'Fashion Item',
            units_sold: 0,
            total_sales: 0,
            total_profit: 0,
            available_stock: 0,
            current_selling_price: item.unit_selling_price,
            current_cost_price: item.unit_cost_price,
            low_stock_threshold: 5,
          };
          map.set(item.product_id, entry);
        }

        entry.units_sold += item.quantity;
        entry.total_sales += item.line_total;
        entry.total_profit += item.line_profit || (item.line_total - item.line_cost);
      });
    });

    return Array.from(map.values());
  }, [bills, products, dateBounds]);

  // Filter & Sort
  const filteredStats = useMemo(() => {
    return salesStats
      .filter((item) => {
        if (selectedCategory !== 'ALL' && item.category_name !== selectedCategory) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesName = item.product_name.toLowerCase().includes(q);
          const matchesSku = item.sku.toLowerCase().includes(q);
          if (!matchesName && !matchesSku) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'units') return b.units_sold - a.units_sold;
        if (sortBy === 'revenue') return b.total_sales - a.total_sales;
        if (sortBy === 'stock') return a.available_stock - b.available_stock;
        return 0;
      });
  }, [salesStats, selectedCategory, searchQuery, sortBy]);

  // Summary KPIs
  const topSeller = useMemo(() => {
    const sorted = [...salesStats].sort((a, b) => b.units_sold - a.units_sold);
    return sorted[0]?.units_sold > 0 ? sorted[0] : null;
  }, [salesStats]);

  const totalUnitsSold = useMemo(() => {
    return salesStats.reduce((sum, it) => sum + it.units_sold, 0);
  }, [salesStats]);

  const totalModelRevenue = useMemo(() => {
    return salesStats.reduce((sum, it) => sum + it.total_sales, 0);
  }, [salesStats]);

  const modelsNeedingRestock = useMemo(() => {
    return products.filter((p) => p.is_active && p.available_stock <= p.low_stock_threshold).length;
  }, [products]);

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Page Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Shirt className="w-5 h-5 text-amber-500" />
            <span>Product & Clothing Model Sales</span>
          </h2>
          <p className="text-xs text-slate-500">
            Identify your most popular clothing models, top revenue earners, and items to restock
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto overflow-x-auto scrollbar-none">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: '7 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'all', label: 'All Time' },
            { id: 'custom', label: 'Custom' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateFilter(tab.id as 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom')}
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

      {/* Custom Date Pickers */}
      {dateFilter === 'custom' && (
        <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 flex flex-wrap items-center gap-2 text-xs">
          <Calendar className="w-4 h-4 text-amber-700" />
          <span className="font-bold text-amber-950">Custom Range:</span>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs"
          />
          <span className="text-amber-800">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs"
          />
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Top Seller Card */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Top Selling Model</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-sm sm:text-base font-black text-slate-900 truncate">
            {topSeller ? topSeller.product_name : 'No sales yet'}
          </div>
          <div className="text-[11px] text-amber-600 font-bold mt-1">
            {topSeller ? `${topSeller.units_sold} units sold` : '—'}
          </div>
        </div>

        {/* Total Garments Sold */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Sold Units</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900">
            {totalUnitsSold} <span className="text-xs font-semibold text-slate-500">Garments</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            In selected period
          </div>
        </div>

        {/* Total Revenue from Items */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Product Sales Value</span>
            <span className="text-amber-600 font-bold text-xs">₹</span>
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900">
            {formatCurrency(totalModelRevenue, false)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Gross item sales
          </div>
        </div>

        {/* Restock Attention */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Restock Alerts</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-rose-600">
            {modelsNeedingRestock} <span className="text-xs font-semibold text-slate-500">Models</span>
          </div>
          <div className="text-[11px] text-rose-600/80 font-medium mt-1">
            Stock at or below threshold
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by model name or SKU..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Sort By */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'units' | 'revenue' | 'stock')}
              className="appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="units">Most Sold (Units)</option>
              <option value="revenue">Highest Revenue (₹)</option>
              <option value="stock">Lowest Stock First</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Models Sales Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-amber-300 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3 sm:px-4"># Rank</th>
                <th className="py-3 px-3 sm:px-4">Clothing Model / Product</th>
                <th className="py-3 px-3 sm:px-4">Category</th>
                <th className="py-3 px-3 sm:px-4 text-right">Units Sold</th>
                <th className="py-3 px-3 sm:px-4 text-right">Total Sales</th>
                <th className="py-3 px-3 sm:px-4 text-center">Available Stock</th>
                <th className="py-3 px-3 sm:px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStats.map((item, idx) => {
                const isTopThree = idx < 3 && item.units_sold > 0;
                const isLowStock = item.available_stock <= item.low_stock_threshold;
                const isOutOfStock = item.available_stock <= 0;

                return (
                  <tr key={item.product_id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 sm:px-4 font-mono font-bold text-slate-500">
                      {isTopThree ? (
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                          idx === 0 
                            ? 'bg-amber-400 text-slate-950 shadow-sm' 
                            : idx === 1 
                            ? 'bg-slate-300 text-slate-900' 
                            : 'bg-amber-800/30 text-amber-900'
                        }`}>
                          {idx + 1}
                        </span>
                      ) : (
                        <span className="text-slate-400">#{idx + 1}</span>
                      )}
                    </td>

                    <td className="py-3 px-3 sm:px-4">
                      <div className="font-bold text-slate-900">{item.product_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</div>
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-slate-600 font-medium">
                      {item.category_name}
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-right font-black text-slate-900">
                      {item.units_sold} <span className="text-[10px] font-normal text-slate-400">pcs</span>
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-right font-bold text-emerald-700">
                      {formatCurrency(item.total_sales, false)}
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-center">
                      <span className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                        isOutOfStock 
                          ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                          : isLowStock 
                          ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                          : 'bg-emerald-50 text-emerald-800'
                      }`}>
                        {item.available_stock} Units
                      </span>
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-center">
                      {isOutOfStock ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          <AlertTriangle className="w-3 h-3" />
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          <AlertTriangle className="w-3 h-3" />
                          Restock Soon
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          <CheckCircle2 className="w-3 h-3" />
                          In Stock
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredStats.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No models found matching your search or filters.
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
