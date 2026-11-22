import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  Plus, Search, Edit2, Trash2, Boxes, X, 
  AlertCircle, Check, ChevronDown 
} from 'lucide-react';
import { formatCurrency, generateSKU } from '../../lib/formatters';
import { Product } from '../../types';
import { storeService } from '../../services/storeService';

// Predefined category suggestions as requested
const PREDEFINED_CATEGORIES = [
  'Shirts',
  'T-Shirts',
  'Jeans',
  'Pants',
  'Shorts',
  'Hoodies',
  'Jackets',
  'Other',
];

export const ProductScreen: React.FC = () => {
  const { products, categories, addProduct, updateProduct, adjustStock, refreshData } = useStore();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  // Add / Edit Product Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [costPrice, setCostPrice] = useState<string>('');
  const [initialStock, setInitialStock] = useState<string>('0');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Autocomplete UI dropdown states
  const [showCatSuggestions, setShowCatSuggestions] = useState(false);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

  // Quick Stock Update Modal
  const [stockModalProd, setStockModalProd] = useState<Product | null>(null);
  const [stockAction, setStockAction] = useState<'ADD' | 'SET' | 'DAMAGE'>('ADD');
  const [stockQtyInput, setStockQtyInput] = useState<string>('');
  const [stockReason, setStockReason] = useState<string>('');
  const [stockSubmitting, setStockSubmitting] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  // Combine predefined categories with any custom categories in the database
  const allCategorySuggestions = useMemo(() => {
    const set = new Set<string>(PREDEFINED_CATEGORIES);
    categories.forEach((c) => {
      if (c.name) set.add(c.name);
    });
    return Array.from(set);
  }, [categories]);

  // Filtered Category suggestions based on typed input
  const filteredCatSuggestions = useMemo(() => {
    const q = categoryInput.trim().toLowerCase();
    if (!q) return allCategorySuggestions;
    return allCategorySuggestions.filter((c) => c.toLowerCase().includes(q));
  }, [allCategorySuggestions, categoryInput]);

  // Filtered Product Name suggestions based on typed input
  const filteredNameSuggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const names = products.map((p) => p.name);
    return Array.from(new Set(names)).filter((n) => n.toLowerCase().includes(q)).slice(0, 5);
  }, [products, name]);

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setCategoryInput(categories[0]?.name || 'Shirts');
    setSellingPrice('');
    setCostPrice('');
    setInitialStock('0');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setCategoryInput(p.category_name || '');
    setSellingPrice(p.current_selling_price.toString());
    setCostPrice(p.current_cost_price.toString());
    setInitialStock(p.available_stock.toString());
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanCat = categoryInput.trim();

    if (!cleanName) return setFormError('Product name is required');
    if (!cleanCat) return setFormError('Product category is required');

    const sp = parseFloat(sellingPrice);
    if (isNaN(sp) || sp < 0) return setFormError('Valid selling price (₹) is required');

    const cp = parseFloat(costPrice);
    if (isNaN(cp) || cp < 0) return setFormError('Valid purchased rate / cost price (₹) is required');

    const stock = parseInt(initialStock);
    if (isNaN(stock) || stock < 0) return setFormError('Valid quantity is required');

    setIsSubmitting(true);
    setFormError(null);

    try {
      // Find or create category avoiding duplicates
      let matchedCat = categories.find(
        (c) => c.name.toLowerCase() === cleanCat.toLowerCase()
      );

      if (!matchedCat) {
        matchedCat = await storeService.addCategory(cleanCat);
      }

      const categoryId = matchedCat.id;
      const categoryName = matchedCat.name;

      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: cleanName,
          category_id: categoryId,
          category_name: categoryName,
          current_selling_price: sp,
          current_cost_price: cp,
        });
      } else {
        const autoSKU = generateSKU(cleanCat.slice(0, 3).toUpperCase(), products.length);
        await addProduct({
          name: cleanName,
          sku: autoSKU,
          category_id: categoryId,
          category_name: categoryName,
          current_selling_price: sp,
          current_cost_price: cp,
          available_stock: stock,
          low_stock_threshold: 5,
          is_active: true,
        });
      }

      setIsModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe delete (archive)
  const handleDeleteProduct = async (p: Product) => {
    if (confirm(`Remove "${p.name}" from active products? Historical bills will be safely kept.`)) {
      await updateProduct(p.id, { is_active: false });
    }
  };

  // Handle Quick Stock Update
  const handleOpenStockModal = (prod: Product) => {
    setStockModalProd(prod);
    setStockAction('ADD');
    setStockQtyInput('');
    setStockReason('Stock replenishment');
    setStockError(null);
  };

  const handleConfirmStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModalProd) return;
    const q = parseInt(stockQtyInput);
    if (isNaN(q) || q <= 0) return setStockError('Enter a valid quantity greater than 0');

    setStockSubmitting(true);
    setStockError(null);

    try {
      let adjType: 'IN' | 'PHYSICAL_COUNT' | 'DAMAGE' = 'IN';
      if (stockAction === 'SET') adjType = 'PHYSICAL_COUNT';
      if (stockAction === 'DAMAGE') adjType = 'DAMAGE';

      const res = await adjustStock({
        product_id: stockModalProd.id,
        adjustment_type: adjType,
        quantity: q,
        reason: stockReason || (stockAction === 'ADD' ? 'Added new stock' : 'Stock count adjustment'),
      });

      if (res.success) {
        setStockModalProd(null);
        await refreshData();
      } else {
        setStockError(res.message || 'Failed to update stock');
      }
    } catch (err: unknown) {
      setStockError(err instanceof Error ? err.message : 'Error updating stock');
    } finally {
      setStockSubmitting(false);
    }
  };

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.is_active) return false;
      const matchesCat = !selectedCat || p.category_name === selectedCat;
      const q = search.toLowerCase().trim();
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [products, selectedCat, search]);

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Top Header & Add Button */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Product Catalog</span>
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
              {filteredProducts.length} items
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Manage clothing models, purchased cost, selling rates & stock
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-sm transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Search & Category Filter Pills */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by model name or SKU..."
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

        {/* Category Pills */}
        <div className="flex space-x-1.5 overflow-x-auto scrollbar-none pb-0.5">
          <button
            onClick={() => setSelectedCat(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
              selectedCat === null
                ? 'bg-slate-900 text-amber-300 shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Categories
          </button>
          {allCategorySuggestions.map((catName) => {
            const count = products.filter((p) => p.is_active && p.category_name === catName).length;
            return (
              <button
                key={catName}
                onClick={() => setSelectedCat(catName)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  selectedCat === catName
                    ? 'bg-slate-900 text-amber-300 shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {catName} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Product List / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredProducts.map((p) => {
          const isLowStock = p.available_stock <= p.low_stock_threshold;
          const isOutOfStock = p.available_stock <= 0;
          const margin = p.current_selling_price - p.current_cost_price;

          return (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{p.name}</h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                      <span className="font-medium text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded">
                        {p.category_name || 'Fashion'}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[10px]">{p.sku}</span>
                    </div>
                  </div>

                  {/* Stock Badge */}
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                      isOutOfStock
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : isLowStock
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {p.available_stock} in stock
                  </span>
                </div>

                {/* Rates Row */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg mt-3 text-center">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Purchased Rate</div>
                    <div className="text-xs font-bold text-slate-700 mt-0.5">
                      {formatCurrency(p.current_cost_price, false)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Selling Rate</div>
                    <div className="text-xs font-black text-slate-900 mt-0.5">
                      {formatCurrency(p.current_selling_price, false)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Unit Profit</div>
                    <div className="text-xs font-black text-emerald-600 mt-0.5">
                      +{formatCurrency(margin, false)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => handleOpenStockModal(p)}
                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-950 rounded-lg font-bold flex items-center space-x-1 transition active:scale-95"
                >
                  <Boxes className="w-3.5 h-3.5 text-amber-600" />
                  <span>Update Stock</span>
                </button>

                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(p)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                    title="Edit Product"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(p)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                    title="Delete Product"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            No products found matching your search.
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-tight text-amber-100">
                {editingProduct ? 'Edit Product' : 'Add New Clothing Product'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-4 sm:p-5 space-y-3.5 text-xs">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Product Name Autocomplete */}
              <div className="relative">
                <label className="font-bold text-slate-800 block mb-1">
                  Product / Clothing Model Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setShowNameSuggestions(true);
                  }}
                  onFocus={() => setShowNameSuggestions(true)}
                  placeholder="e.g. Vintage Check Linen Shirt"
                  className="w-full px-3 py-2 border rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />

                {/* Name suggestions dropdown */}
                {showNameSuggestions && filteredNameSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden divide-y divide-slate-100">
                    {filteredNameSuggestions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setName(item);
                          setShowNameSuggestions(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-amber-50 text-xs font-semibold text-slate-800"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Category Searchable Autocomplete */}
              <div className="relative">
                <label className="font-bold text-slate-800 block mb-1">
                  Category (Select or Type New) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={categoryInput}
                    onChange={(e) => {
                      setCategoryInput(e.target.value);
                      setShowCatSuggestions(true);
                    }}
                    onFocus={() => setShowCatSuggestions(true)}
                    placeholder="Select or type (e.g. Shirts, Hoodies...)"
                    className="w-full px-3 py-2 border rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {/* Category suggestions dropdown */}
                {showCatSuggestions && filteredCatSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-44 overflow-y-auto divide-y divide-slate-100">
                    {filteredCatSuggestions.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setCategoryInput(cat);
                          setShowCatSuggestions(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-amber-50 text-xs font-semibold text-slate-800 flex items-center justify-between"
                      >
                        <span>{cat}</span>
                        {categoryInput === cat && <Check className="w-3.5 h-3.5 text-amber-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Rates Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Purchased Rate (Cost ₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
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
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="999.00"
                    className="w-full px-3 py-2 border rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Initial Quantity (Only for new products) */}
              {!editingProduct && (
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Available Quantity (Initial Stock) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={initialStock}
                    onChange={(e) => setInitialStock(e.target.value)}
                    placeholder="10"
                    className="w-full px-3 py-2 border rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Stock Update Modal */}
      {stockModalProd && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm tracking-tight text-amber-100">Update Stock</h3>
                <p className="text-[11px] text-slate-400">{stockModalProd.name}</p>
              </div>
              <button
                onClick={() => setStockModalProd(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmStockUpdate} className="p-4 space-y-3.5 text-xs">
              {stockError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{stockError}</span>
                </div>
              )}

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Current Stock:</span>
                <span className="font-bold font-mono text-slate-900 text-sm">
                  {stockModalProd.available_stock} Units
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Adjustment Action</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'ADD', label: 'Add (+)' },
                    { id: 'SET', label: 'Set Exact' },
                    { id: 'DAMAGE', label: 'Damage (-)' },
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setStockAction(act.id as 'ADD' | 'SET' | 'DAMAGE')}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        stockAction === act.id
                          ? 'bg-slate-900 text-amber-300 border-slate-900 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  {stockAction === 'ADD' ? 'Quantity to Add' : stockAction === 'SET' ? 'New Count' : 'Damaged / Lost Qty'}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={stockQtyInput}
                  onChange={(e) => setStockQtyInput(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-2 border rounded-xl font-mono text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStockModalProd(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={stockSubmitting}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {stockSubmitting ? 'Saving...' : 'Update Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
