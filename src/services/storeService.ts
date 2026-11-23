// Store Service Layer: Bridges Supabase PostgreSQL RPCs and provides seamless
// local fallback with full FIFO costing & multi-tab synchronization for testing & resilience.

import { supabase, localBroadcastChannel } from '../lib/supabase';
import {
  Product, Category, StockBatch, StockPurchase, StockMovement,
  Bill, Expense, StoreSettings, AuthorizedDevice, DashboardMetrics,
  ProfitLossReport, CartItem, PaymentMethod
} from '../types';

export interface AddPurchasePayload {
  supplier_name?: string;
  reference_no?: string;
  purchase_date?: string;
  total_amount: number;
  notes?: string;
  device_id?: string;
  items: {
    product_id: string;
    quantity: number;
    purchase_price: number;
    selling_price: number;
    total_amount: number;
    update_selling_price: boolean;
  }[];
}

export interface AdjustStockPayload {
  product_id: string;
  adjustment_type: 'IN' | 'OUT' | 'DAMAGE' | 'LOST' | 'PHYSICAL_COUNT';
  quantity: number;
  reason: string;
  device_id?: string;
}

// Clean Store State for Customer Handover (Brand-new installation from zero)
export const INITIAL_CATEGORIES: Category[] = [];
export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_BATCHES: StockBatch[] = [];

export const INITIAL_SETTINGS: StoreSettings = {
  id: 'settings-1',
  store_name: 'VINTAGE CLOTHING STORE',
  tagline: 'Exclusive Men & Women Fashion',
  phone: '+91 98765 43210',
  address: 'Shop #4, Market Road, Kerala, India',
  upi_id: 'vintageclothing@upi',
  currency_symbol: '₹',
  invoice_prefix: 'VCS',
  low_stock_default_threshold: 5,
  enrollment_passcode: 'VCS786',
  max_authorized_devices: 3,
};

// Local storage keys
const STORAGE_PREFIX = 'vcs_store_';

// Customer Handover Clean State Identifier
const HANDOVER_RESET_VERSION_KEY = 'vcs_customer_handover_v20261123_full_wipe';

