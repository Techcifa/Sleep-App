import React, { useState, useEffect } from 'react';
import { RefreshCw, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import { addEntry, fetchEntries } from '../store';
import { SleepEntry } from '../types';

interface Props {
  onSyncComplete: () => void;
}

export default function HealthSyncWidget({ onSyncComplete }: Props) {
  const [isNative, setIsNative] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  if (!isNative) return null;

  const handleSync = async () => {
    setIsSyncing(true);
    setStatusMsg('');
    setErrorMsg('');

    try {
      // 1. Request Permissions
      const auth = await Health.requestAuthorization({
        read: ['sleep'],
      });

      if (!auth.readAuthorized.includes('sleep')) {
        throw new Error('Health Connect sleep permission was denied by the OS or the Health Connect app is not installed.');
      }

      // 2. Query last 7 days of sleep
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);

      const result = await Health.readSamples({
        dataType: 'sleep',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      if (!result.samples || result.samples.length === 0) {
        setStatusMsg('No new sleep data found in Health Connect.');
        setIsSyncing(false);
        return;
      }

      // 3. Aggregate sleep samples by day
      const actualSleeps = result.samples.filter(s => s.sleepState !== 'awake' && s.sleepState !== 'inBed');
      const dailySleepMap = new Map<string, { duration: number; bedTime: Date; wakeTime: Date }>();

      actualSleeps.forEach(sample => {
        const start = new Date(sample.startDate);
        const end = new Date(sample.endDate);
        const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
        
        if (durationMinutes <= 0) return;
        
        // Use the wake-up date as the "calendar date" of the sleep
        const dateString = end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0') + '-' + String(end.getDate()).padStart(2, '0');
        
        const existing = dailySleepMap.get(dateString);
        if (existing) {
          existing.duration += durationMinutes;
          // Expand the time boundaries
          if (start < existing.bedTime) existing.bedTime = start;
          if (end > existing.wakeTime) existing.wakeTime = end;
        } else {
          dailySleepMap.set(dateString, {
            duration: durationMinutes,
            bedTime: start,
            wakeTime: end
          });
        }
      });

      // 4. Check existing entries to prevent duplicating the same day
      const existingEntries = await fetchEntries();
      const existingDates = new Set(existingEntries.map(e => e.date));

      let newEntriesAdded = 0;
      
      const formatTimeStr = (d: Date) => 
        `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

      for (const [date, data] of dailySleepMap.entries()) {
        if (existingDates.has(date)) continue; // skip if already manually logged

        const bedDateStr = data.bedTime.getDate() === data.wakeTime.getDate() ? 'same' : 'prev';

        const newEntry: SleepEntry = {
          id: `hc-${date}-${Date.now()}`, // pseudo-unique id avoiding typical local uuid collisions
          date: date,
          duration: data.duration,
          bedTime: formatTimeStr(data.bedTime),
          wakeTime: formatTimeStr(data.wakeTime),
          bedDate: bedDateStr, 
          quality: 4, // default acceptable quality
          notes: 'Securely synced from Android Health Connect natively.',
          createdAt: Date.now()
        };
        
        await addEntry(newEntry);
        newEntriesAdded++;
      }

      if (newEntriesAdded === 0) {
        setStatusMsg('All Health Connect data is already synced!');
      } else {
        setStatusMsg(`Successfully synced ${newEntriesAdded} new days from Health Connect!`);
        onSyncComplete(); // tell App.tsx to refresh dashboard charts
      }

    } catch (err: any) {
      console.error('Health Sync Error:', err);
      setErrorMsg(err.message || 'Failed to sync with Health Connect. Please ensure the app is installed and permissions are granted.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
        
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl">
            <Activity className="w-6 h-6 text-indigo-700 dark:text-indigo-400 stroke-[1.5]" />
          </div>
          <div>
            <h3 className="font-serif font-medium text-stone-900 dark:text-stone-100">Sync Health Connect</h3>
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-0.5">Automatically import your smartwatch or phone sleep data.</p>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-xl transition-colors shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>

      </div>

      {statusMsg && (
        <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 py-2 px-3 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4" /> {statusMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mt-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 py-2 px-3 rounded-lg border border-red-200 dark:border-red-500/20">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
