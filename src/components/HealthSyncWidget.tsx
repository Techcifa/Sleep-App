import React, { useState, useEffect } from 'react';
import { RefreshCw, Activity, CheckCircle2, AlertCircle, ShieldCheck, ChevronRight, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Health } from '@capgo/capacitor-health';
import { addEntry, fetchEntries } from '../store';
import { SleepEntry } from '../types';

interface Props {
  onSyncComplete: () => void;
}

const HC_SHOWN_KEY = 'health_connect_prompted';

export default function HealthSyncWidget({ onSyncComplete }: Props) {
  const [isNative, setIsNative] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  // 'idle' | 'rationale' | 'done'
  const [uiState, setUiState] = useState<'idle' | 'rationale' | 'done'>('idle');

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    setIsNative(true);

    // Auto-show the rationale dialog on first launch once
    Preferences.get({ key: HC_SHOWN_KEY }).then(({ value }) => {
      if (!value) {
        setUiState('rationale');
      }
    });
  }, []);

  if (!isNative) return null;

  // ── Dismiss rationale permanently ──────────────────────────────────────────
  const handleDismissRationale = async () => {
    await Preferences.set({ key: HC_SHOWN_KEY, value: 'true' });
    setUiState('idle');
  };

  // ── Accept rationale and start sync ────────────────────────────────────────
  const handleAcceptAndSync = async () => {
    await Preferences.set({ key: HC_SHOWN_KEY, value: 'true' });
    setUiState('idle');
    await doSync();
  };

  // ── Core sync logic ────────────────────────────────────────────────────────
  const doSync = async () => {
    setIsSyncing(true);
    setStatusMsg('');
    setErrorMsg('');

    try {
      // 1. Request Permissions
      const auth = await Health.requestAuthorization({ read: ['sleep'] });

      if (!auth.readAuthorized.includes('sleep')) {
        throw new Error(
          'Sleep permission was denied. Please open Health Connect and grant access to Rest & Renewal.'
        );
      }

      // 2. Query last 7 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);

      const result = await Health.readSamples({
        dataType: 'sleep',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      if (!result.samples || result.samples.length === 0) {
        setStatusMsg('No new sleep data found in Health Connect for the past 7 days.');
        setIsSyncing(false);
        return;
      }

      // 3. Aggregate by day — exclude awake/inBed samples
      const actualSleeps = result.samples.filter(
        (s) => s.sleepState !== 'awake' && s.sleepState !== 'inBed'
      );
      const dailySleepMap = new Map<string, { duration: number; bedTime: Date; wakeTime: Date }>();

      actualSleeps.forEach((sample) => {
        const start = new Date(sample.startDate);
        const end = new Date(sample.endDate);
        const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
        if (durationMinutes <= 0) return;

        const dateString =
          end.getFullYear() +
          '-' +
          String(end.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(end.getDate()).padStart(2, '0');

        const existing = dailySleepMap.get(dateString);
        if (existing) {
          existing.duration += durationMinutes;
          if (start < existing.bedTime) existing.bedTime = start;
          if (end > existing.wakeTime) existing.wakeTime = end;
        } else {
          dailySleepMap.set(dateString, { duration: durationMinutes, bedTime: start, wakeTime: end });
        }
      });

      // 4. Deduplicate against existing entries
      const existingEntries = await fetchEntries();
      const existingDates = new Set(existingEntries.map((e) => e.date));

      const formatTimeStr = (d: Date) =>
        `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

      let newEntriesAdded = 0;

      for (const [date, data] of dailySleepMap.entries()) {
        if (existingDates.has(date)) continue;

        const bedDateStr = data.bedTime.getDate() === data.wakeTime.getDate() ? 'same' : 'prev';
        const newEntry: SleepEntry = {
          id: `hc-${date}-${Math.random().toString(36).slice(2)}`,
          date,
          duration: data.duration,
          bedTime: formatTimeStr(data.bedTime),
          wakeTime: formatTimeStr(data.wakeTime),
          bedDate: bedDateStr,
          quality: 4,
          notes: 'Synced from Android Health Connect.',
          createdAt: Date.now(),
        };

        await addEntry(newEntry);
        newEntriesAdded++;
      }

      if (newEntriesAdded === 0) {
        setStatusMsg('Everything is already up to date!');
      } else {
        setStatusMsg(`Successfully imported ${newEntriesAdded} day${newEntriesAdded > 1 ? 's' : ''} of sleep data!`);
        onSyncComplete();
      }
    } catch (err: any) {
      console.error('Health Sync Error:', err);
      setErrorMsg(
        err.message ||
          'Failed to sync. Make sure Health Connect is installed and permissions are granted.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Rationale dialog (shown on first launch) ───────────────────────────────
  if (uiState === 'rationale') {
    return (
      <div className="bg-white dark:bg-stone-900 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl overflow-hidden shadow-md mb-6">
        {/* Header */}
        <div className="bg-indigo-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-white" />
            <span className="text-white font-semibold text-base">Health Connect Access</span>
          </div>
          <button onClick={handleDismissRationale} className="text-indigo-200 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          <p className="text-stone-700 dark:text-stone-300 text-sm leading-relaxed mb-4">
            <strong>Rest & Renewal</strong> can automatically import your nightly sleep data from
            Android Health Connect — including sessions recorded by your smartwatch, fitness
            ring, or phone sensor.
          </p>

          <div className="space-y-3 mb-5">
            {[
              { icon: '✅', text: 'Read sleep session start & end times' },
              { icon: '✅', text: 'Read sleep stage data (deep, REM, light) if available' },
              { icon: '❌', text: 'We never sell or share your health data' },
              { icon: '❌', text: 'We never access Health Connect in the background' },
              { icon: '❌', text: 'We never use health data for advertising' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm text-stone-600 dark:text-stone-400">
                <span className="text-base leading-tight">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-stone-400 dark:text-stone-500 mb-5">
            You can revoke access at any time in your phone's Health Connect settings. View our full{' '}
            <a href="https://sleepaa.netlify.app/privacypolicy.html" className="underline text-indigo-500">
              Privacy Policy
            </a>
            .
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleDismissRationale}
              className="flex-1 py-3 rounded-xl text-sm font-medium border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
            >
              Maybe Later
            </button>
            <button
              onClick={handleAcceptAndSync}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center justify-center gap-2"
            >
              Connect Health Connect
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Compact sync banner (after rationale dismissed) ────────────────────────
  return (
    <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl">
            <Activity className="w-6 h-6 text-indigo-700 dark:text-indigo-400 stroke-[1.5]" />
          </div>
          <div>
            <h3 className="font-serif font-medium text-stone-900 dark:text-stone-100">Sync Health Connect</h3>
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-0.5">
              Import your latest sleep data automatically.
            </p>
          </div>
        </div>

        <button
          onClick={doSync}
          disabled={isSyncing}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-xl transition-colors shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {statusMsg && (
        <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 py-2 px-3 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {statusMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mt-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 py-2 px-3 rounded-lg border border-red-200 dark:border-red-500/20">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
