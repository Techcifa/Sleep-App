import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sparkles } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('out'), 2500);
    return () => clearTimeout(holdTimer);
  }, []);

  // Random stars for background effect
  const stars = [...Array(12)].map((_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    delay: Math.random() * 2,
    size: Math.random() * 4 + 2
  }));

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {phase !== 'out' && (
        <motion.div
          key="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-950 overflow-hidden"
        >
          {/* Animated Background Stars */}
          {stars.map((star) => (
            <motion.div
              key={star.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 0.4, 0], scale: [0, 1, 0] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: star.delay,
                ease: "easeInOut"
              }}
              style={{
                position: 'absolute',
                top: star.top,
                left: star.left,
                width: star.size,
                height: star.size,
                backgroundColor: 'currentColor',
              }}
              className="rounded-full text-stone-300 dark:text-stone-700 blur-[1px]"
            />
          ))}

          {/* Soft expanding glow */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.8, 1.2, 1], opacity: [0, 0.6, 0.4] }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-96 h-96 rounded-full bg-stone-200/50 dark:bg-stone-800/30 blur-[100px]" />
          </motion.div>

          <div className="relative flex flex-col items-center gap-8">
            {/* Animated Logo Container */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ 
                duration: 1, 
                type: 'spring', 
                stiffness: 100, 
                damping: 15 
              }}
              className="relative"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="w-24 h-24 bg-stone-900 dark:bg-stone-800 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-stone-400/20 dark:shadow-black/60 ring-[12px] ring-stone-100 dark:ring-stone-900/60"
              >
                <motion.div
                  initial={{ rotate: -45, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 1, ease: "backOut" }}
                >
                  <Moon className="w-11 h-11 text-stone-50 fill-current" />
                </motion.div>
              </motion.div>

              {/* Sparkle effects around the logo */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="absolute -top-4 -right-4"
              >
                <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>
                  <Sparkles className="w-6 h-6 text-stone-400 dark:text-stone-600" />
                </motion.div>
              </motion.div>
            </motion.div>

            {/* App name with staggered word animation */}
            <div className="text-center">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="text-4xl font-serif font-medium tracking-tight text-stone-900 dark:text-stone-50"
              >
                Rest &amp; Renewal
              </motion.h1>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 1 }}
                className="flex items-center justify-center gap-2 mt-3"
              >
                <div className="h-[1px] w-8 bg-stone-200 dark:bg-stone-800" />
                <p className="text-xs uppercase tracking-[0.4em] text-stone-400 dark:text-stone-500 font-medium">
                  Mindful Journal
                </p>
                <div className="h-[1px] w-8 bg-stone-200 dark:bg-stone-800" />
              </motion.div>
            </div>
          </div>

          {/* Progress bar instead of just a dot */}
          <div className="absolute bottom-16 w-32 h-[2px] bg-stone-100 dark:bg-stone-900 rounded-full overflow-hidden">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 2.5, ease: "linear" }}
              className="w-full h-full bg-gradient-to-r from-transparent via-stone-400 dark:via-stone-600 to-transparent"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
