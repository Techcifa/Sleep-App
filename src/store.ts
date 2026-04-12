import { SleepEntry } from './types';
import { isAfter, parseDate } from './utils/date';
import { supabase } from './lib/supabase';

function inferBedDate(entry: SleepEntry): 'same' | 'prev' {
  if (entry.bedDate) {
    return entry.bedDate;
  }
  return entry.bedTime > entry.wakeTime ? 'prev' : 'same';
}

function normalizeEntry(entry: any): SleepEntry {
  return {
    id: entry.id,
    date: entry.date,
    bedTime: entry.bedTime,
    bedDate: inferBedDate(entry),
    wakeTime: entry.wakeTime,
    duration: entry.duration,
    quality: entry.quality,
    notes: entry.notes || '',
    createdAt: Number(entry.createdAt),
  };
}

function sortEntries(entries: SleepEntry[]): SleepEntry[] {
  return [...entries].sort((a, b) => {
    const aDate = parseDate(a.date);
    const bDate = parseDate(b.date);

    if (isAfter(aDate, bDate)) return -1;
    if (isAfter(bDate, aDate)) return 1;
    return b.createdAt - a.createdAt;
  });
}

export async function fetchEntries(): Promise<SleepEntry[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('sleep_entries')
    .select('*')
    .eq('user_id', session.user.id)
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('Error fetching sleep entries:', error);
    return [];
  }
  
  if (!data) return [];
  
  const parsed = data.map(normalizeEntry);
  return sortEntries(parsed);
}

export async function addEntry(entry: SleepEntry): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");

  const payload = {
    ...entry,
    user_id: session.user.id,
  };
  
  const { error } = await supabase.from('sleep_entries').insert(payload);
  if (error) {
    console.error('Error adding sleep entry:', error);
    throw error;
  }
}

export async function updateEntry(entry: SleepEntry): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");

  const payload = {
    ...entry,
    user_id: session.user.id,
  };

  const { error } = await supabase
    .from('sleep_entries')
    .update(payload)
    .eq('id', entry.id)
    .eq('user_id', session.user.id);

  if (error) {
    console.error('Error updating sleep entry:', error);
    throw error;
  }
}

export async function deleteEntry(id: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from('sleep_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) {
    console.error('Error deleting sleep entry:', error);
    throw error;
  }
}

export async function clearEntries(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from('sleep_entries')
    .delete()
    .eq('user_id', session.user.id);

  if (error) {
    console.error('Error clearing sleep entries:', error);
    throw error;
  }
}
