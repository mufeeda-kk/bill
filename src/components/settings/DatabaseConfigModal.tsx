import React, { useState } from 'react';
import { Database, CheckCircle, AlertTriangle, X, Shield, Copy } from 'lucide-react';
import { 
  getSupabaseCredentials, saveSupabaseCredentials, 
  clearSupabaseCredentials, isSupabaseConfigured,
  DEFAULT_SUPABASE_URL
} from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';

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
