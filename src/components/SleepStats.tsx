import { useMemo } from 'react';
import { Clock, TrendingUp, Star, Award, HeartPulse, Moon, Sun, Sunrise, Sunset, Zap } from 'lucide-react';
import { SleepEntry } from '../types';
import { isAfter, parseDate, subDays } from '../utils/date';
import { calculateSleepDebt, detectChronotype, calculateConsistency } from '../utils/analytics';

interface SleepStatsProps {
  entries: SleepEntry[];
  targetHours: number;
  onEditTarget?: () => void;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function compareEntries(a: SleepEntry, b: SleepEntry) {
  const aDate = parseDate(a.date);
  const bDate = parseDate(b.date);

  if (isAfter(aDate, bDate)) return -1;
  if (isAfter(bDate, aDate)) return 1;
  return b.createdAt - a.createdAt;
}

export default function SleepStats({ entries, targetHours, onEditTarget }: SleepStatsProps) {
  const stats = useMemo(() => {
    if (entries.length === 0) return null;

    const sortedEntries = [...entries].sort(compareEntries);
    const totalSleep = sortedEntries.reduce((sum, entry) => sum + entry.duration, 0);
    const avgDuration = Math.round(totalSleep / sortedEntries.length);
    const avgQuality =
      Math.round(
        (sortedEntries.reduce((sum, entry) => sum + entry.quality, 0) / sortedEntries.length) * 10
      ) / 10;
    const avgHours = Math.round((avgDuration / 60) * 10) / 10;

    const bestEntry = sortedEntries.reduce((best, entry) => {
      if (!best) return entry;
      if (entry.duration > best.duration) return entry;
      if (entry.duration === best.duration && entry.quality > best.quality) return entry;
      return best;
    }, sortedEntries[0]);

    const minDuration = Math.min(...sortedEntries.map((entry) => entry.duration));
    const maxDuration = Math.max(...sortedEntries.map((entry) => entry.duration));

    const today = new Date();
    const recent = sortedEntries.filter((entry) => parseDate(entry.date) >= subDays(today, 6));
    const older = sortedEntries.filter((entry) => {
      const entryDate = parseDate(entry.date);
      return entryDate < subDays(today, 6) && entryDate >= subDays(today, 13);
    });

    const recentAvg = recent.length
      ? Math.round(((recent.reduce((sum, entry) => sum + entry.duration, 0) / recent.length) / 60) * 10) / 10
      : 0;
    const olderAvg = older.length
      ? Math.round(((older.reduce((sum, entry) => sum + entry.duration, 0) / older.length) / 60) * 10) / 10
      : null;

    const sleepDebt = calculateSleepDebt(entries, targetHours);
    const chronotype = detectChronotype(entries);
    const consistency = calculateConsistency(entries);

    return {
      totalEntries: sortedEntries.length,
      avgHours,
      avgQuality,
      bestEntry,
      minDuration,
      maxDuration,
      recentAvg,
      trend: olderAvg === null ? null : Math.round((recentAvg - olderAvg) * 10) / 10,
      sleepDebt,
      chronotype,
      consistency,
    };
  }, [entries, targetHours]);

  if (!stats) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-2.5 mb-3">
          <Clock className="w-5 h-5 text-stone-400 dark:text-stone-500 stroke-[1.5]" />
          <span className="text-sm font-medium text-stone-500 dark:text-stone-400">Average Duration</span>
        </div>
        <div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-stone-800 dark:text-stone-100">{stats.avgHours}h</div>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">per night</p>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-2.5 mb-3">
          <Star className="w-5 h-5 text-amber-500 stroke-[1.5]" />
          <span className="text-sm font-medium text-stone-500 dark:text-stone-400">Sleep Quality</span>
        </div>
        <div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-stone-800 dark:text-stone-100">{stats.avgQuality}/5</div>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">across {stats.totalEntries} entries</p>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-2.5 mb-3">
          <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-500 stroke-[1.5]" />
          <span className="text-sm font-medium text-stone-500 dark:text-stone-400">Best Rest</span>
        </div>
        <div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-stone-800 dark:text-stone-100 break-words">
            {formatDuration(stats.bestEntry.duration)}
          </div>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
            Quality rating: {stats.bestEntry.quality}/5
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-2.5 mb-3">
          <TrendingUp className="w-5 h-5 text-stone-400 dark:text-stone-500 stroke-[1.5]" />
          <span className="text-sm font-medium text-stone-500 dark:text-stone-400">Weekly Trend</span>
        </div>
        <div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-stone-800 dark:text-stone-100">{stats.recentAvg}h</div>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
            {stats.trend !== null
              ? `${stats.trend > 0 ? '+' : ''}${stats.trend}h compared to the previous 7 days`
              : 'Gathering more data'}
          </p>
        </div>
      </div>

      <div className="sm:col-span-2 bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <span className="text-sm font-medium text-stone-500 dark:text-stone-400">Sleep Duration Range</span>
          <span className="text-sm text-stone-600 dark:text-stone-300 font-medium break-words">
            {formatDuration(stats.minDuration)} to {formatDuration(stats.maxDuration)}
          </span>
        </div>
        <div className="h-2.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden relative">
          <div
            className="absolute h-full rounded-full bg-stone-400 dark:bg-stone-500"
            style={{
              left: `${(stats.minDuration / 600) * 100}%`,
              right: `${100 - (stats.maxDuration / 600) * 100}%`,
            }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[11px] text-stone-400 dark:text-stone-500">0h</span>
          <span className="text-[11px] text-stone-400 dark:text-stone-500">10h</span>
        </div>
      </div>
      <div className="sm:col-span-2 mt-4 mb-2 flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
        <div className="flex items-center gap-2 text-stone-800 dark:text-stone-100 font-serif text-lg font-medium">
          <HeartPulse className="w-5 h-5 text-rose-500" />
          Advanced Health Insights
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-2.5 mb-3">
          <Moon className="w-5 h-5 text-indigo-500 stroke-[1.5]" />
          <span className="text-sm font-medium text-stone-500 dark:text-stone-400">Sleep Debt (7 Days)</span>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <div className={`text-2xl sm:text-3xl font-serif font-medium ${stats.sleepDebt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {stats.sleepDebt > 0 ? `-${stats.sleepDebt.toFixed(1)}h` : `+${Math.abs(stats.sleepDebt).toFixed(1)}h`}
            </div>
            {onEditTarget && (
              <button 
                onClick={onEditTarget}
                className="text-[10px] uppercase tracking-wider font-bold text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
                title="Change Goal"
              >
                (Edit Goal)
              </button>
            )}
          </div>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
            {stats.sleepDebt > 0 
              ? `You are behind on your ${targetHours}h per night goal.` 
              : `You've exceeded your ${targetHours}h per night goal!`}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between">
        <div className="flex flex-row gap-4 h-full">
          <div className="flex-1 flex flex-col justify-between border-r border-stone-100 dark:border-stone-800 pr-4">
             <div className="flex items-center gap-2 mb-2 text-stone-500 dark:text-stone-400">
               {stats.chronotype === 'Early Bird' ? <Sunrise className="w-4 h-4 text-amber-500" /> : <Sun className="w-4 h-4 text-amber-500" />}
               <span className="text-xs font-medium uppercase tracking-wider">Chronotype</span>
             </div>
             <div className="text-lg font-serif font-medium text-stone-800 dark:text-stone-100 leading-tight">
               {stats.chronotype}
             </div>
          </div>
          <div className="flex-1 flex flex-col justify-between pl-2">
             <div className="flex items-center gap-2 mb-2 text-stone-500 dark:text-stone-400">
               <Zap className="w-4 h-4 text-emerald-500" />
               <span className="text-xs font-medium uppercase tracking-wider">Consistency</span>
             </div>
             <div className="text-lg font-serif font-medium text-stone-800 dark:text-stone-100 leading-tight">
               {stats.consistency.score}
             </div>
          </div>
        </div>
      </div>

    </div>
  );
}
