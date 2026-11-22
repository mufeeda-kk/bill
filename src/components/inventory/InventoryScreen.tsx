import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Boxes, History, X, AlertCircle, Search } from 'lucide-react';
import { formatCurrency, formatKolkataDateTime } from '../../lib/formatters';
import { storeService } from '../../services/storeService';
import { Product, StockMovement } from '../../types';

export const InventoryScreen: React.FC = () => {
  const { products, adjustStock } = useStore();
  const [activeTab, setActiveTab] = useState<'inventory' | 'movements'>('inventory');
  const [search, setSearch] = useState('');
  const [movements, setMovements] = useState<StockMovement[]>([]);

  // Adjustment Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'IN' | 'OUT' | 'DAMAGE' | 'LOST' | 'PHYSICAL_COUNT'>('DAMAGE');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'movements') {
      storeService.getStockMovements().then(setMovements);
    }
  }, [activeTab]);

  const handleOpenAdjust = (prod: Product) => {
    setSelectedProduct(prod);
    setAdjustmentType('DAMAGE');
    setAdjustQty('');
    setAdjustReason('');
    setErrorMsg(null);
  };

  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const q = parseInt(adjustQty);
    if (isNaN(q) || q <= 0) return setErrorMsg('Quantity must be greater than 0');
    if (!adjustReason.trim()) return setErrorMsg('Reason is required for audit history');

    setIsSubmitting(true);
    const res = await adjustStock({
      product_id: selectedProduct.id,
      adjustment_type: adjustmentType,
      quantity: q,
      reason: adjustReason,
    });
    setIsSubmitting(false);

    if (res.success) {
      setSelectedProduct(null);
      if (activeTab === 'movements') {
        storeService.getStockMovements().then(setMovements);
      }
    } else {
      setErrorMsg(res.message || 'Failed to adjust stock');
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!p.is_active) return false;
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Top Header & Tab Toggle */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-amber-500" />
            <span>Inventory Management & Valuation</span>
          </h2>
          <p className="text-xs text-slate-500">
            Real-time stock levels, margin estimates & full audit movement logs
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'inventory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Live Stock & Margins
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'movements' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit History</span>
          </button>
        </div>
      </div>

      {activeTab === 'inventory' ? (
        <div className="space-y-3">
          {/* Search Box */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center">
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stock by product name or SKU..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Product / SKU</th>
                    <th className="py-2.5 px-3">Available Stock</th>
                    <th className="py-2.5 px-3">Cost Price</th>
                    <th className="py-2.5 px-3">Selling Price</th>
                    <th className="py-2.5 px-3">Inventory Value</th>
                    <th className="py-2.5 px-3">Sales Potential</th>
                    <th className="py-2.5 px-3">Est. Margin</th>
                    <th className="py-2.5 px-3 text-right">Adjustment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => {
                    const costVal = p.available_stock * p.current_cost_price;
                    const salesVal = p.available_stock * p.current_selling_price;
                    const margin = p.current_selling_price > 0
                      ? Math.round(((p.current_selling_price - p.current_cost_price) / p.current_selling_price) * 100)
                      : 0;

                    const isOut = p.available_stock <= 0;
                    const isLow = !isOut && p.available_stock <= p.low_stock_threshold;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div>{p.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">{p.sku}</div>
                        </td>
                        <td className="py-2.5 px-3 font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            isOut
                              ? 'bg-red-100 text-red-800'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {p.available_stock} units
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {formatCurrency(p.current_cost_price, false)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {formatCurrency(p.current_selling_price, false)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-medium">
                          {formatCurrency(costVal, false)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-900 font-bold">
                          {formatCurrency(salesVal, false)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600">
                          {margin}%
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleOpenAdjust(p)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs transition"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Stock Movement Audit Log */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-600 flex justify-between">
            <span>Auditable Stock Movement History (Ledger)</span>
            <span>{movements.length} events logged</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Change</th>
                  <th className="py-2.5 px-3">Prev → New</th>
                  <th className="py-2.5 px-3">Reason / Ref</th>
                  <th className="py-2.5 px-3">Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((mov) => {
                  const isPositive = mov.quantity_change > 0;
                  return (
                    <tr key={mov.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {formatKolkataDateTime(mov.created_at)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {mov.product_name} <span className="font-mono text-[10px] text-slate-400">({mov.product_sku})</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          mov.movement_type === 'PURCHASE_IN'
                            ? 'bg-blue-100 text-blue-800'
                            : mov.movement_type === 'SALE_OUT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : mov.movement_type.includes('DAMAGE') || mov.movement_type.includes('LOST')
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {mov.movement_type}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 font-black ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isPositive ? `+${mov.quantity_change}` : mov.quantity_change}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                        {mov.previous_quantity} → {mov.new_quantity}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate">
                        {mov.reason || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                        {mov.device_name || 'Counter'}
                      </td>
                    </tr>
                  );
                })}

                {movements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No stock movement audit records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Stock Adjustment Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden p-5 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-base">Adjust Stock</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedProduct.name} ({selectedProduct.sku})
                </p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAdjust} className="space-y-3 pt-3 text-xs">
              {errorMsg && (
                <div className="p-2 bg-red-50 text-red-700 rounded-lg flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600 font-medium">Current Available Stock:</span>
                <span className="text-sm font-black text-slate-900">{selectedProduct.available_stock} units</span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Adjustment Type *</label>
                <select
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value as 'IN' | 'OUT' | 'DAMAGE' | 'LOST' | 'PHYSICAL_COUNT')}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                >
                  <option value="DAMAGE">Damaged Stock (Deduct)</option>
                  <option value="LOST">Lost / Theft / Missing (Deduct)</option>
                  <option value="OUT">Manual Stock Out (Deduct)</option>
                  <option value="IN">Manual Restock / Found (Add)</option>
                  <option value="PHYSICAL_COUNT">Physical Count Audit (Set Exact)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="Enter quantity"
                  className="w-full px-3 py-2 border font-bold text-sm rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Audit Reason / Notes *</label>
                <textarea
                  rows={2}
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Torn sleeve during trial, water damage, or count correction"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Commit Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
