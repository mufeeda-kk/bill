import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  Smartphone, ShieldCheck, Download, Upload, 
  CheckCircle, Store, LogOut, AlertTriangle, Database, Trash2 
} from 'lucide-react';
import { storeService } from '../../services/storeService';
import { formatKolkataDateTime } from '../../lib/formatters';
import { isSupabaseConfigured, getSupabaseCredentials } from '../../lib/supabase';
import { DatabaseConfigModal } from './DatabaseConfigModal';

export const SettingsScreen: React.FC = () => {
  const { 
    settings, updateSettings, authorizedDevices, 
    revokeDevice, currentDevice, logoutDevice, refreshData, clearAllBills 
  } = useStore();

  const [clearPasscode, setClearPasscode] = useState('');
  const [isClearingBills, setIsClearingBills] = useState(false);
  const [clearBillsStatus, setClearBillsStatus] = useState<string | null>(null);

  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const currentCreds = getSupabaseCredentials();

  const [storeName, setStoreName] = useState(settings.store_name || 'VINTAGE CLOTHING STORE');
  const [tagline, setTagline] = useState(settings.tagline || 'Exclusive Men & Women Fashion');
  const [phone, setPhone] = useState(settings.phone || '+91 98765 43210');
  const [address, setAddress] = useState(settings.address || 'Shop #4, Market Road, Kerala, India');
  const [upiId, setUpiId] = useState(settings.upi_id || 'vintageclothing@upi');
  const [enrollmentPasscode, setEnrollmentPasscode] = useState(settings.enrollment_passcode || 'VCS786');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  const handleSaveStoreInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      store_name: storeName,
      tagline,
      phone,
      address,
      upi_id: upiId,
      enrollment_passcode: enrollmentPasscode,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDownloadBackup = () => {
    const jsonStr = storeService.exportDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VCS_Store_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBackupNotice('Store data backup downloaded successfully to your device.');
    setTimeout(() => setBackupNotice(null), 5000);
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const ok = storeService.importDataJSON(text);
      if (ok) {
        await refreshData();
        setBackupNotice('Store data restored successfully!');
      } else {
        setBackupNotice('Failed to restore backup: Invalid JSON format.');
      }
      setTimeout(() => setBackupNotice(null), 5000);
    };
    reader.readAsText(file);
  };

  const activeDeviceCount = authorizedDevices.filter((d) => d.is_active).length;
  const maxDevices = settings.max_authorized_devices || 3;

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Top Header */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Store className="w-5 h-5 text-amber-500" />
            <span>Store Configuration & Security</span>
          </h2>
          <p className="text-xs text-slate-500">
            Manage store details, 3-device authorization, and offline data backups
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">Store settings saved successfully!</span>
        </div>
      )}

      {backupNotice && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-bold">{backupNotice}</span>
        </div>
      )}

      {/* Central Database Connection Card */}
      <div className={`p-4 rounded-xl border transition shadow-sm ${
        isSupabaseConfigured
          ? 'bg-emerald-950/20 border-emerald-500/40'
          : 'bg-amber-500/10 border-amber-500/40'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isSupabaseConfigured
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
            }`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-900 text-sm">Central Store Database (Supabase)</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isSupabaseConfigured
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                }`}>
                  {isSupabaseConfigured ? 'CONNECTED & SYNCING' : 'NOT CONNECTED (LOCAL ISOLATION)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSupabaseConfigured
                  ? `Central PostgreSQL active: ${currentCreds.url.replace(/^https:\/\//, '').slice(0, 24)}... (All 3 phones share same bills & stock)`
                  : '⚠️ Devices currently operate as independent islands! Connect Supabase to sync bills across all 3 shop phones.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDbModalOpen(true)}
            className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
              isSupabaseConfigured
                ? 'bg-slate-900 hover:bg-slate-800 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
            }`}
          >
            {isSupabaseConfigured ? 'Manage Connection' : 'Connect Central Database'}
          </button>
        </div>
      </div>

      {/* Grid: Store Info & Device Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Store Profile Info */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-1.5">
            <Store className="w-4 h-4 text-slate-700" />
            <span>Store Profile & Invoicing Info</span>
          </h3>

          <form onSubmit={handleSaveStoreInfo} className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Store Name</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Tagline</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">UPI ID (For QR/Billing)</label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Shop Address</label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 flex items-center justify-between mb-1">
                <span>Shop Phone Enrollment Passcode</span>
                <span className="text-amber-700 font-mono font-bold">Confidential</span>
              </label>
              <input
                type="text"
                value={enrollmentPasscode}
                onChange={(e) => setEnrollmentPasscode(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 font-mono font-black tracking-widest text-sm"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Entered once when enrolling the 3 shop phones. No daily password needed.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-md transition active:scale-95"
            >
              Save Store Profile
            </button>
          </form>
        </div>

        {/* 3-Device Authorization & Management */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-slate-700" />
                <span>Authorized Shop Phones ({activeDeviceCount} of {maxDevices})</span>
              </h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                activeDeviceCount <= maxDevices ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}>
                {maxDevices - activeDeviceCount} Slots Available
              </span>
            </div>

            <p className="text-[11px] text-slate-500">
              Staff phones are authorized once and never require daily logins. If a phone is lost or replaced, revoke its authorization below to free up a slot.
            </p>

            {/* List of Enrolled Devices */}
            <div className="space-y-2 pt-1">
              {authorizedDevices.map((dev) => {
                const isCurrent = currentDevice?.token === dev.device_token;
                return (
                  <div
                    key={dev.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                      !dev.is_active
                        ? 'bg-slate-50 border-slate-200 opacity-60'
                        : isCurrent
                        ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{dev.device_name}</span>
                        {isCurrent && (
                          <span className="bg-amber-200 text-amber-900 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                            THIS PHONE
                          </span>
                        )}
                        {!dev.is_active && (
                          <span className="bg-rose-100 text-rose-800 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                            REVOKED
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Token: {dev.device_token.slice(0, 14)}... • Enrolled: {formatKolkataDateTime(dev.enrolled_at)}
                      </div>
                    </div>

                    {dev.is_active && (
                      <button
                        onClick={() => revokeDevice(dev.id)}
                        className="px-2.5 py-1 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg font-bold text-[11px] transition"
                        title="Revoke device access"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                );
              })}

              {authorizedDevices.length === 0 && (
                <div className="py-6 text-center text-slate-400">
                  No devices recorded yet.
                </div>
              )}
            </div>
          </div>

          {currentDevice && (
            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs">
              <span className="text-slate-500">Need to switch phone role?</span>
              <button
                onClick={logoutDevice}
                className="text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Reset This Phone Authorization</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Backup, Free Tier Limits & Recovery */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Store Data Backup & Safety Management</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Export standalone JSON backups of all products, stock batches, bills, and expenses.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Download JSON Backup */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-xs">Download Full Store Backup (JSON)</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Creates an offline copy of all product inventories, purchase batches, bills, and movements.
              </p>
            </div>
            <button
              onClick={handleDownloadBackup}
              className="mt-3 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download JSON Backup</span>
            </button>
          </div>

          {/* Restore JSON Backup */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-xs">Restore Store from Backup</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Upload a previously saved JSON backup file to restore records.
              </p>
            </div>
            <label className="mt-3 py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer transition">
              <Upload className="w-4 h-4 text-slate-600" />
              <span>Select Backup File</span>
              <input type="file" accept=".json" onChange={handleRestoreFile} className="hidden" />
            </label>
          </div>
        </div>

        {/* Start Fresh: Reset Sales & Clear Sample Bills */}
        <div className="p-4 bg-rose-50/70 rounded-xl border border-rose-200 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Reset Sales & Clear Sample Bills (Start Fresh)</span>
            </div>
          </div>
          <p className="text-rose-800 text-[11px] leading-relaxed">
            Permanently delete all sample/test bills and reset daily sales back to ₹0 across all 3 shop phones to launch real shop operations.
          </p>

          {clearBillsStatus && (
            <div className="p-2.5 bg-white border border-rose-300 rounded-lg text-rose-800 font-bold text-xs">
              {clearBillsStatus}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <input
              type="password"
              placeholder="Enter passcode (VCS786)"
              value={clearPasscode}
              onChange={(e) => setClearPasscode(e.target.value)}
              className="px-3 py-2 bg-white border border-rose-300 rounded-xl font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              type="button"
              disabled={isClearingBills}
              onClick={async () => {
                if (clearPasscode.trim() !== (settings.enrollment_passcode || 'VCS786')) {
                  setClearBillsStatus('Invalid passcode. Default is VCS786');
                  return;
                }
                setIsClearingBills(true);
                const res = await clearAllBills();
                setIsClearingBills(false);
                setClearBillsStatus(res.message || 'Bills cleared successfully');
                setClearPasscode('');
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black rounded-xl text-xs shadow-sm transition disabled:opacity-50"
            >
              {isClearingBills ? 'Clearing...' : 'Clear All Bills & Reset to ₹0'}
            </button>
          </div>
        </div>

        {/* Free Tier Transparency Advisory */}
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Hosting & Database Policy Advisory (Production Transparency)</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-900/90">
            • <strong>Vercel Commercial Terms:</strong> Vercel Hobby accounts are officially restricted to non-commercial, personal projects. For a real retail shop POS, Vercel Pro or self-hosting (e.g. VPS / Cloudflare Pages / Railway) is required for full commercial compliance. We do not automatically charge or upgrade your account.
          </p>
          <p className="text-[11px] leading-relaxed text-amber-900/90">
            • <strong>Supabase Free Tier:</strong> Free Supabase PostgreSQL databases pause after 7 days of inactivity and do not include automated daily point-in-time recovery. Regular manual backups via the JSON button above or `pg_dump` are strongly advised.
          </p>
        </div>
      </div>

      <DatabaseConfigModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        onConnected={() => refreshData()}
      />
    </div>
  );
};
