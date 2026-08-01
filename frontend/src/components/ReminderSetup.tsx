import { useState, useEffect } from 'react';
import { useReminderStore } from '../store/useReminderStore';
import type { Reminder } from '../store/useReminderStore';
import { 
  Plus, Trash2, Edit2, Clock, Check, AlertCircle, Loader2, X 
} from 'lucide-react';

interface ReminderSetupProps {
  medicineId: string;
  profileId: string;
  defaultUnit?: string;
  defaultAmount?: number;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Su' },
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Tu' },
  { value: 3, label: 'We' },
  { value: 4, label: 'Th' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' }
];

export const ReminderSetup = ({ medicineId, profileId, defaultUnit = 'tablets', defaultAmount = 1 }: ReminderSetupProps) => {
  const { 
    reminders, 
    isLoading, 
    error, 
    fetchRemindersByMedicine, 
    createReminder, 
    updateReminder, 
    deleteReminder, 
    toggleReminder,
    clearError 
  } = useReminderStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [doseAmount, setDoseAmount] = useState(String(defaultAmount));
  const [doseUnit, setDoseUnit] = useState(defaultUnit);
  const [instruction, setInstruction] = useState<'NONE' | 'BEFORE_FOOD' | 'AFTER_FOOD' | 'EMPTY_STOMACH'>('NONE');
  const [repeatType, setRepeatType] = useState<'DAILY' | 'WEEKLY' | 'CUSTOM_INTERVAL' | 'COURSE'>('DAILY');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [intervalDays, setIntervalDays] = useState('2');
  const [durationDays, setDurationDays] = useState('5'); // helper for COURSE mode
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [times, setTimes] = useState<string[]>(['08:00']);

  useEffect(() => {
    fetchRemindersByMedicine(medicineId);
    clearError();
  }, [medicineId, fetchRemindersByMedicine, clearError]);

  const handleAddTime = () => {
    setTimes(prev => [...prev, '12:00']);
  };

  const handleRemoveTime = (index: number) => {
    if (times.length > 1) {
      setTimes(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleTimeChange = (index: number, val: string) => {
    setTimes(prev => prev.map((t, i) => i === index ? val : t));
  };

  const handleDayToggle = (day: number) => {
    setDaysOfWeek(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const resetForm = () => {
    setDoseAmount(String(defaultAmount));
    setDoseUnit(defaultUnit);
    setInstruction('NONE');
    setRepeatType('DAILY');
    setDaysOfWeek([]);
    setIntervalDays('2');
    setDurationDays('5');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setTimes(['08:00']);
    setIsEditing(false);
    setEditingId(null);
    clearError();
  };

  const handleStartEdit = (reminder: Reminder) => {
    setEditingId(reminder.id || null);
    setDoseAmount(String(reminder.doseAmount));
    setDoseUnit(reminder.doseUnit);
    setInstruction(reminder.instruction);
    setRepeatType(reminder.repeatType);
    setDaysOfWeek(reminder.daysOfWeek || []);
    setIntervalDays(String(reminder.intervalDays || 2));
    setStartDate(reminder.startDate ? new Date(reminder.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    
    if (reminder.repeatType === 'COURSE' && reminder.startDate && reminder.endDate) {
      const s = new Date(reminder.startDate);
      const e = new Date(reminder.endDate);
      const diffTime = e.getTime() - s.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDurationDays(String(diffDays));
    } else {
      setEndDate(reminder.endDate ? new Date(reminder.endDate).toISOString().split('T')[0] : '');
    }

    setTimes(reminder.times || ['08:00']);
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    let finalEndDate = endDate ? new Date(endDate).toISOString() : null;
    let finalInterval = null;
    let finalDays: number[] = [];

    if (repeatType === 'WEEKLY') {
      finalDays = daysOfWeek;
      if (finalDays.length === 0) {
        alert("Please select at least one day of the week.");
        return;
      }
    } else if (repeatType === 'CUSTOM_INTERVAL') {
      finalInterval = parseInt(intervalDays);
    } else if (repeatType === 'COURSE') {
      const duration = parseInt(durationDays);
      const sDate = new Date(startDate);
      sDate.setDate(sDate.getDate() + duration);
      finalEndDate = sDate.toISOString();
    }

    const payload: Reminder = {
      profileId,
      medicineId,
      doseAmount: parseFloat(doseAmount),
      doseUnit,
      instruction,
      repeatType,
      daysOfWeek: finalDays,
      intervalDays: finalInterval,
      startDate: new Date(startDate).toISOString(),
      endDate: finalEndDate,
      times: times.filter(t => t.trim() !== '')
    };

    let success = false;
    if (editingId) {
      success = await updateReminder(editingId, payload);
    } else {
      success = await createReminder(payload);
    }

    if (success) {
      resetForm();
    }
  };

  const formatRepeatType = (r: Reminder) => {
    switch (r.repeatType) {
      case 'DAILY':
        return 'Every day';
      case 'WEEKLY':
        const days = r.daysOfWeek.map(d => DAYS_OF_WEEK.find(item => item.value === d)?.label).join(', ');
        return `Weekly on: ${days}`;
      case 'CUSTOM_INTERVAL':
        return `Every ${r.intervalDays} days`;
      case 'COURSE':
        const endStr = r.endDate ? new Date(r.endDate).toLocaleDateString() : 'end';
        return `Course-based (until ${endStr})`;
      default:
        return r.repeatType;
    }
  };

  const formatInstruction = (inst: string) => {
    switch (inst) {
      case 'BEFORE_FOOD':
        return 'Before food';
      case 'AFTER_FOOD':
        return 'After food';
      case 'EMPTY_STOMACH':
        return 'Empty stomach';
      default:
        return 'No specific food instructions';
    }
  };

  return (
    <div className="space-y-6">
      
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Reminder Listing */}
      {!isEditing && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Active Schedule</h3>
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <Plus size={14} /> Add Reminder
            </button>
          </div>

          {reminders.length === 0 ? (
            <div className="bg-slate-100/50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl py-8 text-center">
              <Clock className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No dose reminders scheduled for this medicine.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((r) => (
                <div 
                  key={r.id} 
                  className={`p-4 rounded-2xl border transition-all ${
                    r.isActive 
                      ? 'bg-slate-100/50 dark:bg-white/5 border-slate-200 dark:border-white/10' 
                      : 'bg-slate-100/20 dark:bg-white/2 opacity-60 border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                          Take {r.doseAmount} {r.doseUnit}
                        </span>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md font-semibold">
                          {formatRepeatType(r)}
                        </span>
                      </div>
                      
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatInstruction(r.instruction)}
                      </p>

                      <div className="flex items-center gap-1.5 pt-1.5">
                        <Clock size={12} className="text-primary shrink-0" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {r.times.join(', ')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Toggle status switch */}
                      <button
                        onClick={() => toggleReminder(r.id!)}
                        className={`w-10 h-6 rounded-full transition-all relative ${
                          r.isActive ? 'bg-primary' : 'bg-slate-300 dark:bg-white/10'
                        } cursor-pointer`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                          r.isActive ? 'left-5' : 'left-1'
                        }`} />
                      </button>
                      
                      <button
                        onClick={() => handleStartEdit(r)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                        title="Edit Reminder"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm("Are you sure you want to remove this reminder?")) {
                            deleteReminder(r.id!);
                          }
                        }}
                        className="p-1.5 text-red-500 hover:text-red-600 rounded-lg hover:bg-red-500/5 cursor-pointer"
                        title="Delete Reminder"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reminder Add/Edit Form */}
      {isEditing && (
        <form onSubmit={handleSubmit} className="space-y-4 bg-slate-100/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl animate-in slide-in-from-top-4 duration-200">
          <div className="flex justify-between items-center mb-2 border-b border-slate-200 dark:border-white/5 pb-2">
            <h4 className="font-bold text-sm text-slate-950 dark:text-white">
              {editingId ? 'Edit Reminder Details' : 'Create Dose Reminder'}
            </h4>
            <button 
              type="button" 
              onClick={resetForm}
              className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Dosage amount */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Dosage Amount</label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={doseAmount}
                onChange={(e) => setDoseAmount(e.target.value)}
                className="block w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            {/* Dosage unit */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Dosage Unit</label>
              <input
                type="text"
                required
                placeholder="e.g. tablet, ml"
                value={doseUnit}
                onChange={(e) => setDoseUnit(e.target.value)}
                className="block w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            {/* Instruction */}
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Food Instruction</label>
              <select
                value={instruction}
                onChange={(e: any) => setInstruction(e.target.value)}
                className="block w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none"
              >
                <option value="NONE" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">No instructions / General</option>
                <option value="BEFORE_FOOD" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">🟢 Before food (empty stomach)</option>
                <option value="AFTER_FOOD" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">🟡 After food (with/after meal)</option>
                <option value="EMPTY_STOMACH" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">🔴 On empty stomach</option>
              </select>
            </div>

            {/* Repeat pattern */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Repeat Pattern</label>
              <select
                value={repeatType}
                onChange={(e: any) => setRepeatType(e.target.value)}
                className="block w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none"
              >
                <option value="DAILY" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Every Day</option>
                <option value="WEEKLY" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Specific Days of Week</option>
                <option value="CUSTOM_INTERVAL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Custom Interval (Every X days)</option>
                <option value="COURSE" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Course-Based Treatment</option>
              </select>
            </div>

            {/* Start Date */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            {/* Conditional fields based on repeat type */}
            {repeatType === 'WEEKLY' && (
              <div className="space-y-1 sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Select Days</label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS_OF_WEEK.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => handleDayToggle(d.value)}
                      className={`h-9 w-9 text-xs font-bold rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                        daysOfWeek.includes(d.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-white/30 dark:bg-black/20 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-200'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {repeatType === 'CUSTOM_INTERVAL' && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Repeat Interval (Days)</label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min="1"
                    required
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(e.target.value)}
                    className="block w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                  <span className="absolute right-3 text-xs text-slate-400 pointer-events-none select-none">days</span>
                </div>
              </div>
            )}

            {repeatType === 'COURSE' && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Treatment Duration (Days)</label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min="1"
                    required
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    className="block w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                  <span className="absolute right-3 text-xs text-slate-400 pointer-events-none select-none">days</span>
                </div>
              </div>
            )}

            {/* Custom End Date (Optional for DAILY/WEEKLY/INTERVAL) */}
            {repeatType !== 'COURSE' && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">End Date (Optional)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="block w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>
            )}

            {/* Alarm Times */}
            <div className="space-y-2 sm:col-span-2 border-t border-slate-200 dark:border-white/5 pt-3 mt-1">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <Clock size={12} /> Reminder Alarm Times
                </label>
                <button
                  type="button"
                  onClick={handleAddTime}
                  className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus size={12} /> Add Time
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
                {times.map((t, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <input
                      type="time"
                      required
                      value={t}
                      onChange={(e) => handleTimeChange(idx, e.target.value)}
                      className="block w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                    {times.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTime(idx)}
                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-white/5 mt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-all hover:bg-slate-200 dark:hover:bg-white/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="animate-spin h-3 w-3" />
              ) : (
                <Check size={14} />
              )}
              {editingId ? 'Update Schedule' : 'Save Schedule'}
            </button>
          </div>
        </form>
      )}

    </div>
  );
};
