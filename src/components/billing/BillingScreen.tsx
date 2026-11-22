import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  Search, X, Plus, Minus, Trash2, ArrowRight, 
  Smartphone, Tag, AlertCircle, Shirt 
} from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { PaymentMethod } from '../../types';

interface BillingScreenProps {
  onBillSuccess: () => void;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({ onBillSuccess }) => {
  const {
    products, categories, selectedCategory, setSelectedCategory,
    searchQuery, setSearchQuery, cart, addToCart, updateCartQty,
    removeFromCart, cartDiscount, setCartDiscount, customerPhone,
    setCustomerPhone, customerName, setCustomerName, paymentMethod,
    setPaymentMethod, amountPaid, setAmountPaid, clearCart,
    subtotal, grandTotal, balanceDue, checkoutBill
  } = useStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDiscountInput, setShowDiscountInput] = useState(false);

  // Filter products by search and active category
  const filteredProducts = products.filter((prod) => {
    if (!prod.is_active) return false;
    const matchesCat = !selectedCategory || prod.category_id === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      prod.name.toLowerCase().includes(q) || 
      prod.sku.toLowerCase().includes(q) ||
      (prod.barcode && prod.barcode.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  // Handle Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await checkoutBill();
      if (res.success) {
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

  // Quick cash tenders
  const applyExactCash = () => setAmountPaid(grandTotal);
  const addCashTender = (tender: number) => setAmountPaid(amountPaid + tender);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-135px)] pb-16 lg:pb-0">
      {/* LEFT: Product Selection & Catalog */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Search Bar & Clear */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product name or SKU..."
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
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              selectedCategory === null
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Products ({products.filter((p) => p.is_active).length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.is_active && p.category_id === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 auto-rows-max">
          {filteredProducts.map((prod) => {
            const isOutOfStock = prod.available_stock <= 0;
            const isLowStock = !isOutOfStock && prod.available_stock <= prod.low_stock_threshold;
            const cartItem = cart.find((i) => i.product.id === prod.id);

            return (
              <div
                key={prod.id}
                onClick={() => !isOutOfStock && addToCart(prod)}
                className={`relative flex flex-col justify-between p-3 rounded-xl border transition-all text-left select-none ${
                  isOutOfStock
                    ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                    : cartItem
                    ? 'bg-amber-50/60 border-amber-400 ring-1 ring-amber-400 cursor-pointer active:scale-95'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm cursor-pointer active:scale-95'
                }`}
              >
                {/* SKU Badge */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {prod.sku}
                  </span>
                  {/* Stock status badge */}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isOutOfStock
                      ? 'bg-red-100 text-red-700'
                      : isLowStock
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {isOutOfStock ? 'Out' : `${prod.available_stock} in stock`}
                  </span>
                </div>

                {/* Name */}
                <h3 className="font-semibold text-slate-900 text-xs sm:text-sm line-clamp-2 leading-snug mb-2">
                  {prod.name}
                </h3>

                {/* Price and Cart Quantity indicator */}
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                  <span className="font-black text-slate-900 text-sm sm:text-base">
                    {formatCurrency(prod.current_selling_price, false)}
                  </span>
                  {cartItem ? (
                    <span className="bg-amber-500 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full shadow-sm">
                      ×{cartItem.quantity}
                    </span>
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200">
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400">
              <Shirt className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No products found matching &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Active Cart & Checkout Panel */}
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
        {/* Cart Header */}
        <div className="p-3 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm">Cart Items ({cart.length})</span>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-300 hover:text-red-100 font-medium flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-[140px] max-h-[260px] lg:max-h-none">
          {cart.map((item) => (
            <div
              key={item.product.id}
              className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-semibold text-slate-900 truncate">
                  {item.product.name}
                </h4>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <span>{formatCurrency(item.unit_selling_price, false)}</span>
                  <span>•</span>
                  <span className="font-mono text-[10px]">{item.product.sku}</span>
                </div>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg p-0.5">
                <button
                  onClick={() => updateCartQty(item.product.id, item.quantity - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-xs font-bold text-slate-900">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateCartQty(item.product.id, item.quantity + 1)}
                  disabled={item.quantity >= item.product.available_stock}
                  className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Line Total */}
              <div className="text-right w-16">
                <span className="text-xs font-black text-slate-900 block">
                  {formatCurrency(item.line_total, false)}
                </span>
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="text-[10px] text-red-500 hover:underline mt-0.5"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="py-8 text-center text-slate-400">
              <Tag className="w-8 h-8 mx-auto mb-1 opacity-30" />
              <p className="text-xs font-medium">Cart is empty</p>
              <p className="text-[11px] text-slate-400">Tap products on the left to add</p>
            </div>
          )}
        </div>

        {/* Customer & Payment Breakdown Section */}
        {cart.length > 0 && (
          <div className="border-t border-slate-200 p-3 bg-slate-50/70 space-y-2.5">
            {/* Customer Phone for WhatsApp Direct */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between mb-1">
                <span>Customer Mobile (for WhatsApp Bill)</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                  <Smartphone className="w-3 h-3" /> +91
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  maxLength={10}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit phone number"
                  className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Name (Optional)"
                  className="w-28 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Payment Method
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['CASH', 'UPI', 'SPLIT', 'CREDIT'] as PaymentMethod[]).map((pm) => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setPaymentMethod(pm)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition ${
                      paymentMethod === pm
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {pm}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Cash Buttons (if Cash or Split) */}
            {['CASH', 'SPLIT'].includes(paymentMethod) && (
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                <button
                  type="button"
                  onClick={applyExactCash}
                  className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-[11px] font-bold whitespace-nowrap"
                >
                  Exact (₹{grandTotal})
                </button>
                {[100, 200, 500, 1000, 2000].map((tender) => (
                  <button
                    key={tender}
                    type="button"
                    onClick={() => addCashTender(tender)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded text-[11px] font-semibold whitespace-nowrap"
                  >
                    +₹{tender}
                  </button>
                ))}
              </div>
            )}

            {/* Discount & Totals */}
            <div className="space-y-1 pt-1 border-t border-slate-200 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold">{formatCurrency(subtotal, false)}</span>
              </div>

              {/* Discount Row */}
              <div className="flex justify-between items-center text-slate-600">
                <button
                  type="button"
                  onClick={() => setShowDiscountInput(!showDiscountInput)}
                  className="text-amber-700 hover:underline font-semibold flex items-center gap-1"
                >
                  <Tag className="w-3 h-3" />
                  <span>{cartDiscount > 0 ? `Discount Applied: -${formatCurrency(cartDiscount, false)}` : '+ Apply Discount'}</span>
                </button>
                {cartDiscount > 0 && (
                  <button onClick={() => setCartDiscount(0)} className="text-[10px] text-red-500 hover:underline">
                    Remove
                  </button>
                )}
              </div>

              {showDiscountInput && (
                <div className="flex gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200 my-1">
                  <input
                    type="number"
                    min="0"
                    placeholder="Discount ₹"
                    value={cartDiscount || ''}
                    onChange={(e) => setCartDiscount(Number(e.target.value) || 0)}
                    className="w-24 px-2 py-1 text-xs border rounded bg-white"
                  />
                  <div className="flex gap-1">
                    {[5, 10, 15, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setCartDiscount(Math.round((subtotal * pct) / 100))}
                        className="px-1.5 py-0.5 bg-amber-200 hover:bg-amber-300 rounded text-[10px] font-bold text-amber-900"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex justify-between items-baseline pt-1 text-slate-900 border-t border-slate-200">
                <span className="font-bold text-sm">Grand Total</span>
                <span className="font-black text-lg text-amber-600">
                  {formatCurrency(grandTotal, false)}
                </span>
              </div>

              {balanceDue > 0 && (
                <div className="flex justify-between text-red-600 font-semibold text-xs">
                  <span>Balance Due (Credit)</span>
                  <span>{formatCurrency(balanceDue, false)}</span>
                </div>
              )}
            </div>

            {/* Error Message if stock insufficient */}
            {errorMessage && (
              <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* CHARGE / COMPLETE BILL BUTTON */}
            <button
              onClick={handleCheckout}
              disabled={isSubmitting || cart.length === 0}
              className="w-full py-3 px-4 rounded-xl font-black text-sm sm:text-base text-slate-950 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] shadow-md flex items-center justify-center space-x-2 transition disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Processing Bill...' : `COMPLETE BILL (${formatCurrency(grandTotal, false)})`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
