import { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Moon,
  Sun,
  BarChart3,
  History,
  PlusCircle,
  Lightbulb,
  X,
  Sparkles,
  ChevronDown,
  Settings,
  Users,
} from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { SleepEntry, ViewTab } from './types';
import { fetchEntries, deleteEntry } from './store';
import SleepForm from './components/SleepForm';
import SleepHistory from './components/SleepHistory';
import SleepStats from './components/SleepStats';
import SleepTimerWidget from './components/SleepTimerWidget';
import SettingsModal from './components/SettingsModal';
import AuthScreen from './components/AuthScreen';
import GamificationWidget from './components/GamificationWidget';
import HabitCorrelator from './components/HabitCorrelator';
import CommunityLeaderboard from './components/CommunityLeaderboard';
import HealthSyncWidget from './components/HealthSyncWidget';
import { useNotifications } from './hooks/useNotifications';
import { calculateLoggingStreak } from './utils/analytics';
import { fetchProfile, syncProfile } from './store';

import SleepChart from './components/SleepChart';
import AIInsights from './components/AIInsights';

function PanelSkeleton({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/85 p-4 sm:p-6 shadow-sm">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-40 rounded-full bg-stone-200" />
        <div className="h-28 rounded-2xl bg-stone-100" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-3 rounded-full bg-stone-100" />
          <div className="h-3 rounded-full bg-stone-100" />
          <div className="h-3 rounded-full bg-stone-100" />
        </div>
      </div>
      <p className="mt-4 text-sm text-stone-500">{message}</p>
    </div>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  const [entries, setEntries] = useState<SleepEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<SleepEntry | null>(null);
  const [showTips, setShowTips] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSleepStart, setActiveSleepStart] = useState<number | null>(() => {
    const stored = localStorage.getItem('active_sleep');
    return stored ? parseInt(stored, 10) : null;
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });
  const [targetSleep, setTargetSleep] = useState<number>(() => {
    return parseFloat(localStorage.getItem('target_sleep_hours') || '8');
  });
  
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('notifications_enabled') === 'true';
  });
  const [targetBedtime, setTargetBedtime] = useState<string>(() => {
    return localStorage.getItem('target_bedtime') || '22:30';
  });
  const [windDownMinutes, setWindDownMinutes] = useState<number>(() => {
    return parseInt(localStorage.getItem('wind_down_minutes') || '45', 10);
  });

  const { permission, requestPermission, downloadCalendarEvent } = useNotifications({
    enabled: notificationsEnabled,
    targetBedtime,
    windDownMinutes
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitializing(false);
    }).catch(console.error);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshEntries = useCallback(async () => {
    if (session) {
      const data = await fetchEntries();
      setEntries(data);
      
      fetchProfile().then(profile => {
        if (profile?.username) {
          syncProfile(profile.username, calculateLoggingStreak(data)).catch(console.error);
        }
      }).catch(console.error);
    }
  }, [session]);

  useEffect(() => {
    refreshEntries();
  }, [refreshEntries]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const handleEntrySaved = async (_entry: SleepEntry) => {
    await refreshEntries();
    if (editingEntry) {
      setEditingEntry(null);
      setActiveTab('history');
      return;
    }

    setActiveTab('dashboard');
  };

  const handleEdit = (entry: SleepEntry) => {
    setEditingEntry(entry);
    setActiveTab('log');
  };

  const handleStartSleep = () => {
    const now = Date.now();
    setActiveSleepStart(now);
    localStorage.setItem('active_sleep', now.toString());
  };

  const handleWakeUp = (start: number, end: number) => {
    setActiveSleepStart(null);
    localStorage.removeItem('active_sleep');
    
    // Format times for the form
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const formatTimeStr = (d: Date) => 
      `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      
    // Pre-fill a temporary entry to pass into the form
    setEditingEntry({
      id: '', // Empty ID signifies it's new
      date: endDate.toISOString().split('T')[0],
      bedTime: formatTimeStr(startDate),
      bedDate: startDate.getDate() === endDate.getDate() ? 'same' : 'prev',
      wakeTime: formatTimeStr(endDate),
      duration: Math.round((end - start) / 60000), // pre-calculated but form might recalculate
      quality: 3,
      notes: '',
      createdAt: end,
    });
    
    setActiveTab('log');
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEntry(id);
      await refreshEntries();
    } catch {
      // ignore
    }
  };

  const tabs: { id: ViewTab; label: string; icon: typeof Moon }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'log', label: 'Log Sleep', icon: PlusCircle },
    { id: 'history', label: 'History', icon: History },
    { id: 'insights', label: 'Insights', icon: Lightbulb },
    { id: 'community', label: 'Community', icon: Users },
  ];

  const sleepTips = [
    {
      title: 'Consistent Schedule',
      desc: 'Go to bed and wake up at the same time every day, even on weekends.',
    },
    {
      title: 'Avoid Screens',
      desc: 'Stop using phones or laptops 30 to 60 minutes before bed. Blue light can disrupt melatonin.',
    },
    {
      title: 'Cool Environment',
      desc: 'Keep your bedroom between 60 and 67 F (15 to 19 C) for more comfortable sleep.',
    },
    {
      title: 'Limit Caffeine',
      desc: 'Avoid caffeine at least 6 hours before bedtime for better sleep quality.',
    },
    {
      title: 'Dark Room',
      desc: 'Use blackout curtains or a sleep mask to reduce light that interrupts sleep cycles.',
    },
    {
      title: 'Wind Down Routine',
      desc: 'Create a calming pre-sleep ritual like reading, stretching, or meditation.',
    },
  ];

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center">
        <div className="animate-pulse w-12 h-12 bg-stone-200 dark:bg-stone-800 rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen sm:min-h-[100dvh] text-stone-800 dark:text-stone-100 antialiased selection:bg-stone-200 dark:selection:bg-stone-700 overflow-x-hidden">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 md:py-14 pb-32 sm:pb-16">
        <header className="mb-8 sm:mb-12 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6 sm:gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex-shrink-0 w-12 h-12 bg-stone-900 dark:bg-stone-800 rounded-full flex items-center justify-center shadow-lg ring-8 ring-stone-100 dark:ring-stone-900/50">
              <Moon className="w-6 h-6 text-stone-50 fill-current" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl sm:text-3xl font-serif tracking-tight font-medium text-stone-900 dark:text-stone-50">
                Rest & Renewal
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5 font-medium uppercase tracking-wide">A mindful sleep journal</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 p-3 sm:p-3 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-all shadow-sm active:scale-95"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
              <span className="text-xs font-semibold sm:hidden">Settings</span>
            </button>
            <button
              onClick={toggleTheme}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 p-3 sm:p-3 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-all shadow-sm active:scale-95"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              <span className="text-xs font-semibold sm:hidden">{theme === 'light' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </header>

        <section className="mb-6 sm:mb-8 rounded-[1.75rem] border border-stone-200/80 dark:border-stone-800/80 bg-white/80 dark:bg-stone-900/60 backdrop-blur-sm shadow-sm overflow-hidden">
          <div className="px-4 py-5 sm:px-6 sm:py-6 md:px-7 md:py-7 bg-[linear-gradient(135deg,rgba(245,244,240,0.95),rgba(255,255,255,0.85))] dark:bg-[linear-gradient(135deg,rgba(40,38,36,0.9),rgba(28,25,23,0.9))]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl">
                <p className="text-xs uppercase tracking-[0.28em] text-stone-500 dark:text-stone-400 mb-2">
                  Sleep journal
                </p>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-serif text-stone-900 dark:text-stone-50 leading-tight">
                  Notice your rhythm, not just your totals.
                </h2>
                <p className="mt-3 text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                  Log nights, review trends, and reflect on how your routines shape recovery over time.
                </p>
              </div>
              <div className="grid w-full sm:w-auto grid-cols-3 gap-2 sm:gap-3 text-center">
                <div className="rounded-2xl bg-stone-100/80 dark:bg-stone-800/80 px-2.5 sm:px-4 py-3 border border-stone-200/80 dark:border-stone-700/80 min-w-0">
                  <div className="text-lg font-serif text-stone-900 dark:text-stone-50">{entries.length}</div>
                  <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.16em] sm:tracking-[0.2em] text-stone-500 dark:text-stone-400">Entries</div>
                </div>
                <div className="rounded-2xl bg-stone-100/80 dark:bg-stone-800/80 px-2.5 sm:px-4 py-3 border border-stone-200/80 dark:border-stone-700/80 min-w-0">
                  <div className="text-lg font-serif text-stone-900 dark:text-stone-50 truncate">
                    {entries.length > 0 ? `${Math.round((entries.reduce((sum, entry) => sum + entry.duration, 0) / entries.length / 60) * 10) / 10}h` : '--'}
                  </div>
                  <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.16em] sm:tracking-[0.2em] text-stone-500 dark:text-stone-400">Average</div>
                </div>
                <div className="rounded-2xl bg-stone-100/80 dark:bg-stone-800/80 px-2.5 sm:px-4 py-3 border border-stone-200/80 dark:border-stone-700/80 min-w-0">
                  <div className="text-lg font-serif text-stone-900 dark:text-stone-50 truncate">
                    {entries.length > 0 ? `${Math.round((entries.reduce((sum, entry) => sum + entry.quality, 0) / entries.length) * 10) / 10}/5` : '--'}
                  </div>
                  <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.16em] sm:tracking-[0.2em] text-stone-500 dark:text-stone-400">Quality</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 gap-1 bg-white/95 dark:bg-stone-900/95 border-t border-stone-200 dark:border-stone-800 p-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-2 shadow-[0_-4px_20px_-1px_rgba(0,0,0,0.05)] backdrop-blur-md sm:relative sm:bottom-auto sm:left-auto sm:right-auto sm:z-auto sm:mb-12 sm:border sm:rounded-2xl sm:shadow-sm sm:bg-white/85 dark:sm:bg-stone-900/85">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setEditingEntry(null);
                }}
                className={`min-w-0 flex flex-col items-center gap-1 py-2 sm:py-3 px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-50 font-semibold'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-50/50 dark:hover:bg-stone-800/50'
                }`}
              >
                <Icon className="w-5 h-5 sm:w-5 sm:h-5 stroke-[1.5]" />
                <span className="text-center leading-tight">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <main>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <HealthSyncWidget onSyncComplete={refreshEntries} />
                  <GamificationWidget entries={entries} />
                  
                  <SleepTimerWidget 
                    sleepStartTime={activeSleepStart} 
                    onStartSleep={handleStartSleep}
                    onWakeUp={handleWakeUp}
                  />
                  <SleepStats 
                    entries={entries} 
                    targetHours={targetSleep} 
                    onEditTarget={() => setIsSettingsOpen(true)}
                  />
                  <Suspense fallback={<PanelSkeleton message="Loading your sleep charts..." />}>
                    <SleepChart entries={entries} />
                  </Suspense>
                </div>
              )}

              {activeTab === 'log' && (
                <SleepForm
                  key={editingEntry?.id || 'new'}
                  onEntrySaved={handleEntrySaved}
                  initialEntry={editingEntry}
                  isFromTimer={editingEntry?.id === ''}
                />
              )}

              {activeTab === 'history' && (
                <SleepHistory entries={entries} onEdit={handleEdit} onDelete={handleDelete} />
              )}

              {activeTab === 'insights' && (
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center gap-2.5 mb-4">
                      <Sparkles className="w-5 h-5 text-amber-700" />
                      <h2 className="text-xl font-serif font-medium text-stone-800">AI Sleep Analysis</h2>
                    </div>
                    <Suspense fallback={<PanelSkeleton message="Loading the AI analysis panel..." />}>
                      <AIInsights entries={entries} />
                    </Suspense>
                  </div>
                  
                  <HabitCorrelator entries={entries} />

                  <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm">
                    <button
                      onClick={() => setShowTips((current) => !current)}
                      className="w-full flex items-center justify-between gap-3 p-4 sm:p-6 hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Lightbulb className="w-5 h-5 text-amber-700 dark:text-amber-500 stroke-[1.5]" />
                        <h3 className="text-base sm:text-lg font-serif font-medium text-stone-800 dark:text-stone-100 text-left">Mindful Sleep Habits</h3>
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-stone-400 transition-transform duration-300 ${
                          showTips ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {showTips && (
                      <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
                        {sleepTips.map((tip) => (
                          <div key={tip.title} className="bg-stone-50 dark:bg-stone-800 rounded-xl p-4 border border-stone-100 dark:border-stone-700">
                            <h4 className="text-sm font-medium text-stone-800 dark:text-stone-100 mb-1">{tip.title}</h4>
                            <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">{tip.desc}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Suspense fallback={<PanelSkeleton message="Loading your sleep charts..." />}>
                    <SleepChart entries={entries} />
                  </Suspense>
                </div>
              )}

              {activeTab === 'community' && (
                <CommunityLeaderboard entries={entries} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {activeTab !== 'log' && (
          <button
            onClick={() => {
              setEditingEntry(null);
              setActiveTab('log');
            }}
            className="fixed bottom-20 right-4 sm:bottom-8 sm:right-8 w-12 h-12 sm:w-14 sm:h-14 bg-stone-900 dark:bg-stone-800 rounded-full flex items-center justify-center shadow-lg text-white hover:bg-stone-800 dark:hover:bg-stone-700 active:scale-95 transition-all z-30"
            title="Log Sleep"
          >
            <PlusCircle className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.5]" />
          </button>
        )}

        {editingEntry && (
          <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
            <button
              onClick={() => {
                setEditingEntry(null);
                setActiveTab('history');
              }}
              className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full p-2.5 sm:p-3 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 shadow-sm transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onDataChanged={refreshEntries} 
        targetSleep={targetSleep}
        onTargetSleepChange={(val) => {
          setTargetSleep(val);
          localStorage.setItem('target_sleep_hours', String(val));
        }}
        notificationsEnabled={notificationsEnabled}
        onNotificationsToggle={async (enabled) => {
          if (enabled && permission !== 'granted') {
            const granted = await requestPermission();
            if (!granted) return; // if denied, don't toggle on
          }
          setNotificationsEnabled(enabled);
          localStorage.setItem('notifications_enabled', String(enabled));
        }}
        targetBedtime={targetBedtime}
        onTargetBedtimeChange={(val) => {
          setTargetBedtime(val);
          localStorage.setItem('target_bedtime', val);
        }}
        windDownMinutes={windDownMinutes}
        onWindDownMinutesChange={(val) => {
          setWindDownMinutes(val);
          localStorage.setItem('wind_down_minutes', String(val));
        }}
        onCalendarExport={downloadCalendarEvent}
      />
    </div>
  );
}

export default App;
