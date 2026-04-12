import { useMemo } from 'react';
import { Tag, TrendingUp, TrendingDown, Clock, Star, BrainCircuit } from 'lucide-react';
import { SleepEntry } from '../types';
import { calculateTagCorrelations } from '../utils/analytics';

interface HabitCorrelatorProps {
  entries: SleepEntry[];
}

function formatDurationDiff(mins: number) {
  const isPositive = mins > 0;
  const absMins = Math.abs(Math.round(mins));
  const h = Math.floor(absMins / 60);
  const m = absMins % 60;
  
  const formatted = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return isPositive ? `+${formatted}` : `-${formatted}`;
}

export default function HabitCorrelator({ entries }: HabitCorrelatorProps) {
  const { best, worst, all } = useMemo(() => calculateTagCorrelations(entries), [entries]);

  if (all.length === 0) {
    return (
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-stone-200 dark:border-stone-800 shadow-sm text-center">
        <BrainCircuit className="w-8 h-8 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
        <h3 className="text-stone-800 dark:text-stone-100 font-medium font-serif mb-1">Habit Correlator Requires Data</h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
          Start adding "Habit Tags" (like Caffeine or Exercise) when logging your sleep. We need at least 2 logs with the same tag to calculate an impact score!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-stone-800 dark:text-stone-100 font-serif text-lg font-medium px-1">
        <Tag className="w-5 h-5 text-indigo-500" />
        Habit Impact Analysis
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {best && (
          <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-800/30 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Top Positive Habit</span>
              </div>
              <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg text-xs font-medium">
                {best.count} Logs
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-serif font-medium text-stone-800 dark:text-stone-100 mb-3 block">
                {best.tag}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Star className="w-4 h-4 fill-emerald-600/20" />
                  +{best.qualityDelta.toFixed(1)} Quality
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Clock className="w-4 h-4" />
                  {formatDurationDiff(best.durationDeltaMins)}
                </div>
              </div>
            </div>
          </div>
        )}

        {worst && (
          <div className="bg-rose-50/50 dark:bg-rose-900/10 rounded-2xl p-5 border border-rose-100 dark:border-rose-800/30 flex flex-col justify-between">
             <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-rose-500" />
                <span className="text-sm font-medium text-rose-800 dark:text-rose-400">Most Disruptive</span>
              </div>
              <span className="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded-lg text-xs font-medium">
                {worst.count} Logs
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-serif font-medium text-stone-800 dark:text-stone-100 mb-3 block">
                {worst.tag}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                  <Star className="w-4 h-4 fill-rose-600/20" />
                  {worst.qualityDelta > 0 ? '+' : ''}{worst.qualityDelta.toFixed(1)} Quality
                </div>
                <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                  <Clock className="w-4 h-4" />
                  {formatDurationDiff(worst.durationDeltaMins)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 overflow-x-auto shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800 text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">
              <th className="px-4 py-3 font-medium">Habit Tag</th>
              <th className="px-4 py-3 font-medium text-right">Quality Shift</th>
              <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Duration Shift</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {all.map(impact => (
              <tr key={impact.tag} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-stone-800 dark:text-stone-200 text-sm">{impact.tag}</div>
                  <div className="text-[10px] text-stone-400 dark:text-stone-500">{impact.count} logs</div>
                </td>
                <td className={`px-4 py-3 text-right text-sm font-medium ${impact.qualityDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : impact.qualityDelta < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-500'}`}>
                  {impact.qualityDelta > 0 ? '+' : ''}{impact.qualityDelta.toFixed(1)}
                </td>
                <td className={`px-4 py-3 text-right text-sm font-medium hidden sm:table-cell ${impact.durationDeltaMins > 0 ? 'text-emerald-600 dark:text-emerald-400' : impact.durationDeltaMins < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-500'}`}>
                  {formatDurationDiff(impact.durationDeltaMins)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
