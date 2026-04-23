import { ReactNode, useMemo } from 'react';
import { SleepEntry } from '../types';
import { formatDate, parseDate } from '../utils/date';

interface SleepChartProps {
  entries: SleepEntry[];
}

function compareEntries(a: SleepEntry, b: SleepEntry) {
  if (a.date === b.date) {
    return b.createdAt - a.createdAt;
  }

  return a.date < b.date ? 1 : -1;
}

function chartPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return '';
  }

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function areaPath(points: Array<{ x: number; y: number }>, height: number) {
  if (points.length === 0) {
    return '';
  }

  const line = chartPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${last.x} ${height} L ${first.x} ${height} Z`;
}

function StatCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-6 border border-stone-200 dark:border-stone-800 shadow-sm">
      <h3 className="text-base font-serif font-medium text-stone-800 dark:text-stone-100 mb-4 sm:mb-6">{title}</h3>
      {children}
    </div>
  );
}

export default function SleepChart({ entries }: SleepChartProps) {
  const sortedEntries = useMemo(() => [...entries].sort(compareEntries), [entries]);

  const chartData = useMemo(() => {
    const grouped = new Map<string, SleepEntry[]>();

    sortedEntries.forEach((entry) => {
      const list = grouped.get(entry.date) ?? [];
      list.push(entry);
      grouped.set(entry.date, list);
    });

    return [...grouped.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .slice(0, 14)
      .reverse()
      .map(([date, dayEntries]) => {
        const avgDuration = Math.round(
          dayEntries.reduce((sum, entry) => sum + entry.duration, 0) / dayEntries.length
        );
        const avgQuality =
          Math.round(
            (dayEntries.reduce((sum, entry) => sum + entry.quality, 0) / dayEntries.length) * 10
          ) / 10;

        return {
          date: formatDate(parseDate(date), 'MMM d'),
          fullDate: date,
          duration: avgDuration,
          quality: avgQuality,
          hours: Math.round((avgDuration / 60) * 10) / 10,
        };
      });
  }, [sortedEntries]);

  const qualityData = useMemo(() => {
    if (sortedEntries.length === 0) return [];

    const distribution = [0, 0, 0, 0, 0];
    sortedEntries.forEach((entry) => {
      const qi = Math.max(0, Math.min(4, entry.quality - 1));
      distribution[qi] += 1;
    });

    return [
      { name: 'Very Poor', count: distribution[0] },
      { name: 'Poor', count: distribution[1] },
      { name: 'Fair', count: distribution[2] },
      { name: 'Good', count: distribution[3] },
      { name: 'Excellent', count: distribution[4] },
    ].filter((item) => item.count > 0);
  }, [sortedEntries]);

  const radarData = useMemo(
    () =>
      chartData.slice(-7).map((entry) => ({
        day: formatDate(parseDate(entry.fullDate), 'EEE'),
        hours: entry.hours,
        quality: entry.quality,
      })),
    [chartData]
  );

  const durationViz = useMemo(() => {
    const width = 640;
    const height = 220;
    const paddingX = 28;
    const paddingTop = 18;
    const paddingBottom = 30;
    const usableWidth = width - paddingX * 2;
    const usableHeight = height - paddingTop - paddingBottom;
    const maxHours = Math.max(12, ...chartData.map((entry) => entry.hours));
    const stepX = chartData.length > 1 ? usableWidth / (chartData.length - 1) : usableWidth;

    const points = chartData.map((entry, index) => ({
      x: paddingX + stepX * index,
      y: paddingTop + usableHeight - (entry.hours / maxHours) * usableHeight,
      label: entry.date,
    }));

    return {
      width,
      height,
      top: paddingTop,
      baseline: paddingTop + usableHeight,
      points,
      path: chartPath(points),
      area: areaPath(points, paddingTop + usableHeight),
      ticks: [0, 3, 6, 9, 12].filter((tick) => tick <= maxHours),
      maxHours,
    };
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
        <p className="text-stone-500 dark:text-stone-400 text-sm">Not enough journal entries to create visualizations yet.</p>
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">Add a sleep record to begin seeing your trends.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StatCard title="Rest Duration">
        <div className="-mx-2 sm:mx-0 overflow-x-auto">
        <svg
          viewBox={`0 0 ${durationViz.width} ${durationViz.height}`}
          className="min-w-[36rem] w-full h-56 sm:h-64 overflow-visible"
        >
          {durationViz.ticks.map((tick) => {
            const y =
              durationViz.top +
              (durationViz.baseline - durationViz.top) -
              (tick / durationViz.maxHours) * (durationViz.baseline - durationViz.top);

            return (
              <g key={tick}>
                <line
                  x1="28"
                  x2={durationViz.width - 28}
                  y1={y}
                  y2={y}
                  stroke="#e7e5e4"
                  strokeDasharray="4 6"
                />
                <text x="4" y={y + 4} fontSize="11" fill="#a8a29e">
                  {tick}h
                </text>
              </g>
            );
          })}

          <path d={durationViz.area} fill="rgba(214, 211, 209, 0.45)" />
          <path d={durationViz.path} fill="none" stroke="#78716c" strokeWidth="3" strokeLinejoin="round" />

          {durationViz.points.map((point) => (
            <g key={point.label}>
              <circle cx={point.x} cy={point.y} r="4.5" fill="#78716c" />
              <text x={point.x} y={durationViz.height - 6} textAnchor="middle" fontSize="11" fill="#a8a29e">
                {point.label}
              </text>
            </g>
          ))}
        </svg>
        </div>
      </StatCard>

      <StatCard title="Sleep Quality Distribution">
        <div className="space-y-4">
          {qualityData.map((item) => {
            const percent = Math.max((item.count / sortedEntries.length) * 100, 6);
            return (
              <div key={item.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-stone-600 dark:text-stone-400">{item.name}</span>
                  <span className="text-sm font-medium text-stone-800 dark:text-stone-100">{item.count}</span>
                </div>
                <div className="h-3 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-stone-400 dark:bg-stone-500 transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </StatCard>

      {radarData.length >= 3 && (
        <StatCard title="Recent Patterns">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {radarData.map((entry) => (
              <div
                key={entry.day}
                className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-800/70 px-4 py-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{entry.day}</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">Daily snapshot</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-1">
                      <span>Hours</span>
                      <span>{entry.hours}h</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-stone-500 dark:bg-stone-400"
                        style={{ width: `${Math.min((entry.hours / 12) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-1">
                      <span>Quality</span>
                      <span>{entry.quality.toFixed(1)}/5</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-600/80 dark:bg-amber-500/80"
                        style={{ width: `${Math.min((entry.quality / 5) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </StatCard>
      )}
    </div>
  );
}
