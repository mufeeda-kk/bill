-- ===================================================================
-- VINTAGE CLOTHING STORE - COMPLETE PRODUCTION DATABASE SCHEMA (POSTGRESQL)
-- Includes: FIFO Stock Batches, Atomic POS Billing, Idempotency, 
--           Full Stock Movement Audit, Profit/Loss, Device Authorization, RLS
-- ===================================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set Timezone to Asia/Kolkata
ALTER DATABASE postgres SET timezone TO 'Asia/Kolkata';

-- Clean existing schema if necessary (controlled)
DROP FUNCTION IF EXISTS create_bill_atomic(jsonb);
DROP FUNCTION IF EXISTS cancel_or_return_bill_atomic(uuid, text, text);
DROP FUNCTION IF EXISTS add_stock_purchase_atomic(jsonb);
DROP FUNCTION IF EXISTS adjust_stock_atomic(jsonb);
DROP FUNCTION IF EXISTS get_dashboard_metrics(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS get_profit_loss_report(timestamptz, timestamptz, text);

-- -------------------------------------------------------------------
-- 1. STORE SETTINGS
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_name TEXT NOT NULL DEFAULT 'VINTAGE CLOTHING STORE',
    tagline TEXT DEFAULT 'Exclusive Men & Women Fashion',
    phone TEXT DEFAULT '+91 98765 43210',
    address TEXT DEFAULT 'Market Road, Kerala, India',
    upi_id TEXT DEFAULT 'vintageclothing@upi',
    currency_symbol TEXT DEFAULT '₹',
    invoice_prefix TEXT DEFAULT 'VCS',
    low_stock_default_threshold INT DEFAULT 5,
    enrollment_passcode TEXT NOT NULL DEFAULT 'VCS786',
    max_authorized_devices INT DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now())
);

-- -------------------------------------------------------------------
-- 2. AUTHORIZED DEVICES (Three shop phones, no daily login)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS authorized_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_token TEXT NOT NULL UNIQUE,
    device_name TEXT NOT NULL,
    model_info TEXT,
    ip_address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now()),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now()),
    revoked_at TIMESTAMPTZ
);

-- -------------------------------------------------------------------
-- 3. CATEGORIES
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now())
);

-- -------------------------------------------------------------------
-- 4. PRODUCTS
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    current_selling_price NUMERIC(12, 2) NOT NULL CHECK (current_selling_price >= 0),
    current_cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (current_cost_price >= 0),
    available_stock INT NOT NULL DEFAULT 0 CHECK (available_stock >= 0),
    low_stock_threshold INT NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
    barcode TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_active_stock ON products(is_active, available_stock);

-- -------------------------------------------------------------------
-- 5. STOCK PURCHASES & PURCHASE ITEMS
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_number TEXT NOT NULL UNIQUE,
    supplier_name TEXT,
    reference_no TEXT,
    purchase_date TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now()),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    notes TEXT,
    device_id UUID REFERENCES authorized_devices(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now())
);

CREATE TABLE IF NOT EXISTS stock_purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES stock_purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    purchase_price NUMERIC(12, 2) NOT NULL CHECK (purchase_price >= 0),
    selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now())
);

-- -------------------------------------------------------------------
-- 6. STOCK BATCHES (FIFO INVENTORY COSTING)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    purchase_item_id UUID REFERENCES stock_purchase_items(id) ON DELETE SET NULL,
    batch_number TEXT NOT NULL,
    initial_quantity INT NOT NULL CHECK (initial_quantity > 0),
    remaining_quantity INT NOT NULL CHECK (remaining_quantity >= 0),
    unit_cost NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0),
    selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
    received_date TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now()),
    is_depleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_stock_batches_fifo 
ON stock_batches(product_id, is_depleted, received_date ASC, created_at ASC);

-- -------------------------------------------------------------------
-- 7. STOCK MOVEMENTS (Auditable History of all stock changes)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES stock_batches(id) ON DELETE SET NULL,
    movement_type TEXT NOT NULL CHECK (
        movement_type IN ('PURCHASE_IN', 'SALE_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE_OUT', 'LOST_OUT', 'RETURN_IN', 'CANCEL_IN')
    ),
    quantity_change INT NOT NULL, -- positive for IN, negative for OUT
    previous_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reference_type TEXT CHECK (reference_type IN ('BILL', 'PURCHASE', 'ADJUSTMENT', 'RETURN')),
    reference_id UUID,
    reason TEXT,
    device_id UUID REFERENCES authorized_devices(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON stock_movements(reference_type, reference_id);

-- -------------------------------------------------------------------
-- 8. BILLS & BILL ITEMS (POS Sales & Invoices)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    bill_date TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now()),
    customer_name TEXT DEFAULT 'Walk-in Customer',
    customer_phone TEXT,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    discount_percentage NUMERIC(5, 2) DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL CHECK (grand_total >= 0),
    total_cost_cogs NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_cost_cogs >= 0),
    gross_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'UPI', 'SPLIT', 'CREDIT')),
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance_due >= 0),
    payment_status TEXT NOT NULL CHECK (payment_status IN ('PAID', 'PARTIALLY_PAID', 'UNPAID')),
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'CANCELLED', 'RETURNED')),
    notes TEXT,
    idempotency_key TEXT UNIQUE,
    device_id UUID REFERENCES authorized_devices(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date DESC);
