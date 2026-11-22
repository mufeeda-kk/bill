import React from 'react';
import { useStore } from '../../context/StoreContext';
import { WifiOff, Smartphone, RefreshCw, ShoppingBag } from 'lucide-react';
import { formatKolkataTime } from '../../lib/formatters';

interface HeaderProps {
  onNavigate: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate }) => {
  const { 
    settings, currentDevice, isOnline, syncStatus, 
    lastSyncTime, refreshData, cart 
  } = useStore();

  return (
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

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between">
        {/* Brand & Store Name */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black text-lg shadow-inner">
            V
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-amber-100 flex items-center gap-2">
              {settings.store_name || 'VINTAGE CLOTHING STORE'}
              <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50">
                POS
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 hidden xs:block">
              {settings.tagline || 'Exclusive Fashion'} • INR (₹)
            </p>
          </div>
        </div>

        {/* Sync Status & Device Badge */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Device Badge */}
          {currentDevice && (
            <div className="hidden md:flex items-center space-x-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full text-xs text-slate-300">
              <Smartphone className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-medium max-w-[120px] truncate">{currentDevice.name}</span>
            </div>
          )}

          {/* Realtime Live Sync Status */}
          <div 
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
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
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition active:scale-95"
            title="Refresh All Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Quick POS Billing Button */}
          <button
            onClick={() => onNavigate('billing')}
            className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs sm:text-sm shadow-sm transition active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>POS Billing</span>
            {cart.length > 0 && (
              <span className="bg-slate-950 text-amber-300 text-[11px] px-1.5 py-0.2 rounded-full font-black ml-1">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
