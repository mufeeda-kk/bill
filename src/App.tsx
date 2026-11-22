import React, { useState } from 'react';
import { useStore } from './context/StoreContext';
import { Header } from './components/layout/Header';
import { Navbar } from './components/layout/Navbar';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { BillingScreen } from './components/billing/BillingScreen';
import { ProductScreen } from './components/products/ProductScreen';
import { InventoryScreen } from './components/inventory/InventoryScreen';
import { StockPurchaseScreen } from './components/stock/StockPurchaseScreen';
import { BillHistoryScreen } from './components/bills/BillHistoryScreen';
import { ProfitLossScreen } from './components/profitloss/ProfitLossScreen';
import { ExpenseScreen } from './components/expenses/ExpenseScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { InvoiceModal } from './components/billing/InvoiceModal';
import { DeviceEnrollmentModal } from './components/auth/DeviceEnrollmentModal';
import { Bill } from './types';

export const App: React.FC = () => {
  const { settings, lastCompletedBill, setLastCompletedBill } = useStore();
  const [currentTab, setCurrentTab] = useState<string>('billing'); // Default to fast POS billing
  const [viewingBill, setViewingBill] = useState<Bill | null>(null);

  const activeBillModal = viewingBill || lastCompletedBill;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* One-Time Device Enrollment Modal (only if phone is not yet enrolled) */}
      <DeviceEnrollmentModal />

      {/* Top Application Header */}
      <Header onNavigate={(tab) => setCurrentTab(tab)} />

      {/* Top/Bottom Navigation Bar */}
      <Navbar currentTab={currentTab} onTabChange={(tab) => setCurrentTab(tab)} />

      {/* Main Screen Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 overflow-x-hidden">
        {currentTab === 'dashboard' && (
          <DashboardScreen
            onNavigate={(tab) => setCurrentTab(tab)}
            onSelectBill={(b) => setViewingBill(b)}
          />
        )}

        {currentTab === 'billing' && (
          <BillingScreen
            onBillSuccess={() => {
              // lastCompletedBill in StoreContext triggers InvoiceModal automatically
            }}
          />
        )}

        {currentTab === 'products' && <ProductScreen />}

        {currentTab === 'inventory' && <InventoryScreen />}

        {currentTab === 'stock-purchase' && <StockPurchaseScreen />}

        {currentTab === 'bills' && (
          <BillHistoryScreen
            onSelectBill={(b) => setViewingBill(b)}
          />
        )}

        {currentTab === 'profit-loss' && <ProfitLossScreen />}

        {currentTab === 'expenses' && <ExpenseScreen />}

        {currentTab === 'settings' && <SettingsScreen />}
      </main>

      {/* Completed Invoice / Thermal Receipt / WhatsApp Share Modal */}
      {activeBillModal && (
        <InvoiceModal
          bill={activeBillModal}
          settings={settings}
          onClose={() => {
            setViewingBill(null);
            setLastCompletedBill(null);
          }}
          onNewBill={() => {
            setViewingBill(null);
            setLastCompletedBill(null);
            setCurrentTab('billing');
          }}
        />
      )}
    </div>
  );
};

export default App;