CREATE INDEX IF NOT EXISTS idx_bills_invoice ON bills(invoice_number);
CREATE INDEX IF NOT EXISTS idx_bills_phone ON bills(customer_phone);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_idempotency ON bills(idempotency_key);

CREATE TABLE IF NOT EXISTS bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_selling_price NUMERIC(12, 2) NOT NULL CHECK (unit_selling_price >= 0),
    unit_cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- weighted or average for the line
    item_discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (item_discount >= 0),
    line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
    line_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    line_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_prod ON bill_items(product_id);

-- FIFO Batch allocation audit per bill item
CREATE TABLE IF NOT EXISTS bill_item_batch_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_item_id UUID NOT NULL REFERENCES bill_items(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES stock_batches(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now())
);

-- -------------------------------------------------------------------
-- 9. PAYMENTS (Split & Single Payments)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'UPI', 'CREDIT')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    reference_no TEXT,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now())
);

-- -------------------------------------------------------------------
-- 10. EXPENSES (Shop operations)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (
        category IN ('Shop Rent', 'Electricity', 'Transport', 'Staff Expenses', 'Packaging', 'Refreshments', 'Repairs & Maintenance', 'Other')
    ),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    expense_date TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now()),
    reference_no TEXT,
    device_id UUID REFERENCES authorized_devices(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- -------------------------------------------------------------------
-- 11. RETURNS & CANCELLATIONS
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number TEXT NOT NULL UNIQUE,
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
    return_date TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now()),
    refund_amount NUMERIC(12, 2) NOT NULL CHECK (refund_amount >= 0),
    reason TEXT NOT NULL,
    device_id UUID REFERENCES authorized_devices(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now())
);

CREATE TABLE IF NOT EXISTS return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    bill_item_id UUID NOT NULL REFERENCES bill_items(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    refund_rate NUMERIC(12, 2) NOT NULL CHECK (refund_rate >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now())
);

