import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Star, Moon, Crown, Sparkles, Lock } from 'lucide-react';
import { SleepEntry } from '../types';
import { calculateLoggingStreak, getUnlockedBadges, Badge } from '../utils/analytics';

interface GamificationWidgetProps {
  entries: SleepEntry[];
}

export default function GamificationWidget({ entries }: GamificationWidgetProps) {
  const { streak, badges } = useMemo(() => {
    const currentStreak = calculateLoggingStreak(entries);
    const configuredBadges = getUnlockedBadges(currentStreak);
    return { streak: currentStreak, badges: configuredBadges };
  }, [entries]);

  const getBadgeIcon = (type: Badge['iconType']) => {
    switch (type) {
      case 'star': return Star;
      case 'moon': return Moon;
      case 'sparkles': return Sparkles;
      case 'crown': return Crown;
      default: return Star;
    }
  };

  if (streak === 0 && entries.length === 0) return null; // Don't show if entirely empty history

  return (
    <div className="bg-white dark:bg-stone-900 rounded-[1.75rem] border border-stone-200/80 dark:border-stone-800/80 shadow-sm overflow-hidden mb-8">
      <div className="p-5 sm:p-7 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-50/50 via-white to-white dark:from-orange-900/10 dark:via-stone-900 dark:to-stone-900">
        
        {/* Streak Counter */}
        <div className="flex flex-col items-center justify-center shrink-0">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className={`relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br ${streak > 0 ? 'from-orange-400 to-rose-500 shadow-lg shadow-orange-500/30' : 'from-stone-200 to-stone-300 dark:from-stone-700 dark:to-stone-800'} p-0.5`}
          >
            <div className="absolute inset-0.5 bg-white dark:bg-stone-900 rounded-full flex flex-col items-center justify-center z-10">
              <Flame className={`w-7 h-7 mb-0.5 ${streak > 0 ? 'text-orange-500 fill-orange-500/20' : 'text-stone-400 dark:text-stone-500'}`} />
              <span className={`text-xl font-bold font-serif leading-none ${streak > 0 ? 'text-stone-800 dark:text-stone-100' : 'text-stone-400 dark:text-stone-500'}`}>
                {streak}
              </span>
            </div>
            {/* Pulsing ring if active streak */}
            {streak > 0 && (
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full border-2 border-orange-500/50"
              />
            )}
          </motion.div>
          <span className="mt-3 text-xs sm:text-sm font-medium uppercase tracking-widest text-stone-500 dark:text-stone-400">
            Day Streak
          </span>
        </div>

        {/* Badges Container */}
        <div className="flex-1 w-full border-t border-stone-100 dark:border-stone-800/50 sm:border-t-0 sm:border-l pt-6 sm:pt-0 sm:pl-8">
          <div className="flex flex-col mb-4 text-center sm:text-left">
            <h3 className="text-sm font-medium text-stone-800 dark:text-stone-100">Your Achievements</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Keep logging consistently to unlock higher tiers.</p>
          </div>
          
          <div className="grid grid-cols-4 gap-3 sm:gap-4">
            {badges.map((badge) => {
              const Icon = getBadgeIcon(badge.iconType);
              const isUnlocked = badge.isUnlocked;

              return (
                <div key={badge.id} className="flex flex-col items-center group relative">
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-2 transition-all duration-300 ${isUnlocked ? `bg-gradient-to-br ${badge.color} shadow-md` : 'bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700'}`}>
                    {isUnlocked ? (
                      <Icon className="w-6 h-6 text-white drop-shadow-sm stroke-[1.5]" />
                    ) : (
                      <Lock className="w-5 h-5 text-stone-300 dark:text-stone-600 stroke-[1.5]" />
                    )}
                  </div>
                  
                  {/* Tooltip on Hover */}
                  <div className="absolute top-16 sm:top-18 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 w-40 mt-2">
                    <div className="bg-stone-900 dark:bg-stone-800 text-white rounded-lg p-2.5 text-xs text-center shadow-xl border border-stone-800 dark:border-stone-700">
                      <div className="font-medium mb-1">{badge.name}</div>
                      <div className="text-stone-400 text-[10px] leading-tight">{badge.description}</div>
                      {!isUnlocked && (
                        <div className="mt-1.5 text-orange-400 font-medium text-[10px]">
                          Requires {badge.threshold} days (Currently {streak})
                        </div>
                      )}
                    </div>
                  </div>

                  <span className={`text-[10px] sm:text-xs font-medium text-center leading-tight sm:leading-tight px-1 ${isUnlocked ? 'text-stone-700 dark:text-stone-300' : 'text-stone-400 dark:text-stone-600'}`}>
                    {badge.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
