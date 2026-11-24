// Central Supabase SQL Migration for Manual Data Management & Atomic Bill Deletion
export const MANUAL_MANAGEMENT_SQL = `-- VINTAGE CLOTHING STORE: MANUAL DATA MANAGEMENT & DELETE RPCs
DROP FUNCTION IF EXISTS public.delete_bill_atomic(UUID, TEXT);
DROP FUNCTION IF EXISTS public.delete_bill_atomic(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.delete_customer_atomic(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.delete_product_atomic(UUID);
DROP FUNCTION IF EXISTS public.delete_product_atomic(TEXT);
DROP FUNCTION IF EXISTS public.delete_stock_movement_atomic(UUID);
DROP FUNCTION IF EXISTS public.delete_stock_movement_atomic(TEXT);

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
                    is_depleted = false,
                    updated_at = timezone('Asia/Kolkata'::text, now())
                WHERE id = v_allocation.batch_id;
            END LOOP;

            IF NOT v_had_allocations THEN
                UPDATE public.stock_batches
                SET remaining_quantity = remaining_quantity + v_item.quantity,
                    is_depleted = false,
                    updated_at = timezone('Asia/Kolkata'::text, now())
                WHERE id = (
                    SELECT id FROM public.stock_batches 
                    WHERE product_id = v_item.product_id 
                    ORDER BY purchase_date DESC, created_at DESC 
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

-- RLS Write & Delete Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Delete Bills' AND tablename = 'bills') THEN
        CREATE POLICY "Public Delete Bills" ON public.bills FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Delete Bill Items' AND tablename = 'bill_items') THEN
        CREATE POLICY "Public Delete Bill Items" ON public.bill_items FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Delete Batch Allocations' AND tablename = 'bill_item_batch_allocations') THEN
        CREATE POLICY "Public Delete Batch Allocations" ON public.bill_item_batch_allocations FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Delete Payments' AND tablename = 'payments') THEN
        CREATE POLICY "Public Delete Payments" ON public.payments FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Delete Returns' AND tablename = 'returns') THEN
        CREATE POLICY "Public Delete Returns" ON public.returns FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Delete Return Items' AND tablename = 'return_items') THEN
        CREATE POLICY "Public Delete Return Items" ON public.return_items FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Update Stock Batches' AND tablename = 'stock_batches') THEN
        CREATE POLICY "Public Update Stock Batches" ON public.stock_batches FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Insert Stock Movements' AND tablename = 'stock_movements') THEN
        CREATE POLICY "Public Insert Stock Movements" ON public.stock_movements FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Delete Stock Movements' AND tablename = 'stock_movements') THEN
        CREATE POLICY "Public Delete Stock Movements" ON public.stock_movements FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Delete Products' AND tablename = 'products') THEN
        CREATE POLICY "Public Delete Products" ON public.products FOR DELETE USING (true);
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
`;
