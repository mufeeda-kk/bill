import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Check, AlertCircle, ArrowRight } from 'lucide-react';
import { SHOP_PHONE_SLOTS } from '../../lib/deviceAuth';

export const DeviceEnrollmentModal: React.FC = () => {
  const { enrollDevice, isEnrolled } = useStore();

  const [selectedSlot, setSelectedSlot] = useState<string>(SHOP_PHONE_SLOTS[0].name);
  const [customName, setCustomName] = useState<string>('');
  const [passcode, setPasscode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (isEnrolled) return null;

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = customName.trim() || selectedSlot;
    if (!passcode.trim()) {
      return setErrorMsg('Please enter the shop enrollment passcode');
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await enrollDevice(finalName, passcode.trim());
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.message || 'Enrollment failed. Check passcode.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 animate-in fade-in zoom-in-95">
        <div className="text-center pb-4 border-b border-slate-100">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-2.5 border border-slate-200 shadow-sm p-1.5 overflow-hidden">
            <img 
              src="/logo.jpg" 
              alt="Vintage Clothing Store" 
              className="w-full h-full object-contain"
            />
          </div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            VINTAGE CLOTHING STORE
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            One-Time Shop Phone Setup (No Daily Login Required)
          </p>
        </div>

        <form onSubmit={handleEnroll} className="space-y-4 pt-4 text-xs">
          {errorMsg && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-bold">{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="font-bold text-slate-800 block mb-1.5">
              Select Phone Role (1 of 3 Authorized Phones)
            </label>
            <div className="space-y-2">
              {SHOP_PHONE_SLOTS.map((slot) => {
                const isSelected = selectedSlot === slot.name && !customName;
                return (
                  <button
                    key={slot.slot}
                    type="button"
                    onClick={() => {
                      setSelectedSlot(slot.name);
                      setCustomName('');
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left font-semibold transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-50 border-amber-500 text-amber-950 ring-1 ring-amber-500'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{slot.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-amber-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Or Custom Device Name
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Counter iPad or Floor Tablet"
              className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Shop Master Passcode *
            </label>
            <input
              type="password"
              required
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Default: VCS786"
              className="w-full px-3 py-2 border rounded-xl text-sm font-mono font-bold tracking-widest text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              This passcode registers this device in the central store database. Once enrolled, you will go straight to billing without logging in again.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-sm shadow-md transition active:scale-95 flex items-center justify-center space-x-1.5 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Registering Device...' : 'AUTHORIZE & OPEN STORE'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
