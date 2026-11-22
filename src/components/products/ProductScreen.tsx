import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Plus, Search, Edit2, Archive, RotateCcw, X, AlertCircle, Sparkles } from 'lucide-react';
import { formatCurrency, generateSKU } from '../../lib/formatters';
import { Product } from '../../types';

export const ProductScreen: React.FC = () => {
  const { products, categories, addProduct, updateProduct } = useStore();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [costPrice, setCostPrice] = useState<string>('');
  const [initialStock, setInitialStock] = useState<string>('0');
  const [lowStockThreshold, setLowStockThreshold] = useState<string>('5');
  const [formError, setFormError] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    const defaultCat = categories[0]?.name || 'SHI';
    setSku(generateSKU(defaultCat, products.length));
    setCategoryId(categories[0]?.id || '');
    setDescription('');
    setSellingPrice('');
    setCostPrice('');
    setInitialStock('0');
    setLowStockThreshold('5');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setSku(p.sku);
    setCategoryId(p.category_id || '');
    setDescription(p.description || '');
    setSellingPrice(p.current_selling_price.toString());
    setCostPrice(p.current_cost_price.toString());
    setInitialStock(p.available_stock.toString());
    setLowStockThreshold(p.low_stock_threshold.toString());
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setFormError('Product name is required');
    if (!sku.trim()) return setFormError('SKU is required');
    const sp = parseFloat(sellingPrice);
    if (isNaN(sp) || sp < 0) return setFormError('Valid selling price required');
    const cp = parseFloat(costPrice) || 0;
    const stock = parseInt(initialStock) || 0;
    const threshold = parseInt(lowStockThreshold) || 5;

    const cat = categories.find((c) => c.id === categoryId);

    if (editingProduct) {
      await updateProduct(editingProduct.id, {
        name,
        sku,
        category_id: categoryId || null,
        category_name: cat?.name,
        description,
        current_selling_price: sp,
        current_cost_price: cp,
        low_stock_threshold: threshold,
      });
    } else {
      await addProduct({
        name,
        sku,
        category_id: categoryId || null,
        category_name: cat?.name,
        description,
        current_selling_price: sp,
        current_cost_price: cp,
        available_stock: stock,
        low_stock_threshold: threshold,
        is_active: true,
      });
    }

    setIsModalOpen(false);
  };

  const handleToggleArchive = async (p: Product) => {
    await updateProduct(p.id, { is_active: !p.is_active });
  };

  // Filtered List
  const filtered = products.filter((p) => {
    if (!showArchived && !p.is_active) return false;
    if (showArchived && p.is_active) return false;
    if (selectedCat && p.category_id !== selectedCat) return false;
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Top Header & Search */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Product Catalog
          </h2>
          <p className="text-xs text-slate-500">
            Manage store merchandise, pricing & SKU inventory
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-1.5 shadow-sm active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-2.5 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products or SKU..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto scrollbar-none">
          <select
            value={selectedCat || ''}
            onChange={(e) => setSelectedCat(e.target.value || null)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
              showArchived
                ? 'bg-rose-50 text-rose-700 border-rose-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {showArchived ? 'Showing Archived' : 'Show Archived'}
          </button>
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Selling Price</th>
                <th className="py-2.5 px-3">Cost Price</th>
                <th className="py-2.5 px-3">Stock</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((prod) => (
                <tr key={prod.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    <div>{prod.name}</div>
                    {prod.description && (
                      <div className="text-[10px] text-slate-400 font-normal truncate max-w-xs">{prod.description}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-600">
                    {prod.sku}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {prod.category_name || '-'}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    {formatCurrency(prod.current_selling_price, false)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">
                    {formatCurrency(prod.current_cost_price, false)}
                  </td>
                  <td className="py-2.5 px-3 font-bold">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                      prod.available_stock <= 0
                        ? 'bg-red-100 text-red-800'
                        : prod.available_stock <= prod.low_stock_threshold
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {prod.available_stock} in stock
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right space-x-1">
                    <button
                      onClick={() => openEditModal(prod)}
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5 inline" />
                    </button>
                    <button
                      onClick={() => handleToggleArchive(prod)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title={prod.is_active ? 'Archive' : 'Restore'}
                    >
                      {prod.is_active ? <Archive className="w-3.5 h-3.5 inline" /> : <RotateCcw className="w-3.5 h-3.5 inline" />}
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden p-5 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 pt-3 text-xs">
              {formError && (
                <div className="p-2 bg-red-50 text-red-700 rounded-lg flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Slim Fit Denim Jeans"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 flex items-center justify-between mb-1">
                    <span>SKU Code *</span>
                    <button
                      type="button"
                      onClick={() => {
                        const cat = categories.find((c) => c.id === categoryId)?.name || 'GEN';
                        setSku(generateSKU(cat, products.length));
                      }}
                      className="text-[10px] text-amber-700 font-bold hover:underline flex items-center gap-0.5"
                    >
                      <Sparkles className="w-2.5 h-2.5" /> Auto SKU
                    </button>
                  </label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border font-mono font-bold rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Current Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="e.g. 1499"
                    className="w-full px-3 py-2 border font-bold text-slate-900 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Estimated Purchase Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="e.g. 750"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {!editingProduct && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Initial Opening Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Low Stock Threshold</label>
                  <input
                    type="number"
                    min="1"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description / Size / Color Notes</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional details (e.g. Sizes: 30, 32, 34; Color: Vintage Indigo)"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-md"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
