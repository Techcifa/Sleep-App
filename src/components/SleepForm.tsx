import { useState, useEffect } from 'react';
import { Calendar, Moon, Sun, Star, FileText, Plus, Check } from 'lucide-react';
import { SleepEntry } from '../types';
import { addEntry, updateEntry } from '../store';
import { addDays, formatDate, isAfter, parseTime } from '../utils/date';

interface SleepFormProps {
  onEntrySaved: (entry: SleepEntry) => void;
  initialEntry?: SleepEntry | null;
  isFromTimer?: boolean;
}

function inferBedDate(entry: SleepEntry) {
  if (entry.bedDate) {
    return entry.bedDate;
  }

  return isAfter(
    parseTime(entry.bedTime),
    parseTime(entry.wakeTime)
  )
    ? 'prev'
    : 'same';
}

export default function SleepForm({ onEntrySaved, initialEntry, isFromTimer }: SleepFormProps) {
  const today = formatDate(new Date(), 'yyyy-MM-dd');

  const [date, setDate] = useState(today);
  const [bedTime, setBedTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [quality, setQuality] = useState(3);
  const [notes, setNotes] = useState('');
  const [calculatedDuration, setCalculatedDuration] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [bedDate, setBedDate] = useState<'same' | 'prev'>('prev');

  useEffect(() => {
    if (!initialEntry) {
      return;
    }

    setDate(initialEntry.date);
    setBedTime(initialEntry.bedTime);
    setBedDate(inferBedDate(initialEntry));
    setWakeTime(initialEntry.wakeTime);
    setQuality(initialEntry.quality);
    setNotes(initialEntry.notes);
  }, [initialEntry]);

  useEffect(() => {
    try {
      const bed = parseTime(bedTime);
      let wake = parseTime(wakeTime);

      if (bedDate === 'prev') {
        wake = addDays(wake, 1);
      }

      const diffMinutes = Math.round((wake.getTime() - bed.getTime()) / 60000);
      setCalculatedDuration(diffMinutes > 0 ? diffMinutes : 0);
    } catch {
      setCalculatedDuration(0);
    }
  }, [bedTime, wakeTime, bedDate]);

  const durationHours = Math.floor(calculatedDuration / 60);
  const durationMinutes = calculatedDuration % 60;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (calculatedDuration <= 0) {
      return;
    }

    const entry: SleepEntry = {
      id: (initialEntry?.id && !isFromTimer) ? initialEntry.id : (Date.now().toString(36) + Math.random().toString(36).substring(2, 9)),
      date,
      bedTime,
      bedDate,
      wakeTime,
      duration: calculatedDuration,
      quality,
      notes,
      createdAt: (initialEntry?.createdAt && !isFromTimer) ? initialEntry.createdAt : Date.now(),
    };

    if (initialEntry && !isFromTimer) {
      updateEntry(entry);
    } else {
      addEntry(entry);
    }

    onEntrySaved(entry);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);

    if (!initialEntry || isFromTimer) {
      setBedTime('23:00');
      setWakeTime('07:00');
      setQuality(3);
      setNotes('');
      setBedDate('prev');
    }
  };

  const getQualityLabel = (value: number) => {
    const labels = ['Very Poor', 'Poor', 'Fair', 'Good', 'Excellent'];
    return labels[value - 1];
  };

  return (
    <div className="max-w-lg mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-400 mb-3">
            <Calendar className="w-4 h-4 stroke-[1.5]" />
            Wake-up date
          </label>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500 focus:border-transparent outline-none transition-all color-scheme-dark"
          />
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-400 mb-4">
            <Moon className="w-4 h-4 stroke-[1.5]" />
            <span>Went to Bed</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs text-stone-400 dark:text-stone-500 mb-1">Time</label>
              <input
                type="time"
                value={bedTime}
                onChange={(event) => setBedTime(event.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500 focus:border-transparent outline-none transition-all color-scheme-dark"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-400 dark:text-stone-500 mb-1">Date</label>
              <select
                value={bedDate}
                onChange={(event) => setBedDate(event.target.value as 'same' | 'prev')}
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500 focus:border-transparent outline-none transition-all"
              >
                <option value="same">Same day</option>
                <option value="prev">Previous day</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-400 mb-4">
            <Sun className="w-4 h-4 stroke-[1.5]" />
            <span>Woke Up</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs text-stone-400 dark:text-stone-500 mb-1">Time</label>
              <input
                type="time"
                value={wakeTime}
                onChange={(event) => setWakeTime(event.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500 focus:border-transparent outline-none transition-all color-scheme-dark"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-400 dark:text-stone-500 mb-1">Date</label>
              <select
                value="same"
                disabled
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 text-stone-400 dark:text-stone-600 cursor-not-allowed"
              >
                <option>Same day</option>
              </select>
            </div>
          </div>

          {calculatedDuration > 0 ? (
            <div className="bg-stone-50 dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl p-4 text-center">
              <span className="text-2xl sm:text-3xl font-serif text-stone-800 dark:text-stone-100">
                {durationHours}h {durationMinutes}m
              </span>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">Total time resting</p>
            </div>
          ) : (
            <p className="text-xs text-rose-600">
              Choose a bedtime and wake time that produce a valid overnight sleep duration.
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-400 mb-3">
            <Star className="w-4 h-4 stroke-[1.5]" />
            Quality of Sleep
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setQuality(value)}
                className={`min-w-0 py-3 rounded-xl text-center transition-all ${
                  quality === value
                    ? 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 shadow-sm'
                    : 'bg-stone-50 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700'
                }`}
              >
                <div className="text-lg font-serif">{value}</div>
                <div className="text-[10px] mt-0.5 leading-tight">{getQualityLabel(value)}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-400 mb-3">
            <FileText className="w-4 h-4 stroke-[1.5]" />
            Journal Notes
          </label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="How did you feel upon waking? Any notable dreams?"
            rows={3}
            className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500 focus:border-transparent outline-none transition-all resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={calculatedDuration <= 0}
          className="w-full bg-stone-900 dark:bg-white hover:bg-stone-800 dark:hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed text-white dark:text-stone-900 font-medium py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus className="w-5 h-5 stroke-[1.5]" />
          {initialEntry && !isFromTimer ? 'Save Changes' : 'Log Entry'}
        </button>
      </form>

      {showSuccess && (
        <div className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-8 sm:bottom-8 sm:w-auto bg-stone-900 text-white px-4 sm:px-6 py-3 rounded-xl shadow-lg flex items-center justify-center sm:justify-start gap-2 text-sm z-50">
          <Check className="w-4 h-4" />
          Sleep entry saved successfully
        </div>
      )}
    </div>
  );
}
