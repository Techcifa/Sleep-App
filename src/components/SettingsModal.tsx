import { useState, useRef, useEffect } from 'react';
import { X, Download, Upload, Trash2, CheckCircle2, LogOut, Mail, Lock, Loader2, AlertCircle, LogIn, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Session } from '@supabase/supabase-js';
import { SleepEntry } from '../types';
import { fetchEntries, addEntry, clearEntries, fetchProfile, syncProfile } from '../store';
import { calculateLoggingStreak } from '../utils/analytics';
import { supabase } from '../lib/supabase';
import { Capacitor } from '@capacitor/core';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
  targetSleep: number;
  onTargetSleepChange: (val: number) => void;
  notificationsEnabled: boolean;
  onNotificationsToggle: (enabled: boolean) => void;
  targetBedtime: string;
  onTargetBedtimeChange: (val: string) => void;
  windDownMinutes: number;
  onWindDownMinutesChange: (val: number) => void;
  onCalendarExport: () => void;
  session: Session | null;
}

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  onDataChanged, 
  targetSleep, 
  onTargetSleepChange,
  notificationsEnabled,
  onNotificationsToggle,
  targetBedtime,
  onTargetBedtimeChange,
  windDownMinutes,
  onWindDownMinutesChange,
  onCalendarExport,
  session,
}: SettingsModalProps) {
  const [statusMsg, setStatusMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Auth state for sign-in panel
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);

  // Fetch username when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchProfile().then(p => {
        if (p?.username) setUsername(p.username);
      }).catch(console.error);
    } else {
      setUsernameError('');
    }
  }, [isOpen]);

  const handleUpdateUsername = async () => {
    if (!username.trim()) return;
    setIsUpdatingUsername(true);
    setUsernameError('');
    try {
      const entries = await fetchEntries();
      const streak = calculateLoggingStreak(entries);
      await syncProfile(username.trim(), streak);
      showStatus('Username updated successfully!');
      onDataChanged(); // Might trigger a re-render in App
    } catch (err: any) {
      if (err.code === '23505') {
        setUsernameError('Username already taken.');
      } else {
        setUsernameError('Failed to update username. Try again.');
      }
    } finally {
      setIsUpdatingUsername(false);
    }
  };

  const handleExport = async () => {
    try {
      const entries = await fetchEntries();
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sleep-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showStatus('Data exported successfully.');
    } catch (err) {
      showStatus('Failed to export data.');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content) as SleepEntry[];
        
        if (!Array.isArray(parsed)) {
          throw new Error('Invalid format');
        }

        // Upload in parallel
        await Promise.all(parsed.map((entry) => addEntry(entry)));

        showStatus('Data imported successfully!');
        onDataChanged();
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (err) {
        showStatus('Invalid file format or network issue. Import failed.');
      }
    };
    reader.readAsText(file);
  };
  
  const handleClear = async () => {
    if (confirm('Are you absolutely sure? This will delete all your sleep data irreversibly from the cloud.')) {
      try {
        await clearEntries();
        showStatus('All data cleared.');
        onDataChanged();
      } catch (err) {
        showStatus('Failed to clear data.');
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onClose();
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setAuthMessage('');
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        onClose();
      } else {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        setAuthMessage('Check your email for the confirmation link.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: Capacitor.isNativePlatform()
            ? 'https://sleepaa.netlify.app'
            : window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message || 'Failed to start Google login.');
    }
  };

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-stone-900/40 dark:bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 w-full rounded-t-[2.5rem] bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] p-6 pb-12 sm:relative sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem] sm:max-w-md sm:p-8 sm:shadow-2xl overflow-y-auto max-h-[92dvh] sm:max-h-[85vh]"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-serif font-medium text-stone-900 dark:text-stone-100">Data & Settings</h2>
              <button
                onClick={onClose}
                className="p-2 text-stone-400 dark:text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 stroke-[1.5]" />
              </button>
            </div>

            <div className="space-y-4">
              {/* ── Always Visible Settings ── */}
              
              {/* Target Sleep Duration */}
              <div className="p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-medium text-stone-800 dark:text-stone-100 mb-1">Target Sleep Duration</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Used to calculate your rolling sleep debt.</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="4"
                    max="14"
                    step="0.5"
                    value={targetSleep}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) onTargetSleepChange(val);
                    }}
                    className="w-24 px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500 outline-none text-center font-medium shadow-sm transition-all"
                  />
                  <span className="text-sm text-stone-500 dark:text-stone-400 font-medium">hours</span>
                </div>
              </div>

              {/* Smart Wind-Down */}
              <div className="p-4 sm:p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-indigo-900 dark:text-indigo-100 mb-1">Smart Wind-Down</h3>
                    <p className="text-xs text-indigo-700/70 dark:text-indigo-300/70">Receive a notification before bed.</p>
                  </div>
                  <button
                    onClick={() => onNotificationsToggle(!notificationsEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${notificationsEnabled ? 'bg-indigo-500' : 'bg-stone-300 dark:bg-stone-700'}`}
                    role="switch"
                    aria-checked={notificationsEnabled}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute left-0.5 inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${notificationsEnabled ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>
                </div>

                {notificationsEnabled && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="flex flex-col gap-3 pt-3 border-t border-indigo-100 dark:border-indigo-800/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-indigo-800 dark:text-indigo-300">Target Bedtime</span>
                      <input
                        type="time"
                        value={targetBedtime}
                        onChange={(e) => onTargetBedtimeChange(e.target.value)}
                        className="px-2 py-1.5 bg-white dark:bg-stone-900 border border-indigo-200 dark:border-indigo-700/50 rounded-lg text-indigo-900 dark:text-indigo-100 text-xs font-medium outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-indigo-800 dark:text-indigo-300">Alert Me (Minutes Before)</span>
                      <input
                        type="number"
                        min="5"
                        max="120"
                        step="5"
                        value={windDownMinutes}
                        onChange={(e) => onWindDownMinutesChange(Number(e.target.value))}
                        className="w-16 px-2 py-1.5 bg-white dark:bg-stone-900 border border-indigo-200 dark:border-indigo-700/50 rounded-lg text-indigo-900 dark:text-indigo-100 text-xs text-center font-medium outline-none"
                      />
                    </div>
                    
                    <button
                      onClick={onCalendarExport}
                      className="mt-2 text-xs w-full py-2 bg-indigo-100 dark:bg-indigo-900/40 hover:bg-indigo-200 dark:hover:bg-indigo-800/60 text-indigo-700 dark:text-indigo-300 rounded-lg font-medium transition-colors"
                    >
                      Export to Mobile Calendar (.ics)
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Export Data */}
              <div className="p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-medium text-stone-800 dark:text-stone-100 mb-1">Export Data</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Download a JSON backup of your resting records.</p>
                </div>
                <button
                  onClick={handleExport}
                  className="flex flex-1 items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 text-sm font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Backup Now
                </button>
              </div>

              {/* ── Conditional Settings based on Session ── */}
              {!session ? (
                /* Sign-in panel for guests */
                <div className="p-5 sm:p-6 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-sm flex flex-col gap-4 mt-2">
                  <div className="text-center pb-2">
                    <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-1">Cloud Sync & Backup</h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">Sign in to sync your sleep data and unlock community features.</p>
                  </div>
                  <button onClick={handleGoogleAuth}
                    className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors shadow-sm text-sm font-medium text-stone-700 dark:text-stone-200">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-200 dark:border-stone-800" /></div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white dark:bg-stone-900 px-3 text-stone-400 uppercase tracking-widest">Or</span>
                    </div>
                  </div>
                  <form onSubmit={handleEmailAuth} className="space-y-3">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail className="w-4 h-4 text-stone-400" /></div>
                      <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="you@example.com" required
                        className="w-full pl-11 pr-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-400 outline-none transition-all text-sm" />
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="w-4 h-4 text-stone-400" /></div>
                      <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••" required
                        className="w-full pl-11 pr-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-400 outline-none transition-all text-sm" />
                    </div>
                    {authError && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-xl flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-red-600 dark:text-red-400">{authError}</p>
                      </div>
                    )}
                    {authMessage && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 rounded-xl flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">{authMessage}</p>
                      </div>
                    )}
                    <button type="submit" disabled={authLoading}
                      className="w-full bg-stone-900 dark:bg-white text-white dark:text-stone-900 hover:bg-stone-800 font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
                      {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                      {authMode === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                  </form>
                  <div className="text-center">
                    <button onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); setAuthMessage(''); }}
                      className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors">
                      {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Community Username */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 flex flex-col gap-3">
                    <div>
                      <h3 className="text-sm font-medium text-stone-800 dark:text-stone-100 mb-1">Community Username</h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400">Change how you appear on the leaderboard.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          maxLength={20}
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Your username"
                          className="flex-1 px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500 outline-none placeholder-stone-400 text-sm font-medium shadow-sm transition-all"
                        />
                        <button
                          onClick={handleUpdateUsername}
                          disabled={isUpdatingUsername || !username.trim()}
                          className="px-4 py-2 bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 text-sm font-medium rounded-xl hover:bg-stone-700 dark:hover:bg-stone-300 disabled:opacity-50 transition-colors"
                        >
                          {isUpdatingUsername ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                      {usernameError && <p className="text-xs text-red-500">{usernameError}</p>}
                    </div>
                  </div>

                  {/* Import Data */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 flex flex-col gap-3">
                    <div>
                      <h3 className="text-sm font-medium text-stone-800 dark:text-stone-100 mb-1">Import Data</h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400">Restore your records from a previous JSON backup.</p>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 text-sm font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Select Backup File
                    </button>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleImport}
                    />
                  </div>

                  {/* Account settings */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 flex flex-col gap-3">
                    <div>
                      <h3 className="text-sm font-medium text-stone-800 dark:text-stone-100 mb-1">Account settings</h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400">Sign out of your active tracking session.</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="flex flex-1 items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 text-sm font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>

                  {/* Danger Zone */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-rose-100 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/20 flex flex-col gap-3">
                    <div>
                      <h3 className="text-sm font-medium text-rose-800 dark:text-rose-400 mb-1">Danger Zone</h3>
                      <p className="text-xs text-rose-600/70 dark:text-rose-500/70">Permanently delete all tracking data from the cloud.</p>
                    </div>
                    <button
                      onClick={handleClear}
                      className="flex flex-1 items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-stone-900 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-sm font-medium rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/40 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear Data
                    </button>
                  </div>
                </>
              )}
            </div>

            {statusMsg && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4" />
                {statusMsg}
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
