import React from 'react';
import { 
  LayoutDashboard, ShoppingCart, Shirt, Boxes, 
  Truck, ReceiptText, TrendingUp, Wallet, Settings 
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange }) => {
  const { cart } = useStore();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'billing', label: 'Billing POS', icon: ShoppingCart, badge: cart.length > 0 ? cart.length : null },
    { id: 'products', label: 'Products', icon: Shirt },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'stock-purchase', label: 'Add Stock', icon: Truck },
    { id: 'bills', label: 'Bills', icon: ReceiptText },
    { id: 'profit-loss', label: 'P & L', icon: TrendingUp },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Desktop & Tablet Top Navigation Bar */}
      <nav className="hidden md:block bg-slate-800 border-b border-slate-700/80 sticky top-[53px] z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex space-x-1 py-1.5 overflow-x-auto scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge !== null && item.badge !== undefined && (
                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar (Primary phone navigation) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50 pb-safe shadow-2xl">
        <div className="grid grid-cols-5 h-16 items-center px-1">
          {/* Dashboard */}
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex flex-col items-center justify-center py-1 text-[11px] font-medium transition ${
              currentTab === 'dashboard' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span>Home</span>
          </button>

          {/* Products */}
          <button
            onClick={() => onTabChange('products')}
            className={`flex flex-col items-center justify-center py-1 text-[11px] font-medium transition ${
              currentTab === 'products' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Shirt className="w-5 h-5 mb-0.5" />
            <span>Items</span>
          </button>

          {/* Central Billing Button (Hero) */}
          <button
            onClick={() => onTabChange('billing')}
            className="flex flex-col items-center justify-center -mt-5 relative"
          >
            <div className={`w-13 h-13 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-900 transition active:scale-95 ${
              currentTab === 'billing' ? 'bg-amber-400 text-slate-950' : 'bg-amber-500 text-slate-950'
            }`}>
              <ShoppingCart className="w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute top-0 right-1 bg-red-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-slate-900">
                  {cart.length}
                </span>
              )}
            </div>
            <span className={`text-[10px] font-bold mt-1 ${currentTab === 'billing' ? 'text-amber-400' : 'text-slate-300'}`}>
              BILLING
            </span>
          </button>

          {/* Bills */}
          <button
            onClick={() => onTabChange('bills')}
            className={`flex flex-col items-center justify-center py-1 text-[11px] font-medium transition ${
              currentTab === 'bills' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <ReceiptText className="w-5 h-5 mb-0.5" />
            <span>Bills</span>
          </button>

          {/* More Menu (Opens Inventory / P&L / Settings) */}
          <button
            onClick={() => onTabChange(currentTab === 'inventory' ? 'profit-loss' : (currentTab === 'profit-loss' ? 'settings' : 'inventory'))}
            className={`flex flex-col items-center justify-center py-1 text-[11px] font-medium transition ${
              ['inventory', 'stock-purchase', 'profit-loss', 'expenses', 'settings'].includes(currentTab)
                ? 'text-amber-400 font-bold'
                : 'text-slate-400'
            }`}
          >
            <Boxes className="w-5 h-5 mb-0.5" />
            <span className="capitalize">{['inventory', 'stock-purchase', 'profit-loss', 'expenses', 'settings'].includes(currentTab) ? currentTab : 'More'}</span>
          </button>
        </div>
      </nav>
    </>
  );
};
