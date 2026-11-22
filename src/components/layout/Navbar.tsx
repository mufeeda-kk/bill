import React from 'react';
import { 
  LayoutDashboard, ShoppingCart, Shirt, Boxes, 
  ReceiptText, TrendingUp, Settings 
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange }) => {
  const { cart } = useStore();

  const desktopNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'billing', label: 'Billing POS', icon: ShoppingCart, badge: cart.length > 0 ? cart.length : null },
    { id: 'products', label: 'Products', icon: Shirt },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'bills', label: 'Bill History', icon: ReceiptText },
    { id: 'model-sales', label: 'Model Sales', icon: TrendingUp },
    { id: 'profit-loss', label: 'P & L Statement', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Desktop & Tablet Top Navigation Bar */}
      <nav className="hidden md:block bg-slate-900 border-b border-slate-800 sticky top-[53px] z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex space-x-1 py-1.5 overflow-x-auto scrollbar-none">
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge !== null && item.badge !== undefined && (
                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black ml-1">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar: Exactly 4 Clean Items (Home | Billing | Products | History) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 z-50 pb-safe shadow-2xl">
        <div className="grid grid-cols-4 h-16 items-center px-2">
          {/* 1. Home (Dashboard) */}
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex flex-col items-center justify-center py-1 text-[11px] font-bold transition ${
              currentTab === 'dashboard' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span>Home</span>
          </button>

          {/* 2. Billing (Central Hero) */}
          <button
            onClick={() => onTabChange('billing')}
            className="flex flex-col items-center justify-center -mt-5 relative"
          >
            <div className={`w-13 h-13 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-950 transition active:scale-95 ${
              currentTab === 'billing' ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-400/50' : 'bg-amber-500 text-slate-950'
            }`}>
              <ShoppingCart className="w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute top-0 right-1 bg-rose-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-slate-950">
                  {cart.length}
                </span>
              )}
            </div>
            <span className={`text-[10px] font-black mt-1 uppercase ${
              currentTab === 'billing' ? 'text-amber-400' : 'text-slate-300'
            }`}>
              Billing
            </span>
          </button>

          {/* 3. Products */}
          <button
            onClick={() => onTabChange('products')}
            className={`flex flex-col items-center justify-center py-1 text-[11px] font-bold transition ${
              currentTab === 'products' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shirt className="w-5 h-5 mb-0.5" />
            <span>Products</span>
          </button>

          {/* 4. History */}
          <button
            onClick={() => onTabChange('bills')}
            className={`flex flex-col items-center justify-center py-1 text-[11px] font-bold transition ${
              currentTab === 'bills' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ReceiptText className="w-5 h-5 mb-0.5" />
            <span>History</span>
          </button>
        </div>
      </nav>
    </>
  );
};
