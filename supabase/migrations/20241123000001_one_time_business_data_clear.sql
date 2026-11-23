-- ===================================================================
-- VINTAGE CLOTHING STORE - COMPLETE CUSTOMER & BUSINESS DATA DELETION
-- ONE-TIME HANDOVER DATA WIPE SCRIPT
--
-- STRICT PRESERVATION CONSTRAINTS:
-- 1. NO DROP TABLE (All table structures, columns, relationships, types preserved)
-- 2. NO TRUNCATE TABLE (Uses pure DELETE FROM in strict dependency order)
-- 3. PRESERVES: store_settings, authorized_devices, RPC functions, triggers, RLS
-- 4. PERMANENTLY REMOVES: 
--    - All customer names, phone numbers, email addresses, and notes
--    - All customer-linked bills, items, and purchase history
--    - All customer payment records (cash, UPI, card, dues)
--    - All customer credits, outstanding dues, loyalty points & rewards
--    - All audit log traces containing customer/transaction PII
--    - All inventory batches, purchases, movements, and products
-- ===================================================================

BEGIN;

-- -------------------------------------------------------------------
-- PHASE 1: DELETE OPTIONAL / DEDICATED CUSTOMER TABLES (IF PRESENT)
-- -------------------------------------------------------------------
DO $$
DECLARE
    tbl text;
    customer_tables text[] := ARRAY[
        'customer_loyalty',
        'loyalty_rewards',
        'customer_credits',
        'customer_dues',
        'customer_notes',
        'customer_profiles',
        'customer_addresses',
        'customers'
    ];
BEGIN
    FOREACH tbl IN ARRAY customer_tables
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            EXECUTE format('DELETE FROM public.%I', tbl);
            RAISE NOTICE 'Deleted all records from optional customer table: %', tbl;
        END IF;
    END LOOP;
END $$;

-- -------------------------------------------------------------------
-- PHASE 2: DELETE DEPENDENT TRANSACTION RECORDS
-- -------------------------------------------------------------------
-- 1. Delete Return Items & Returns (links to bills and customer returns)
DELETE FROM public.return_items;
DELETE FROM public.returns;

-- 2. Delete FIFO batch allocations linked to customer bills
DELETE FROM public.bill_item_batch_allocations;

-- 3. Delete POS Bill Items & Payment records (Cash, UPI, Card)
DELETE FROM public.bill_items;
DELETE FROM public.payments;

-- 4. Delete Bills (Contains customer_name, customer_phone, purchase history)
DELETE FROM public.bills;

-- -------------------------------------------------------------------
-- PHASE 3: DELETE INVENTORY & CATALOG RECORDS
-- -------------------------------------------------------------------
-- 5. Delete Stock Movements & Supplier Purchase Line Items
DELETE FROM public.stock_movements;
DELETE FROM public.stock_purchase_items;

-- 6. Delete Stock Batches & Purchases
DELETE FROM public.stock_batches;
DELETE FROM public.stock_purchases;

-- 7. Delete Operating Expenses
DELETE FROM public.expenses;

-- 8. Delete Catalog Products & Categories
DELETE FROM public.products;
DELETE FROM public.categories;

-- -------------------------------------------------------------------
-- PHASE 4: PURGE AUDIT LOGS FOR COMPLETE CUSTOMER DATA PRIVACY
-- (Removes historical JSON snapshots that contained customer names/phones)
-- -------------------------------------------------------------------
DELETE FROM public.audit_logs 
WHERE table_name NOT IN ('store_settings', 'authorized_devices');

COMMIT;

-- ===================================================================
-- VERIFICATION QUERY: RUN TO CONFIRM COMPLETE ZERO STATE
-- ===================================================================
SELECT 
    -- Customer & Sales Data: Must all be 0
    (SELECT COUNT(*) FROM bills) AS remaining_bills,
    (SELECT COUNT(*) FROM bill_items) AS remaining_bill_items,
    (SELECT COUNT(*) FROM payments) AS remaining_payments,
    (SELECT COUNT(*) FROM returns) AS remaining_returns,
    (SELECT COUNT(*) FROM return_items) AS remaining_return_items,
    -- Inventory & Catalog: Must all be 0
    (SELECT COUNT(*) FROM products) AS remaining_products,
    (SELECT COUNT(*) FROM categories) AS remaining_categories,
    (SELECT COUNT(*) FROM stock_batches) AS remaining_stock_batches,
    (SELECT COUNT(*) FROM stock_movements) AS remaining_stock_movements,
    (SELECT COUNT(*) FROM stock_purchases) AS remaining_stock_purchases,
    (SELECT COUNT(*) FROM expenses) AS remaining_expenses,
    -- Customer Audit Logs: Must be 0
    (SELECT COUNT(*) FROM audit_logs WHERE table_name = 'bills') AS remaining_bill_audit_logs,
    -- CRITICAL CONFIGURATION: Must remain PRESERVED (> 0)
    (SELECT COUNT(*) FROM store_settings) AS preserved_settings_count,
    (SELECT COUNT(*) FROM authorized_devices) AS preserved_devices_count;
