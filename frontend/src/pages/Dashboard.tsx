import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useReminderStore } from '../store/useReminderStore';
import type { Reminder } from '../store/useReminderStore';
import { useMedicineStore } from '../store/useMedicineStore';
import { calculateStockStatus } from '../utils/stockCalc';
import {
  Activity, Pill, Clock, Plus, AlertTriangle, CheckCircle2, XCircle,
  ChevronRight, Sparkles, RefreshCw, Calendar, CalendarDays,
  Package, ArrowUpRight
} from 'lucide-react';

const getLocalDateString = (date: Date) => {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTime12h = (timeStr: string) => {
  if (!timeStr) return '';
  try {
    const [hoursStr, minutesStr] = timeStr.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    if (isNaN(hours) || isNaN(minutes)) return timeStr;

    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    const displayMinutes = String(minutes).padStart(2, '0');

    if (hours === 12 && minutes === 0) return '12:00 PM';
    if (hours === 0 && minutes === 0) return '12:00 AM';

    return `${displayHours}:${displayMinutes} ${ampm}`;
  } catch {
    return timeStr;
  }
};

export const Dashboard = () => {
  const { user, profiles = [], fetchProfiles, activeProfileId, setActiveProfileId } = useAuthStore();
  const {
    reminders = [],
    doseLogs = [],
    fetchRemindersByProfile,
    fetchDoseLogs,
    logDose,
    isLoading: isReminderLoading
  } = useReminderStore();

  const {
    medicines = [],
    fetchMedicines,
    isLoading: isMedicineLoading
  } = useMedicineStore();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [tipIndex, setTipIndex] = useState(0);
  const [loadingTasks, setLoadingTasks] = useState<Record<string, boolean>>({});
  const [refillAlerts, setRefillAlerts] = useState<any[]>([]);

  // Fetch refill alerts from the backend API
  const fetchRefillAlerts = async (profileId: string) => {
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`http://localhost:5000/api/refills/profile/${profileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRefillAlerts(data);
      }
    } catch (err) {
      console.error("Error fetching refill alerts:", err);
    }
  };

  // Update refill alert status
  const handleUpdateAlertStatus = async (alertId: string, status: 'REORDERED' | 'SNOOZED' | 'DISMISSED') => {
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`http://localhost:5000/api/refills/${alertId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        if (activeProfileId) {
          await fetchRefillAlerts(activeProfileId);
        }
      }
    } catch (err) {
      console.error("Error updating refill alert status:", err);
    }
  };

  // Dynamic time-based greeting
  const greeting = useMemo(() => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning';
    if (hours < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  // AI Health Tips
  const healthTips = [
    "Stay hydrated! Drinking water helps your body process medications more efficiently.",
    "Consistency is key. Try to take your medications at the same time each day to maintain stable levels.",
    "Did you know? Some vitamins are better absorbed with food, while others need an empty stomach.",
    "Always check expiration dates in your Cabinet. Expired meds can lose their effectiveness.",
    "Keep your pill cabinet away from hot, humid areas like bathroom showers to preserve shelf life."
  ];

  // Rotate health tips
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % healthTips.length);
    }, 12000);
    return () => clearInterval(interval);
  }, [healthTips.length]);

  useEffect(() => {
    if (typeof fetchProfiles === 'function') {
      fetchProfiles();
    }
  }, [fetchProfiles]);



  const loadDashboardData = async (profileId: string) => {
    if (profileId) {
      try {
        await Promise.all([
          typeof fetchRemindersByProfile === 'function' ? fetchRemindersByProfile(profileId) : Promise.resolve(),
          typeof fetchDoseLogs === 'function' ? fetchDoseLogs(profileId) : Promise.resolve(),
          typeof fetchMedicines === 'function' ? fetchMedicines(profileId) : Promise.resolve(),
          fetchRefillAlerts(profileId)
        ]);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      }
    }
  };

  useEffect(() => {
    if (activeProfileId) {
      loadDashboardData(activeProfileId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileId]);

  // Determine which reminders are active on the selected date
  const scheduleForSelectedDate = useMemo(() => {
    const safeReminders = reminders || [];
    if (safeReminders.length === 0) return [];

    try {
      const targetDate = new Date(selectedDate);
      targetDate.setHours(0, 0, 0, 0);
      const targetDayOfWeek = targetDate.getDay();

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      return safeReminders.filter((r) => {
        if (!r || !r.isActive) return false;
        if (!r.startDate) return false;

        const start = new Date(r.startDate);
        start.setHours(0, 0, 0, 0);
        if (targetDate.getTime() < start.getTime()) return false;

        if (r.endDate) {
          const end = new Date(r.endDate);
          end.setHours(0, 0, 0, 0);
          if (targetDate.getTime() > end.getTime()) return false;
        }

        // Repeat pattern checks
        if (r.repeatType === 'DAILY' || r.repeatType === 'COURSE') {
          return true;
        } else if (r.repeatType === 'WEEKLY') {
          return Array.isArray(r.daysOfWeek) && r.daysOfWeek.includes(targetDayOfWeek);
        } else if (r.repeatType === 'CUSTOM_INTERVAL') {
          const diffTime = targetDate.getTime() - start.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const interval = r.intervalDays || 1;
          return diffDays % interval === 0;
        }
        return false;
      });
    } catch (e) {
      console.error("Error parsing schedule for date:", e);
      return [];
    }
  }, [reminders, selectedDate]);

  // Generate individual dose tasks for the selected date
  const todayDoseTasks = useMemo(() => {
    const tasks: Array<{
      reminder: Reminder;
      time: string;
      scheduledIso: string;
      status: 'TAKEN' | 'SKIPPED' | 'PENDING' | 'MISSED';
      logId?: string;
    }> = [];

    try {
      const targetDateStr = getLocalDateString(selectedDate);
      const isToday = getLocalDateString(new Date()) === targetDateStr;
      const nowHours = new Date().getHours();
      const nowMinutes = new Date().getMinutes();

      const safeSchedule = scheduleForSelectedDate || [];
      const safeDoseLogs = doseLogs || [];

      safeSchedule.forEach((r) => {
        if (!r || !Array.isArray(r.times)) return;

        r.times.forEach((time) => {
          if (!time || typeof time !== 'string') return;

          // Construct target ISO scheduled string
          const scheduledTimeDate = new Date(selectedDate);
          const [hours, minutes] = time.split(':').map(Number);
          scheduledTimeDate.setHours(hours, minutes, 0, 0);
          const scheduledIso = scheduledTimeDate.toISOString();

          // Check if there is an existing log for this reminder at this scheduled date/time
          const matchingLog = safeDoseLogs.find((log) => {
            if (!log || log.reminderId !== r.id) return false;
            if (!log.scheduledAt) return false;
            try {
              const d = new Date(log.scheduledAt);
              if (isNaN(d.getTime())) return false;
              const logDateStr = getLocalDateString(d);

              const logHours = String(d.getHours()).padStart(2, '0');
              const logMinutes = String(d.getMinutes()).padStart(2, '0');
              const logTimeStr = `${logHours}:${logMinutes}`;

              return logDateStr === targetDateStr && logTimeStr === time;
            } catch {
              return false;
            }
          });

          let status: 'TAKEN' | 'SKIPPED' | 'PENDING' | 'MISSED' = 'PENDING';
          if (matchingLog) {
            status = matchingLog.status || 'PENDING';
          } else if (isToday) {
            const timeValue = hours * 60 + minutes;
            const nowValue = nowHours * 60 + nowMinutes;
            if (nowValue > timeValue + 120) {
              status = 'PENDING';
            }
          }

          tasks.push({
            reminder: r,
            time,
            scheduledIso,
            status,
            logId: matchingLog?.id
          });
        });
      });
    } catch (e) {
      console.error("Error generating today's dose tasks:", e);
    }

    return tasks.sort((a, b) => a.time.localeCompare(b.time));
  }, [scheduleForSelectedDate, doseLogs, selectedDate]);

  // Stats calculation
  const stats = useMemo(() => {
    const safeTasks = todayDoseTasks || [];
    const total = safeTasks.length;
    const taken = safeTasks.filter(t => t && t.status === 'TAKEN').length;
    const skipped = safeTasks.filter(t => t && t.status === 'SKIPPED').length;
    const rate = total > 0 ? Math.round((taken / total) * 100) : 100;
    return { total, taken, skipped, rate };
  }, [todayDoseTasks]);

  // Low stock check
  const lowStockMeds = useMemo(() => {
    return (medicines || []).filter(m => {
      if (!m) return false;
      const stockInfo = calculateStockStatus(m, reminders);
      return stockInfo.status !== 'green';
    });
  }, [medicines, reminders]);

  // Expiring soon check
  const expiringMeds = useMemo(() => {
    return (medicines || []).filter(m => {
      if (!m) return false;
      if (m.status === 'EXPIRING_SOON' || m.status === 'EXPIRED') return true;
      if (!m.expiryDate) return false;
      try {
        const expDate = new Date(m.expiryDate);
        if (isNaN(expDate.getTime())) return false;
        const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysLeft <= 30;
      } catch {
        return false;
      }
    });
  }, [medicines]);

  const handleLogAction = async (reminderId: string, status: 'TAKEN' | 'SKIPPED', scheduledIso: string) => {
    if (typeof logDose !== 'function') return;
    const taskKey = `${reminderId}-${scheduledIso}`;
    setLoadingTasks(prev => ({ ...prev, [taskKey]: true }));
    try {
      const success = await logDose(reminderId, status, scheduledIso);
      if (success && activeProfileId) {
        if (typeof fetchDoseLogs === 'function') await fetchDoseLogs(activeProfileId);
        if (typeof fetchMedicines === 'function') await fetchMedicines(activeProfileId);
        await fetchRefillAlerts(activeProfileId);
      }
    } catch (err) {
      console.error("Error logging dose:", err);
    } finally {
      setLoadingTasks(prev => ({ ...prev, [taskKey]: false }));
    }
  };

  const getDoseInstructions = (instruction: string) => {
    switch (instruction) {
      case 'BEFORE_FOOD': return 'Before meal';
      case 'AFTER_FOOD': return 'After meal';
      case 'EMPTY_STOMACH': return 'Empty stomach';
      default: return 'Any time (After/Befor Meal)';
    }
  };

  const safeProfiles = profiles || [];
  const safeMedicines = medicines || [];

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* Greeting Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded-full tracking-wider">
              {greeting}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              <CalendarDays size={11} />
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
            Hi, {user?.name?.split(' ')[0] || 'Hey'} 👋
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track your medications today.
          </p>
        </div>
        {/* Refresh button */}
        <button
          onClick={() => activeProfileId && loadDashboardData(activeProfileId)}
          className="p-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Profile Selector Tab Row */}
      {safeProfiles.length > 1 && (
        <div className="flex border-b border-slate-200 dark:border-white/10 mt-2 pb-2 overflow-x-auto gap-4 scrollbar-none whitespace-nowrap">
          {safeProfiles.map((p) => (
            <button
              key={p.id}
              onClick={() => typeof setActiveProfileId === 'function' && setActiveProfileId(p.id)}
              className={`pb-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
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

      {/* Main Grid Layout for Desktop vs Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mt-4">
        
        {/* Right Column (Stats, Alerts, AI Companion, Quick Actions) -> Order 1 on Mobile, 2 on Desktop */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6 lg:order-2 order-1">

          {/* Adherence Circular Progress Wheel */}
          <div className="glass-panel p-4 rounded-2xl relative overflow-hidden flex flex-col items-center text-center col-span-2">
            <div className="absolute top-0 right-0 p-2 text-primary/30">
              <Sparkles size={18} />
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Today's Adherence</h3>

            {/* Circle Progress - smaller for mobile */}
            <div className="relative flex items-center justify-center mb-6">
              <svg className="w-36 h-36 transform -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r="62"
                  className="stroke-slate-100 dark:stroke-white/5"
                  strokeWidth="12"
                  fill="transparent"
                />
                <circle
                  cx="72"
                  cy="72"
                  r="62"
                  className="stroke-primary transition-all duration-1000 ease-out"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 62}
                  strokeDashoffset={2 * Math.PI * 62 * (1 - stats.rate / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.rate}%</span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5">Taken</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] mb-4">
              {stats.total === 0
                ? "No doses scheduled for today."
                : `${stats.taken} of ${stats.total} doses logged successfully.`}
            </p>

            {/* Quick Micro-stats */}
            <div className="grid grid-cols-2 gap-4 w-full border-t border-slate-100 dark:border-white/5 pt-4">
              <div className="text-center border-r border-slate-100 dark:border-white/5">
                <span className="text-xs text-slate-400 font-semibold block">Total Doses</span>
                <span className="text-lg font-bold text-slate-800 dark:text-white">{stats.total}</span>
              </div>
              <div className="text-center">
                <span className="text-xs text-slate-400 font-semibold block">Skipped</span>
                <span className="text-lg font-bold text-red-500">{stats.skipped}</span>
              </div>
            </div>
          </div>

          {/* AI Health Companion Tip Box */}
          <div className="glass-panel p-6 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20 relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-primary/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center gap-2 mb-3 text-primary font-bold text-sm">
              <Activity size={18} />
              <span>MediMate AI Companion</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 min-h-[60px] transition-all duration-500">
              "{healthTips[tipIndex]}"
            </p>
          </div>

          {/* Low Stock, Expiry & Refill Alerts Panel */}
          {(lowStockMeds.length > 0 || expiringMeds.length > 0 || refillAlerts.length > 0) && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 px-1">Attention Required</h4>

              {/* Refill Alerts */}
              {refillAlerts.map((alert) => {
                if (!alert || !alert.medicine) return null;
                return (
                  <div key={alert.id} className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-bold text-amber-800 dark:text-amber-300 truncate">
                          Refill Reminder: {alert.medicine.name}
                        </h5>
                        <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                          Your {alert.medicine.name} will finish in {alert.daysRemainingAtAlert} day{alert.daysRemainingAtAlert > 1 ? 's' : ''}.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleUpdateAlertStatus(alert.id, 'REORDERED')}
                        className="px-2.5 py-1.5 text-[9px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors cursor-pointer"
                      >
                        Mark as Reordered
                      </button>
                      <button
                        onClick={() => handleUpdateAlertStatus(alert.id, 'SNOOZED')}
                        className="px-2.5 py-1.5 text-[9px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 rounded-lg transition-colors cursor-pointer"
                      >
                        Snooze
                      </button>
                      <button
                        onClick={() => handleUpdateAlertStatus(alert.id, 'DISMISSED')}
                        className="px-2.5 py-1.5 text-[9px] font-bold bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Low Stock Alerts */}
              {lowStockMeds.map((med) => {
                if (!med) return null;
                const stockInfo = calculateStockStatus(med, reminders);
                let alertBg = 'bg-amber-500/10 border-amber-500/20';
                let alertText = 'text-amber-800 dark:text-amber-300';
                let alertSubText = 'text-amber-600/80 dark:text-amber-400/80';
                let btnHover = 'hover:bg-amber-500/20 text-amber-700 dark:text-amber-300';
                let alertColor = 'text-amber-500';

                if (stockInfo.status === 'red') {
                  alertBg = 'bg-rose-500/10 border-rose-500/20';
                  alertText = 'text-rose-800 dark:text-rose-300';
                  alertSubText = 'text-rose-600/80 dark:text-rose-400/80';
                  btnHover = 'hover:bg-rose-500/20 text-rose-700 dark:text-rose-300';
                  alertColor = 'text-rose-500';
                } else if (stockInfo.status === 'orange') {
                  alertBg = 'bg-orange-500/10 border-orange-500/20';
                  alertText = 'text-orange-800 dark:text-orange-300';
                  alertSubText = 'text-orange-600/80 dark:text-orange-400/80';
                  btnHover = 'hover:bg-orange-500/20 text-orange-700 dark:text-orange-300';
                  alertColor = 'text-orange-500';
                }

                return (
                  <div key={med.id} className={`p-4 border rounded-2xl flex items-start gap-3 ${alertBg}`}>
                    <AlertTriangle className={`${alertColor} shrink-0 mt-0.5`} size={18} />
                    <div className="flex-1 min-w-0">
                      <h5 className={`text-xs font-bold truncate ${alertText}`}>{stockInfo.label}: {med.name}</h5>
                      <p className={`text-[10px] mt-0.5 ${alertSubText}`}>
                        Only {med.quantityAvailable} {med.quantityUnit} left.
                      </p>
                    </div>
                    <Link
                      to={`/cabinet`}
                      className={`p-1.5 rounded-lg transition-colors ${btnHover}`}
                      title="View Cabinet"
                    >
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                );
              })}

              {/* Expiring Soon Alerts */}
              {expiringMeds.map((med) => {
                if (!med) return null;
                return (
                  <div key={med.id} className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-bold text-red-800 dark:text-red-300 truncate">Expiry Warning: {med.name}</h5>
                      <p className="text-[10px] text-red-600/80 dark:text-red-400/80 mt-0.5">
                        Expires: {med.expiryDate ? new Date(med.expiryDate).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                    <Link
                      to={`/cabinet`}
                      className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-red-700 dark:text-red-300"
                      title="View Cabinet"
                    >
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Actions Panel */}
          <div className="space-y-3 col-span-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/cabinet/new"
                className="glass-panel p-3.5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 hover:bg-primary/5 hover:border-primary/20 transition-all group"
              >
                <div className="p-2 bg-primary/10 text-primary rounded-xl group-hover:scale-110 transition-transform">
                  <Pill size={18} />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-white">Add Medicine</span>
              </Link>

              <Link
                to="/reminders"
                className="glass-panel p-3.5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 hover:bg-primary/5 hover:border-primary/20 transition-all group"
              >
                <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl group-hover:scale-110 transition-transform">
                  <Clock size={18} />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-white">Set Reminder</span>
              </Link>
            </div>
          </div>

        </div>

        {/* Left Column (Timeline) -> Order 2 on Mobile, 1 on Desktop */}
        <div className="lg:col-span-7 xl:col-span-8 lg:order-1 order-2">
          {/* Today's Schedule Timeline */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-white/5 h-full">
            <div className="flex justify-between items-center gap-3 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar size={16} className="text-primary" />
                  Intake Timeline
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Log your doses for the day.
                </p>
              </div>

              {/* Simple Day Quick Toggles */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
                {[-1, 0, 1].map((offset) => {
                  const d = new Date();
                  d.setDate(d.getDate() + offset);
                  const isSelected = selectedDate.toDateString() === d.toDateString();
                  const label = offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : 'Tomorrow';
                  return (
                    <button
                      key={offset}
                      onClick={() => setSelectedDate(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${isSelected
                        ? 'bg-white dark:bg-slate-900 text-primary shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                        }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dose Timeline Tasks */}
            {isReminderLoading && reminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <RefreshCw className="animate-spin text-primary h-8 w-8" />
                <span className="text-xs text-slate-500">Updating timeline...</span>
              </div>
            ) : todayDoseTasks.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Clock className="mx-auto text-slate-350 dark:text-white/10 mb-4 animate-pulse" size={44} />
                <h4 className="text-base font-bold text-slate-800 dark:text-white">No doses scheduled for this day</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2">
                  Looks like you don't have any active alarm schedules matching this date.
                </p>
                <Link
                  to="/reminders"
                  className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl transition-all"
                >
                  <Plus size={16} />
                  Configure Schedules
                </Link>
              </div>
            ) : (
              <div className="relative border-l border-slate-100 dark:border-white/5 pl-4 ml-3 space-y-6">
                {todayDoseTasks.map((task, index) => {
                  if (!task || !task.reminder) return null;
                  const isTaken = task.status === 'TAKEN';
                  const isSkipped = task.status === 'SKIPPED';
                  const isPending = task.status === 'PENDING';
                  const medicineName = task.reminder.medicine?.name || 'Medicine';
                  const dosage = `${task.reminder.doseAmount || ''} ${task.reminder.doseUnit || ''}`;

                  return (
                    <div
                      key={`${task.reminder.id}-${task.time}-${index}`}
                      className={`relative flex items-start justify-between gap-4 p-4 rounded-2xl border transition-all ${isTaken
                        ? 'bg-green-500/5 border-green-500/10 dark:bg-green-500/2'
                        : isSkipped
                          ? 'bg-red-500/5 border-red-500/10 dark:bg-red-500/2 opacity-75'
                          : 'bg-white/50 border-slate-200/60 dark:bg-white/2 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                        }`}
                    >
                      {/* Left Dot Bullet on Timeline */}
                      <span className={`absolute -left-[22px] top-7 w-3.5 h-3.5 rounded-full border-2 bg-background transition-all ${isTaken
                        ? 'border-green-500 bg-green-500 scale-110 shadow-lg shadow-green-500/30'
                        : isSkipped
                          ? 'border-red-500 bg-red-500'
                          : 'border-primary'
                        }`} />

                      <div className="flex gap-3">
                        {/* Medicine Icon */}
                        <div className={`p-3 rounded-xl shrink-0 mt-0.5 ${isTaken
                          ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                          : isSkipped
                            ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                            : 'bg-primary/10 text-primary'
                          }`}>
                          <Pill size={18} />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary bg-primary/10 p-0.5 px-2 rounded-lg">
                              {formatTime12h(task.time)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                              {getDoseInstructions(task.reminder.instruction)}
                            </span>
                          </div>

                          <h4 className="text-base font-bold text-slate-800 dark:text-white mt-1.5 leading-none">
                            {medicineName}
                          </h4>

                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Dosage: <span className="font-semibold text-slate-700 dark:text-slate-300">{dosage}</span>
                          </p>
                        </div>
                      </div>

                      {/* Right Action buttons */}
                      <div className="flex items-center gap-1.5">
                        {isPending ? (
                          <>
                            <button
                              disabled={loadingTasks[`${task.reminder.id}-${task.scheduledIso}`]}
                              onClick={() => handleLogAction(task.reminder.id!, 'TAKEN', task.scheduledIso)}
                              className="px-3.5 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-green-500/20 hover:shadow-green-500/45 hover:-translate-y-0.5 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              {loadingTasks[`${task.reminder.id}-${task.scheduledIso}`] ? (
                                <RefreshCw size={14} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={14} />
                              )}
                              Take
                            </button>
                            <button
                              disabled={loadingTasks[`${task.reminder.id}-${task.scheduledIso}`]}
                              onClick={() => handleLogAction(task.reminder.id!, 'SKIPPED', task.scheduledIso)}
                              className="p-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl transition-all cursor-pointer"
                              title="Skip Dose"
                            >
                              {loadingTasks[`${task.reminder.id}-${task.scheduledIso}`] ? (
                                <RefreshCw size={15} className="animate-spin" />
                              ) : (
                                <XCircle size={15} />
                              )}
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1 ${isTaken
                              ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                              : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                              }`}>
                              {isTaken ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                              {isTaken ? 'Taken' : 'Skipped'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        {/* Simple Inventory/Cabinet Status Tracker */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-white/5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Package size={16} className="text-primary" />
                  Cabinet Inventory
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Stock levels of your cabinet medications.
                </p>
              </div>
              <Link
                to="/cabinet"
                className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
              >
                Manage
                <ChevronRight size={14} />
              </Link>
            </div>

            {isMedicineLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading inventory...</div>
            ) : safeMedicines.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No medicines in cabinet. Add some to start tracking.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {safeMedicines.slice(0, 4).map((med) => {
                  if (!med) return null;
                  const stockInfo = calculateStockStatus(med, reminders);
                  const percent = Math.min(100, Math.max(0, ((med.quantityAvailable || 0) / 50) * 100));
                  let barColor = 'bg-primary';
                  if (stockInfo.status === 'red') barColor = 'bg-rose-500';
                  else if (stockInfo.status === 'orange') barColor = 'bg-orange-500';
                  else if (stockInfo.status === 'yellow') barColor = 'bg-amber-500';

                  return (
                    <div key={med.id} className="p-3 bg-slate-50 dark:bg-white/2 rounded-2xl border border-slate-100 dark:border-white/5 flex flex-col justify-between">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">{med.name}</h4>
                          <span className="text-[10px] text-slate-400 capitalize">{med.type}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stockInfo.bgClass} ${stockInfo.colorClass} ${stockInfo.borderClass}`}>
                          {med.quantityAvailable || 0} left
                        </span>
                      </div>

                      {/* Simple stock progress bar */}
                      <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
