import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  Boxes, Plus, History, AlertTriangle, 
  Search, X, ChevronDown 
} from 'lucide-react';
import { formatCurrency, formatKolkataDateTime } from '../../lib/formatters';
import { storeService } from '../../services/storeService';
import { Product, StockMovement } from '../../types';

export const InventoryScreen: React.FC = () => {
  const { products, categories, adjustStock, addStockPurchase, refreshData } = useStore();
  const [activeView, setActiveView] = useState<'stock' | 'movements'>('stock');
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  // Simple Add Stock Modal
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [addStockProdId, setAddStockProdId] = useState('');
  const [addStockQty, setAddStockQty] = useState('');
  const [addStockCost, setAddStockCost] = useState('');
  const [addStockSell, setAddStockSell] = useState('');
  const [addStockSubmitting, setAddStockSubmitting] = useState(false);
  const [addStockError, setAddStockError] = useState<string | null>(null);

  // Adjustment Modal (Damage / Physical Count / Loss)
  const [adjustProd, setAdjustProd] = useState<Product | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'IN' | 'OUT' | 'DAMAGE' | 'LOST' | 'PHYSICAL_COUNT'>('DAMAGE');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  React.useEffect(() => {
    if (activeView === 'movements') {
      storeService.getStockMovements().then(setMovements);
    }
  }, [activeView]);

  // Open Add Stock modal
  const handleOpenAddStock = (prod?: Product) => {
    const targetProd = prod || products[0];
    if (targetProd) {
      setAddStockProdId(targetProd.id);
      setAddStockCost(targetProd.current_cost_price.toString());
      setAddStockSell(targetProd.current_selling_price.toString());
    } else {
      setAddStockProdId('');
      setAddStockCost('');
      setAddStockSell('');
    }
    setAddStockQty('');
    setAddStockError(null);
    setIsAddStockOpen(true);
  };

  const handleSelectAddProduct = (pId: string) => {
    setAddStockProdId(pId);
    const prod = products.find((p) => p.id === pId);
    if (prod) {
      setAddStockCost(prod.current_cost_price.toString());
      setAddStockSell(prod.current_selling_price.toString());
    }
  };

  const handleConfirmAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStockProdId) return setAddStockError('Please select a product');
    const q = parseInt(addStockQty);
    if (isNaN(q) || q <= 0) return setAddStockError('Quantity must be greater than 0');
    const cp = parseFloat(addStockCost);
    if (isNaN(cp) || cp < 0) return setAddStockError('Valid purchased rate required');
    const sp = parseFloat(addStockSell);
    if (isNaN(sp) || sp < 0) return setAddStockError('Valid selling rate required');

    setAddStockSubmitting(true);
    setAddStockError(null);

    try {
      const res = await addStockPurchase({
        total_amount: q * cp,
        items: [
          {
            product_id: addStockProdId,
            quantity: q,
            purchase_price: cp,
            selling_price: sp,
            total_amount: q * cp,
            update_selling_price: true,
          },
        ],
      });

      if (res.success) {
        setIsAddStockOpen(false);
        await refreshData();
      } else {
        setAddStockError(res.message || 'Failed to add stock');
      }
    } catch (err: unknown) {
      setAddStockError(err instanceof Error ? err.message : 'Error adding stock');
    } finally {
      setAddStockSubmitting(false);
    }
  };

  // Confirm stock adjustment
  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProd) return;
    const q = parseInt(adjustQty);
    if (isNaN(q) || q <= 0) return setAdjustError('Quantity must be greater than 0');
    if (!adjustReason.trim()) return setAdjustError('Reason is required for audit history');

    setAdjustSubmitting(true);
    setAdjustError(null);

    const res = await adjustStock({
      product_id: adjustProd.id,
      adjustment_type: adjustmentType,
      quantity: q,
      reason: adjustReason,
    });

    setAdjustSubmitting(false);

    if (res.success) {
      setAdjustProd(null);
      await refreshData();
      if (activeView === 'movements') {
        storeService.getStockMovements().then(setMovements);
      }
    } else {
      setAdjustError(res.message || 'Failed to adjust stock');
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.is_active) return false;
      if (selectedCat !== 'ALL' && p.category_name !== selectedCat) return false;
      if (onlyLowStock && p.available_stock > p.low_stock_threshold) return false;
      const q = search.toLowerCase().trim();
      return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    });
  }, [products, selectedCat, onlyLowStock, search]);

  // Overall Stock Valuation
  const totalStockUnits = useMemo(() => {
    return products.reduce((sum, p) => p.is_active ? sum + p.available_stock : sum, 0);
  }, [products]);

  const totalStockCostValuation = useMemo(() => {
    return products.reduce((sum, p) => p.is_active ? sum + (p.available_stock * p.current_cost_price) : sum, 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.is_active && p.available_stock <= p.low_stock_threshold && p.available_stock > 0).length;
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.filter((p) => p.is_active && p.available_stock <= 0).length;
  }, [products]);

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Top Header */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-amber-500" />
            <span>Inventory & Stock Management</span>
          </h2>
          <p className="text-xs text-slate-500">
            Real-time shop stock levels, purchased rates, selling rates & adjustments
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* View toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveView('stock')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeView === 'stock' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Stock List
            </button>
            <button
              onClick={() => setActiveView('movements')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                activeView === 'movements' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit Log</span>
            </button>
          </div>

          {/* Add Stock Button */}
          <button
            onClick={() => handleOpenAddStock()}
            className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs sm:text-sm shadow-sm transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Stock</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Units</div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {totalStockUnits} <span className="text-xs font-normal text-slate-500">pcs</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Across all models</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Stock Cost Value</div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {formatCurrency(totalStockCostValuation, false)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Purchased rate total</div>
        </div>

        <button
          onClick={() => setOnlyLowStock(!onlyLowStock)}
          className={`p-3.5 rounded-xl border text-left transition ${
            onlyLowStock
              ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Low Stock</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-900 mt-1">
            {lowStockCount} <span className="text-xs font-normal text-amber-700">models</span>
          </div>
          <div className="text-[10px] text-amber-700 font-bold mt-0.5">
            {onlyLowStock ? 'Showing low stock only (Tap to reset)' : 'Tap to filter'}
          </div>
        </button>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Out of Stock</div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 mt-1">
            {outOfStockCount} <span className="text-xs font-normal text-rose-400">models</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">0 units remaining</div>
        </div>
      </div>

      {activeView === 'stock' ? (
        <>
          {/* Search & Category Filter */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stock by product name or SKU..."
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

            <div className="relative">
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Stock Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-amber-300 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3 sm:px-4">Product Name</th>
                    <th className="py-3 px-3 sm:px-4">Category</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Available Stock</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Purchased Rate</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Selling Rate</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Total Cost Value</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => {
                    const isLowStock = p.available_stock <= p.low_stock_threshold;
                    const isOutOfStock = p.available_stock <= 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 sm:px-4">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</div>
                        </td>

                        <td className="py-3 px-3 sm:px-4 text-slate-600 font-medium">
                          {p.category_name || 'Fashion'}
                        </td>

                        <td className="py-3 px-3 sm:px-4 text-center">
                          <span className={`font-mono font-bold px-2.5 py-1 rounded-full text-xs ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-800'
                          }`}>
                            {p.available_stock} Units
                          </span>
                        </td>

                        <td className="py-3 px-3 sm:px-4 text-right font-bold text-slate-600">
                          {formatCurrency(p.current_cost_price, false)}
                        </td>

                        <td className="py-3 px-3 sm:px-4 text-right font-black text-slate-900">
                          {formatCurrency(p.current_selling_price, false)}
                        </td>

                        <td className="py-3 px-3 sm:px-4 text-right font-bold text-slate-800">
                          {formatCurrency(p.available_stock * p.current_cost_price, false)}
                        </td>

                        <td className="py-3 px-3 sm:px-4 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenAddStock(p)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold rounded-lg text-[11px] transition"
                              title="Add more stock units"
                            >
                              + Add Stock
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustProd(p);
                                setAdjustmentType('DAMAGE');
                                setAdjustQty('');
                                setAdjustReason('');
                                setAdjustError(null);
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition"
                              title="Damage, Loss or Count adjustment"
                            >
                              Adjust
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No products found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Movement Audit Log */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="font-bold text-xs text-slate-800">Recent Stock Movements (Audit Trail)</span>
            <span className="text-[11px] text-slate-400">{movements.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Action Type</th>
                  <th className="py-2.5 px-3 text-right">Change</th>
                  <th className="py-2.5 px-3 text-right">New Stock</th>
                  <th className="py-2.5 px-3">Reason / Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.slice(0, 50).map((m) => {
                  const isPositive = m.quantity_change > 0;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {formatKolkataDateTime(m.created_at)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {m.product_name || m.product_sku || 'Product'}
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {m.movement_type}
                        </span>
                      </td>
                      <td className={`py-2 px-3 text-right font-bold font-mono ${
                        isPositive ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isPositive ? `+${m.quantity_change}` : m.quantity_change}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                        {m.new_quantity}
                      </td>
                      <td className="py-2 px-3 text-slate-500 text-[11px] truncate max-w-xs">
                        {m.reason || m.reference_type || '—'}
                      </td>
                    </tr>
                  );
                })}

                {movements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {isAddStockOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-tight text-amber-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Add Stock to Inventory</span>
              </h3>
              <button
                onClick={() => setIsAddStockOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAddStock} className="p-4 sm:p-5 space-y-3.5 text-xs">
              {addStockError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{addStockError}</span>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Select Product Model <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={addStockProdId}
                  onChange={(e) => handleSelectAddProduct(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-bold text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="">Select a product...</option>
                  {products.filter((p) => p.is_active).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Current: {p.available_stock} in stock)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Quantity Received (Units) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={addStockQty}
                  onChange={(e) => setAddStockQty(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full px-3 py-2 border rounded-xl font-mono text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Purchased Rate (Cost ₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={addStockCost}
                    onChange={(e) => setAddStockCost(e.target.value)}
                    placeholder="450.00"
                    className="w-full px-3 py-2 border rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Selling Rate (Price ₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={addStockSell}
                    onChange={(e) => setAddStockSell(e.target.value)}
                    placeholder="999.00"
                    className="w-full px-3 py-2 border rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStockOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addStockSubmitting}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {addStockSubmitting ? 'Adding Stock...' : 'Confirm Stock Addition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {adjustProd && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm tracking-tight text-amber-100">Stock Adjustment</h3>
                <p className="text-[11px] text-slate-400">{adjustProd.name}</p>
              </div>
              <button
                onClick={() => setAdjustProd(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAdjust} className="p-4 space-y-3.5 text-xs">
              {adjustError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{adjustError}</span>
                </div>
              )}

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Current Stock:</span>
                <span className="font-bold font-mono text-slate-900 text-sm">
                  {adjustProd.available_stock} Units
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Adjustment Type</label>
                <select
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-xl font-bold text-slate-900 bg-white"
                >
                  <option value="DAMAGE">Damaged Goods (-)</option>
                  <option value="LOST">Lost / Missing (-)</option>
                  <option value="PHYSICAL_COUNT">Physical Count Audit (Set Exact)</option>
                  <option value="IN">Return / Found (+)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="e.g. 2"
                  className="w-full px-3 py-2 border rounded-xl font-mono text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Reason for Audit Log</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Torn seam during display"
                  className="w-full px-3 py-2 border rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustProd(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-300 font-black rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {adjustSubmitting ? 'Saving...' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
