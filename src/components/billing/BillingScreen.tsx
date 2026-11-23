import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  Search, X, Plus, Minus, Trash2, ArrowRight, 
  Tag, AlertCircle, Shirt 
} from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';

interface BillingScreenProps {
  onBillSuccess: () => void;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({ onBillSuccess }) => {
  const {
    products, categories, selectedCategory, setSelectedCategory,
    searchQuery, setSearchQuery, cart, addToCart, updateCartQty,
    removeFromCart, cartDiscount, setCartDiscount, customerPhone,
    setCustomerPhone, customerName, setCustomerName,
    setPaymentMethod, clearCart,
    subtotal, grandTotal, checkoutBill,
    isMobileCartOpen, setIsMobileCartOpen
  } = useStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDiscountInput, setShowDiscountInput] = useState(false);

  // Selected UI payment type: 'CASH' | 'UPI' | 'CARD' | 'SPLIT'
  const [uiPaymentMethod, setUiPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'SPLIT'>('CASH');

  // Split payment state
  const [splitCash, setSplitCash] = useState<string>('');
  const [splitGPay, setSplitGPay] = useState<string>('');
  const [splitCard, setSplitCard] = useState<string>('');

  // Synchronize payment method with StoreContext
  useEffect(() => {
    if (uiPaymentMethod === 'CASH') {
      setPaymentMethod('CASH');
    } else if (uiPaymentMethod === 'UPI') {
      setPaymentMethod('UPI');
    } else if (uiPaymentMethod === 'CARD') {
      // Map to UPI/Electronic with CARD notes to strictly respect DB constraint
      setPaymentMethod('UPI');
    } else if (uiPaymentMethod === 'SPLIT') {
      setPaymentMethod('SPLIT');
    }
  }, [uiPaymentMethod, setPaymentMethod]);

  // When switching to Split payment, initialize splitCash with grandTotal
  const handleSelectPaymentMethod = (method: 'CASH' | 'UPI' | 'CARD' | 'SPLIT') => {
    setUiPaymentMethod(method);
    if (method === 'SPLIT') {
      setSplitCash(grandTotal.toString());
      setSplitGPay('0');
      setSplitCard('0');
    }
  };

  // Calculate current total of split fields
  const splitTotal = useMemo(() => {
    const c = parseFloat(splitCash) || 0;
    const g = parseFloat(splitGPay) || 0;
    const cd = parseFloat(splitCard) || 0;
    return c + g + cd;
  }, [splitCash, splitGPay, splitCard]);

  const splitDifference = grandTotal - splitTotal;

  // Filter products by search and active category
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      if (!prod.is_active) return false;
      const matchesCat = !selectedCategory || prod.category_id === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        prod.name.toLowerCase().includes(q) || 
        prod.sku.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Handle Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setErrorMessage(null);

    // Validation for split payments
    if (uiPaymentMethod === 'SPLIT') {
      if (Math.abs(splitDifference) > 0.5) {
        setErrorMessage(`Split sum (₹${splitTotal}) must exactly equal the bill total (₹${grandTotal})`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let customNotes: string | undefined;
      if (uiPaymentMethod === 'CARD') {
        customNotes = '[Payment Method: CARD]';
      } else if (uiPaymentMethod === 'SPLIT') {
        const c = parseFloat(splitCash) || 0;
        const g = parseFloat(splitGPay) || 0;
        const cd = parseFloat(splitCard) || 0;
        customNotes = `[Split: Cash ₹${c}, GPay ₹${g}, Card ₹${cd}]`;
      }

      const res = await checkoutBill(customNotes);
      if (res.success) {
        setIsMobileCartOpen(false);
        onBillSuccess();
      } else {
        setErrorMessage(res.message || 'Error creating bill');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full pb-20 lg:pb-6">
      {/* LEFT: Product Selection & Catalog */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Search Bar */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clothing model name or SKU..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills (Horizontal Scroll) */}
        <div className="px-3 py-2 border-b border-slate-100 bg-white flex space-x-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
              selectedCategory === null
                ? 'bg-slate-900 text-amber-300 shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Items ({products.filter((p) => p.is_active).length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-amber-300 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid (Large touch friendly cards) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
            {filteredProducts.map((prod) => {
              const inCartItem = cart.find((i) => i.product.id === prod.id);
              const isOutOfStock = prod.available_stock <= 0;
              const isLowStock = prod.available_stock <= prod.low_stock_threshold;

              return (
                <button
                  key={prod.id}
                  disabled={isOutOfStock}
                  onClick={() => addToCart(prod)}
                  className={`group relative flex flex-col justify-between p-3 rounded-xl border text-left transition-all active:scale-98 ${
                    isOutOfStock
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : inCartItem
                      ? 'bg-amber-50/60 border-amber-400 ring-2 ring-amber-500/20 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-xs'
                  }`}
                >
                  {/* Cart Quantity Badge if selected */}
                  {inCartItem && (
                    <span className="absolute top-2 right-2 bg-slate-900 text-amber-300 font-black text-[11px] w-6 h-6 rounded-full flex items-center justify-center shadow-sm">
                      {inCartItem.quantity}
                    </span>
                  )}

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block truncate uppercase">
                      {prod.category_name || 'Fashion'}
                    </span>
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 mt-0.5 group-hover:text-amber-800">
                      {prod.name}
                    </h3>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                    <span className="font-black text-sm sm:text-base text-slate-900">
                      {formatCurrency(prod.current_selling_price, false)}
                    </span>

                    <span className={`text-[10px] font-bold ${
                      isOutOfStock
                        ? 'text-rose-600'
                        : isLowStock
                        ? 'text-amber-700'
                        : 'text-slate-500'
                    }`}>
                      {isOutOfStock ? '0 stock' : `${prod.available_stock} left`}
                    </span>
                  </div>
                </button>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-14 text-center text-slate-400">
                <Shirt className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <h3 className="font-bold text-sm text-slate-700">Catalog is Fresh & Empty</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Add clothing garments in the Products tab to begin billing.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Backdrop Dimmer (Clicks outside close cart) */}
      {isMobileCartOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[60] lg:hidden animate-in fade-in"
          onClick={() => setIsMobileCartOpen(false)}
        />
      )}

      {/* RIGHT (Desktop) / DRAWER (Mobile): Current Bill & Checkout */}
      <div className={`
        fixed inset-x-0 bottom-0 z-[70] lg:static lg:z-0 lg:w-96 bg-white rounded-t-3xl lg:rounded-xl shadow-2xl lg:shadow-sm border border-slate-200 flex flex-col max-h-[92vh] lg:max-h-none overflow-hidden transition-transform duration-300
        ${isMobileCartOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
      `}>
        {/* Mobile Pull Handle */}
        <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto my-2 lg:hidden shrink-0" />

        {/* Cart Header */}
        <div className="p-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <h3 className="font-black text-sm tracking-tight text-amber-100">Current Bill</h3>
            <span className="bg-amber-500 text-slate-950 font-black text-[11px] px-2 py-0.2 rounded-full">
              {cart.reduce((s, i) => s + i.quantity, 0)} items
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-slate-400 hover:text-rose-400 text-[11px] font-bold transition"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMobileCartOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Customer Information (Optional) */}
        <div className="p-2.5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-2 text-xs shrink-0">
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="WhatsApp Phone"
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-xs focus:ring-1 focus:ring-amber-500"
          />
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer Name"
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-xs focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Cart Items & Details (Scrollable Body) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {cart.map((item) => (
            <div
              key={item.product.id}
              className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2 shadow-xs"
            >
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-xs text-slate-900 truncate">{item.product.name}</h4>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {formatCurrency(item.unit_selling_price, false)} × {item.quantity} = <strong className="text-slate-900">{formatCurrency(item.line_total, false)}</strong>
                </div>
              </div>

              {/* Qty +/- Controls */}
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => updateCartQty(item.product.id, item.quantity - 1)}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition active:scale-90"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold text-xs w-5 text-center text-slate-900">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateCartQty(item.product.id, item.quantity + 1)}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition active:scale-90"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeFromCart(item.product.id)}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 flex items-center justify-center transition ml-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="py-10 text-center text-slate-400">
              <Shirt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold">Bill is empty</p>
              <p className="text-[11px] mt-0.5">Tap any clothing item on the left to add</p>
            </div>
          )}

          {/* Subtotal & Discount Row */}
          {cart.length > 0 && (
            <div className="pt-2 border-t border-slate-200 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-900">{formatCurrency(subtotal, false)}</span>
              </div>

              {/* Discount toggle */}
              <div className="flex justify-between items-center text-slate-600">
                <button
                  type="button"
                  onClick={() => setShowDiscountInput(!showDiscountInput)}
                  className="text-[11px] font-bold text-amber-700 hover:underline flex items-center gap-1"
                >
                  <Tag className="w-3 h-3" />
                  <span>{cartDiscount > 0 ? `Discount (₹${cartDiscount})` : '+ Add Discount'}</span>
                </button>
                {cartDiscount > 0 && (
                  <span className="font-bold text-rose-600">- {formatCurrency(cartDiscount, false)}</span>
                )}
              </div>

              {showDiscountInput && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    min="0"
                    max={subtotal}
                    value={cartDiscount || ''}
                    onChange={(e) => setCartDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="Discount Amount (₹)"
                    className="w-full px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
              )}
            </div>
          )}

          {/* Split Payment Detailed Inputs (Inside Scrollable Area) */}
          {uiPaymentMethod === 'SPLIT' && (
            <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2 text-xs">
              <div className="text-[11px] font-bold text-amber-950 flex items-center justify-between">
                <span>Enter Split Amounts:</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                  Math.abs(splitDifference) < 0.5 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {Math.abs(splitDifference) < 0.5 ? 'Exact Match' : `Diff: ₹${splitDifference}`}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">💵 Cash ₹</label>
                  <input
                    type="number"
                    min="0"
                    value={splitCash}
                    onChange={(e) => setSplitCash(e.target.value)}
                    className="w-full px-2 py-1 bg-white border rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">📱 GPay ₹</label>
                  <input
                    type="number"
                    min="0"
                    value={splitGPay}
                    onChange={(e) => setSplitGPay(e.target.value)}
                    className="w-full px-2 py-1 bg-white border rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">💳 Card ₹</label>
                  <input
                    type="number"
                    min="0"
                    value={splitCard}
                    onChange={(e) => setSplitCard(e.target.value)}
                    className="w-full px-2 py-1 bg-white border rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              {splitDifference !== 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const c = parseFloat(splitCash) || 0;
                    setSplitCash((c + splitDifference).toString());
                  }}
                  className="w-full text-center text-[10px] font-bold text-amber-900 underline"
                >
                  Auto-fill ₹{splitDifference} to Cash
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sticky Pinned Checkout Footer - ALWAYS 100% VISIBLE */}
        <div className="shrink-0 p-3 sm:p-4 bg-slate-900 text-white border-t border-slate-800 space-y-2.5 pb-safe shadow-2xl">
          {/* Payment Method Selector */}
          <div>
            <div className="flex justify-between items-center mb-1 text-[11px]">
              <span className="font-bold text-slate-300">Payment Mode:</span>
              <span className="text-amber-400 font-bold">{uiPaymentMethod}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'CASH', label: 'Cash', icon: '💵' },
                { id: 'UPI', label: 'GPay', icon: '📱' },
                { id: 'CARD', label: 'Card', icon: '💳' },
                { id: 'SPLIT', label: 'Split', icon: '⚖️' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectPaymentMethod(m.id as any)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold border transition flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                    uiPaymentMethod === m.id
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <span className="text-sm">{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* High-Visibility Complete Bill Action Button */}
          <button
            type="button"
            disabled={cart.length === 0 || isSubmitting}
            onClick={handleCheckout}
            className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-black rounded-xl text-sm sm:text-base shadow-xl flex items-center justify-between transition-all disabled:opacity-50"
          >
            <div className="flex flex-col text-left leading-tight">
              <span className="text-[10px] uppercase tracking-wider text-amber-950 font-extrabold">
                Total Payable
              </span>
              <span className="text-lg font-black text-slate-950">
                {formatCurrency(grandTotal, false)}
              </span>
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-950 text-amber-300 px-3.5 py-1.5 rounded-lg text-xs font-black shadow-sm">
              <span>{isSubmitting ? 'Creating Bill...' : 'COMPLETE BILL'}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>

      {/* MOBILE STICKY BAR: Opens Cart Drawer on Phone */}
      {cart.length > 0 && !isMobileCartOpen && (
        <div className="lg:hidden fixed bottom-20 left-3 right-3 z-30 animate-in slide-in-from-bottom-4">
          <button
            type="button"
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between active:scale-[0.99] transition hover:bg-slate-800"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
              <div className="text-left">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Cart Total</div>
                <div className="text-sm font-black text-amber-400">{formatCurrency(grandTotal, false)}</div>
              </div>
            </div>

            <span className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center space-x-1 shadow-sm">
              <span>View Bill & Pay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