function ensureCustomerHandoverCleanState() {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage) {
      const isCleaned = localStorage.getItem(HANDOVER_RESET_VERSION_KEY);
      if (!isCleaned) {
        // Wipe all business and customer data from local storage
        const businessKeys = [
          'bills', 'products', 'categories', 'batches', 'purchases', 
          'expenses', 'movements', 'returns', 'customers', 'customer_profiles',
          'customer_credits', 'customer_loyalty', 'loyalty_rewards', 'customer_notes',
          'cart_draft', 'customer_phone', 'customer_name', 'recent_customers'
        ];
        for (const k of businessKeys) {
          localStorage.removeItem(STORAGE_PREFIX + k);
          localStorage.removeItem(k);
        }

        // Clean any leftover customer search or transaction caches
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith(STORAGE_PREFIX) && 
            !key.includes('settings') && 
            !key.includes('device') && 
            !key.includes('supabase')
          )) {
            keysToRemove.push(key);
          }
        }
        for (const k of keysToRemove) {
          localStorage.removeItem(k);
        }

        localStorage.setItem(HANDOVER_RESET_VERSION_KEY, 'true');
      }
    }

    // Clear IndexedDB customer/transaction stores if present
    if (window.indexedDB && window.indexedDB.databases) {
      window.indexedDB.databases().then((dbs) => {
        dbs.forEach((db) => {
          if (db.name && (db.name.includes('vcs') || db.name.includes('customer') || db.name.includes('bill'))) {
            window.indexedDB.deleteDatabase(db.name);
          }
        });
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('Local storage check warning:', e);
  }
}
ensureCustomerHandoverCleanState();

function loadLocal<T>(key: string, defaultValue: T): T {
  try {
    const val = localStorage.getItem(STORAGE_PREFIX + key);
    return val ? JSON.parse(val) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
  } catch (e) {
    console.error('Storage write error', e);
  }
}

export class StoreService {
  // Broadcast local changes to other tabs (Phones 2 & 3 in local simulation)
  private broadcastChange(type: string, data?: unknown) {
    if (localBroadcastChannel) {
      localBroadcastChannel.postMessage({ type, data, timestamp: Date.now() });
    }
  }

  // --- STORE SETTINGS ---
  async getSettings(): Promise<StoreSettings> {
    if (supabase) {
      const { data, error } = await supabase.from('store_settings').select('*').limit(1).single();
      if (!error && data) return data as StoreSettings;
    }
    return loadLocal('settings', INITIAL_SETTINGS);
  }

  async updateSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
    if (supabase) {
      const current = await this.getSettings();
      const { data, error } = await supabase
        .from('store_settings')
        .update(settings)
        .eq('id', current.id)
        .select()
        .single();
      if (!error && data) {
        return data as StoreSettings;
      }
    }
    const current = loadLocal('settings', INITIAL_SETTINGS);
    const updated = { ...current, ...settings, updated_at: new Date().toISOString() };
    saveLocal('settings', updated);
    this.broadcastChange('SETTINGS_UPDATED', updated);
    return updated;
  }

  // --- AUTHORIZED DEVICES ---
  async getAuthorizedDevices(): Promise<AuthorizedDevice[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('authorized_devices')
        .select('*')
        .order('enrolled_at', { ascending: false });
      if (!error && data) return data as AuthorizedDevice[];
    }
    return loadLocal<AuthorizedDevice[]>('devices', []);
  }

  async enrollDevice(
    deviceToken: string,
    deviceName: string,
    modelInfo: string,
    passcode: string
  ): Promise<{ success: boolean; message?: string; device?: AuthorizedDevice }> {
    if (supabase) {
      const { data, error } = await supabase.rpc('enroll_device', {
        p_device_token: deviceToken,
        p_device_name: deviceName,
        p_model_info: modelInfo,
        p_passcode: passcode,
      });
      if (error) {
        return { success: false, message: error.message };
      }
      return data as { success: boolean; message?: string; device?: AuthorizedDevice };
    }

    // Local Engine
    const settings = await this.getSettings();
    if (passcode !== settings.enrollment_passcode) {
      return { success: false, message: 'Invalid shop enrollment passcode' };
    }

    const devices = loadLocal<AuthorizedDevice[]>('devices', []);
    const existing = devices.find((d) => d.device_token === deviceToken);
    if (existing) {
      if (!existing.is_active) {
        return { success: false, message: 'This device has been revoked by shop manager' };
      }
      existing.device_name = deviceName;
      existing.last_active_at = new Date().toISOString();
      saveLocal('devices', devices);
      this.broadcastChange('DEVICE_ENROLLED', existing);
      return { success: true, device: existing };
    }

    const activeCount = devices.filter((d) => d.is_active).length;
    if (activeCount >= settings.max_authorized_devices) {
      return {
        success: false,
        message: `Maximum device limit reached (${settings.max_authorized_devices} phones). Revoke an old phone first in Settings.`,
      };
    }

    const newDevice: AuthorizedDevice = {
      id: 'dev-' + Date.now(),
      device_token: deviceToken,
      device_name: deviceName,
      model_info: modelInfo,
      is_active: true,
      enrolled_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    };
    devices.push(newDevice);
    saveLocal('devices', devices);
    this.broadcastChange('DEVICE_ENROLLED', newDevice);
    return { success: true, device: newDevice };
  }

  async revokeDevice(deviceId: string): Promise<boolean> {
    if (supabase) {
      const { error } = await supabase
        .from('authorized_devices')
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq('id', deviceId);
      return !error;
    }
    const devices = loadLocal<AuthorizedDevice[]>('devices', []);
    const dev = devices.find((d) => d.id === deviceId);
    if (dev) {
      dev.is_active = false;
      dev.revoked_at = new Date().toISOString();
      saveLocal('devices', devices);
      this.broadcastChange('DEVICE_REVOKED', { deviceId });
      return true;
    }
    return false;
  }

  // --- CATEGORIES ---
  async getCategories(): Promise<Category[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });
      if (!error && data) return data as Category[];
    }
    return loadLocal('categories', INITIAL_CATEGORIES);
  }

  async addCategory(name: string, description?: string): Promise<Category> {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (supabase) {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name, slug, description, display_order: 99 })
        .select()
        .single();
      if (!error && data) return data as Category;
    }
    const cats = loadLocal('categories', INITIAL_CATEGORIES);
    const newCat: Category = {
      id: 'cat-' + Date.now(),
      name,
      slug,
      description,
      display_order: cats.length + 1,
    };
    cats.push(newCat);
    saveLocal('categories', cats);
    this.broadcastChange('CATEGORY_ADDED', newCat);
    return newCat;
  }

  // --- PRODUCTS ---
  async getProducts(): Promise<Product[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('name', { ascending: true });
      if (!error && data) {
        return data.map((p) => ({
          ...p,
          category_name: p.categories?.name,
        })) as Product[];
      }
    }
    return loadLocal('products', INITIAL_PRODUCTS);
  }

  async addProduct(product: Omit<Product, 'id'>): Promise<Product> {
    if (supabase) {
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: product.name,
          sku: product.sku,
          category_id: product.category_id,
          description: product.description,
          current_selling_price: product.current_selling_price,
          current_cost_price: product.current_cost_price,
          available_stock: product.available_stock,
          low_stock_threshold: product.low_stock_threshold,
          is_active: product.is_active ?? true,
        })
        .select()
        .single();
      if (!error && data) return data as Product;
    }

    const prods = loadLocal('products', INITIAL_PRODUCTS);
    const newProd: Product = {
      ...product,
      id: 'prod-' + Date.now(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    prods.unshift(newProd);
    saveLocal('products', prods);

    // If initial stock provided, create initial batch
    if (newProd.available_stock > 0) {
      const batches = loadLocal('batches', INITIAL_BATCHES);
      batches.push({
        id: 'batch-' + Date.now(),
        product_id: newProd.id,
        batch_number: 'BATCH-INIT-' + newProd.sku,
        initial_quantity: newProd.available_stock,
        remaining_quantity: newProd.available_stock,
        unit_cost: newProd.current_cost_price,
        selling_price: newProd.current_selling_price,
        received_date: new Date().toISOString(),
        is_depleted: false,
      });
      saveLocal('batches', batches);
    }

    this.broadcastChange('PRODUCT_ADDED', newProd);
    return newProd;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
    if (supabase) {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data as Product;
    }

    const prods = loadLocal('products', INITIAL_PRODUCTS);
    const idx = prods.findIndex((p) => p.id === id);
    if (idx !== -1) {
      prods[idx] = { ...prods[idx], ...updates, updated_at: new Date().toISOString() };
      saveLocal('products', prods);
      this.broadcastChange('PRODUCT_UPDATED', prods[idx]);
      return prods[idx];
    }
    return null;
  }

  // --- BILLING (ATOMIC + FIFO COGS) ---
  async createBill(payload: {
    items: CartItem[];
    subtotal: number;
    discount_amount: number;
    discount_percentage?: number;
    grand_total: number;
    payment_method: PaymentMethod;
    amount_paid: number;
    balance_due: number;
    customer_name?: string;
    customer_phone?: string;
    notes?: string;
    idempotency_key?: string;
    device_id?: string;
    device_name?: string;
  }): Promise<{ success: boolean; bill?: Bill; message?: string }> {
    if (supabase) {
      const rpcPayload = {
        idempotency_key: payload.idempotency_key,
        customer_name: payload.customer_name || 'Walk-in Customer',
        customer_phone: payload.customer_phone,
        subtotal: payload.subtotal,
        discount_amount: payload.discount_amount,
        discount_percentage: payload.discount_percentage,
        grand_total: payload.grand_total,
        payment_method: payload.payment_method,
        amount_paid: payload.amount_paid,
        balance_due: payload.balance_due,
        payment_status: payload.balance_due <= 0 ? 'PAID' : (payload.amount_paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
        notes: payload.notes,
        device_id: payload.device_id,
        items: payload.items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          unit_selling_price: i.unit_selling_price,
          item_discount: i.item_discount,
          line_total: i.line_total,
        })),
      };

      const { data, error } = await supabase.rpc('create_bill_atomic', { p_bill_data: rpcPayload });
      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true, bill: data as Bill };
    }

    // Local Engine with Full FIFO Costing & Idempotency
    const bills = loadLocal<Bill[]>('bills', []);
    
    // Idempotency check
    if (payload.idempotency_key) {
      const existing = bills.find((b) => b.idempotency_key === payload.idempotency_key);
      if (existing) {
        return { success: true, bill: existing };
      }
    }

    const prods = loadLocal<Product[]>('products', INITIAL_PRODUCTS);
    const batches = loadLocal<StockBatch[]>('batches', INITIAL_BATCHES);
    const movements = loadLocal<StockMovement[]>('movements', []);

    // 1. Verify stock availability for all items atomically
    for (const item of payload.items) {
      const prod = prods.find((p) => p.id === item.product.id);
      if (!prod || !prod.is_active) {
        return { success: false, message: `Product "${item.product.name}" is not active or available` };
      }
      if (prod.available_stock < item.quantity) {
        return {
          success: false,
          message: `Insufficient stock for "${prod.name}". Available: ${prod.available_stock}, Requested: ${item.quantity}`,
        };
      }
    }

    // 2. Generate daily invoice number VCS-YYYYMMDD-0001
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todaysBillsCount = bills.filter((b) => b.invoice_number.includes(todayStr)).length;
    const invNumber = `VCS-${todayStr}-${String(todaysBillsCount + 1).padStart(4, '0')}`;

    let overallCogs = 0;
    const billItems: Bill['items'] = [];

    // 3. FIFO Batch allocation per item
    for (const item of payload.items) {
      const prod = prods.find((p) => p.id === item.product.id)!;
      let qtyNeeded = item.quantity;
      let lineCost = 0;

      // Find active batches for this product sorted by received_date
      const prodBatches = batches
        .filter((b) => b.product_id === prod.id && b.remaining_quantity > 0 && !b.is_depleted)
        .sort((a, b) => new Date(a.received_date).getTime() - new Date(b.received_date).getTime());

      for (const batch of prodBatches) {
        if (qtyNeeded <= 0) break;
        const take = Math.min(batch.remaining_quantity, qtyNeeded);
        batch.remaining_quantity -= take;
        if (batch.remaining_quantity === 0) batch.is_depleted = true;
        lineCost += take * batch.unit_cost;
        qtyNeeded -= take;
      }

      // Fallback cost if batches underflow
      if (qtyNeeded > 0) {
        lineCost += qtyNeeded * prod.current_cost_price;
      }

      overallCogs += lineCost;
      const unitCost = Math.round((lineCost / item.quantity) * 100) / 100;
      const lineProfit = item.line_total - lineCost;

      billItems.push({
        id: 'bi-' + Math.random().toString(36).slice(2),
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        quantity: item.quantity,
        unit_selling_price: item.unit_selling_price,
        unit_cost_price: unitCost,
        item_discount: item.item_discount,
        line_total: item.line_total,
        line_cost: lineCost,
        line_profit: lineProfit,
      });

      // Deduct available stock
      const prevStock = prod.available_stock;
      prod.available_stock -= item.quantity;
      prod.updated_at = new Date().toISOString();

      // Record movement
      movements.unshift({
        id: 'mov-' + Date.now() + Math.random().toString(36).slice(2, 5),
        product_id: prod.id,
        product_name: prod.name,
        product_sku: prod.sku,
        movement_type: 'SALE_OUT',
        quantity_change: -item.quantity,
        previous_quantity: prevStock,
        new_quantity: prod.available_stock,
        unit_cost: unitCost,
        reference_type: 'BILL',
        reason: `Sold in Bill ${invNumber}`,
        device_id: payload.device_id,
        device_name: payload.device_name,
        created_at: new Date().toISOString(),
      });
    }

    const grossProfit = payload.grand_total - overallCogs;

    const newBill: Bill = {
      id: 'bill-' + Date.now(),
      invoice_number: invNumber,
      bill_date: new Date().toISOString(),
      customer_name: payload.customer_name || 'Walk-in Customer',
      customer_phone: payload.customer_phone,
      subtotal: payload.subtotal,
      discount_amount: payload.discount_amount,
      discount_percentage: payload.discount_percentage,
      grand_total: payload.grand_total,
      total_cost_cogs: overallCogs,
      gross_profit: grossProfit,
      payment_method: payload.payment_method,
      amount_paid: payload.amount_paid,
      balance_due: payload.balance_due,
      payment_status: payload.balance_due <= 0 ? 'PAID' : (payload.amount_paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
      status: 'COMPLETED',
      notes: payload.notes,
      idempotency_key: payload.idempotency_key,
      device_id: payload.device_id,
      device_name: payload.device_name,
      created_at: new Date().toISOString(),
      items: billItems,
    };

    bills.unshift(newBill);

    // Save all updated tables
    saveLocal('bills', bills);
    saveLocal('products', prods);
    saveLocal('batches', batches);
    saveLocal('movements', movements);

    // Broadcast live event to all other open tabs/phones!
    this.broadcastChange('BILL_CREATED', newBill);

    return { success: true, bill: newBill };
  }

  // --- CANCEL / RETURN BILL ---
  async cancelBill(billId: string, reason: string, deviceId?: string): Promise<{ success: boolean; message?: string }> {
    if (supabase) {
      const { data, error } = await supabase.rpc('cancel_or_return_bill_atomic', {
        p_bill_id: billId,
        p_reason: reason,
        p_device_id: deviceId || null,
      });
      if (error) return { success: false, message: error.message };
      return { success: true, message: data?.message };
    }

    const bills = loadLocal<Bill[]>('bills', []);
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return { success: false, message: 'Bill not found' };
    if (bill.status === 'CANCELLED') return { success: false, message: 'Bill already cancelled' };

    const prods = loadLocal<Product[]>('products', INITIAL_PRODUCTS);
    const batches = loadLocal<StockBatch[]>('batches', INITIAL_BATCHES);
    const movements = loadLocal<StockMovement[]>('movements', []);

    // Restore stock
    for (const item of bill.items || []) {
      const prod = prods.find((p) => p.id === item.product_id);
      if (prod) {
        const prev = prod.available_stock;
        prod.available_stock += item.quantity;
        prod.updated_at = new Date().toISOString();

        movements.unshift({
          id: 'mov-' + Date.now() + Math.random().toString(36).slice(2, 5),
          product_id: prod.id,
          product_name: prod.name,
          product_sku: prod.sku,
          movement_type: 'CANCEL_IN',
          quantity_change: item.quantity,
          previous_quantity: prev,
          new_quantity: prod.available_stock,
          unit_cost: item.unit_cost_price,
          reference_type: 'BILL',
          reason: `Restocked due to bill cancellation: ${reason}`,
          device_id: deviceId,
          created_at: new Date().toISOString(),
        });
      }

      // Re-add to earliest available batch
      const pBatch = batches.find((b) => b.product_id === item.product_id);
      if (pBatch) {
        pBatch.remaining_quantity += item.quantity;
        pBatch.is_depleted = false;
      }
    }

    bill.status = 'CANCELLED';
    bill.notes = (bill.notes ? bill.notes + ' ' : '') + `[CANCELLED: ${reason}]`;
    bill.updated_at = new Date().toISOString();

    saveLocal('bills', bills);
    saveLocal('products', prods);
    saveLocal('batches', batches);
    saveLocal('movements', movements);

    this.broadcastChange('BILL_CANCELLED', { billId, reason });
    return { success: true, message: 'Bill cancelled and stock restored successfully' };
  }

  // --- STOCK PURCHASES ---
  async getPurchases(): Promise<StockPurchase[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('stock_purchases')
        .select('*, stock_purchase_items(*)')
        .order('purchase_date', { ascending: false });
      if (!error && data) return data as StockPurchase[];
    }
    return loadLocal('purchases', []);
  }

  async addStockPurchase(payload: AddPurchasePayload): Promise<{ success: boolean; purchase?: StockPurchase; message?: string }> {
    if (supabase) {
      const { data, error } = await supabase.rpc('add_stock_purchase_atomic', {
        p_purchase_data: payload,
      });
      if (error) return { success: false, message: error.message };
      return { success: true, purchase: data as StockPurchase };
    }

    const purchases = loadLocal<StockPurchase[]>('purchases', []);
    const prods = loadLocal<Product[]>('products', INITIAL_PRODUCTS);
    const batches = loadLocal<StockBatch[]>('batches', INITIAL_BATCHES);
    const movements = loadLocal<StockMovement[]>('movements', []);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const purchaseNumber = `PUR-${dateStr}-${String(purchases.length + 1).padStart(4, '0')}`;
    const pDate = payload.purchase_date || new Date().toISOString();

    const purchaseId = 'pur-' + Date.now();
    const purchaseItems = payload.items.map((it) => {
      const prod = prods.find((p) => p.id === it.product_id);
      return {
        id: 'pi-' + Math.random().toString(36).slice(2),
        purchase_id: purchaseId,
        product_id: it.product_id,
        product_name: prod?.name,
        product_sku: prod?.sku,
        quantity: it.quantity,
        purchase_price: it.purchase_price,
        selling_price: it.selling_price,
        total_amount: it.total_amount,
        created_at: pDate,
      };
    });

    const newPurchase: StockPurchase = {
      id: purchaseId,
      purchase_number: purchaseNumber,
      supplier_name: payload.supplier_name,
      reference_no: payload.reference_no,
      purchase_date: pDate,
      total_amount: payload.total_amount,
      notes: payload.notes,
      device_id: payload.device_id,
      created_at: new Date().toISOString(),
      items: purchaseItems,
    };

    // Update products & add batches
    for (const item of payload.items) {
      const prod = prods.find((p) => p.id === item.product_id);
      if (prod) {
        const prevStock = prod.available_stock;
        prod.available_stock += item.quantity;
        prod.current_cost_price = item.purchase_price;
        if (item.update_selling_price) {
          prod.current_selling_price = item.selling_price;
        }
        prod.updated_at = new Date().toISOString();

        // New FIFO Batch
        batches.push({
          id: 'batch-' + Date.now() + Math.random().toString(36).slice(2, 4),
          product_id: prod.id,
          batch_number: `BATCH-${dateStr}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          initial_quantity: item.quantity,
          remaining_quantity: item.quantity,
          unit_cost: item.purchase_price,
          selling_price: item.selling_price,
          received_date: pDate,
          is_depleted: false,
          created_at: new Date().toISOString(),
        });

        // Audit Movement
        movements.unshift({
          id: 'mov-' + Date.now() + Math.random().toString(36).slice(2, 5),
          product_id: prod.id,
          product_name: prod.name,
          product_sku: prod.sku,
          movement_type: 'PURCHASE_IN',
          quantity_change: item.quantity,
          previous_quantity: prevStock,
          new_quantity: prod.available_stock,
          unit_cost: item.purchase_price,
          reference_type: 'PURCHASE',
          reason: `Stock received via purchase ${purchaseNumber}`,
          device_id: payload.device_id,
          created_at: new Date().toISOString(),
        });
      }
    }

    purchases.unshift(newPurchase);
    saveLocal('purchases', purchases);
    saveLocal('products', prods);
    saveLocal('batches', batches);
    saveLocal('movements', movements);

    this.broadcastChange('PURCHASE_ADDED', newPurchase);
    return { success: true, purchase: newPurchase };
  }

  // --- MANUAL STOCK ADJUSTMENT (Damage / Lost / Audit) ---
  async adjustStock(payload: AdjustStockPayload): Promise<{ success: boolean; message?: string }> {
    if (supabase) {
      const { error } = await supabase.rpc('adjust_stock_atomic', {
        p_adjustment_data: payload,
      });
      if (error) return { success: false, message: error.message };
      return { success: true };
    }

    const prods = loadLocal<Product[]>('products', INITIAL_PRODUCTS);
    const movements = loadLocal<StockMovement[]>('movements', []);
    const prod = prods.find((p) => p.id === payload.product_id);
    if (!prod) return { success: false, message: 'Product not found' };

    let qtyChange = 0;
    let newQty = prod.available_stock;
    let movementType: StockMovement['movement_type'] = 'ADJUSTMENT_IN';

    if (payload.adjustment_type === 'IN') {
      qtyChange = payload.quantity;
      newQty = prod.available_stock + payload.quantity;
      movementType = 'ADJUSTMENT_IN';
    } else if (payload.adjustment_type === 'OUT') {
      if (prod.available_stock < payload.quantity) return { success: false, message: 'Cannot adjust out more than available stock' };
      qtyChange = -payload.quantity;
      newQty = prod.available_stock - payload.quantity;
      movementType = 'ADJUSTMENT_OUT';
    } else if (payload.adjustment_type === 'DAMAGE') {
      if (prod.available_stock < payload.quantity) return { success: false, message: 'Cannot mark damage more than available stock' };
      qtyChange = -payload.quantity;
      newQty = prod.available_stock - payload.quantity;
      movementType = 'DAMAGE_OUT';
    } else if (payload.adjustment_type === 'LOST') {
      if (prod.available_stock < payload.quantity) return { success: false, message: 'Cannot mark lost more than available stock' };
      qtyChange = -payload.quantity;
      newQty = prod.available_stock - payload.quantity;
      movementType = 'LOST_OUT';
    } else if (payload.adjustment_type === 'PHYSICAL_COUNT') {
      qtyChange = payload.quantity - prod.available_stock;
      newQty = payload.quantity;
      movementType = qtyChange >= 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    }

    const prev = prod.available_stock;
    prod.available_stock = newQty;
    prod.updated_at = new Date().toISOString();

    movements.unshift({
      id: 'mov-' + Date.now() + Math.random().toString(36).slice(2, 5),
      product_id: prod.id,
      product_name: prod.name,
      product_sku: prod.sku,
      movement_type: movementType,
      quantity_change: qtyChange,
      previous_quantity: prev,
      new_quantity: newQty,
      unit_cost: prod.current_cost_price,
      reference_type: 'ADJUSTMENT',
      reason: payload.reason,
      device_id: payload.device_id,
      created_at: new Date().toISOString(),
    });

    saveLocal('products', prods);
    saveLocal('movements', movements);
    this.broadcastChange('STOCK_ADJUSTED', { productId: prod.id, newStock: newQty });
    return { success: true };
  }

  // --- STOCK MOVEMENTS AUDIT ---
  async getStockMovements(): Promise<StockMovement[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*, products(name, sku)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!error && data) {
        return data.map((m) => ({
          ...m,
          product_name: m.products?.name,
          product_sku: m.products?.sku,
        })) as StockMovement[];
      }
    }
    return loadLocal('movements', []);
  }

  // --- BILLS & INVOICE HISTORY ---
  async getBills(): Promise<Bill[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('bills')
        .select('*, bill_items(*)')
        .order('bill_date', { ascending: false });
      if (!error && data) {
        return data.map((b) => ({
          ...b,
          items: b.bill_items,
        })) as Bill[];
      }
    }
    return loadLocal('bills', []);
  }

  // --- EXPENSES ---
  async getExpenses(): Promise<Expense[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      if (!error && data) return data as Expense[];
    }
    return loadLocal('expenses', []);
  }

  async addExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
    if (supabase) {
      const { data, error } = await supabase
        .from('expenses')
        .insert(expense)
        .select()
        .single();
      if (!error && data) return data as Expense;
    }
    const expenses = loadLocal<Expense[]>('expenses', []);
    const newExp: Expense = {
      ...expense,
      id: 'exp-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    expenses.unshift(newExp);
    saveLocal('expenses', expenses);
    this.broadcastChange('EXPENSE_ADDED', newExp);
    return newExp;
  }

  async deleteExpense(id: string): Promise<boolean> {
    if (supabase) {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      return !error;
    }
    const expenses = loadLocal<Expense[]>('expenses', []);
    const filtered = expenses.filter((e) => e.id !== id);
    saveLocal('expenses', filtered);
    this.broadcastChange('EXPENSE_DELETED', { id });
    return true;
  }

  // --- DASHBOARD METRICS ---
  async getDashboardMetrics(startDate: Date, endDate: Date): Promise<DashboardMetrics> {
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    if (supabase) {
      const { data, error } = await supabase.rpc('get_dashboard_metrics', {
        p_start_date: startIso,
        p_end_date: endIso,
      });
      if (!error && data) return data as DashboardMetrics;
    }

    const bills = loadLocal<Bill[]>('bills', []);
    const prods = loadLocal<Product[]>('products', INITIAL_PRODUCTS).filter((p) => p.is_active);
    const expenses = loadLocal<Expense[]>('expenses', []);

    // Filter active bills in date range
    const periodBills = bills.filter((b) => {
      const bTime = new Date(b.bill_date).getTime();
      return b.status === 'COMPLETED' && bTime >= startDate.getTime() && bTime <= endDate.getTime();
    });

    const periodExpenses = expenses.filter((e) => {
      const eTime = new Date(e.expense_date).getTime();
      return eTime >= startDate.getTime() && eTime <= endDate.getTime();
    });

    const totalSales = periodBills.reduce((acc, b) => acc + (b.grand_total || 0), 0);
    const totalCogs = periodBills.reduce((acc, b) => acc + (b.total_cost_cogs || 0), 0);
    const grossProfit = totalSales - totalCogs;
    const totalExpenses = periodExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const netProfit = grossProfit - totalExpenses;

    const totalAvailableStock = prods.reduce((acc, p) => acc + (p.available_stock || 0), 0);
    const totalStockValue = prods.reduce((acc, p) => acc + (p.available_stock * p.current_cost_price), 0);
    const lowStockCount = prods.filter((p) => p.available_stock > 0 && p.available_stock <= p.low_stock_threshold).length;
    const outOfStockCount = prods.filter((p) => p.available_stock === 0).length;

    return {
      total_sales: totalSales,
      total_bills: periodBills.length,
      gross_profit: grossProfit,
      total_cogs: totalCogs,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      gross_margin_percentage: totalSales > 0 ? Math.round((grossProfit / totalSales) * 10000) / 100 : 0,
      net_margin_percentage: totalSales > 0 ? Math.round((netProfit / totalSales) * 10000) / 100 : 0,
      total_products: prods.length,
      total_available_stock: totalAvailableStock,
      total_stock_value: totalStockValue,
      low_stock_count: lowStockCount,
      out_of_stock_count: outOfStockCount,
    };
  }

  // --- PROFIT AND LOSS REPORT ---
  async getProfitLossReport(startDate: Date, endDate: Date): Promise<ProfitLossReport> {
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    if (supabase) {
      const { data, error } = await supabase.rpc('get_profit_loss_report', {
        p_start_date: startIso,
        p_end_date: endIso,
      });
      if (!error && data) return data as ProfitLossReport;
    }

    const bills = loadLocal<Bill[]>('bills', []);
    const expenses = loadLocal<Expense[]>('expenses', []);
    const prods = loadLocal<Product[]>('products', INITIAL_PRODUCTS);
    const cats = loadLocal<Category[]>('categories', INITIAL_CATEGORIES);

    const periodBills = bills.filter((b) => {
      const bTime = new Date(b.bill_date).getTime();
      return b.status === 'COMPLETED' && bTime >= startDate.getTime() && bTime <= endDate.getTime();
    });

    const periodExpenses = expenses.filter((e) => {
      const eTime = new Date(e.expense_date).getTime();
      return eTime >= startDate.getTime() && eTime <= endDate.getTime();
    });

    const totalRevenue = periodBills.reduce((acc, b) => acc + b.grand_total, 0);
    const totalCogs = periodBills.reduce((acc, b) => acc + b.total_cost_cogs, 0);
    const grossProfit = totalRevenue - totalCogs;
    const totalDiscounts = periodBills.reduce((acc, b) => acc + (b.discount_amount || 0), 0);

    // Group expenses by category
    const expenseMap: Record<string, { total: number; count: number }> = {};
    for (const exp of periodExpenses) {
      if (!expenseMap[exp.category]) expenseMap[exp.category] = { total: 0, count: 0 };
      expenseMap[exp.category].total += exp.amount;
      expenseMap[exp.category].count += 1;
    }

    const expensesByCategory = Object.entries(expenseMap).map(([category, val]) => ({
      category,
      total_amount: val.total,
      count: val.count,
    }));

    // Group sales items by product category
    const catMap: Record<string, { revenue: number; cogs: number; profit: number; units: number }> = {};
    for (const bill of periodBills) {
      for (const item of bill.items || []) {
        const prod = prods.find((p) => p.id === item.product_id);
        const cat = cats.find((c) => c.id === prod?.category_id);
        const catName = cat?.name || 'Uncategorized';

        if (!catMap[catName]) catMap[catName] = { revenue: 0, cogs: 0, profit: 0, units: 0 };
        catMap[catName].revenue += item.line_total;
        catMap[catName].cogs += item.line_cost;
        catMap[catName].profit += item.line_profit;
        catMap[catName].units += item.quantity;
      }
    }

    const categoryBreakdown = Object.entries(catMap).map(([category_name, val]) => ({
      category_name,
      revenue: val.revenue,
      cogs: val.cogs,
      profit: val.profit,
      units_sold: val.units,
    }));

    return {
      summary: {
        total_revenue: totalRevenue,
        total_cogs: totalCogs,
        gross_profit: grossProfit,
        total_bills: periodBills.length,
        total_discounts: totalDiscounts,
      },
      expenses_by_category: expensesByCategory,
      category_breakdown: categoryBreakdown,
    };
  }

  // Backup: Export entire store JSON
  exportDataJSON(): string {
    return JSON.stringify({
      version: '1.0',
      exported_at: new Date().toISOString(),
      settings: loadLocal('settings', INITIAL_SETTINGS),
      categories: loadLocal('categories', INITIAL_CATEGORIES),
      products: loadLocal('products', INITIAL_PRODUCTS),
      batches: loadLocal('batches', INITIAL_BATCHES),
      purchases: loadLocal('purchases', []),
      bills: loadLocal('bills', []),
      expenses: loadLocal('expenses', []),
      movements: loadLocal('movements', []),
      devices: loadLocal('devices', []),
    }, null, 2);
  }

  // --- COMPLETE CUSTOMER HANDOVER DATA RESET ---
  async resetAllBusinessData(passcode: string): Promise<{ success: boolean; message?: string }> {
    const settings = await this.getSettings();
    if (passcode.trim() !== (settings.enrollment_passcode || 'VCS786')) {
      return { success: false, message: 'Invalid shop master passcode' };
    }

    if (supabase) {
      try {
        await supabase.rpc('reset_handover_data_atomic', { p_passcode: passcode });
      } catch (rpcErr) {
        console.warn('RPC reset attempt:', rpcErr);
      }

      try {
        await supabase.from('return_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('returns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('bill_item_batch_allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('bill_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('bills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('stock_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('stock_batches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('stock_purchase_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('stock_purchases').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        // Clear customer records from customer tables if configured in Supabase
        await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('customer_profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('customer_credits').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('customer_loyalty').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('customer_notes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (err: unknown) {
        console.warn('Supabase direct deletion warning:', err);
      }
    }

    saveLocal('bills', []);
    saveLocal('products', []);
    saveLocal('categories', []);
    saveLocal('batches', []);
    saveLocal('purchases', []);
    saveLocal('expenses', []);
    saveLocal('movements', []);
    saveLocal('customers', []);
    saveLocal('recent_customers', []);

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('customer_phone');
      localStorage.removeItem('customer_name');
      localStorage.removeItem('vcs_customer_phone');
      localStorage.removeItem('vcs_customer_name');
      localStorage.setItem(HANDOVER_RESET_VERSION_KEY, 'true');
    }

    this.broadcastChange('STORE_RESET_HANDOVER', {});
    return { success: true, message: 'All business data wiped successfully. Store is ready for fresh customer launch.' };
  }

  // Backup: Restore store JSON
  importDataJSON(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (data.products) saveLocal('products', data.products);
      if (data.categories) saveLocal('categories', data.categories);
      if (data.batches) saveLocal('batches', data.batches);
      if (data.purchases) saveLocal('purchases', data.purchases);
      if (data.bills) saveLocal('bills', data.bills);
      if (data.expenses) saveLocal('expenses', data.expenses);
      if (data.movements) saveLocal('movements', data.movements);
      if (data.settings) saveLocal('settings', data.settings);
      this.broadcastChange('STORE_RESTORED');
      return true;
    } catch {
      return false;
    }
  }
}

export const storeService = new StoreService();
