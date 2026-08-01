import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useReminderStore } from '../store/useReminderStore';
import { useMedicineStore } from '../store/useMedicineStore';
import { ReminderSetup } from '../components/ReminderSetup';
import { 
  Clock, X, Trash2, Activity, Award, CheckCircle2, Loader2, RefreshCw, Plus 
} from 'lucide-react';

export const Reminders = () => {
  const { profiles, fetchProfiles, activeProfileId, setActiveProfileId } = useAuthStore();
  const { 
    reminders, 
    doseLogs, 
    fetchRemindersByProfile, 
    fetchDoseLogs, 
    deleteReminder, 
    toggleReminder,
    isLoading 
  } = useReminderStore();
  
  const { medicines, fetchMedicines } = useMedicineStore();
  const [activeTab, setActiveTab] = useState<'schedule' | 'history'>('schedule');

  // Add/Edit modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedMedId, setSelectedMedId] = useState('');
  const [selectedMedUnit, setSelectedMedUnit] = useState('tablets');
  const [selectedMedAmount, setSelectedMedAmount] = useState(1);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);



  // Load reminders, dose logs, and medicines for the active profile
  useEffect(() => {
    if (activeProfileId) {
      fetchRemindersByProfile(activeProfileId);
      fetchDoseLogs(activeProfileId);
      fetchMedicines(activeProfileId);
    }
  }, [activeProfileId, fetchRemindersByProfile, fetchDoseLogs, fetchMedicines]);

  // Calculate adherence statistics
  const stats = useMemo(() => {
    if (doseLogs.length === 0) {
      return { rate: 100, taken: 0, skipped: 0, total: 0 };
    }
    const total = doseLogs.length;
    const taken = doseLogs.filter((log) => log.status === 'TAKEN').length;
    const skipped = doseLogs.filter((log) => log.status === 'SKIPPED').length;
    const rate = Math.round((taken / total) * 100);
    return { rate, taken, skipped, total };
  }, [doseLogs]);

  const handleOpenAdd = () => {
    if (medicines.length === 0) {
      alert("Please add medicines to your cabinet first before setting up reminders.");
      return;
    }
    // Prefill first medicine
    setSelectedMedId(medicines[0].id || '');
    setSelectedMedUnit(medicines[0].dosageUnit || 'tablets');
    setSelectedMedAmount(medicines[0].dosageAmount || 1);
    setIsAddOpen(true);
  };

  const handleMedChange = (medId: string) => {
    const med = medicines.find(m => m.id === medId);
    if (med) {
      setSelectedMedId(medId);
      setSelectedMedUnit(med.dosageUnit || 'tablets');
      setSelectedMedAmount(med.dosageAmount || 1);
    }
  };

  const formatRepeatType = (repeatType: string, daysOfWeek: number[], intervalDays: number | null | undefined, endDate: string | null | undefined) => {
    switch (repeatType) {
      case 'DAILY':
        return 'Every day';
      case 'WEEKLY':
        const days = daysOfWeek.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
        return `Weekly on: ${days}`;
      case 'CUSTOM_INTERVAL':
        return `Every ${intervalDays} days`;
      case 'COURSE':
        const endStr = endDate ? new Date(endDate).toLocaleDateString() : 'end';
        return `Course (until ${endStr})`;
      default:
        return repeatType;
    }
  };

  const getDoseStatusBadge = (status: string) => {
    switch (status) {
      case 'TAKEN':
        return 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400';
      case 'SKIPPED':
        return 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400';
      default:
        return 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500';
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      
      {/* Action bar */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manage schedules and adherence history.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all cursor-pointer"
        >
          <Plus size={15} />
          Create
        </button>
      </div>

      {/* Profiles tabs */}
      {profiles.length > 1 && (
        <div className="flex border-b border-slate-200 dark:border-white/10 mb-8 overflow-x-auto gap-4 scrollbar-none">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveProfileId(p.id)}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                activeProfileId === p.id
                  ? 'border-primary text-slate-950 dark:text-white font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              {p.fullName} ({p.relation})
            </button>
          ))}
        </div>
      )}

      {/* Stats Cards Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Adherence Rate */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-white/5 flex items-center gap-4 hover:shadow-lg transition-all">
          <div className="p-3 bg-green-500/10 text-green-500 rounded-2xl">
            <Award size={32} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Intake Adherence</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.rate}%</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Target adherence rate is 90%+</p>
          </div>
        </div>

        {/* Doses Taken */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-white/5 flex items-center gap-4 hover:shadow-lg transition-all">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Doses Logged</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.taken} <span className="text-sm font-normal text-slate-400">/ {stats.total} total</span></h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Taken vs skipped dose records</p>
          </div>
        </div>

        {/* Total Reminders */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-white/5 flex items-center gap-4 hover:shadow-lg transition-all">
          <div className="p-3 bg-purple-500/10 text-purple-500 rounded-2xl">
            <Clock size={32} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Active Schedules</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {reminders.filter(r => r.isActive).length} <span className="text-sm font-normal text-slate-400">/ {reminders.length} total</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Scheduled alarms currently active</p>
          </div>
        </div>
      </div>

      {/* Main View Tabs */}
      <div className="flex border-b border-slate-200 dark:border-white/10 mb-6 gap-6">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'schedule'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Active Schedule
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Adherence Log
        </button>
      </div>

      {/* Conditional views */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="animate-spin h-10 w-10 text-primary" />
          <p className="text-slate-500 dark:text-slate-400">Loading schedule...</p>
        </div>
      ) : activeTab === 'schedule' ? (
        /* Schedule List */
        reminders.length === 0 ? (
          <div className="glass-panel text-center py-20 rounded-3xl">
            <Clock className="mx-auto h-12 w-12 text-slate-400 mb-4 animate-pulse" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No reminders created</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">Create your first medicine schedule to receive alarms and check-ins.</p>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <Plus size={20} />
              Setup First Schedule
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {reminders.map((r) => {
              const foodInst = r.instruction === 'BEFORE_FOOD' 
                ? 'Before food' 
                : r.instruction === 'AFTER_FOOD' 
                  ? 'After food' 
                  : r.instruction === 'EMPTY_STOMACH' 
                    ? 'Empty stomach' 
                    : '';

              return (
                <div 
                  key={r.id}
                  className={`glass-panel rounded-3xl p-6 border flex flex-col justify-between hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 ${
                    r.isActive 
                      ? 'border-slate-200 dark:border-white/5 hover:border-primary/20' 
                      : 'border-transparent bg-slate-100/30 dark:bg-white/2 opacity-65'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-200/50 dark:bg-white/10 text-slate-800 dark:text-slate-200">
                        {r.medicine?.type || 'medicine'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        r.isActive 
                          ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' 
                          : 'bg-slate-500/10 border-slate-500/20 text-slate-500'
                      }`}>
                        {r.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                      {r.medicine?.name || 'Aspirin'}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                      Dosage: <span className="font-semibold text-slate-700 dark:text-slate-300">{r.doseAmount} {r.doseUnit}</span>
                    </p>

                    <div className="space-y-2 border-t border-slate-150 dark:border-white/5 pt-4">
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <RefreshCw size={14} className="text-primary shrink-0" />
                        <span>Repeat: <span className="font-semibold">{formatRepeatType(r.repeatType, r.daysOfWeek, r.intervalDays, r.endDate)}</span></span>
                      </div>
                      
                      {foodInst && (
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <Activity size={14} className="text-primary shrink-0" />
                          <span>Intake: <span className="font-semibold">{foodInst}</span></span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <Clock size={14} className="text-primary shrink-0" />
                        <span>Times: <span className="font-bold text-primary">{r.times.join(', ')}</span></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-150 dark:border-white/5">
                    {/* Toggle Switch */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleReminder(r.id!)}
                        className={`w-9 h-5.5 rounded-full transition-all relative ${
                          r.isActive ? 'bg-primary' : 'bg-slate-300 dark:bg-white/10'
                        } cursor-pointer`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-1 transition-all ${
                          r.isActive ? 'left-4.5' : 'left-1'
                        }`} />
                      </button>
                      <span className="text-xs text-slate-500 font-semibold">{r.isActive ? 'Pause' : 'Activate'}</span>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          if (window.confirm("Are you sure you want to delete this reminder schedule?")) {
                            deleteReminder(r.id!);
                          }
                        }}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                        title="Delete Reminder"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Adherence History Log */
        doseLogs.length === 0 ? (
          <div className="glass-panel text-center py-20 rounded-3xl">
            <Activity className="mx-auto h-12 w-12 text-slate-400 mb-4 animate-pulse" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No adherence logs yet</h2>
            <p className="text-slate-500 dark:text-slate-400">Dose logs appear here as you click Taken or Skip on reminders.</p>
          </div>
        ) : (
          <div className="glass-panel rounded-3xl overflow-hidden border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/10">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-white/5 text-left text-sm">
                <thead className="bg-slate-50 dark:bg-black/35 text-xs text-slate-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-6 py-4">Medicine</th>
                    <th className="px-6 py-4">Scheduled For</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Logged At</th>
                    <th className="px-6 py-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-slate-700 dark:text-slate-300">
                  {doseLogs.map((log) => {
                    const medicineName = log.reminder?.medicine?.name || 'Medicine';
                    const type = log.reminder?.medicine?.type || '';
                    const doseInfo = `${log.reminder?.doseAmount || ''} ${log.reminder?.doseUnit || ''}`;
                    return (
                      <tr key={log.id} className="hover:bg-slate-100/50 dark:hover:bg-white/2 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                          <div>{medicineName}</div>
                          <span className="text-[10px] text-slate-400 font-normal uppercase tracking-wider">{type} • {doseInfo}</span>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {new Date(log.scheduledAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getDoseStatusBadge(log.status)}`}>
                            {log.status === 'TAKEN' ? 'Taken' : log.status === 'SKIPPED' ? 'Skipped' : log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {log.respondedAt ? new Date(log.respondedAt).toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {log.snoozeCount > 0 ? `Snoozed x${log.snoozeCount}` : 'Direct response'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Add Reminder Modal Dialog */}
      {isAddOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setIsAddOpen(false)}
        >
          <div 
            className="w-full max-w-2xl rounded-3xl p-6 md:p-8 relative bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setIsAddOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>

            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-6 pr-8">
              Create New Reminder Schedule
            </h2>

            {/* Medicine Selection Select Dropdown */}
            <div className="space-y-2 mb-6">
              <label htmlFor="medicineSelect" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Select Medicine from Cabinet
              </label>
              <select
                id="medicineSelect"
                value={selectedMedId}
                onChange={(e) => handleMedChange(e.target.value)}
                className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none"
              >
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.type} • {m.dosageAmount} {m.dosageUnit} available)
                  </option>
                ))}
              </select>
            </div>

            {/* Embedded ReminderSetup Form */}
            <div className="border-t border-slate-200 dark:border-white/5 pt-6">
              <ReminderSetup 
                key={selectedMedId}
                medicineId={selectedMedId}
                profileId={activeProfileId || ""}
                defaultUnit={selectedMedUnit}
                defaultAmount={selectedMedAmount}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
