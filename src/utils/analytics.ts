import { SleepEntry } from '../types';
import { isAfter, parseDate, subDays, parseTime, formatDate } from './date';

export function calculateSleepDebt(entries: SleepEntry[], targetHours: number, trailingDays: number = 7): number {
  if (!entries || entries.length === 0) return 0;
  
  const today = new Date();
  const thresholdDate = subDays(today, trailingDays);
  
  const recentEntries = entries.filter(e => isAfter(parseDate(e.date), thresholdDate) || parseDate(e.date).getTime() === thresholdDate.getTime());
  
  if (recentEntries.length === 0) return 0;
  
  const targetMinutes = targetHours * 60;
  const uniqueDaysLogged = new Set(recentEntries.map(e => e.date)).size;
  const totalTarget = targetMinutes * uniqueDaysLogged;
  const totalActual = recentEntries.reduce((sum, e) => sum + e.duration, 0);
  
  // Debt in hours
  return (totalTarget - totalActual) / 60;
}

export function detectChronotype(entries: SleepEntry[]): string {
  if (!entries || entries.length === 0) return "Gathering Data";

  const bedTimes = entries.slice(0, 30).map(e => {
    let [hours, minutes] = e.bedTime.split(':').map(Number);
    // Adjust hours so 00:00 - 11:59 is treated as 24:00 - 35:59 for sequential averaging
    if (hours < 12) {
      hours += 24;
    }
    return hours * 60 + minutes;
  });

  const avgMinutes = bedTimes.reduce((sum, time) => sum + time, 0) / bedTimes.length;
  
  // 22:30 = 22 * 60 + 30 = 1350
  if (avgMinutes <= 1350) {
    return 'Early Bird';
  } 
  // 24:00 = 24 * 60 = 1440
  else if (avgMinutes > 1440) {
    return 'Night Owl';
  } 
  
  return 'Flexible Rhythm'; // Neutral
}

export function calculateConsistency(entries: SleepEntry[]): { score: string; varianceMins: number } {
  if (!entries || entries.length < 3) return { score: "Gathering Data", varianceMins: 0 };

  const recent = entries.slice(0, 14);
  const bedTimes = recent.map(e => {
    let [hours, minutes] = e.bedTime.split(':').map(Number);
    if (hours < 12) hours += 24;
    return hours * 60 + minutes;
  });

  const mean = bedTimes.reduce((sum, val) => sum + val, 0) / bedTimes.length;
  const squareDiffs = bedTimes.map(val => Math.pow(val - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / squareDiffs.length;
  
  const stdDevMins = Math.sqrt(avgSquareDiff);

  if (stdDevMins <= 45) {
    return { score: 'Highly Regimented', varianceMins: stdDevMins };
  } else if (stdDevMins <= 90) {
    return { score: 'Moderately Consistent', varianceMins: stdDevMins };
  } else {
    return { score: 'Erratic Schedule', varianceMins: stdDevMins };
  }
}

export function calculateLoggingStreak(entries: SleepEntry[]): number {
  if (!entries || entries.length === 0) return 0;
  
  // Extract unique dates sorted descending
  const uniqueDates = Array.from(new Set(entries.map(e => e.date))).sort((a, b) => b.localeCompare(a));
  
  if (uniqueDates.length === 0) return 0;

  const getDayDiff = (d1: string, d2: string) => {
    // using UTC to avoid timezone leap bugs
    const date1 = new Date(d1 + 'T00:00:00Z');
    const date2 = new Date(d2 + 'T00:00:00Z');
    return Math.round((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
  };

  const todayStr = formatDate(new Date(), 'yyyy-MM-dd');
  const mostRecentStr = uniqueDates[0];

  // If the last log wasn't today or yesterday, streak is broken
  const diffFromToday = getDayDiff(todayStr, mostRecentStr);
  if (diffFromToday > 1) {
    return 0;
  }

  let streak = 1;
  for (let i = 0; i < uniqueDates.length - 1; i++) {
    if (getDayDiff(uniqueDates[i], uniqueDates[i + 1]) === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  threshold: number;
  iconType: 'star' | 'moon' | 'crown' | 'sparkles';
  color: string;
  isUnlocked: boolean;
}

export function getUnlockedBadges(streak: number): Badge[] {
  const allBadges: Omit<Badge, 'isUnlocked'>[] = [
    { id: 'b1', name: 'Novice Dreamer', description: 'Logged sleep for 3 consecutive days.', threshold: 3, iconType: 'star', color: 'from-amber-200 to-amber-500' },
    { id: 'b2', name: 'Rhythmic Sleeper', description: 'Logged sleep for 7 consecutive days.', threshold: 7, iconType: 'moon', color: 'from-blue-300 to-indigo-500' },
    { id: 'b3', name: 'Deep Sleeper', description: 'Logged sleep for 14 consecutive days.', threshold: 14, iconType: 'sparkles', color: 'from-fuchsia-300 to-purple-600' },
    { id: 'b4', name: 'Lucid Master', description: 'Logged sleep for 30 consecutive days.', threshold: 30, iconType: 'crown', color: 'from-yellow-300 via-amber-400 to-orange-500' },
  ];

  return allBadges.map(b => ({
    ...b,
    isUnlocked: streak >= b.threshold
  }));
}

export interface TagImpact {
  tag: string;
  count: number;
  qualityDelta: number;
  durationDeltaMins: number;
}

export function calculateTagCorrelations(entries: SleepEntry[]): { best: TagImpact | null; worst: TagImpact | null; all: TagImpact[] } {
  if (!entries || entries.length < 2) return { best: null, worst: null, all: [] };

  const totalQuality = entries.reduce((sum, e) => sum + e.quality, 0);
  const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0);
  
  const baselineQuality = totalQuality / entries.length;
  const baselineDuration = totalDuration / entries.length;

  const tagMap = new Map<string, SleepEntry[]>();
  
  entries.forEach(entry => {
    if (entry.tags && Array.isArray(entry.tags)) {
      entry.tags.forEach(tag => {
        if (!tagMap.has(tag)) tagMap.set(tag, []);
        tagMap.get(tag)!.push(entry);
      });
    }
  });

  const impacts: TagImpact[] = [];

  tagMap.forEach((taggedEntries, tag) => {
    if (taggedEntries.length < 2) return; // Need at least 2 occurrences for statistical relevance

    const tagQuality = taggedEntries.reduce((sum, e) => sum + e.quality, 0) / taggedEntries.length;
    const tagDuration = taggedEntries.reduce((sum, e) => sum + e.duration, 0) / taggedEntries.length;

    impacts.push({
      tag,
      count: taggedEntries.length,
      qualityDelta: tagQuality - baselineQuality,
      durationDeltaMins: tagDuration - baselineDuration
    });
  });

  if (impacts.length === 0) return { best: null, worst: null, all: [] };

  impacts.sort((a, b) => b.qualityDelta - a.qualityDelta); // Highest quality impact first

  return {
    best: impacts[0].qualityDelta > 0 ? impacts[0] : null,
    worst: impacts[impacts.length - 1].qualityDelta < 0 ? impacts[impacts.length - 1] : null,
    all: impacts
  };
}
