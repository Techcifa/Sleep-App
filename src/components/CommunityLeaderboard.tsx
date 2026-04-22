import { useState, useEffect, useMemo } from 'react';
import { Users, Globe, UserPlus, Flame, Search, Medal, ShieldAlert } from 'lucide-react';
import { UserProfile, fetchGlobalLeaderboard, fetchFriendsLeaderboard, syncProfile, fetchProfile } from '../store';
import { getUnlockedBadges } from '../utils/analytics';
import { SleepEntry } from '../types';
import { calculateLoggingStreak } from '../utils/analytics';

interface CommunityLeaderboardProps {
  entries: SleepEntry[];
}

export default function CommunityLeaderboard({ entries }: CommunityLeaderboardProps) {
  const [activeTab, setActiveTab] = useState<'global' | 'friends'>('global');
  const [globalBoard, setGlobalBoard] = useState<UserProfile[]>([]);
  const [friendsBoard, setFriendsBoard] = useState<UserProfile[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [username, setUsername] = useState<string>('');
  const [isUsernameSet, setIsUsernameSet] = useState<boolean>(true); // assume true until fetch completes
  const [usernameInput, setUsernameInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [friendsList, setFriendsList] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('sleep_friends') || '[]');
    } catch {
      return [];
    }
  });
  const [friendInput, setFriendInput] = useState('');

  const currentStreak = useMemo(() => calculateLoggingStreak(entries), [entries]);

  useEffect(() => {
    // Check if user has a profile securely established.
    fetchProfile().then(profile => {
      if (profile && profile.username) {
        setUsername(profile.username);
        setIsUsernameSet(true);
        // Automatically resync their active local streak to the cloud if they have a username!
        syncProfile(profile.username, currentStreak);
      } else {
        setIsUsernameSet(false);
      }
      refreshBoards();
    });
  }, [currentStreak]);

  const refreshBoards = async () => {
    setIsRefreshing(true);
    const [global, friends] = await Promise.all([
      fetchGlobalLeaderboard(),
      fetchFriendsLeaderboard(friendsList)
    ]);
    setGlobalBoard(global);
    setFriendsBoard(friends);
    setIsRefreshing(false);
  };

  const handleSetUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    setErrorMsg('');
    
    try {
      // Save to database
      await syncProfile(usernameInput.trim(), currentStreak);
      setUsername(usernameInput.trim());
      setIsUsernameSet(true);
      refreshBoards();
    } catch (err: any) {
      if (err.code === '23505') {
        setErrorMsg('This username is already taken. Please choose another.');
      } else {
        setErrorMsg('Failed to set username. Please try again.');
      }
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const newFriend = friendInput.trim();
    if (!newFriend || friendsList.includes(newFriend)) {
      setFriendInput('');
      return;
    }
    
    const newList = [...friendsList, newFriend];
    setFriendsList(newList);
    localStorage.setItem('sleep_friends', JSON.stringify(newList));
    setFriendInput('');
    setIsRefreshing(true);
    const newFriendsBoard = await fetchFriendsLeaderboard(newList);
    setFriendsBoard(newFriendsBoard);
    setIsRefreshing(false);
  };

  const removeFriend = async (friendUsername: string) => {
    const newList = friendsList.filter(f => f !== friendUsername);
    setFriendsList(newList);
    localStorage.setItem('sleep_friends', JSON.stringify(newList));
    const newFriendsBoard = await fetchFriendsLeaderboard(newList);
    setFriendsBoard(newFriendsBoard);
  };

  const renderRankRow = (profile: UserProfile, index: number) => {
    const isMe = profile.username === username;
    const badges = getUnlockedBadges(profile.current_streak);
    // Find the highest unlocked badge
    const highestBadge = [...badges].reverse().find(b => b.isUnlocked);

    return (
      <div key={profile.id} className={`flex items-center justify-between p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800 last:border-0 ${isMe ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
        <div className="flex items-center gap-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-yellow-400 text-yellow-900 shadow-md shadow-yellow-400/20' : index === 1 ? 'bg-stone-300 text-stone-700 shadow-sm' : index === 2 ? 'bg-amber-600 text-amber-100 shadow-sm' : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'}`}>
            {index + 1}
          </div>
          <div className="flex flex-col">
            <span className={`font-medium ${isMe ? 'text-amber-800 dark:text-amber-400' : 'text-stone-800 dark:text-stone-200'}`}>
              {profile.username} {isMe && '(You)'}
            </span>
            {highestBadge && (
              <span className="text-[10px] text-stone-500 dark:text-stone-400 flex items-center gap-1 mt-0.5">
                <Medal className="w-3 h-3" /> {highestBadge.name}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2">
            <Flame className={`w-5 h-5 ${profile.current_streak > 0 ? 'text-orange-500 fill-orange-500/20' : 'text-stone-300 dark:text-stone-600'}`} />
            <span className={`font-serif text-lg font-bold min-w-[20px] text-right ${profile.current_streak > 0 ? 'text-stone-800 dark:text-stone-100' : 'text-stone-400 dark:text-stone-600'}`}>
              {profile.current_streak}
            </span>
          </div>
          {activeTab === 'friends' && !isMe && (
            <button onClick={() => removeFriend(profile.username)} className="text-xs text-rose-500 hover:text-rose-600 font-medium px-2 py-1 rounded bg-rose-50 dark:bg-rose-900/20">
              Remove
            </button>
          )}
        </div>
      </div>
    );
  };

  if (!isUsernameSet) {
    return (
      <div className="bg-white dark:bg-stone-900 rounded-[1.75rem] border border-stone-200 dark:border-stone-800 p-6 sm:p-8 shadow-sm max-w-md mx-auto text-center">
        <Users className="w-10 h-10 text-indigo-500 mx-auto mb-4" />
        <h2 className="text-2xl font-serif text-stone-900 dark:text-stone-100 mb-2">Join the Community</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
          Set a unique username to post your active Day Streak to the global leaderboard and let friends track your progress.
        </p>
        <form onSubmit={handleSetUsername} className="flex flex-col gap-3">
          <input
            type="text"
            required
            maxLength={20}
            value={usernameInput}
            onChange={e => setUsernameInput(e.target.value)}
            placeholder="Choose a username..."
            className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-center"
          />
          {errorMsg && (
            <p className="text-sm text-red-500 text-center font-medium bg-red-50 dark:bg-red-500/10 py-1.5 rounded-lg border border-red-100 dark:border-red-500/20">{errorMsg}</p>
          )}
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all shadow-md shadow-indigo-600/20">
            Join Leaderboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex bg-stone-100 dark:bg-stone-900/50 p-1 rounded-2xl max-w-sm mx-auto shadow-inner border border-stone-200/50 dark:border-stone-800/50">
        <button
          onClick={() => setActiveTab('global')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'global' ? 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'}`}
        >
          <Globe className="w-4 h-4" /> Global
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'friends' ? 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'}`}
        >
          <Users className="w-4 h-4" /> Friends
        </button>
      </div>

      {activeTab === 'friends' && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-5 border border-stone-200 dark:border-stone-800 shadow-sm">
          <form onSubmit={handleAddFriend} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={friendInput}
                onChange={e => setFriendInput(e.target.value)}
                placeholder="Search friend's exact username..."
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <button type="submit" disabled={!friendInput.trim()} className="shrink-0 flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-50 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border border-indigo-200 dark:border-indigo-800/30">
              <UserPlus className="w-4 h-4" /> Add
            </button>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-stone-900 rounded-[1.75rem] border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm relative">
        {isRefreshing && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-stone-100 dark:bg-stone-800 overflow-hidden">
            <div className="h-full bg-indigo-500 animate-[pulse_1.5s_ease-in-out_infinite] w-1/3" />
          </div>
        )}
        
        <div className="divide-y divide-stone-100 dark:divide-stone-800/50">
          {activeTab === 'global' ? (
            globalBoard.length > 0 ? globalBoard.map(renderRankRow) : (
              <div className="p-8 text-center text-stone-500 text-sm">Loading global leaders...</div>
            )
          ) : (
            friendsBoard.length > 0 ? friendsBoard.map(renderRankRow) : (
              <div className="p-10 text-center">
                <ShieldAlert className="w-8 h-8 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
                <p className="text-stone-500 dark:text-stone-400 text-sm">You haven't added any active friends yet. Use the search bar above to follow someone's exact username!</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
