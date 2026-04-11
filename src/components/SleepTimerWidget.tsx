import { useState, useEffect } from 'react';
import { Moon, Sun, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate } from '../utils/date';

interface SleepTimerWidgetProps {
  sleepStartTime: number | null;
  onStartSleep: () => void;
  onWakeUp: (startTime: number, endTime: number) => void;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

export default function SleepTimerWidget({ sleepStartTime, onStartSleep, onWakeUp }: SleepTimerWidgetProps) {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (!sleepStartTime) return;
    
    // Update immediately
    setElapsed(Date.now() - sleepStartTime);
    
    // Then tick every second
    const interval = setInterval(() => {
      setElapsed(Date.now() - sleepStartTime);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [sleepStartTime]);

  return (
    <AnimatePresence mode="wait">
      {sleepStartTime ? (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-stone-900 dark:bg-stone-800 text-stone-50 rounded-[1.75rem] p-5 sm:p-6 shadow-xl border border-stone-800 dark:border-stone-700 relative overflow-hidden"
        >
          {/* subtle background pulse pattern */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_white_10%,_transparent_70%)] animate-pulse" />
          
          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <div className="flex items-center gap-2 text-stone-400 mb-1 font-medium">
                <Moon className="w-4 h-4" />
                <span className="text-xs uppercase tracking-widest">Sleeping</span>
              </div>
              <div className="text-3xl sm:text-4xl font-serif font-light tracking-tight tabular-nums">
                {formatDuration(elapsed)}
              </div>
              <p className="text-xs text-stone-500 mt-2">
                Started {formatDate(new Date(sleepStartTime), 'h:mm a')}
              </p>
            </div>
            
            <button
              onClick={() => onWakeUp(sleepStartTime, Date.now())}
              className="w-full sm:w-auto px-8 py-3.5 bg-white text-stone-900 hover:bg-stone-100 rounded-xl font-medium shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Sun className="w-5 h-5" />
              Wake Up
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-stone-900 rounded-[1.75rem] p-5 sm:p-6 shadow-sm border border-stone-200 dark:border-stone-800"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="w-12 h-12 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-stone-600 dark:text-stone-400" />
              </div>
              <div>
                <h3 className="font-serif font-medium text-stone-900 dark:text-stone-100 text-lg">Ready for bed?</h3>
                <p className="text-sm text-stone-500 dark:text-stone-400">Start the timer to track your rest perfectly.</p>
              </div>
            </div>
            
            <button
              onClick={onStartSleep}
              className="w-full sm:w-auto px-6 py-3 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
            >
              <Moon className="w-4 h-4" />
              Start Sleep
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
