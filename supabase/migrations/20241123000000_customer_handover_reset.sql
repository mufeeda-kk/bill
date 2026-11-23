-- ===================================================================
-- VINTAGE CLOTHING STORE - CUSTOMER HANDOVER COMPLETE DATA RESET
-- Preserves: Schema, tables, triggers, RLS, store_settings, authorized_devices
-- Deletes: All test products, categories, stock, bills, payments, movements
-- ===================================================================

BEGIN;

-- 1. Safely truncate all transactional and catalog business records
TRUNCATE TABLE 
    return_items,
    returns,
    bill_item_batch_allocations,
    bill_items,
    payments,
    bills,
    stock_movements,
    stock_batches,
    stock_purchase_items,
    stock_purchases,
    expenses,
    audit_logs,
    products,
    categories
CASCADE;

-- 2. Create atomic RPC reset function for authorized one-click resets
CREATE OR REPLACE FUNCTION reset_handover_data_atomic(p_passcode TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actual_passcode TEXT;
BEGIN
    SELECT enrollment_passcode INTO v_actual_passcode FROM store_settings LIMIT 1;
    IF v_actual_passcode IS NULL THEN
        v_actual_passcode := 'VCS786';
    END IF;

    IF p_passcode <> v_actual_passcode THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid shop master passcode');
    END IF;

    TRUNCATE TABLE 
        return_items,
        returns,
        bill_item_batch_allocations,
        bill_items,
        payments,
        bills,
        stock_movements,
        stock_batches,
        stock_purchase_items,
        stock_purchases,
        expenses,
        audit_logs,
        products,
        categories
    CASCADE;

    RETURN jsonb_build_object('success', true, 'message', 'All business data reset successfully for customer handover.');
END;
$$;

GRANT EXECUTE ON FUNCTION reset_handover_data_atomic(TEXT) TO anon, authenticated;

COMMIT;
