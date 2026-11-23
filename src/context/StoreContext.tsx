// React Store Context for VINTAGE CLOTHING STORE
// Provides 3-Phone Live Synchronization, Device Authorization, Cart State, and Real-time Updates.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Product, Category, Bill, Expense, StoreSettings, AuthorizedDevice,
  DashboardMetrics, CartItem, PaymentMethod
} from '../types';
import { storeService, AddPurchasePayload, AdjustStockPayload } from '../services/storeService';
import { supabase, isSupabaseConfigured, localBroadcastChannel } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  getEnrolledDeviceToken, getEnrolledDeviceName, saveEnrolledDevice,
  clearEnrolledDevice, getClientDeviceInfo, generateDeviceUUID
} from '../lib/deviceAuth';
import { playBeep, playSuccessChime, triggerHaptic } from '../lib/feedback';

interface StoreContextType {
  // Device & Authorization (No daily login)
  isEnrolled: boolean;
  currentDevice: { token: string; name: string } | null;
  authorizedDevices: AuthorizedDevice[];
  enrollDevice: (name: string, passcode: string) => Promise<{ success: boolean; message?: string }>;
  revokeDevice: (id: string) => Promise<boolean>;
  logoutDevice: () => void;

  // Store Settings
  settings: StoreSettings;
  updateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;

  // Products & Categories
  products: Product[];
  categories: Category[];
  selectedCategory: string | null;
  setSelectedCategory: (catId: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  addProduct: (product: Omit<Product, 'id'>) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<Product | null>;

  // Cart & POS Billing
  cart: CartItem[];
  isMobileCartOpen: boolean;
  setIsMobileCartOpen: (open: boolean) => void;
  addToCart: (product: Product) => void;
  updateCartQty: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  cartDiscount: number;
  setCartDiscount: (amount: number) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (pm: PaymentMethod) => void;
  amountPaid: number;
  setAmountPaid: (amt: number) => void;
  clearCart: () => void;
  subtotal: number;
  grandTotal: number;
  balanceDue: number;
  checkoutBill: (customNotes?: string) => Promise<{ success: boolean; bill?: Bill; message?: string }>;

  // Bills & Invoices
  bills: Bill[];
  lastCompletedBill: Bill | null;
  setLastCompletedBill: (bill: Bill | null) => void;
  cancelBill: (billId: string, reason: string) => Promise<{ success: boolean; message?: string }>;

  // Stock Purchases
  addStockPurchase: (payload: AddPurchasePayload) => Promise<{ success: boolean; message?: string }>;

  // Customer Handover Reset
  resetAllBusinessData: (passcode: string) => Promise<{ success: boolean; message?: string }>;

  // Stock Adjustments
  adjustStock: (payload: AdjustStockPayload) => Promise<{ success: boolean; message?: string }>;

  // Expenses
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<Expense>;
  deleteExpense: (id: string) => Promise<boolean>;

  // Dashboard Metrics & Live Sync
  dashboardMetrics: DashboardMetrics | null;
  dateRange: 'today' | 'yesterday' | 'week' | 'month' | 'custom';
  setDateRange: (range: 'today' | 'yesterday' | 'week' | 'month' | 'custom') => void;
  customStartDate: string;
  setCustomStartDate: (d: string) => void;
  customEndDate: string;
  setCustomEndDate: (d: string) => void;
  isOnline: boolean;
  syncStatus: 'connected' | 'connecting' | 'disconnected';
  lastSyncTime: Date;
  refreshData: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Device Auth state
  const [isEnrolled, setIsEnrolled] = useState<boolean>(() => Boolean(getEnrolledDeviceToken()));
  const [currentDevice, setCurrentDevice] = useState<{ token: string; name: string } | null>(() => {
    const token = getEnrolledDeviceToken();
    const name = getEnrolledDeviceName();
    return token && name ? { token, name } : null;
  });
  const [authorizedDevices, setAuthorizedDevices] = useState<AuthorizedDevice[]>([]);

  // Core Data
  const [settings, setSettings] = useState<StoreSettings>({} as StoreSettings);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false);
  const [cartDiscount, setCartDiscount] = useState<number>(0);
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [lastCompletedBill, setLastCompletedBill] = useState<Bill | null>(null);

  // Filter & Search
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Network & Sync State
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connected');
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Date range calculation
  const getDateBounds = useCallback(() => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

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
      const s = new Date(customStartDate);
      s.setHours(0, 0, 0, 0);
      const e = new Date(customEndDate);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }

