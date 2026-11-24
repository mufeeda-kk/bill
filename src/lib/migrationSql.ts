// Central Supabase SQL Migration for Manual Data Management & Atomic Bill Deletion
export const MANUAL_MANAGEMENT_SQL = `-- ===================================================================
-- VINTAGE CLOTHING STORE - SECURE MANUAL DATA MANAGEMENT & DELETE RPCs
-- ===================================================================

-- 1. DROP UNNECESSARY UNRESTRICTED PUBLIC RLS POLICIES
DROP POLICY IF EXISTS "Public Delete Bills" ON public.bills;
DROP POLICY IF EXISTS "Public Delete Bill Items" ON public.bill_items;
DROP POLICY IF EXISTS "Public Delete Batch Allocations" ON public.bill_item_batch_allocations;
DROP POLICY IF EXISTS "Public Delete Payments" ON public.payments;
DROP POLICY IF EXISTS "Public Delete Returns" ON public.returns;
DROP POLICY IF EXISTS "Public Delete Return Items" ON public.return_items;
DROP POLICY IF EXISTS "Public Update Stock Batches" ON public.stock_batches;
DROP POLICY IF EXISTS "Public Insert Stock Movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Public Delete Stock Movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Public Delete Products" ON public.products;

-- Clean existing function signatures
DROP FUNCTION IF EXISTS public.delete_bill_atomic(UUID, TEXT);
DROP FUNCTION IF EXISTS public.delete_bill_atomic(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.delete_customer_atomic(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.delete_product_atomic(UUID);
DROP FUNCTION IF EXISTS public.delete_product_atomic(TEXT);
DROP FUNCTION IF EXISTS public.delete_stock_movement_atomic(UUID);
DROP FUNCTION IF EXISTS public.delete_stock_movement_atomic(TEXT);

-- 2. ATOMIC BILL DELETION WITH INVENTORY RESTORATION
CREATE OR REPLACE FUNCTION public.delete_bill_atomic(
    p_bill_id UUID,
    p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB 
LANGUAGE plpgsql
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
    v_had_allocations BOOLEAN;
BEGIN
    IF p_device_id IS NOT NULL AND p_device_id <> '' THEN
        BEGIN
            v_dev_uuid := p_device_id::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_dev_uuid := NULL;
        END;
    END IF;

    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bill not found or already deleted');
    END IF;

    IF v_bill.status <> 'CANCELLED' THEN
        FOR v_item IN SELECT * FROM public.bill_items WHERE bill_id = p_bill_id
        LOOP
            v_had_allocations := false;
            SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id FOR UPDATE;

            FOR v_allocation IN 
                SELECT * FROM public.bill_item_batch_allocations WHERE bill_item_id = v_item.id
            LOOP
                v_had_allocations := true;
                UPDATE public.stock_batches
                SET remaining_quantity = remaining_quantity + v_allocation.quantity,
                    is_depleted = false
                WHERE id = v_allocation.batch_id;
            END LOOP;

            IF NOT v_had_allocations THEN
                UPDATE public.stock_batches
                SET remaining_quantity = remaining_quantity + v_item.quantity,
                    is_depleted = false
                WHERE id = (
                    SELECT id FROM public.stock_batches 
                    WHERE product_id = v_item.product_id 
                    ORDER BY received_date DESC, created_at DESC 
                    LIMIT 1
                );
            END IF;

            IF v_product.id IS NOT NULL THEN
                UPDATE public.products
                SET available_stock = available_stock + v_item.quantity,
                    updated_at = timezone('Asia/Kolkata'::text, now())
                WHERE id = v_item.product_id;

                INSERT INTO public.stock_movements (
                    product_id, movement_type, quantity_change, previous_quantity,
                    new_quantity, unit_cost, reference_type, reference_id,
                    reason, device_id
                ) VALUES (
                    v_item.product_id, 'CANCEL_IN', v_item.quantity, v_product.available_stock,
                    v_product.available_stock + v_item.quantity, v_item.unit_cost_price,
                    'BILL', p_bill_id, 'Stock restored due to deleted bill ' || v_bill.invoice_number, v_dev_uuid
                );
            END IF;

            v_restored_count := v_restored_count + 1;
        END LOOP;
    END IF;

    DELETE FROM public.return_items WHERE return_id IN (SELECT id FROM public.returns WHERE bill_id = p_bill_id);
    DELETE FROM public.returns WHERE bill_id = p_bill_id;
    DELETE FROM public.bill_item_batch_allocations WHERE bill_item_id IN (SELECT id FROM public.bill_items WHERE bill_id = p_bill_id);
    DELETE FROM public.bill_items WHERE bill_id = p_bill_id;
    DELETE FROM public.payments WHERE bill_id = p_bill_id;
    DELETE FROM public.bills WHERE id = p_bill_id;

    INSERT INTO public.audit_logs (
        action, entity, entity_id, details, device_id
    ) VALUES (
        'BILL_DELETED', 'bills', p_bill_id::text,
        jsonb_build_object(
            'invoice_number', v_bill.invoice_number,
            'grand_total', v_bill.grand_total,
            'payment_method', v_bill.payment_method,
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
$$;

CREATE OR REPLACE FUNCTION public.delete_bill_atomic(
    p_bill_id TEXT,
    p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.delete_bill_atomic(p_bill_id::UUID, p_device_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid bill ID: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_bill_atomic(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_bill_atomic(TEXT, TEXT) TO anon, authenticated, service_role;

-- 3. ATOMIC CUSTOMER DELETION
CREATE OR REPLACE FUNCTION public.delete_customer_atomic(
    p_phone TEXT DEFAULT NULL,
    p_name TEXT DEFAULT NULL
)
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_bills INT := 0;
BEGIN
    IF p_phone IS NOT NULL AND p_phone <> '' THEN
        UPDATE public.bills 
        SET customer_phone = NULL,
            customer_name = 'Walk-in Customer',
            updated_at = timezone('Asia/Kolkata'::text, now())
        WHERE customer_phone = p_phone;
        GET DIAGNOSTICS v_updated_bills = ROW_COUNT;
    ELSIF p_name IS NOT NULL AND p_name <> '' AND p_name <> 'Walk-in Customer' THEN
        UPDATE public.bills 
        SET customer_name = 'Walk-in Customer',
            customer_phone = NULL,
            updated_at = timezone('Asia/Kolkata'::text, now())
        WHERE customer_name = p_name;
        GET DIAGNOSTICS v_updated_bills = ROW_COUNT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
        IF p_phone IS NOT NULL AND p_phone <> '' THEN
            EXECUTE 'DELETE FROM public.customers WHERE phone = $1' USING p_phone;
        ELSIF p_name IS NOT NULL AND p_name <> '' THEN
            EXECUTE 'DELETE FROM public.customers WHERE name = $1' USING p_name;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Customer personal information removed safely.',
        'bills_anonymized', v_updated_bills
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_customer_atomic(TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. ATOMIC PRODUCT DELETION
CREATE OR REPLACE FUNCTION public.delete_product_atomic(
    p_product_id UUID
)
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill_count INT;
BEGIN
    SELECT COUNT(*) INTO v_bill_count FROM public.bill_items WHERE product_id = p_product_id;
    
    IF v_bill_count > 0 THEN
        UPDATE public.products 
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
        DELETE FROM public.bill_item_batch_allocations WHERE batch_id IN (SELECT id FROM public.stock_batches WHERE product_id = p_product_id);
        DELETE FROM public.stock_batches WHERE product_id = p_product_id;
        DELETE FROM public.stock_purchase_items WHERE product_id = p_product_id;
        DELETE FROM public.stock_movements WHERE product_id = p_product_id;
        DELETE FROM public.products WHERE id = p_product_id;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'DELETED',
            'message', 'Product deleted permanently.'
        );
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_product_atomic(
    p_product_id TEXT
)
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.delete_product_atomic(p_product_id::UUID);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid product ID: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_product_atomic(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_product_atomic(TEXT) TO anon, authenticated, service_role;

-- 5. ATOMIC STOCK MOVEMENT RECORD DELETION
CREATE OR REPLACE FUNCTION public.delete_stock_movement_atomic(
    p_movement_id UUID
)
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.stock_movements WHERE id = p_movement_id;
    RETURN jsonb_build_object('success', true, 'message', 'Stock adjustment history record deleted.');
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_stock_movement_atomic(
    p_movement_id TEXT
)
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.delete_stock_movement_atomic(p_movement_id::UUID);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid movement ID: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_stock_movement_atomic(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_stock_movement_atomic(TEXT) TO anon, authenticated, service_role;

-- 6. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
`;
