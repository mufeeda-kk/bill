-- ===================================================================
-- VINTAGE CLOTHING STORE - COMPLETE MANUAL DATA MANAGEMENT & DELETE RPCs
-- Adds atomic operations for:
-- 1. delete_bill_atomic (Restores sold stock to batches/products, removes payments, deletes bill)
-- 2. delete_customer_atomic (Safely removes customer PII without breaking accounting records)
-- 3. delete_product_atomic (Deletes unused products or archives products with history safely)
-- 4. delete_stock_movement_atomic (Removes individual stock adjustment history entries)
-- ===================================================================

-- 1. ATOMIC BILL DELETION WITH INVENTORY RESTORATION
CREATE OR REPLACE FUNCTION delete_bill_atomic(
    p_bill_id UUID,
    p_device_id TEXT
)
RETURNS JSONB 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill RECORD;
    v_item RECORD;
    v_allocation RECORD;
    v_product RECORD;
    v_dev_uuid UUID := NULL;
    v_restored_count INT := 0;
BEGIN
    IF p_device_id IS NOT NULL AND p_device_id <> '' THEN
        BEGIN
            v_dev_uuid := p_device_id::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_dev_uuid := NULL;
        END;
    END IF;

    -- Lock bill for update
    SELECT * INTO v_bill FROM bills WHERE id = p_bill_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bill not found or already deleted');
    END IF;

    -- Restore stock ONLY if bill was NOT already cancelled (prevents duplicate stock restoration)
    IF v_bill.status <> 'CANCELLED' THEN
        FOR v_item IN SELECT * FROM bill_items WHERE bill_id = p_bill_id
        LOOP
            SELECT * INTO v_product FROM products WHERE id = v_item.product_id FOR UPDATE;

            -- Restore allocated FIFO batches
            FOR v_allocation IN 
                SELECT * FROM bill_item_batch_allocations WHERE bill_item_id = v_item.id
            LOOP
                UPDATE stock_batches
                SET remaining_quantity = remaining_quantity + v_allocation.quantity,
                    is_depleted = false,
                    updated_at = timezone('Asia/Kolkata'::text, now())
                WHERE id = v_allocation.batch_id;
            END LOOP;

            -- Restore product available stock
            IF v_product.id IS NOT NULL THEN
                UPDATE products
                SET available_stock = available_stock + v_item.quantity,
                    updated_at = timezone('Asia/Kolkata'::text, now())
                WHERE id = v_item.product_id;

                -- Record stock restoration in stock_movements audit trail
                INSERT INTO stock_movements (
                    product_id, movement_type, quantity_change, previous_quantity,
                    new_quantity, unit_cost, reference_type, reference_id,
                    reason, device_id
                ) VALUES (
                    v_item.product_id, 'RESTORE_IN', v_item.quantity, v_product.available_stock,
                    v_product.available_stock + v_item.quantity, v_item.unit_cost_price,
                    'BILL_DELETE', p_bill_id, 'Stock restored due to deleted bill ' || v_bill.invoice_number, v_dev_uuid
                );
            END IF;

            v_restored_count := v_restored_count + 1;
        END LOOP;
    END IF;

    -- Remove dependent records cleanly
    DELETE FROM return_items WHERE return_id IN (SELECT id FROM returns WHERE bill_id = p_bill_id);
    DELETE FROM returns WHERE bill_id = p_bill_id;
    DELETE FROM bill_item_batch_allocations WHERE bill_item_id IN (SELECT id FROM bill_items WHERE bill_id = p_bill_id);
    DELETE FROM bill_items WHERE bill_id = p_bill_id;
    DELETE FROM payments WHERE bill_id = p_bill_id;

    -- Delete bill record
    DELETE FROM bills WHERE id = p_bill_id;

    -- Log deletion in audit_logs
    INSERT INTO audit_logs (
        action, entity, entity_id, details, device_id
    ) VALUES (
        'BILL_DELETED', 'bills', p_bill_id::text,
        jsonb_build_object(
            'invoice_number', v_bill.invoice_number,
            'grand_total', v_bill.grand_total,
            'restored_items_count', v_restored_count
        ),
        v_dev_uuid
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Bill ' || v_bill.invoice_number || ' deleted and inventory restored successfully.',
        'invoice_number', v_bill.invoice_number,
        'restored_products_count', v_restored_count
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION delete_bill_atomic(UUID, TEXT) TO anon, authenticated;

-- 2. ATOMIC CUSTOMER DELETION (Safely clears PII without breaking billing foreign keys)
CREATE OR REPLACE FUNCTION delete_customer_atomic(
    p_phone TEXT,
    p_name TEXT
)
RETURNS JSONB 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_bills INT := 0;
BEGIN
    IF p_phone IS NOT NULL AND p_phone <> '' THEN
        UPDATE bills 
        SET customer_phone = NULL,
            customer_name = 'Walk-in Customer',
            updated_at = timezone('Asia/Kolkata'::text, now())
        WHERE customer_phone = p_phone;
        GET DIAGNOSTICS v_updated_bills = ROW_COUNT;
    ELSIF p_name IS NOT NULL AND p_name <> '' AND p_name <> 'Walk-in Customer' THEN
        UPDATE bills 
        SET customer_name = 'Walk-in Customer',
            customer_phone = NULL,
            updated_at = timezone('Asia/Kolkata'::text, now())
        WHERE customer_name = p_name;
        GET DIAGNOSTICS v_updated_bills = ROW_COUNT;
    END IF;

    -- Optional customer tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
        IF p_phone IS NOT NULL AND p_phone <> '' THEN
            EXECUTE 'DELETE FROM public.customers WHERE phone = $1' USING p_phone;
        ELSIF p_name IS NOT NULL AND p_name <> '' THEN
            EXECUTE 'DELETE FROM public.customers WHERE name = $1' USING p_name;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Customer information removed safely.',
        'bills_anonymized', v_updated_bills
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION delete_customer_atomic(TEXT, TEXT) TO anon, authenticated;

-- 3. ATOMIC PRODUCT DELETION
CREATE OR REPLACE FUNCTION delete_product_atomic(
    p_product_id UUID
)
RETURNS JSONB 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill_count INT;
BEGIN
    SELECT COUNT(*) INTO v_bill_count FROM bill_items WHERE product_id = p_product_id;
    
    IF v_bill_count > 0 THEN
        -- Product has transaction history: archive safely to protect previous sales records
        UPDATE products 
        SET is_active = false,
            available_stock = 0,
            updated_at = timezone('Asia/Kolkata'::text, now())
        WHERE id = p_product_id;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'ARCHIVED',
            'message', 'Product archived and removed from active catalog to protect ' || v_bill_count || ' historical bill reference(s).'
        );
    ELSE
        -- No transaction records: delete permanently
        DELETE FROM stock_batches WHERE product_id = p_product_id;
        DELETE FROM stock_purchase_items WHERE product_id = p_product_id;
        DELETE FROM stock_movements WHERE product_id = p_product_id;
        DELETE FROM products WHERE id = p_product_id;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'DELETED',
            'message', 'Product deleted permanently.'
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION delete_product_atomic(UUID) TO anon, authenticated;

-- 4. ATOMIC STOCK MOVEMENT RECORD DELETION
CREATE OR REPLACE FUNCTION delete_stock_movement_atomic(
    p_movement_id UUID
)
RETURNS JSONB 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM stock_movements WHERE id = p_movement_id;
    RETURN jsonb_build_object('success', true, 'message', 'Stock adjustment history record deleted.');
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION delete_stock_movement_atomic(UUID) TO anon, authenticated;