    return { start, end };
  }, [dateRange, customStartDate, customEndDate]);

  // Main refresh data
  const refreshData = useCallback(async () => {
    try {
      const [s, p, c, b, e, d] = await Promise.all([
        storeService.getSettings(),
        storeService.getProducts(),
        storeService.getCategories(),
        storeService.getBills(),
        storeService.getExpenses(),
        storeService.getAuthorizedDevices(),
      ]);

      setSettings(s);
      setProducts(p);
      setCategories(c);
      setBills(b);
      setExpenses(e);
      setAuthorizedDevices(d);

      // Verify active enrollment of this device
      const token = getEnrolledDeviceToken();
      if (token && d.length > 0) {
        const found = d.find((dev) => dev.device_token === token);
        if (found && !found.is_active) {
          clearEnrolledDevice();
          setIsEnrolled(false);
          setCurrentDevice(null);
        }
      }

      // Refresh Dashboard Metrics
      const bounds = getDateBounds();
      const metrics = await storeService.getDashboardMetrics(bounds.start, bounds.end);
      
      // Calculate payment method breakdown from actual bills in date range
      let cash = 0;
      let gpay = 0;
      let card = 0;
      const startTime = bounds.start.getTime();
      const endTime = bounds.end.getTime();

      for (const bill of b) {
        if (bill.status !== 'COMPLETED') continue;
        const bTime = new Date(bill.bill_date).getTime();
        if (bTime >= startTime && bTime <= endTime) {
          const paid = bill.amount_paid || 0;
          if (bill.payment_method === 'CASH') {
            cash += paid;
          } else if (bill.payment_method === 'UPI') {
            if (bill.notes && bill.notes.includes('[Payment Method: CARD]')) {
              card += paid;
            } else {
              gpay += paid;
            }
          } else if (bill.payment_method === 'SPLIT' && bill.notes) {
            const cashMatch = bill.notes.match(/Cash ₹?([\d.]+)/i);
            const gpayMatch = bill.notes.match(/GPay ₹?([\d.]+)/i) || bill.notes.match(/UPI ₹?([\d.]+)/i);
            const cardMatch = bill.notes.match(/Card ₹?([\d.]+)/i);
            if (cashMatch) cash += parseFloat(cashMatch[1]) || 0;
            if (gpayMatch) gpay += parseFloat(gpayMatch[1]) || 0;
            if (cardMatch) card += parseFloat(cardMatch[1]) || 0;
          }
        }
      }

      metrics.today_cash = cash;
      metrics.today_gpay = gpay;
      metrics.today_card = card;

      setDashboardMetrics(metrics);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error('Error refreshing store data:', err);
    }
  }, [getDateBounds]);

  // Initial load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Live Synchronization across 3 phones
  useEffect(() => {
    // 1. Local multi-tab broadcast listener (Instant sync across open browser sessions)
    const handleLocalBroadcast = (ev: MessageEvent) => {
      if (ev.data && ev.data.type) {
        refreshData();
      }
    };

    if (localBroadcastChannel) {
      localBroadcastChannel.addEventListener('message', handleLocalBroadcast);
    }

    // 2. Supabase Realtime Channel
    let supabaseChannel: RealtimeChannel | null = null;
    if (supabase && isSupabaseConfigured) {
      setSyncStatus('connecting');
      supabaseChannel = supabase
        .channel('vcs_live_shop')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
          refreshData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, () => {
          refreshData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, () => {
          refreshData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
          refreshData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'authorized_devices' }, () => {
          refreshData();
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setSyncStatus('connected');
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setSyncStatus('disconnected');
          }
        });
    }

    // 3. Online/Offline window listeners
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('connected');
      refreshData();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (localBroadcastChannel) {
        localBroadcastChannel.removeEventListener('message', handleLocalBroadcast);
      }
      if (supabase && supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshData]);

  // Device Enrollment
  const enrollDevice = async (name: string, passcode: string) => {
    const token = getEnrolledDeviceToken() || generateDeviceUUID();
    const model = getClientDeviceInfo();
    const res = await storeService.enrollDevice(token, name, model, passcode);
    if (res.success) {
      saveEnrolledDevice(token, name);
      setIsEnrolled(true);
      setCurrentDevice({ token, name });
      await refreshData();
      playSuccessChime();
      return { success: true };
    }
    return { success: false, message: res.message || 'Enrollment failed' };
  };

  const revokeDevice = async (id: string) => {
    const success = await storeService.revokeDevice(id);
    if (success) {
      await refreshData();
    }
    return success;
  };

  const logoutDevice = () => {
    clearEnrolledDevice();
    setIsEnrolled(false);
    setCurrentDevice(null);
  };

  // Cart Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.line_total, 0);
  const grandTotal = Math.max(0, subtotal - cartDiscount);
  const balanceDue = Math.max(0, grandTotal - amountPaid);

  // Auto-sync amountPaid if user hasn't typed custom tender
  useEffect(() => {
    setAmountPaid(grandTotal);
  }, [grandTotal]);

  const addToCart = (product: Product) => {
    if (product.available_stock <= 0) {
      triggerHaptic();
      return;
    }
    playBeep();
    triggerHaptic();

    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.available_stock) return prev; // Cannot exceed available stock
        const newQty = existing.quantity + 1;
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: newQty, line_total: (newQty * i.unit_selling_price) - i.item_discount }
            : i
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          unit_selling_price: product.current_selling_price,
          item_discount: 0,
          line_total: product.current_selling_price,
        },
      ];
    });
  };

  const updateCartQty = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    playBeep();
    triggerHaptic();

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const clampedQty = Math.min(quantity, item.product.available_stock);
          return {
            ...item,
            quantity: clampedQty,
            line_total: (clampedQty * item.unit_selling_price) - item.item_discount,
          };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    playBeep();
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCartDiscount(0);
    setCustomerPhone('');
    setCustomerName('Walk-in Customer');
    setPaymentMethod('CASH');
    setAmountPaid(0);
    setIsMobileCartOpen(false);
  };

  // Fast Checkout with Idempotency Key
  const checkoutBill = async (customNotes?: string) => {
    if (cart.length === 0) {
      return { success: false, message: 'Cart is empty' };
    }

    // Generate unique idempotency key to prevent double submit
    const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const res = await storeService.createBill({
      items: cart,
      subtotal,
      discount_amount: cartDiscount,
      grand_total: grandTotal,
      payment_method: paymentMethod,
      amount_paid: amountPaid,
      balance_due: balanceDue,
      customer_name: customerName,
      customer_phone: customerPhone,
      notes: customNotes,
      idempotency_key: idempotencyKey,
      device_id: currentDevice?.token,
      device_name: currentDevice?.name,
    });

    if (res.success && res.bill) {
      playSuccessChime();
      triggerHaptic();
      setLastCompletedBill(res.bill);
      clearCart();
      await refreshData();
      return { success: true, bill: res.bill };
    }

    return { success: false, message: res.message || 'Billing failed' };
  };

  // Product Operations
  const addProduct = async (prod: Omit<Product, 'id'>) => {
    const res = await storeService.addProduct(prod);
    await refreshData();
    return res;
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const res = await storeService.updateProduct(id, updates);
    await refreshData();
    return res;
  };

  // Stock Operations
  const addStockPurchase = async (payload: AddPurchasePayload) => {
    const res = await storeService.addStockPurchase({
      ...payload,
      device_id: currentDevice?.token,
    });
    if (res.success) {
      playSuccessChime();
      await refreshData();
    }
    return res;
  };

  const adjustStock = async (payload: AdjustStockPayload) => {
    const res = await storeService.adjustStock({
      ...payload,
      device_id: currentDevice?.token,
    });
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  // Cancel Bill
  const cancelBill = async (billId: string, reason: string) => {
    const res = await storeService.cancelBill(billId, reason, currentDevice?.token);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  // Customer Handover Reset
  const resetAllBusinessData = async (passcode: string) => {
    const res = await storeService.resetAllBusinessData(passcode);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  // Expenses
  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    const res = await storeService.addExpense({
      ...expense,
      device_id: currentDevice?.token,
    });
    await refreshData();
    return res;
  };

  const deleteExpense = async (id: string) => {
    const res = await storeService.deleteExpense(id);
    if (res) await refreshData();
    return res;
  };

  // Settings
  const updateSettings = async (newSettings: Partial<StoreSettings>) => {
    const updated = await storeService.updateSettings(newSettings);
    setSettings(updated);
  };

  return (
    <StoreContext.Provider
      value={{
        isEnrolled,
        currentDevice,
        authorizedDevices,
        enrollDevice,
        revokeDevice,
        logoutDevice,
        settings,
        updateSettings,
        products,
        categories,
        selectedCategory,
        setSelectedCategory,
        searchQuery,
        setSearchQuery,
        addProduct,
        updateProduct,
        cart,
        isMobileCartOpen,
        setIsMobileCartOpen,
        addToCart,
        updateCartQty,
        removeFromCart,
        cartDiscount,
        setCartDiscount,
        customerPhone,
        setCustomerPhone,
        customerName,
        setCustomerName,
        paymentMethod,
        setPaymentMethod,
        amountPaid,
        setAmountPaid,
        clearCart,
        subtotal,
        grandTotal,
        balanceDue,
        checkoutBill,
        bills,
        lastCompletedBill,
        setLastCompletedBill,
        cancelBill,
        addStockPurchase,
        adjustStock,
        expenses,
        addExpense,
        deleteExpense,
        resetAllBusinessData,
        dashboardMetrics,
        dateRange,
        setDateRange,
        customStartDate,
        setCustomStartDate,
        customEndDate,
        setCustomEndDate,
        isOnline,
        syncStatus,
        lastSyncTime,
        refreshData,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