-- -------------------------------------------------------------------
-- 12. AUDIT LOGS
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    device_id UUID REFERENCES authorized_devices(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ===================================================================
-- DATABASE RPC FUNCTIONS: SECURE, CONCURRENT & ATOMIC TRANSACTIONS
-- ===================================================================

-- 1. Helper function: Generate Daily Sequence Invoice Number (Format: VCS-YYYYMMDD-0001)
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    v_prefix TEXT;
    v_date_part TEXT;
    v_count INT;
    v_invoice TEXT;
BEGIN
    SELECT COALESCE(invoice_prefix, 'VCS') INTO v_prefix FROM store_settings LIMIT 1;
    IF v_prefix IS NULL THEN v_prefix := 'VCS'; END IF;
    
    v_date_part := to_char(timezone('Asia/Kolkata'::text, now()), 'YYYYMMDD');
    
    -- Count bills created today with this prefix
    SELECT count(*) + 1 INTO v_count
    FROM bills
    WHERE invoice_number LIKE v_prefix || '-' || v_date_part || '-%';
    
    v_invoice := v_prefix || '-' || v_date_part || '-' || lpad(v_count::text, 4, '0');
    
    -- Safety check against existing
    WHILE EXISTS (SELECT 1 FROM bills WHERE invoice_number = v_invoice) LOOP
        v_count := v_count + 1;
        v_invoice := v_prefix || '-' || v_date_part || '-' || lpad(v_count::text, 4, '0');
    END LOOP;
    
    RETURN v_invoice;
END;
$$ LANGUAGE plpgsql;

-- 2. Helper function: Generate Purchase Number (Format: PUR-YYYYMMDD-0001)
CREATE OR REPLACE FUNCTION generate_purchase_number()
RETURNS TEXT AS $$
DECLARE
    v_date_part TEXT;
    v_count INT;
    v_number TEXT;
BEGIN
    v_date_part := to_char(timezone('Asia/Kolkata'::text, now()), 'YYYYMMDD');
    SELECT count(*) + 1 INTO v_count
    FROM stock_purchases
    WHERE purchase_number LIKE 'PUR-' || v_date_part || '-%';
    
    v_number := 'PUR-' || v_date_part || '-' || lpad(v_count::text, 4, '0');
    WHILE EXISTS (SELECT 1 FROM stock_purchases WHERE purchase_number = v_number) LOOP
        v_count := v_count + 1;
        v_number := 'PUR-' || v_date_part || '-' || lpad(v_count::text, 4, '0');
    END LOOP;
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- 3. CORE ATOMIC BILLING FUNCTION WITH FIFO INVENTORY & IDEMPOTENCY
CREATE OR REPLACE FUNCTION create_bill_atomic(p_bill_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_idempotency_key TEXT;
    v_existing_bill RECORD;
    v_bill_id UUID;
    v_invoice_number TEXT;
    v_customer_name TEXT;
    v_customer_phone TEXT;
    v_subtotal NUMERIC(12, 2);
    v_discount_amount NUMERIC(12, 2);
    v_discount_percentage NUMERIC(5, 2);
    v_grand_total NUMERIC(12, 2);
    v_payment_method TEXT;
    v_amount_paid NUMERIC(12, 2);
    v_balance_due NUMERIC(12, 2);
    v_payment_status TEXT;
    v_notes TEXT;
    v_device_id UUID;
    v_items JSONB;
    v_payments JSONB;
    
    v_item JSONB;
    v_product_id UUID;
    v_req_qty INT;
    v_unit_selling_price NUMERIC(12, 2);
    v_item_discount NUMERIC(12, 2);
    v_line_total NUMERIC(12, 2);
    
    v_product RECORD;
    v_bill_item_id UUID;
    v_item_total_cost NUMERIC(12, 2) := 0;
    v_item_total_profit NUMERIC(12, 2) := 0;
    v_overall_cogs NUMERIC(12, 2) := 0;
    v_overall_gross_profit NUMERIC(12, 2) := 0;
    
    v_batch RECORD;
    v_qty_needed INT;
    v_take_qty INT;
    
    v_payment JSONB;
    v_return_payload JSONB;
BEGIN
    -- 1. Idempotency Check
    v_idempotency_key := p_bill_data->>'idempotency_key';
    IF v_idempotency_key IS NOT NULL AND v_idempotency_key <> '' THEN
        SELECT * INTO v_existing_bill FROM bills WHERE idempotency_key = v_idempotency_key;
        IF FOUND THEN
            -- Already processed, return existing bill data directly
            SELECT jsonb_build_object(
                'success', true,
                'is_idempotent_duplicate', true,
                'bill_id', v_existing_bill.id,
                'invoice_number', v_existing_bill.invoice_number,
                'grand_total', v_existing_bill.grand_total,
                'total_cost_cogs', v_existing_bill.total_cost_cogs,
                'gross_profit', v_existing_bill.gross_profit,
                'bill_date', v_existing_bill.bill_date,
                'customer_phone', v_existing_bill.customer_phone
            ) INTO v_return_payload;
            RETURN v_return_payload;
        END IF;
    END IF;

    -- 2. Extract Header Info
    v_customer_name := COALESCE(p_bill_data->>'customer_name', 'Walk-in Customer');
    v_customer_phone := p_bill_data->>'customer_phone';
    v_subtotal := (p_bill_data->>'subtotal')::NUMERIC(12, 2);
    v_discount_amount := COALESCE((p_bill_data->>'discount_amount')::NUMERIC(12, 2), 0.00);
    v_discount_percentage := COALESCE((p_bill_data->>'discount_percentage')::NUMERIC(5, 2), 0.00);
    v_grand_total := (p_bill_data->>'grand_total')::NUMERIC(12, 2);
    v_payment_method := p_bill_data->>'payment_method';
    v_amount_paid := COALESCE((p_bill_data->>'amount_paid')::NUMERIC(12, 2), v_grand_total);
    v_balance_due := COALESCE((p_bill_data->>'balance_due')::NUMERIC(12, 2), 0.00);
    v_payment_status := COALESCE(p_bill_data->>'payment_status', 'PAID');
    v_notes := p_bill_data->>'notes';
    v_device_id := (p_bill_data->>'device_id')::UUID;
    v_items := p_bill_data->'items';
    v_payments := p_bill_data->'payments';

    IF jsonb_array_length(v_items) = 0 THEN
        RAISE EXCEPTION 'Bill must contain at least one item';
    END IF;

    v_invoice_number := generate_invoice_number();

    -- 3. Create Bill Record (Temporary 0 COGS, will update after batch allocation)
    INSERT INTO bills (
        invoice_number, customer_name, customer_phone, subtotal,
        discount_amount, discount_percentage, grand_total,
        total_cost_cogs, gross_profit, payment_method,
        amount_paid, balance_due, payment_status,
        status, notes, idempotency_key, device_id
    ) VALUES (
        v_invoice_number, v_customer_name, v_customer_phone, v_subtotal,
        v_discount_amount, v_discount_percentage, v_grand_total,
        0.00, 0.00, v_payment_method,
        v_amount_paid, v_balance_due, v_payment_status,
        'COMPLETED', v_notes, v_idempotency_key, v_device_id
    ) RETURNING id INTO v_bill_id;

    -- 4. Process Each Item & Perform Atomic Stock Check & FIFO Batch Allocation
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_req_qty := (v_item->>'quantity')::INT;
        v_unit_selling_price := (v_item->>'unit_selling_price')::NUMERIC(12, 2);
        v_item_discount := COALESCE((v_item->>'item_discount')::NUMERIC(12, 2), 0.00);
        v_line_total := (v_item->>'line_total')::NUMERIC(12, 2);

        -- CRITICAL: Lock Product Row for atomic stock verification
        SELECT * INTO v_product
        FROM products
        WHERE id = v_product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product with ID % not found', v_product_id;
        END IF;

        IF v_product.is_active = false THEN
            RAISE EXCEPTION 'Product "%" is archived and cannot be sold', v_product.name;
        END IF;

        IF v_product.available_stock < v_req_qty THEN
            RAISE EXCEPTION 'Insufficient stock for "%". Requested: %, Available: %',
                v_product.name, v_req_qty, v_product.available_stock;
        END IF;

        -- Create Bill Item Record
        INSERT INTO bill_items (
            bill_id, product_id, product_name, sku, quantity,
            unit_selling_price, unit_cost_price, item_discount,
            line_total, line_cost, line_profit
        ) VALUES (
            v_bill_id, v_product_id, v_product.name, v_product.sku, v_req_qty,
            v_unit_selling_price, 0.00, v_item_discount,
            v_line_total, 0.00, 0.00
        ) RETURNING id INTO v_bill_item_id;

        -- FIFO Batch Allocation
        v_qty_needed := v_req_qty;
        v_item_total_cost := 0;

        FOR v_batch IN 
            SELECT * FROM stock_batches
            WHERE product_id = v_product_id AND remaining_quantity > 0 AND is_depleted = false
            ORDER BY received_date ASC, created_at ASC
            FOR UPDATE
        LOOP
            IF v_qty_needed <= 0 THEN
                EXIT;
            END IF;

            v_take_qty := LEAST(v_batch.remaining_quantity, v_qty_needed);
            
            -- Deduct from batch
            UPDATE stock_batches
            SET remaining_quantity = remaining_quantity - v_take_qty,
                is_depleted = (remaining_quantity - v_take_qty = 0)
            WHERE id = v_batch.id;

            -- Record batch allocation for audit
            INSERT INTO bill_item_batch_allocations (
                bill_item_id, batch_id, quantity, unit_cost
            ) VALUES (
                v_bill_item_id, v_batch.id, v_take_qty, v_batch.unit_cost
            );

            v_item_total_cost := v_item_total_cost + (v_take_qty * v_batch.unit_cost);
            v_qty_needed := v_qty_needed - v_take_qty;
        END LOOP;

        -- If batches are somehow exhausted but available_stock was positive (edge fallback to current_cost_price)
        IF v_qty_needed > 0 THEN
            v_item_total_cost := v_item_total_cost + (v_qty_needed * v_product.current_cost_price);
        END IF;

        v_item_total_profit := v_line_total - v_item_total_cost;

        -- Update Bill Item with accurate line cost & profit
        UPDATE bill_items
        SET unit_cost_price = ROUND(v_item_total_cost / v_req_qty, 2),
            line_cost = v_item_total_cost,
            line_profit = v_item_total_profit
        WHERE id = v_bill_item_id;

        -- Deduct product available stock atomically
        UPDATE products
        SET available_stock = available_stock - v_req_qty,
            updated_at = timezone('Asia/Kolkata'::text, now())
        WHERE id = v_product_id;

        -- Record in stock_movements audit trail
        INSERT INTO stock_movements (
            product_id, movement_type, quantity_change, previous_quantity,
            new_quantity, unit_cost, reference_type, reference_id,
            reason, device_id
        ) VALUES (
            v_product_id, 'SALE_OUT', -v_req_qty, v_product.available_stock,
            v_product.available_stock - v_req_qty, ROUND(v_item_total_cost / v_req_qty, 2),
            'BILL', v_bill_id, 'Sold in Bill ' || v_invoice_number, v_device_id
        );

        v_overall_cogs := v_overall_cogs + v_item_total_cost;
    END LOOP;

    -- 5. Calculate overall gross profit (Grand total revenue minus exact COGS)
    v_overall_gross_profit := v_grand_total - v_overall_cogs;

    UPDATE bills
    SET total_cost_cogs = v_overall_cogs,
        gross_profit = v_overall_gross_profit,
        updated_at = timezone('Asia/Kolkata'::text, now())
    WHERE id = v_bill_id;

    -- 6. Insert Payments
    IF v_payments IS NOT NULL AND jsonb_array_length(v_payments) > 0 THEN
        FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments)
        LOOP
            INSERT INTO payments (
                bill_id, payment_method, amount, reference_no
            ) VALUES (
                v_bill_id,
                v_payment->>'payment_method',
                (v_payment->>'amount')::NUMERIC(12, 2),
                v_payment->>'reference_no'
            );
        END LOOP;
    ELSE
        -- Default single payment
        INSERT INTO payments (
            bill_id, payment_method, amount
        ) VALUES (
            v_bill_id, v_payment_method, v_amount_paid
        );
    END IF;

    -- 7. Insert Audit Log
    INSERT INTO audit_logs (
        action, entity, entity_id, details, device_id
    ) VALUES (
        'BILL_CREATED', 'bills', v_bill_id::text,
        jsonb_build_object(
            'invoice_number', v_invoice_number,
            'grand_total', v_grand_total,
            'cogs', v_overall_cogs,
            'gross_profit', v_overall_gross_profit
        ),
        v_device_id
    );

    -- 8. Return Complete Bill Result for Zero-Delay UI & WhatsApp
    SELECT jsonb_build_object(
        'success', true,
        'bill_id', v_bill_id,
        'invoice_number', v_invoice_number,
        'bill_date', timezone('Asia/Kolkata'::text, now()),
        'customer_name', v_customer_name,
        'customer_phone', v_customer_phone,
        'subtotal', v_subtotal,
        'discount_amount', v_discount_amount,
        'grand_total', v_grand_total,
        'total_cost_cogs', v_overall_cogs,
        'gross_profit', v_overall_gross_profit,
        'payment_method', v_payment_method,
        'amount_paid', v_amount_paid,
        'balance_due', v_balance_due,
        'payment_status', v_payment_status,
        'items', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', bi.id,
                'product_name', bi.product_name,
                'sku', bi.sku,
                'quantity', bi.quantity,
                'unit_selling_price', bi.unit_selling_price,
                'item_discount', bi.item_discount,
                'line_total', bi.line_total,
                'line_profit', bi.line_profit
            ))
            FROM bill_items bi WHERE bi.bill_id = v_bill_id
        )
    ) INTO v_return_payload;

    RETURN v_return_payload;
