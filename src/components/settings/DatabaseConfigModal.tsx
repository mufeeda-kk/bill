import React, { useState } from 'react';
import { Database, CheckCircle, AlertTriangle, X, Shield, Copy, Terminal } from 'lucide-react';
import { 
  getSupabaseCredentials, saveSupabaseCredentials, 
  clearSupabaseCredentials, isSupabaseConfigured,
  DEFAULT_SUPABASE_URL
} from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';

const MANUAL_MANAGEMENT_SQL = `-- VINTAGE CLOTHING STORE: MANUAL DATA MANAGEMENT & DELETE RPCs
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

NOTIFY pgrst, 'reload schema';`;

interface DatabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export const DatabaseConfigModal: React.FC<DatabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConnected,
}) => {
  const currentCreds = getSupabaseCredentials();
  const [url, setUrl] = useState(currentCreds.url || DEFAULT_SUPABASE_URL);
  const [anonKey, setAnonKey] = useState(currentCreds.anonKey);
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  const copySqlMigration = () => {
    navigator.clipboard.writeText(MANUAL_MANAGEMENT_SQL);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 3000);
  };

  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();

    if (!cleanUrl.startsWith('https://') || !cleanUrl.includes('.supabase.co')) {
      setStatus('error');
      setErrorMsg('Please enter a valid Supabase project URL (e.g. https://xyz.supabase.co)');
      return;
    }

    if (!cleanKey || cleanKey.length < 20) {
      setStatus('error');
      setErrorMsg('Please enter a valid Supabase anon/public key.');
      return;
    }

    setStatus('testing');
    setErrorMsg(null);

    try {
      const testClient = createClient(cleanUrl, cleanKey, {
        auth: { persistSession: false },
      });

      // Quick probe to test connectivity
      const { error } = await testClient.from('store_settings').select('store_name').limit(1);

      if (error && !error.message.includes('permission denied')) {
        // Even if table is empty or permission denied, network reached. But if domain doesn't exist, throws
        console.warn('Probe response:', error);
      }

      saveSupabaseCredentials(cleanUrl, cleanKey);
      setStatus('success');
      setTimeout(() => {
        if (onConnected) onConnected();
        window.location.reload();
      }, 1200);
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Failed to reach Supabase project';
      setErrorMsg(msg);
    }
  };

  const handleDisconnect = () => {
    if (confirm('Disconnect from central Supabase database and return to local mode?')) {
      clearSupabaseCredentials();
      window.location.reload();
    }
  };

  const copyVercelSnippet = () => {
    const snippet = `VITE_SUPABASE_URL=${url || 'https://your-project.supabase.co'}\nVITE_SUPABASE_ANON_KEY=${anonKey || 'your-anon-key'}`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">Central Database Connection</h3>
              <p className="text-[11px] text-slate-400">Syncs Bills & Stock Live Across All 3 Shop Phones</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status banner */}
        <div className={`p-3 text-xs flex items-center justify-between ${
          isSupabaseConfigured 
            ? 'bg-emerald-50 text-emerald-900 border-b border-emerald-200' 
            : 'bg-amber-50 text-amber-900 border-b border-amber-200'
        }`}>
          <div className="flex items-center space-x-2">
            {isSupabaseConfigured ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span className="font-semibold">
              {isSupabaseConfigured 
                ? 'Connected to Central Supabase Database' 
                : 'Isolated Local Storage Mode (Phones will not sync!)'}
            </span>
          </div>
          {isSupabaseConfigured && (
            <button
              onClick={handleDisconnect}
              className="text-[10px] text-red-600 hover:text-red-800 underline font-semibold"
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleTestAndSave} className="p-4 sm:p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {status === 'success' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span className="font-bold">Database connected! Refreshing store data...</span>
            </div>
          )}

          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://abcdefghijkl.supabase.co"
              className="w-full px-3 py-2 border rounded-xl font-mono text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Found in your Supabase Dashboard → <strong>Project Settings → API → Project URL</strong>
            </p>
          </div>

          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Supabase Anon / Public Key (Safe for Frontend)
            </label>
            <textarea
              required
              rows={2}
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full px-3 py-2 border rounded-xl font-mono text-[11px] text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-600" />
              Use only the <strong>anon public key</strong>. Never enter the secret service_role key here.
            </p>
          </div>

          {/* Vercel Environment variables helper */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Permanent Vercel Sync Setup:</span>
              <button
                type="button"
                onClick={copyVercelSnippet}
                className="flex items-center space-x-1 text-amber-700 hover:text-amber-800 font-semibold text-[10px]"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? 'Copied!' : 'Copy for Vercel'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              To apply across all phones automatically without entering keys on each phone, paste these in 
              <strong> Vercel → Project Settings → Environment Variables</strong> and redeploy.
            </p>
          </div>

          {/* Supabase SQL Migration Helper (Delete Bill & Stock Restore RPC) */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-900 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-amber-600" />
                <span>Supabase Delete Bill & RPC Migration:</span>
              </span>
              <button
                type="button"
                onClick={copySqlMigration}
                className="flex items-center space-x-1 px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[10px] transition"
              >
                <Copy className="w-3 h-3" />
                <span>{sqlCopied ? 'Copied SQL!' : 'Copy SQL Migration'}</span>
              </button>
            </div>
            <p className="text-[10px] text-amber-800 leading-relaxed">
              If Supabase reports <em>"function delete_bill_atomic not in schema cache"</em>, click <strong>Copy SQL Migration</strong> and paste it into your <strong>Supabase Dashboard → SQL Editor → Run</strong>. It automatically reloads PostgREST schema cache.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === 'testing' || status === 'success'}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-md transition disabled:opacity-50"
            >
              {status === 'testing' ? 'Connecting...' : 'Connect & Sync All Phones'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
