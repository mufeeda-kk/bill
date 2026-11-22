// Database and Domain Types for VINTAGE CLOTHING STORE

export type PaymentMethod = 'CASH' | 'UPI' | 'SPLIT' | 'CREDIT';
export type PaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
export type BillStatus = 'COMPLETED' | 'CANCELLED' | 'RETURNED';
export type StockMovementType = 
  | 'PURCHASE_IN' 
  | 'SALE_OUT' 
  | 'ADJUSTMENT_IN' 
  | 'ADJUSTMENT_OUT' 
  | 'DAMAGE_OUT' 
  | 'LOST_OUT' 
  | 'RETURN_IN' 
  | 'CANCEL_IN';

export interface StoreSettings {
  id: string;
  store_name: string;
  tagline: string;
  phone: string;
  address: string;
  upi_id: string;
  currency_symbol: string;
  invoice_prefix: string;
  low_stock_default_threshold: number;
  enrollment_passcode: string;
  max_authorized_devices: number;
  created_at?: string;
  updated_at?: string;
}

export interface AuthorizedDevice {
  id: string;
  device_token: string;
  device_name: string;
  model_info?: string;
  is_active: boolean;
  enrolled_at: string;
  last_active_at: string;
  revoked_at?: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  display_order: number;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category_id?: string | null;
  category_name?: string;
  description?: string;
  current_selling_price: number;
  current_cost_price: number;
  available_stock: number;
  low_stock_threshold: number;
  barcode?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StockBatch {
  id: string;
  product_id: string;
  purchase_item_id?: string;
  batch_number: string;
  initial_quantity: number;
  remaining_quantity: number;
  unit_cost: number;
  selling_price: number;
  received_date: string;
  is_depleted: boolean;
  created_at?: string;
}

export interface StockPurchase {
  id: string;
  purchase_number: string;
  supplier_name?: string;
  reference_no?: string;
  purchase_date: string;
  total_amount: number;
  notes?: string;
  device_id?: string;
  created_at?: string;
  items?: StockPurchaseItem[];
}

export interface StockPurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  total_amount: number;
  created_at?: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  batch_id?: string;
  movement_type: StockMovementType;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  unit_cost: number;
  reference_type?: 'BILL' | 'PURCHASE' | 'ADJUSTMENT' | 'RETURN';
  reference_id?: string;
  reason?: string;
  device_id?: string;
  device_name?: string;
  created_at: string;
}

export interface BillItem {
  id: string;
  bill_id?: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_selling_price: number;
  unit_cost_price: number;
  item_discount: number;
  line_total: number;
  line_cost: number;
  line_profit: number;
  created_at?: string;
}

export interface Bill {
  id: string;
  invoice_number: string;
  bill_date: string;
  customer_name: string;
  customer_phone?: string;
  subtotal: number;
  discount_amount: number;
  discount_percentage?: number;
  grand_total: number;
  total_cost_cogs: number;
  gross_profit: number;
  payment_method: PaymentMethod;
  amount_paid: number;
  balance_due: number;
  payment_status: PaymentStatus;
  status: BillStatus;
  notes?: string;
  idempotency_key?: string;
  device_id?: string;
  device_name?: string;
  created_at: string;
  updated_at?: string;
  items?: BillItem[];
  payments?: PaymentRecord[];
}

export interface PaymentRecord {
  id: string;
  bill_id: string;
  payment_method: PaymentMethod;
  amount: number;
  reference_no?: string;
  payment_date: string;
  created_at?: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  reference_no?: string;
  device_id?: string;
  created_at?: string;
}

export interface DashboardMetrics {
  total_sales: number;
  total_bills: number;
  gross_profit: number;
  total_cogs: number;
  total_expenses: number;
  net_profit: number;
  gross_margin_percentage: number;
  net_margin_percentage: number;
  total_products: number;
  total_available_stock: number;
  total_stock_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
}

export interface ProfitLossReport {
  summary: {
    total_revenue: number;
    total_cogs: number;
    gross_profit: number;
    total_bills: number;
    total_discounts: number;
  };
  expenses_by_category: {
    category: string;
    total_amount: number;
    count: number;
  }[];
  category_breakdown: {
    category_name: string;
    revenue: number;
    cogs: number;
    profit: number;
    units_sold: number;
  }[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  unit_selling_price: number;
  item_discount: number;
  line_total: number;
}
