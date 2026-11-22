import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { WifiOff, Smartphone, RefreshCw, ShoppingBag, Database, AlertCircle, Settings } from 'lucide-react';
import { formatKolkataTime } from '../../lib/formatters';
import { isSupabaseConfigured } from '../../lib/supabase';
import { DatabaseConfigModal } from '../settings/DatabaseConfigModal';

interface HeaderProps {
  onNavigate: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate }) => {
  const { 
    settings, currentDevice, isOnline, syncStatus, 
    lastSyncTime, refreshData, cart, setIsMobileCartOpen 
  } = useStore();

  const [isDbModalOpen, setIsDbModalOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md border-b border-slate-800">
        {/* Offline Alert Banner */}
        {!isOnline && (
          <div className="bg-amber-600 text-white text-xs px-4 py-1.5 flex items-center justify-between font-medium">
            <div className="flex items-center space-x-2">
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
              <span>Offline Mode: Bills saved locally and will sync when reconnected.</span>
            </div>
            <span className="bg-amber-800 px-2 py-0.5 rounded text-[10px]">LOCAL CASH DRAWER ACTIVE</span>
          </div>
        )}

        {/* Database Not Connected Warning Banner */}
        {!isSupabaseConfigured && (
          <div 
            onClick={() => setIsDbModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 cursor-pointer text-slate-950 font-bold text-xs px-4 py-1.5 flex items-center justify-between transition"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>⚠️ Central Database Not Connected! Tap here to link Supabase so all 3 phones sync together.</span>
            </div>
            <span className="bg-slate-950 text-amber-300 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
              CONNECT NOW
            </span>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2">
          {/* Brand & Store Name */}
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white p-0.5 border border-amber-500/40 flex items-center justify-center shadow-inner overflow-hidden shrink-0">
              <img 
                src="/logo.jpg" 
                alt="Vintage Clothing Store Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-black tracking-tight text-amber-100 flex items-center gap-1.5 truncate">
                <span className="truncate">{settings.store_name || 'VINTAGE CLOTHING'}</span>
                <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50 shrink-0">
                  POS
                </span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-400 hidden xs:block truncate">
                {settings.tagline || 'Exclusive Fashion'} • INR (₹)
              </p>
            </div>
          </div>

          {/* Sync Status & Action Buttons */}
          <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
            {/* Database Connection Button */}
            <button
              onClick={() => setIsDbModalOpen(true)}
              className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold border transition ${
                isSupabaseConfigured
                  ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  : 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'
              }`}
              title={isSupabaseConfigured ? 'Central Supabase Connected' : 'Click to connect central database'}
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {isSupabaseConfigured ? 'Central DB' : 'Connect DB'}
              </span>
            </button>

            {/* Device Badge (Desktop only) */}
            {currentDevice && (
              <div className="hidden lg:flex items-center space-x-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full text-xs text-slate-300">
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-medium max-w-[120px] truncate">{currentDevice.name}</span>
              </div>
            )}

            {/* Realtime Live Sync Status */}
            <div 
              className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium border ${
                syncStatus === 'connected' 
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50' 
                  : syncStatus === 'connecting'
                  ? 'bg-yellow-950/60 text-yellow-300 border-yellow-700/50'
                  : 'bg-red-950/60 text-red-300 border-red-700/50'
              }`}
              title={`Last synced: ${formatKolkataTime(lastSyncTime)}`}
            >
              <span className={`w-2 h-2 rounded-full ${
                syncStatus === 'connected' 
                  ? 'bg-emerald-400 animate-pulse' 
                  : syncStatus === 'connecting'
                  ? 'bg-yellow-400 animate-ping'
                  : 'bg-red-400'
              }`} />
              <span className="hidden sm:inline">
                {syncStatus === 'connected' ? 'Live Sync' : syncStatus === 'connecting' ? 'Syncing...' : 'Disconnected'}
              </span>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={() => refreshData()}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition active:scale-95"
              title="Refresh All Data"
            >
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Settings Button */}
            <button
              onClick={() => onNavigate('settings')}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition active:scale-95"
              title="Store Settings & Device Auth"
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* POS Billing Cart Button - Clean Responsive Behavior */}
            <button
              onClick={() => {
                onNavigate('billing');
                if (cart.length > 0) {
                  setIsMobileCartOpen(true);
                }
              }}
              className="relative flex items-center space-x-1 sm:space-x-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm shadow-sm transition shrink-0"
              title="POS Billing"
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">POS Billing</span>
              {cart.length > 0 && (
                <span className="bg-slate-950 text-amber-300 text-[11px] px-1.5 py-0.2 rounded-full font-black">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Database Connection Modal */}
      <DatabaseConfigModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        onConnected={() => refreshData()}
      />
    </>
  );
};
