import { SleepEntry } from './types';
import { isAfter, parseDate } from './utils/date';
import { supabase } from './lib/supabase';

export interface UserProfile {
  id: string;
  username: string;
  current_streak: number;
}

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
    tags: Array.isArray(entry.tags) ? entry.tags : [],
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

export async function syncProfile(username: string, streak: number): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: session.user.id, username, current_streak: streak });
    
  if (error) console.error('Error syncing profile:', error);
}

export async function fetchProfile(): Promise<UserProfile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (error || !data) return null;
  return data as UserProfile;
}

export async function fetchGlobalLeaderboard(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('current_streak', { ascending: false })
    .limit(50);
  if (error) return [];
  return data as UserProfile[];
}

export async function fetchFriendsLeaderboard(usernames: string[]): Promise<UserProfile[]> {
  if (usernames.length === 0) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('username', usernames)
    .order('current_streak', { ascending: false });
  if (error) return [];
  return data as UserProfile[];
}
