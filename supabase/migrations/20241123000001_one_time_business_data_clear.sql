-- ===================================================================
-- VINTAGE CLOTHING STORE - ONE-TIME BUSINESS DATA CLEAR SCRIPT
-- STRICT REQUIREMENTS:
-- 1. NO DROP TABLE (Preserves all tables, columns, indexes, types)
-- 2. NO TRUNCATE TABLE (Uses pure DELETE FROM in strict foreign key order)
-- 3. PRESERVES: store_settings, authorized_devices, triggers, RPC functions, RLS
-- 4. DELETES ONLY: products, categories, stock, bills, payments, movements, expenses
-- ===================================================================

BEGIN;

-- Step 1: Delete dependent child transactions (Return Items & Allocations)
DELETE FROM return_items;
DELETE FROM returns;
DELETE FROM bill_item_batch_allocations;

-- Step 2: Delete POS Bill Items and Payments
DELETE FROM bill_items;
DELETE FROM payments;

-- Step 3: Delete Bills
DELETE FROM bills;

-- Step 4: Delete Stock Movements and Purchase Line Items
DELETE FROM stock_movements;
DELETE FROM stock_purchase_items;

-- Step 5: Delete Stock Batches and Purchases
DELETE FROM stock_batches;
DELETE FROM stock_purchases;

-- Step 6: Delete Shop Expenses
DELETE FROM expenses;

-- Step 7: Delete Catalog Products and Categories
DELETE FROM products;
DELETE FROM categories;

-- Step 8: Clear transaction audit logs while keeping device audit
DELETE FROM audit_logs WHERE table_name NOT IN ('store_settings', 'authorized_devices');

COMMIT;

-- ===================================================================
-- VERIFICATION QUERY: Run this to confirm ALL business tables are at 0
-- ===================================================================
SELECT 
    (SELECT COUNT(*) FROM products) AS remaining_products,
    (SELECT COUNT(*) FROM categories) AS remaining_categories,
    (SELECT COUNT(*) FROM bills) AS remaining_bills,
    (SELECT COUNT(*) FROM bill_items) AS remaining_bill_items,
    (SELECT COUNT(*) FROM payments) AS remaining_payments,
    (SELECT COUNT(*) FROM stock_batches) AS remaining_stock_batches,
    (SELECT COUNT(*) FROM stock_movements) AS remaining_stock_movements,
    (SELECT COUNT(*) FROM stock_purchases) AS remaining_stock_purchases,
    (SELECT COUNT(*) FROM expenses) AS remaining_expenses,
    -- Verify Settings & Authorized Devices are 100% PRESERVED:
    (SELECT COUNT(*) FROM store_settings) AS preserved_settings_count,
    (SELECT COUNT(*) FROM authorized_devices) AS preserved_devices_count;
