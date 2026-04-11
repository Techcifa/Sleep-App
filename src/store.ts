import { SleepEntry } from './types';
import { isAfter, parseDate } from './utils/date';

const STORAGE_KEY = 'sleep-tracker-entries';

function inferBedDate(entry: SleepEntry): 'same' | 'prev' {
  if (entry.bedDate) {
    return entry.bedDate;
  }

  return entry.bedTime > entry.wakeTime ? 'prev' : 'same';
}

function normalizeEntry(entry: SleepEntry): SleepEntry {
  return {
    ...entry,
    bedDate: inferBedDate(entry),
  };
}

function sortEntries(entries: SleepEntry[]): SleepEntry[] {
  return [...entries].sort((a, b) => {
    const aDate = parseDate(a.date);
    const bDate = parseDate(b.date);

    if (isAfter(aDate, bDate)) {
      return -1;
    }

    if (isAfter(bDate, aDate)) {
      return 1;
    }

    return b.createdAt - a.createdAt;
  });
}

export function getEntries(): SleepEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsed: SleepEntry[] = data ? JSON.parse(data) : [];
    return sortEntries(parsed.map(normalizeEntry));
  } catch {
    return [];
  }
}

export function saveEntries(entries: SleepEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sortEntries(entries.map(normalizeEntry))));
}

export function addEntry(entry: SleepEntry): SleepEntry[] {
  const entries = getEntries().filter((existing) => existing.id !== entry.id);
  const nextEntries = [normalizeEntry(entry), ...entries];
  saveEntries(nextEntries);
  return nextEntries;
}

export function deleteEntry(id: string): SleepEntry[] {
  const entries = getEntries().filter((entry) => entry.id !== id);
  saveEntries(entries);
  return entries;
}

export function updateEntry(updated: SleepEntry): SleepEntry[] {
  const entries = getEntries();
  const hasMatch = entries.some((entry) => entry.id === updated.id);
  const nextEntries = hasMatch
    ? entries.map((entry) => (entry.id === updated.id ? normalizeEntry(updated) : entry))
    : [normalizeEntry(updated), ...entries];

  saveEntries(nextEntries);
  return nextEntries;
}
