import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Wallet, Trash2, AlertCircle } from 'lucide-react';
import { formatCurrency, formatKolkataDateTime } from '../../lib/formatters';

const EXPENSE_CATEGORIES = [
  'Shop Rent',
  'Electricity',
  'Transport',
  'Staff Expenses',
  'Packaging',
  'Refreshments',
  'Repairs & Maintenance',
  'Other',
];

export const ExpenseScreen: React.FC = () => {
  const { expenses, addExpense, deleteExpense } = useStore();

  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return setErrorMsg('Amount must be greater than 0');
    if (!description.trim()) return setErrorMsg('Description is required');

    setIsSubmitting(true);
    await addExpense({
      category,
      amount: amt,
      description,
      expense_date: new Date(expenseDate).toISOString(),
      reference_no: referenceNo || undefined,
    });
    setIsSubmitting(false);

    setAmount('');
    setDescription('');
    setReferenceNo('');
    setErrorMsg(null);
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-500" />
            <span>Shop Expense Management</span>
          </h2>
          <p className="text-xs text-slate-500">
            Record day-to-day shop operating costs for accurate net profit calculation
          </p>
        </div>

        <div className="bg-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-xl text-xs font-bold text-rose-800 self-start sm:self-auto">
          Total Recorded Expenses: {formatCurrency(totalExpenses, false)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Add Expense Form */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 text-sm mb-3">Add New Expense</h3>

          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            {errorMsg && (
              <div className="p-2 bg-red-50 text-red-700 rounded-lg flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="font-bold text-slate-700 block mb-1">Expense Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-2.5 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 1500"
                className="w-full px-3 py-2 border font-bold text-sm text-slate-900 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Date</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Description / Notes *</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. May electricity bill or shopping carry bags"
                className="w-full px-2.5 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Receipt / Ref # (Optional)</label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. Bill #8491"
                className="w-full px-2.5 py-1.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Record Expense'}
            </button>
          </form>
        </div>

        {/* Expense History Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Recorded Expenses History</h3>
            <span className="text-xs text-slate-400">{expenses.length} records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {formatKolkataDateTime(exp.expense_date)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      {exp.category}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                      {exp.description}
                      {exp.reference_no && (
                        <span className="font-mono text-[10px] text-slate-400 ml-1">({exp.reference_no})</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-black text-rose-600">
                      {formatCurrency(exp.amount, false)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => deleteExpense(exp.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No expenses logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
