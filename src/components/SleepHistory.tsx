import { Trash2, Edit2, Moon, Sun, Star } from 'lucide-react';
import { SleepEntry } from '../types';
import { deleteEntry } from '../store';
import { formatDate, parseDate } from '../utils/date';

interface SleepHistoryProps {
  entries: SleepEntry[];
  onEdit: (entry: SleepEntry) => void;
  onDelete: (id: string) => void;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatClockTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${suffix}`;
}

export default function SleepHistory({ entries, onEdit, onDelete }: SleepHistoryProps) {
  const handleDelete = (id: string) => {
    if (confirm('Permanently remove this entry?')) {
      deleteEntry(id);
      onDelete(id);
    }
  };

  const getQualityStars = (quality: number) =>
    Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`w-3.5 h-3.5 stroke-[1.5] ${
          index < quality ? 'text-amber-500 fill-amber-500' : 'text-stone-300'
        }`}
      />
    ));

  const getDurationBarColor = (minutes: number) => {
    if (minutes < 360) return 'bg-amber-700/80';
    if (minutes < 420) return 'bg-amber-500/80';
    return 'bg-emerald-600/80';
  };

  const getDurationPercent = (minutes: number) => {
    const maxMinutes = 600;
    return Math.min((minutes / maxMinutes) * 100, 100);
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-stone-200">
        <Moon className="w-12 h-12 text-stone-300 mx-auto mb-4 stroke-[1.5]" />
        <h3 className="text-lg font-serif font-medium text-stone-800 mb-1">No resting records yet</h3>
        <p className="text-sm text-stone-400">Your journal awaits its first sleep entry.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-6 shadow-sm transition-all"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-stone-500 tracking-wide uppercase text-xs">
                {formatDate(parseDate(entry.date), 'EEEE, MMMM d')}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 mt-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Moon className="w-4 h-4 text-stone-400 stroke-[1.5]" />
                  <span className="text-sm font-medium text-stone-800">
                    {formatClockTime(entry.bedTime)}
                  </span>
                </div>
                <div className="hidden sm:block text-stone-400 text-xs">to</div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sun className="w-4 h-4 text-stone-400 stroke-[1.5]" />
                  <span className="text-sm font-medium text-stone-800">
                    {formatClockTime(entry.wakeTime)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                onClick={() => onEdit(entry)}
                className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition-colors"
                title="Edit entry"
              >
                <Edit2 className="w-4 h-4 stroke-[1.5]" />
              </button>
              <button
                onClick={() => handleDelete(entry.id)}
                className="p-2 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-stone-50 transition-colors"
                title="Delete entry"
              >
                <Trash2 className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-0.5">{getQualityStars(entry.quality)}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-stone-400">Time asleep</span>
                <span className="text-sm font-serif font-medium text-stone-800">
                  {formatDuration(entry.duration)}
                </span>
              </div>
              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getDurationBarColor(entry.duration)}`}
                  style={{ width: `${getDurationPercent(entry.duration)}%` }}
                />
              </div>
            </div>
          </div>

          {entry.notes && (
            <div className="mt-4 pt-4 border-t border-stone-100">
              <p className="text-sm text-stone-500 italic leading-relaxed">"{entry.notes}"</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