END;
$$ LANGUAGE plpgsql;

-- 4. ATOMIC STOCK PURCHASE MODULE (Creates Batches, Updates Stock & Pricing)
CREATE OR REPLACE FUNCTION add_stock_purchase_atomic(p_purchase_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_purchase_id UUID;
    v_purchase_number TEXT;
    v_supplier_name TEXT;
    v_reference_no TEXT;
    v_purchase_date TIMESTAMPTZ;
    v_total_amount NUMERIC(12, 2);
    v_notes TEXT;
    v_device_id UUID;
    v_items JSONB;
    v_item JSONB;
    
    v_product_id UUID;
    v_qty INT;
    v_purchase_price NUMERIC(12, 2);
    v_selling_price NUMERIC(12, 2);
    v_item_total NUMERIC(12, 2);
    v_update_selling_price BOOLEAN;
    
    v_product RECORD;
    v_purchase_item_id UUID;
    v_batch_number TEXT;
BEGIN
    v_purchase_number := generate_purchase_number();
    v_supplier_name := p_purchase_data->>'supplier_name';
    v_reference_no := p_purchase_data->>'reference_no';
    v_purchase_date := COALESCE((p_purchase_data->>'purchase_date')::TIMESTAMPTZ, timezone('Asia/Kolkata'::text, now()));
    v_total_amount := (p_purchase_data->>'total_amount')::NUMERIC(12, 2);
    v_notes := p_purchase_data->>'notes';
    v_device_id := (p_purchase_data->>'device_id')::UUID;
    v_items := p_purchase_data->'items';

    IF jsonb_array_length(v_items) = 0 THEN
        RAISE EXCEPTION 'Purchase must contain at least one product item';
    END IF;

    INSERT INTO stock_purchases (
        purchase_number, supplier_name, reference_no, purchase_date,
        total_amount, notes, device_id
    ) VALUES (
        v_purchase_number, v_supplier_name, v_reference_no, v_purchase_date,
        v_total_amount, v_notes, v_device_id
    ) RETURNING id INTO v_purchase_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::INT;
        v_purchase_price := (v_item->>'purchase_price')::NUMERIC(12, 2);
        v_selling_price := (v_item->>'selling_price')::NUMERIC(12, 2);
        v_item_total := (v_item->>'total_amount')::NUMERIC(12, 2);
        v_update_selling_price := COALESCE((v_item->>'update_selling_price')::BOOLEAN, false);

        -- Lock product
        SELECT * INTO v_product FROM products WHERE id = v_product_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % not found', v_product_id;
        END IF;

        -- Insert purchase item
        INSERT INTO stock_purchase_items (
            purchase_id, product_id, quantity, purchase_price, selling_price, total_amount
        ) VALUES (
            v_purchase_id, v_product_id, v_qty, v_purchase_price, v_selling_price, v_item_total
        ) RETURNING id INTO v_purchase_item_id;

        -- Create Stock Batch for FIFO Costing
        v_batch_number := 'BATCH-' || to_char(v_purchase_date, 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6);
        INSERT INTO stock_batches (
            product_id, purchase_item_id, batch_number, initial_quantity,
            remaining_quantity, unit_cost, selling_price, received_date, is_depleted
        ) VALUES (
            v_product_id, v_purchase_item_id, v_batch_number, v_qty,
            v_qty, v_purchase_price, v_selling_price, v_purchase_date, false
        );

        -- Update product available stock and pricing
        UPDATE products
        SET available_stock = available_stock + v_qty,
            current_cost_price = v_purchase_price,
            current_selling_price = CASE WHEN v_update_selling_price THEN v_selling_price ELSE current_selling_price END,
            updated_at = timezone('Asia/Kolkata'::text, now())
        WHERE id = v_product_id;

        -- Record in stock_movements
        INSERT INTO stock_movements (
            product_id, movement_type, quantity_change, previous_quantity,
            new_quantity, unit_cost, reference_type, reference_id,
            reason, device_id
        ) VALUES (
            v_product_id, 'PURCHASE_IN', v_qty, v_product.available_stock,
            v_product.available_stock + v_qty, v_purchase_price, 'PURCHASE',
            v_purchase_id, 'Stock received via purchase ' || v_purchase_number, v_device_id
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'purchase_id', v_purchase_id,
        'purchase_number', v_purchase_number
    );
END;
$$ LANGUAGE plpgsql;

-- 5. ATOMIC BILL CANCELLATION / RETURN WITH STOCK RESTORATION
CREATE OR REPLACE FUNCTION cancel_or_return_bill_atomic(
    p_bill_id UUID,
    p_reason TEXT,
    p_device_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_bill RECORD;
    v_item RECORD;
    v_allocation RECORD;
    v_product RECORD;
    v_dev_uuid UUID := NULL;
BEGIN
    IF p_device_id IS NOT NULL AND p_device_id <> '' THEN
        v_dev_uuid := p_device_id::UUID;
    END IF;

    -- Lock bill
    SELECT * INTO v_bill FROM bills WHERE id = p_bill_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bill % not found', p_bill_id;
    END IF;

    IF v_bill.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Bill % is already cancelled', v_bill.invoice_number;
    END IF;

    -- Iterate items and restore stock
    FOR v_item IN SELECT * FROM bill_items WHERE bill_id = p_bill_id
    LOOP
        SELECT * INTO v_product FROM products WHERE id = v_item.product_id FOR UPDATE;

        -- Re-open batches or add back remaining quantities
        FOR v_allocation IN 
            SELECT * FROM bill_item_batch_allocations WHERE bill_item_id = v_item.id
        LOOP
            UPDATE stock_batches
            SET remaining_quantity = remaining_quantity + v_allocation.quantity,
                is_depleted = false
            WHERE id = v_allocation.batch_id;
        END LOOP;

        -- Increment product available stock
        UPDATE products
        SET available_stock = available_stock + v_item.quantity,
            updated_at = timezone('Asia/Kolkata'::text, now())
        WHERE id = v_item.product_id;

        -- Log stock movement
        INSERT INTO stock_movements (
            product_id, movement_type, quantity_change, previous_quantity,
            new_quantity, unit_cost, reference_type, reference_id,
            reason, device_id
        ) VALUES (
            v_item.product_id, 'CANCEL_IN', v_item.quantity, v_product.available_stock,
            v_product.available_stock + v_item.quantity, v_item.unit_cost_price,
            'BILL', p_bill_id, 'Restocked due to bill cancellation: ' || p_reason, v_dev_uuid
        );
    END LOOP;

    -- Update bill status
    UPDATE bills
    SET status = 'CANCELLED',
        notes = COALESCE(notes, '') || ' [CANCELLED: ' || p_reason || ']',
        updated_at = timezone('Asia/Kolkata'::text, now())
    WHERE id = p_bill_id;

    -- Audit log
    INSERT INTO audit_logs (
        action, entity, entity_id, details, device_id
    ) VALUES (
        'BILL_CANCELLED', 'bills', p_bill_id::text,
        jsonb_build_object('reason', p_reason, 'invoice_number', v_bill.invoice_number),
        v_dev_uuid
    );

    RETURN jsonb_build_object('success', true, 'message', 'Bill cancelled and stock restored');
END;
$$ LANGUAGE plpgsql;

-- 6. ATOMIC MANUAL STOCK ADJUSTMENT (Damage, Lost, Physical count)
CREATE OR REPLACE FUNCTION adjust_stock_atomic(p_adjustment_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_product_id UUID;
    v_adjustment_type TEXT;
    v_quantity INT;
    v_reason TEXT;
    v_device_id UUID;
    v_product RECORD;
    v_new_qty INT;
    v_movement_type TEXT;
    v_qty_change INT;
BEGIN
    v_product_id := (p_adjustment_data->>'product_id')::UUID;
    v_adjustment_type := p_adjustment_data->>'adjustment_type'; -- 'IN', 'OUT', 'DAMAGE', 'LOST', 'PHYSICAL_COUNT'
    v_quantity := (p_adjustment_data->>'quantity')::INT;
    v_reason := p_adjustment_data->>'reason';
    v_device_id := (p_adjustment_data->>'device_id')::UUID;

    SELECT * INTO v_product FROM products WHERE id = v_product_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found', v_product_id;
    END IF;

    IF v_adjustment_type = 'IN' THEN
        v_qty_change := v_quantity;
        v_new_qty := v_product.available_stock + v_quantity;
        v_movement_type := 'ADJUSTMENT_IN';
    ELSIF v_adjustment_type = 'OUT' THEN
        IF v_product.available_stock < v_quantity THEN
            RAISE EXCEPTION 'Cannot adjust out more than available stock (%)', v_product.available_stock;
        END IF;
        v_qty_change := -v_quantity;
        v_new_qty := v_product.available_stock - v_quantity;
        v_movement_type := 'ADJUSTMENT_OUT';
    ELSIF v_adjustment_type = 'DAMAGE' THEN
        IF v_product.available_stock < v_quantity THEN
            RAISE EXCEPTION 'Cannot mark damaged more than available stock (%)', v_product.available_stock;
        END IF;
        v_qty_change := -v_quantity;
        v_new_qty := v_product.available_stock - v_quantity;
        v_movement_type := 'DAMAGE_OUT';
    ELSIF v_adjustment_type = 'LOST' THEN
        IF v_product.available_stock < v_quantity THEN
            RAISE EXCEPTION 'Cannot mark lost more than available stock (%)', v_product.available_stock;
        END IF;
        v_qty_change := -v_quantity;
        v_new_qty := v_product.available_stock - v_quantity;
        v_movement_type := 'LOST_OUT';
    ELSIF v_adjustment_type = 'PHYSICAL_COUNT' THEN
        v_qty_change := v_quantity - v_product.available_stock;
        v_new_qty := v_quantity;
        IF v_qty_change >= 0 THEN
            v_movement_type := 'ADJUSTMENT_IN';
        ELSE
            v_movement_type := 'ADJUSTMENT_OUT';
        END IF;
    ELSE
        RAISE EXCEPTION 'Unknown adjustment type %', v_adjustment_type;
    END IF;

    UPDATE products
    SET available_stock = v_new_qty,
        updated_at = timezone('Asia/Kolkata'::text, now())
    WHERE id = v_product_id;

    INSERT INTO stock_movements (
        product_id, movement_type, quantity_change, previous_quantity,
        new_quantity, unit_cost, reference_type, reason, device_id
    ) VALUES (
        v_product_id, v_movement_type, v_qty_change, v_product.available_stock,
        v_new_qty, v_product.current_cost_price, 'ADJUSTMENT', v_reason, v_device_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'previous_quantity', v_product.available_stock,
        'new_quantity', v_new_qty,
        'quantity_change', v_qty_change
    );
END;
$$ LANGUAGE plpgsql;

-- 7. DASHBOARD METRICS RPC (High-speed single query)
CREATE OR REPLACE FUNCTION get_dashboard_metrics(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_total_sales NUMERIC(12, 2) := 0;
    v_total_bills INT := 0;
    v_gross_profit NUMERIC(12, 2) := 0;
    v_total_cogs NUMERIC(12, 2) := 0;
    v_total_expenses NUMERIC(12, 2) := 0;
    v_net_profit NUMERIC(12, 2) := 0;
    
    v_total_products INT := 0;
    v_total_available_stock INT := 0;
    v_total_stock_value NUMERIC(12, 2) := 0;
    v_low_stock_count INT := 0;
    v_out_of_stock_count INT := 0;
BEGIN
    -- Sales & Profit within period (excluding cancelled bills)
    SELECT 
        COALESCE(SUM(grand_total), 0),
        COUNT(*),
        COALESCE(SUM(gross_profit), 0),
        COALESCE(SUM(total_cost_cogs), 0)
    INTO v_total_sales, v_total_bills, v_gross_profit, v_total_cogs
    FROM bills
    WHERE status = 'COMPLETED'
      AND bill_date >= p_start_date
      AND bill_date <= p_end_date;

    -- Expenses within period
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_expenses
    FROM expenses
    WHERE expense_date >= p_start_date
      AND expense_date <= p_end_date;

    v_net_profit := v_gross_profit - v_total_expenses;

    -- Current Inventory Status
    SELECT 
        COUNT(*),
        COALESCE(SUM(available_stock), 0),
        COALESCE(SUM(available_stock * current_cost_price), 0),
        COUNT(*) FILTER (WHERE available_stock > 0 AND available_stock <= low_stock_threshold),
        COUNT(*) FILTER (WHERE available_stock = 0)
    INTO 
        v_total_products,
        v_total_available_stock,
        v_total_stock_value,
        v_low_stock_count,
        v_out_of_stock_count
    FROM products
    WHERE is_active = true;

    RETURN jsonb_build_object(
        'total_sales', v_total_sales,
        'total_bills', v_total_bills,
        'gross_profit', v_gross_profit,
        'total_cogs', v_total_cogs,
        'total_expenses', v_total_expenses,
        'net_profit', v_net_profit,
        'gross_margin_percentage', CASE WHEN v_total_sales > 0 THEN ROUND((v_gross_profit / v_total_sales) * 100, 2) ELSE 0 END,
        'net_margin_percentage', CASE WHEN v_total_sales > 0 THEN ROUND((v_net_profit / v_total_sales) * 100, 2) ELSE 0 END,
        'total_products', v_total_products,
        'total_available_stock', v_total_available_stock,
        'total_stock_value', v_total_stock_value,
        'low_stock_count', v_low_stock_count,
        'out_of_stock_count', v_out_of_stock_count
    );
END;
$$ LANGUAGE plpgsql;

-- 8. PROFIT & LOSS REPORT RPC (Group by day, month, product, category)
CREATE OR REPLACE FUNCTION get_profit_loss_report(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_group_by TEXT DEFAULT 'day'
)
RETURNS JSONB AS $$
DECLARE
    v_summary JSONB;
    v_details JSONB;
    v_expenses JSONB;
    v_category_breakdown JSONB;
BEGIN
    -- Overall Summary
    SELECT jsonb_build_object(
        'total_revenue', COALESCE(SUM(grand_total), 0),
        'total_cogs', COALESCE(SUM(total_cost_cogs), 0),
        'gross_profit', COALESCE(SUM(gross_profit), 0),
        'total_bills', COUNT(*),
        'total_discounts', COALESCE(SUM(discount_amount), 0)
    ) INTO v_summary
    FROM bills
    WHERE status = 'COMPLETED'
      AND bill_date >= p_start_date
      AND bill_date <= p_end_date;

    -- Expense Breakdown
    SELECT jsonb_agg(jsonb_build_object(
        'category', category,
        'total_amount', SUM(amount),
        'count', COUNT(*)
    )) INTO v_expenses
    FROM expenses
    WHERE expense_date >= p_start_date AND expense_date <= p_end_date
    GROUP BY category;

    -- Category-wise Profitability
    SELECT jsonb_agg(row_data) INTO v_category_breakdown
    FROM (
        SELECT 
            COALESCE(c.name, 'Uncategorized') AS category_name,
            SUM(bi.line_total) AS revenue,
            SUM(bi.line_cost) AS cogs,
            SUM(bi.line_profit) AS profit,
            SUM(bi.quantity) AS units_sold
        FROM bill_items bi
        JOIN bills b ON b.id = bi.bill_id
        JOIN products p ON p.id = bi.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE b.status = 'COMPLETED'
          AND b.bill_date >= p_start_date
          AND b.bill_date <= p_end_date
        GROUP BY c.name
        ORDER BY profit DESC
    ) row_data;

    RETURN jsonb_build_object(
        'summary', v_summary,
        'expenses_by_category', COALESCE(v_expenses, '[]'::jsonb),
        'category_breakdown', COALESCE(v_category_breakdown, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql;

-- 9. DEVICE ENROLLMENT RPC (Safe enrollment up to 3 authorized shop phones)
CREATE OR REPLACE FUNCTION enroll_device(
    p_device_token TEXT,
    p_device_name TEXT,
    p_model_info TEXT,
    p_passcode TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_correct_passcode TEXT;
    v_max_devices INT;
    v_active_count INT;
    v_existing_device RECORD;
    v_device_id UUID;
BEGIN
    SELECT enrollment_passcode, max_authorized_devices 
    INTO v_correct_passcode, v_max_devices
    FROM store_settings LIMIT 1;

    IF v_correct_passcode IS NULL THEN
        v_correct_passcode := 'VCS786';
        v_max_devices := 3;
    END IF;

    -- Verify Passcode
    IF p_passcode <> v_correct_passcode THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid shop enrollment passcode');
    END IF;

    -- Check if token already enrolled
    SELECT * INTO v_existing_device FROM authorized_devices WHERE device_token = p_device_token;
    IF FOUND THEN
        IF v_existing_device.is_active = false THEN
            RETURN jsonb_build_object('success', false, 'message', 'This device has been revoked by shop manager');
        END IF;

        UPDATE authorized_devices
        SET last_active_at = timezone('Asia/Kolkata'::text, now()),
            device_name = p_device_name
        WHERE id = v_existing_device.id;

        RETURN jsonb_build_object('success', true, 'device_id', v_existing_device.id, 'device_name', v_existing_device.device_name);
    END IF;

    -- Check active device slots
    SELECT COUNT(*) INTO v_active_count FROM authorized_devices WHERE is_active = true;
    IF v_active_count >= v_max_devices THEN
        RETURN jsonb_build_object('success', false, 'message', 'Maximum device limit reached (' || v_max_devices || ' shop phones). Revoke an old device first in Settings.');
    END IF;

    -- Insert new device
    INSERT INTO authorized_devices (
        device_token, device_name, model_info
    ) VALUES (
        p_device_token, p_device_name, p_model_info
    ) RETURNING id INTO v_device_id;

    RETURN jsonb_build_object('success', true, 'device_id', v_device_id, 'device_name', p_device_name);
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- ROW LEVEL SECURITY (RLS) & REALTIME CONFIGURATION
-- ===================================================================

-- Enable RLS on all tables
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_item_batch_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Anonymous/Public READ Policies for shop operations
CREATE POLICY "Public Read Categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public Read Products" ON products FOR SELECT USING (true);
CREATE POLICY "Public Read Stock Purchases" ON stock_purchases FOR SELECT USING (true);
CREATE POLICY "Public Read Purchase Items" ON stock_purchase_items FOR SELECT USING (true);
CREATE POLICY "Public Read Stock Batches" ON stock_batches FOR SELECT USING (true);
CREATE POLICY "Public Read Stock Movements" ON stock_movements FOR SELECT USING (true);
CREATE POLICY "Public Read Bills" ON bills FOR SELECT USING (true);
CREATE POLICY "Public Read Bill Items" ON bill_items FOR SELECT USING (true);
CREATE POLICY "Public Read Payments" ON payments FOR SELECT USING (true);
CREATE POLICY "Public Read Expenses" ON expenses FOR SELECT USING (true);
CREATE POLICY "Public Read Settings" ON store_settings FOR SELECT USING (true);
CREATE POLICY "Public Read Authorized Devices" ON authorized_devices FOR SELECT USING (true);
CREATE POLICY "Public Read Returns" ON returns FOR SELECT USING (true);
CREATE POLICY "Public Read Return Items" ON return_items FOR SELECT USING (true);

-- Product Management Writes
CREATE POLICY "Public Insert Products" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Products" ON products FOR UPDATE USING (true);

-- Categories Writes
CREATE POLICY "Public Insert Categories" ON categories FOR INSERT WITH CHECK (true);

-- Expenses Writes
CREATE POLICY "Public Insert Expenses" ON expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Delete Expenses" ON expenses FOR DELETE USING (true);

-- Settings Update
CREATE POLICY "Public Update Settings" ON store_settings FOR UPDATE USING (true);

-- Enable Supabase Realtime Publication for Live Synchronization across 3 phones
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    products, 
    bills, 
    bill_items, 
    stock_movements, 
    stock_purchases, 
    expenses, 
    store_settings;
COMMIT;

-- ===================================================================
-- SEED INITIAL STORE SETTINGS & ESSENTIAL CATEGORIES
-- ===================================================================
INSERT INTO store_settings (
    store_name, tagline, phone, address, upi_id, currency_symbol, invoice_prefix, enrollment_passcode, max_authorized_devices
) VALUES (
    'VINTAGE CLOTHING STORE',
    'Exclusive Men & Women Fashion',
    '+91 98765 43210',
    'Shop #4, Market Road, Kerala, India',
    'vintageclothing@upi',
    '₹',
    'VCS',
    'VCS786',
    3
) ON CONFLICT DO NOTHING;

INSERT INTO categories (name, slug, description, display_order) VALUES
('Shirts & Tops', 'shirts-tops', 'Men and Women casual and formal shirts', 1),
('Jeans & Trousers', 'jeans-trousers', 'Denim jeans, chinos and trousers', 2),
('T-Shirts & Polos', 't-shirts-polos', 'Cotton graphic tees and polos', 3),
('Dresses & Kurtis', 'dresses-kurtis', 'Ethnic wear, kurtis, and dresses', 4),
('Jackets & Outerwear', 'jackets-outerwear', 'Denim jackets, hoodies, and blazers', 5),
('Accessories', 'accessories', 'Belts, caps, socks, and accessories', 6)
ON CONFLICT (slug) DO NOTHING;
