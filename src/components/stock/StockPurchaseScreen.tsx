import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Truck, Plus, Trash2, CheckCircle, AlertCircle, Receipt } from 'lucide-react';
import { formatCurrency, formatKolkataDateTime } from '../../lib/formatters';
import { storeService } from '../../services/storeService';
import { StockPurchase } from '../../types';

export const StockPurchaseScreen: React.FC = () => {
  const { products, addStockPurchase } = useStore();

  const [supplierName, setSupplierName] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Purchase items
  const [items, setItems] = useState<
    {
      productId: string;
      quantity: number;
      purchasePrice: number;
      sellingPrice: number;
      updateSellingPrice: boolean;
    }[]
  >([]);

  // Item row input
  const [selectedProdId, setSelectedProdId] = useState('');
  const [qtyInput, setQtyInput] = useState('');
  const [costInput, setCostInput] = useState('');
  const [sellInput, setSellInput] = useState('');
  const [updatePriceCheck, setUpdatePriceCheck] = useState(true);

  const [purchases, setPurchases] = useState<StockPurchase[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load previous purchases
  React.useEffect(() => {
    storeService.getPurchases().then(setPurchases);
  }, []);

  // When product selected in row, prefill current cost & selling price
  const handleProductSelect = (pId: string) => {
    setSelectedProdId(pId);
    const prod = products.find((p) => p.id === pId);
    if (prod) {
      setCostInput(prod.current_cost_price.toString());
      setSellInput(prod.current_selling_price.toString());
    }
  };

  const handleAddItem = () => {
    if (!selectedProdId) return setErrorMsg('Select a product first');
    const q = parseInt(qtyInput);
    if (isNaN(q) || q <= 0) return setErrorMsg('Quantity must be greater than 0');
    const cp = parseFloat(costInput);
    if (isNaN(cp) || cp < 0) return setErrorMsg('Valid purchase price required');
    const sp = parseFloat(sellInput);
    if (isNaN(sp) || sp < 0) return setErrorMsg('Valid selling price required');

    setItems((prev) => [
      ...prev,
      {
        productId: selectedProdId,
        quantity: q,
        purchasePrice: cp,
        sellingPrice: sp,
        updateSellingPrice: updatePriceCheck,
      },
    ]);

    setSelectedProdId('');
    setQtyInput('');
    setCostInput('');
    setSellInput('');
    setErrorMsg(null);
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalPurchaseAmount = items.reduce(
    (sum, it) => sum + it.quantity * it.purchasePrice,
    0
  );

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return setErrorMsg('Add at least one product item');
    setIsSubmitting(true);
    setErrorMsg(null);

    const payload = {
      supplier_name: supplierName || undefined,
      reference_no: referenceNo || undefined,
      purchase_date: new Date(purchaseDate).toISOString(),
      total_amount: totalPurchaseAmount,
      notes: notes || undefined,
      items: items.map((it) => ({
        product_id: it.productId,
        quantity: it.quantity,
        purchase_price: it.purchasePrice,
        selling_price: it.sellingPrice,
        total_amount: it.quantity * it.purchasePrice,
        update_selling_price: it.updateSellingPrice,
      })),
    };

    const res = await addStockPurchase(payload);
    setIsSubmitting(false);

    if (res.success) {
      setSuccessMsg('Stock purchase added successfully! Batches and stock updated.');
      setItems([]);
      setSupplierName('');
      setReferenceNo('');
      setNotes('');
      storeService.getPurchases().then(setPurchases);
      setTimeout(() => setSuccessMsg(null), 5000);
    } else {
      setErrorMsg(res.message || 'Failed to record purchase');
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Truck className="w-5 h-5 text-amber-500" />
          <span>Stock Purchase / Add Inventory</span>
        </h2>
        <p className="text-xs text-slate-500">
          Record vendor purchases, cost of goods (FIFO batches), and update stock counts
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span className="font-bold">{errorMsg}</span>
        </div>
      )}

      {/* Main Entry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Purchase Header & Item Entry */}
        <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            1. Invoice Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Supplier Name</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Raymond Mill / Tirupur Knit"
                className="w-full px-2.5 py-1.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Supplier Invoice Ref</label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. INV-9842"
                className="w-full px-2.5 py-1.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Purchase Date</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-2 border-t border-slate-100">
            2. Add Product Items to Batch
          </h3>

          {/* Row Inputs */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Select Product *</label>
                <select
                  value={selectedProdId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium"
                >
                  <option value="">-- Choose Product --</option>
                  {products.filter((p) => p.is_active).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) [Current: {p.available_stock}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  placeholder="e.g. 20"
                  className="w-full px-2.5 py-1.5 bg-white border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Purchase Cost (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  placeholder="e.g. 450"
                  className="w-full px-2.5 py-1.5 bg-white border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
              <div>
                <label className="font-bold text-slate-700 block mb-1">New Selling Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellInput}
                  onChange={(e) => setSellInput(e.target.value)}
                  placeholder="e.g. 999"
                  className="w-full px-2.5 py-1.5 bg-white border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold text-amber-700"
                />
              </div>

              <div className="sm:col-span-2 flex items-center pt-4">
                <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updatePriceCheck}
                    onChange={(e) => setUpdatePriceCheck(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <span className="font-medium text-[11px]">Update product retail selling price</span>
                </label>
              </div>

              <div className="pt-2 sm:pt-4 text-right">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center justify-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line</span>
                </button>
              </div>
            </div>
          </div>

          {/* Staged Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Item</th>
                  <th className="py-2 px-3">Qty</th>
                  <th className="py-2 px-3">Cost Rate</th>
                  <th className="py-2 px-3">Sell Rate</th>
                  <th className="py-2 px-3">Line Total</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, idx) => {
                  const prod = products.find((p) => p.id === it.productId);
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {prod?.name} <span className="font-mono text-[10px] text-slate-400">({prod?.sku})</span>
                      </td>
                      <td className="py-2 px-3 font-bold">{it.quantity}</td>
                      <td className="py-2 px-3">{formatCurrency(it.purchasePrice, false)}</td>
                      <td className="py-2 px-3 text-amber-700 font-bold">{formatCurrency(it.sellingPrice, false)}</td>
                      <td className="py-2 px-3 font-bold">{formatCurrency(it.quantity * it.purchasePrice, false)}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      No items staged in this purchase yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Purchase Summary & Confirmation */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="space-y-3 text-xs">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
              Purchase Summary
            </h3>

            <div className="space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Total Items Staged:</span>
                <span className="font-bold text-slate-900">{items.length} products</span>
              </div>
              <div className="flex justify-between">
                <span>Total Units Received:</span>
                <span className="font-bold text-slate-900">
                  {items.reduce((s, i) => s + i.quantity, 0)} units
                </span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100">
                <span>Total Purchase Cost:</span>
                <span className="text-amber-600">
                  {formatCurrency(totalPurchaseAmount, false)}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <label className="font-bold text-slate-700 block mb-1">Purchase Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional supplier transport, payment terms, or batch notes"
                className="w-full px-2.5 py-1.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmitPurchase}
            disabled={isSubmitting || items.length === 0}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-sm shadow-md transition active:scale-95 disabled:opacity-50 mt-4"
          >
            {isSubmitting ? 'Recording Purchase...' : 'CONFIRM & ADD STOCK'}
          </button>
        </div>
      </div>

      {/* Historical Purchases Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="w-4 h-4 text-slate-600" />
            <h3 className="font-bold text-sm text-slate-900">Previous Stock Purchases</h3>
          </div>
          <span className="text-xs text-slate-400">{purchases.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Purchase #</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Supplier</th>
                <th className="py-2.5 px-3">Ref Invoice</th>
                <th className="py-2.5 px-3">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchases.map((pur) => (
                <tr key={pur.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                    {pur.purchase_number}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {formatKolkataDateTime(pur.purchase_date)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">
                    {pur.supplier_name || 'Direct / Cash'}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-500">
                    {pur.reference_no || '-'}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    {formatCurrency(pur.total_amount, false)}
                  </td>
                </tr>
              ))}

              {purchases.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No historical purchases recorded.
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
