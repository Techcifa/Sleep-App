import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, AlertCircle, RefreshCw, Server } from 'lucide-react';
import { SleepEntry } from '../types';
import { parseDate } from '../utils/date';
import { Capacitor } from '@capacitor/core';

// On native Android, relative paths like '/api/...' resolve on localhost, not Netlify.
// We must use an absolute URL when running inside the Capacitor WebView.
const API_BASE = Capacitor.isNativePlatform() ? 'https://sleepaa.netlify.app' : '';

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function qualityLabel(value: number): string {
  const labels = ['', 'Very Poor', 'Poor', 'Fair', 'Good', 'Excellent'];
  return labels[value] || 'Unknown';
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${suffix}`;
}

function averageClockTime(values: number[]) {
  const total = values.reduce(
    (acc, value) => {
      const angle = (value / 1440) * Math.PI * 2;
      return {
        x: acc.x + Math.cos(angle),
        y: acc.y + Math.sin(angle),
      };
    },
    { x: 0, y: 0 }
  );

  let angle = Math.atan2(total.y / values.length, total.x / values.length);
  if (angle < 0) {
    angle += Math.PI * 2;
  }

  return Math.round((angle / (Math.PI * 2)) * 1440) % 1440;
}

function compareEntries(a: SleepEntry, b: SleepEntry) {
  if (a.date === b.date) {
    return b.createdAt - a.createdAt;
  }

  return a.date < b.date ? 1 : -1;
}

function buildSleepSummary(entries: SleepEntry[]): string {
  if (entries.length === 0) {
    return 'No sleep data available.';
  }

  const last14 = [...entries].sort(compareEntries).slice(0, 14);
  const avgDuration = last14.reduce((sum, entry) => sum + entry.duration, 0) / last14.length;
  const avgQuality = last14.reduce((sum, entry) => sum + entry.quality, 0) / last14.length;

  const bedTimes = last14.map((entry) => {
    const [hours, minutes] = entry.bedTime.split(':').map(Number);
    return hours * 60 + minutes;
  });
  const wakeTimes = last14.map((entry) => {
    const [hours, minutes] = entry.wakeTime.split(':').map(Number);
    return hours * 60 + minutes;
  });

  const avgBedMinutes = averageClockTime(bedTimes);
  const avgWakeMinutes = averageClockTime(wakeTimes);
  const avgBedH = Math.floor(avgBedMinutes / 60);
  const avgBedM = avgBedMinutes % 60;
  const avgWakeH = Math.floor(avgWakeMinutes / 60);
  const avgWakeM = avgWakeMinutes % 60;

  let summary = `SLEEP DATA SUMMARY (${last14.length} most recent entries out of ${entries.length} total):\n\n`;
  summary += `Overall Averages (last ${last14.length} nights):\n`;
  summary += `- Average sleep duration: ${formatDuration(Math.round(avgDuration))}\n`;
  summary += `- Average sleep quality: ${avgQuality.toFixed(1)}/5 (${qualityLabel(Math.round(avgQuality))})\n`;
  summary += `- Average bedtime: ${avgBedH.toString().padStart(2, '0')}:${avgBedM.toString().padStart(2, '0')}\n`;
  summary += `- Average wake time: ${avgWakeH.toString().padStart(2, '0')}:${avgWakeM.toString().padStart(2, '0')}\n\n`;

  summary += 'Nightly Details (most recent first):\n';
  last14.forEach((entry, index) => {
    summary += `${index + 1}. ${entry.date}: Bed at ${formatTime(entry.bedTime)}, woke at ${formatTime(entry.wakeTime)} -> ${formatDuration(entry.duration)}, quality ${entry.quality}/5 (${qualityLabel(entry.quality)})`;
    if (entry.notes.trim()) {
      summary += ` | Notes: "${entry.notes.trim()}"`;
    }
    summary += '\n';
  });

  const durations = last14.map((entry) => entry.duration);
  const maxDuration = Math.max(...durations);
  const minDuration = Math.min(...durations);
  const stdDev = Math.sqrt(
    durations.reduce((sum, duration) => sum + Math.pow(duration - avgDuration, 2), 0) /
      durations.length
  );

  summary += '\nPattern Highlights:\n';
  summary += `- Sleep duration range: ${formatDuration(minDuration)} to ${formatDuration(maxDuration)} (variation: ${formatDuration(maxDuration - minDuration)})\n`;
  summary += `- Duration consistency (standard deviation): ${formatDuration(Math.round(stdDev))}\n`;

  const qualityDistribution: Record<number, number> = {};
  last14.forEach((entry) => {
    qualityDistribution[entry.quality] = (qualityDistribution[entry.quality] || 0) + 1;
  });
  summary += `- Quality distribution: ${Object.entries(qualityDistribution)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([quality, count]) => `${qualityLabel(Number(quality))}: ${count} nights`)
    .join(', ')}\n`;

  const weekdayEntries = last14.filter((entry) => {
    const day = parseDate(entry.date).getDay();
    return day > 0 && day < 6;
  });
  const weekendEntries = last14.filter((entry) => {
    const day = parseDate(entry.date).getDay();
    return day === 0 || day === 6;
  });

  if (weekdayEntries.length > 0 && weekendEntries.length > 0) {
    const avgWeekdayDuration =
      weekdayEntries.reduce((sum, entry) => sum + entry.duration, 0) / weekdayEntries.length;
    const avgWeekendDuration =
      weekendEntries.reduce((sum, entry) => sum + entry.duration, 0) / weekendEntries.length;
    summary += `- Weekday average: ${formatDuration(Math.round(avgWeekdayDuration))} (${weekdayEntries.length} nights) vs weekend average: ${formatDuration(Math.round(avgWeekendDuration))} (${weekendEntries.length} nights)\n`;
  }

  return summary;
}

interface AIInsightsProps {
  entries: SleepEntry[];
}

export default function AIInsights({ entries }: AIInsightsProps) {
  const [insights, setInsights] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverReady, setServerReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkServer = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/health`);
        const data = await response.json();
        if (!cancelled) {
          setServerReady(Boolean(data?.providerConfigured));
        }
      } catch {
        if (!cancelled) {
          setServerReady(false);
        }
      }
    };

    checkServer();

    return () => {
      cancelled = true;
    };
  }, []);

  const analyzeSleep = useCallback(async () => {
    if (entries.length === 0) {
      setError('No sleep data to analyze. Log some sleep entries first.');
      return;
    }

    setLoading(true);
    setError('');
    setInsights('');

    try {
      const response = await fetch(`${API_BASE}/api/deepseek`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: buildSleepSummary(entries),
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `AI request failed with status ${response.status}`);
      }

      if (!data?.content) {
        throw new Error('No response received from the AI.');
      }

      setInsights(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [entries]);

  return (
    <div className="space-y-6">


      <button
        onClick={analyzeSleep}
        disabled={loading || entries.length === 0 || serverReady !== true}
        className="w-full py-3.5 rounded-2xl bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 text-sm font-medium hover:bg-stone-700 dark:hover:bg-stone-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2.5 shadow-sm"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing your sleep...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            {entries.length > 0 ? `Analyze ${entries.length} sleep ${entries.length === 1 ? 'entry' : 'entries'}` : 'Log some sleep first'}
          </>
        )}
      </button>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-800 dark:text-red-200 font-medium">Something went wrong</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
          </div>
        </div>
      )}

      {serverReady === false && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <Server className="w-5 h-5 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">AI Provider Not Configured</p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">The server is missing the DEEPSEEK_API_KEY environment variable. AI analysis is currently unavailable.</p>
          </div>
        </div>
      )}

      {insights && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-700 dark:text-amber-500" />
              </div>
              <h3 className="text-base font-serif font-medium text-stone-800 dark:text-stone-100">Your Sleep Analysis</h3>
            </div>
            <button
              onClick={analyzeSleep}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="prose prose-stone prose-sm max-w-none">
            {insights.split('\n').map((line, index) => {
              if (line.startsWith('## ')) {
                return (
                  <h2
                    key={index}
                    className="text-base font-serif font-medium text-stone-800 dark:text-stone-100 mt-6 mb-2 first:mt-0"
                  >
                    {line.replace('## ', '')}
                  </h2>
                );
              }

              if (line.startsWith('### ')) {
                return (
                  <h3 key={index} className="text-sm font-medium text-stone-700 dark:text-stone-200 mt-4 mb-1.5">
                    {line.replace('### ', '')}
                  </h3>
                );
              }

              if (line.startsWith('**') && line.endsWith('**')) {
                return (
                  <p key={index} className="text-sm font-medium text-stone-800 dark:text-stone-100 mt-3 mb-1">
                    {line.replace(/\*\*/g, '')}
                  </p>
                );
              }

              if (line.trim() === '') {
                return <div key={index} className="h-2" />;
              }

              const parts = line.split(/(\*\*[^*]+\*\*)/);
              return (
                <p key={index} className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-1.5">
                  {parts.map((part, partIndex) =>
                    part.startsWith('**') && part.endsWith('**') ? (
                      <span key={partIndex} className="font-medium text-stone-800 dark:text-stone-100">
                        {part.replace(/\*\*/g, '')}
                      </span>
                    ) : (
                      <span key={partIndex}>{part}</span>
                    )
                  )}
                </p>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800">
            <p className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed">
              Analysis generated by DeepSeek through your local server proxy. This is for
              informational purposes only and not medical advice.
            </p>
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="text-center py-12 text-stone-400 dark:text-stone-500">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Log some sleep entries to unlock AI analysis</p>
        </div>
      )}
    </div>
  );
}
