import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useReminderStore } from '../store/useReminderStore';
import type { Reminder } from '../store/useReminderStore';
import { Check, Clock } from 'lucide-react';

export const NotificationManager = () => {
  const { isAuthenticated, profiles, fetchProfiles } = useAuthStore();
  const { logDose } = useReminderStore();
  
  const [activeAlerts, setActiveAlerts] = useState<Array<{
    id: string; // unique alert instance ID
    reminder: Reminder;
    scheduledTime: string; // HH:MM
    scheduledDate: string; // YYYY-MM-DD
    snoozeCount: number;
  }>>([]);

  // Keep track of triggered alerts to prevent double-firing in the same minute
  // Key: reminderId-time-date, Value: true
  const triggeredRef = useRef<Record<string, boolean>>({});
  
  // Keep track of snoozed alerts and their target trigger timestamp
  const snoozedAlertsRef = useRef<Array<{
    reminder: Reminder;
    triggerTime: number; // timestamp
    scheduledTime: string;
    scheduledDate: string;
    snoozeCount: number;
  }>>([]);

  // Fetch reminders for all profiles periodically
  const [allReminders, setAllReminders] = useState<Reminder[]>([]);

  // Synthesize a premium chiptune chime sound using Web Audio API
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Note 1
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.45);

      // Note 2 (slight delay)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.12); // E5
      gain2.gain.setValueAtTime(0.15, audioCtx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.52);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(audioCtx.currentTime + 0.12);
      osc2.stop(audioCtx.currentTime + 0.55);

      // Note 3 (slight delay)
      const osc3 = audioCtx.createOscillator();
      const gain3 = audioCtx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.24); // G5
      gain3.gain.setValueAtTime(0.18, audioCtx.currentTime + 0.24);
      gain3.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
      osc3.connect(gain3);
      gain3.connect(audioCtx.destination);
      osc3.start(audioCtx.currentTime + 0.24);
      osc3.stop(audioCtx.currentTime + 0.85);

    } catch (e) {
      console.warn("AudioContext chime failed:", e);
    }
  };

  // Request browser Notification permissions on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Fetch profiles when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchProfiles();
    }
  }, [isAuthenticated, fetchProfiles]);

  // Load all active reminders for all profiles
  useEffect(() => {
    if (!isAuthenticated || profiles.length === 0) return;

    const loadAllReminders = async () => {
      try {
        const token = useAuthStore.getState().token;
        const fetchedReminders: Reminder[] = [];

        for (const p of profiles) {
          const res = await fetch(`http://localhost:5000/api/reminders/profile/${p.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            fetchedReminders.push(...data);
          }
        }
        setAllReminders(fetchedReminders.filter(r => r.isActive));
      } catch (err) {
        console.error("Error loading notification manager reminders:", err);
      }
    };

    loadAllReminders();
    // Poll for new reminders every 60 seconds
    const interval = setInterval(loadAllReminders, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated, profiles]);

  // Check reminders and snoozed alerts every 15 seconds
  useEffect(() => {
    if (!isAuthenticated || allReminders.length === 0) return;

    const checkScheduler = () => {
      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const currentYYYYMMDD = now.toISOString().split('T')[0];
      const todayDayOfWeek = now.getDay();
      
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // 1. Process regular reminders
      allReminders.forEach((r) => {
        // Date math bounds check
        const start = new Date(r.startDate);
        start.setHours(0, 0, 0, 0);
        if (todayStart.getTime() < start.getTime()) return;

        if (r.endDate) {
          const end = new Date(r.endDate);
          end.setHours(0, 0, 0, 0);
          if (todayStart.getTime() > end.getTime()) return;
        }

        // Repeat pattern check
        let matchesDay = false;
        if (r.repeatType === 'DAILY' || r.repeatType === 'COURSE') {
          matchesDay = true;
        } else if (r.repeatType === 'WEEKLY') {
          matchesDay = r.daysOfWeek.includes(todayDayOfWeek);
        } else if (r.repeatType === 'CUSTOM_INTERVAL') {
          const diffTime = todayStart.getTime() - start.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const interval = r.intervalDays || 1;
          matchesDay = diffDays % interval === 0;
        }

        if (!matchesDay) return;

        // Check scheduled times
        r.times.forEach((time) => {
          if (time === currentHHMM) {
            const key = `${r.id}-${time}-${currentYYYYMMDD}`;
            if (!triggeredRef.current[key]) {
              triggeredRef.current[key] = true;
              triggerAlert(r, time, currentYYYYMMDD, 0);
            }
          }
        });
      });

      // 2. Process snoozed reminders
      const currentTimestamp = Date.now();
      const stillSnoozed: typeof snoozedAlertsRef.current = [];

      snoozedAlertsRef.current.forEach((snoozed) => {
        if (currentTimestamp >= snoozed.triggerTime) {
          // Re-trigger alert
          triggerAlert(snoozed.reminder, snoozed.scheduledTime, snoozed.scheduledDate, snoozed.snoozeCount);
        } else {
          stillSnoozed.push(snoozed);
        }
      });

      snoozedAlertsRef.current = stillSnoozed;
    };

    const triggerAlert = (reminder: Reminder, time: string, date: string, snoozeCount: number) => {
      // 1. Play Synth Sound
      playChime();

      // 2. Trigger Browser Notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const bodyText = `Take ${reminder.doseAmount} ${reminder.doseUnit} of ${reminder.medicine?.name || 'medicine'} (${reminder.instruction === 'BEFORE_FOOD' ? 'Before food' : reminder.instruction === 'AFTER_FOOD' ? 'After food' : reminder.instruction === 'EMPTY_STOMACH' ? 'Empty stomach' : 'No food instructions'}).`;
        new Notification("MediMate Medicine Reminder", {
          body: bodyText,
          icon: '/activity.png', // fallback
          tag: reminder.id
        });
      }

      // 3. Add to In-app Alerts
      const alertId = `${reminder.id}-${time}-${date}-${snoozeCount}-${Date.now()}`;
      setActiveAlerts(prev => [
        ...prev,
        {
          id: alertId,
          reminder,
          scheduledTime: time,
          scheduledDate: date,
          snoozeCount
        }
      ]);
    };

    const interval = setInterval(checkScheduler, 15000);
    return () => clearInterval(interval);
  }, [allReminders, isAuthenticated]);

  const handleAction = async (
    alertId: string, 
    reminderId: string, 
    status: 'TAKEN' | 'SKIPPED' | 'MISSED' | 'PENDING', 
    scheduledTime: string, 
    scheduledDate: string,
    snoozeCount: number
  ) => {
    // Dismiss the active alert toaster
    setActiveAlerts(prev => prev.filter(a => a.id !== alertId));

    // Construct scheduled ISO date string
    const dateObj = new Date(scheduledDate);
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    dateObj.setHours(hours, minutes, 0, 0);

    // Call backend to log dose
    await logDose(reminderId, status, dateObj.toISOString(), snoozeCount);
  };

  const handleSnooze = (
    alertId: string,
    reminder: Reminder,
    scheduledTime: string,
    scheduledDate: string,
    snoozeCount: number
  ) => {
    // Dismiss the active alert toaster
    setActiveAlerts(prev => prev.filter(a => a.id !== alertId));

    // Add to snoozed alerts ref (trigger in 15 minutes)
    // For testability and responsive feedback, we will do 15 minutes
    const snoozeDelayMs = 15 * 60 * 1000;
    
    snoozedAlertsRef.current.push({
      reminder,
      triggerTime: Date.now() + snoozeDelayMs,
      scheduledTime,
      scheduledDate,
      snoozeCount: snoozeCount + 1
    });

    console.log(`Reminder snoozed for 15 minutes. Trigger at: ${new Date(Date.now() + snoozeDelayMs).toLocaleTimeString()}`);
  };

  if (!isAuthenticated || activeAlerts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-4 max-w-sm w-full p-4 md:p-0">
      {activeAlerts.map((alert) => {
        const { id, reminder, scheduledTime, scheduledDate, snoozeCount } = alert;
        const foodInst = reminder.instruction === 'BEFORE_FOOD' 
          ? 'Before food' 
          : reminder.instruction === 'AFTER_FOOD' 
            ? 'After food' 
            : reminder.instruction === 'EMPTY_STOMACH' 
              ? 'Empty stomach' 
              : '';

        return (
          <div 
            key={id}
            className="glass-panel p-5 rounded-2xl border border-primary/20 shadow-2xl bg-white/95 dark:bg-slate-950/95 flex flex-col gap-3 animate-in slide-in-from-bottom-5 duration-300"
          >
            <div className="flex justify-between items-start">
              <div className="flex gap-2">
                <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0 h-10 w-10 flex items-center justify-center">
                  <Clock size={20} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Medicine Dose Reminder
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    For profile: <span className="font-semibold text-slate-700 dark:text-slate-300">{reminder.profile?.fullName || 'Self'}</span>
                  </p>
                </div>
              </div>
              {snoozeCount > 0 && (
                <span className="text-[10px] font-bold bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full shrink-0">
                  Snoozed x{snoozeCount}
                </span>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5">
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {reminder.medicine?.name || 'Aspirin'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Take {reminder.doseAmount} {reminder.doseUnit} {foodInst && `• ${foodInst}`}
              </div>
            </div>

            <div className="flex gap-2 text-xs font-bold mt-1">
              <button
                onClick={() => handleAction(id, reminder.id!, 'TAKEN', scheduledTime, scheduledDate, snoozeCount)}
                className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-primary text-primary-foreground rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5"
              >
                <Check size={14} /> Taken
              </button>
              <button
                onClick={() => handleSnooze(id, reminder, scheduledTime, scheduledDate, snoozeCount)}
                className="flex-1 py-2 px-3 bg-slate-150 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white rounded-xl transition-all cursor-pointer"
              >
                Snooze
              </button>
              <button
                onClick={() => handleAction(id, reminder.id!, 'SKIPPED', scheduledTime, scheduledDate, snoozeCount)}
                className="py-2 px-3 border border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
              >
                Skip
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
