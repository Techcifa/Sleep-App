import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    // Hold for 1.4s after fade-in, then fade out
    const holdTimer = setTimeout(() => setPhase('out'), 1800);
    return () => clearTimeout(holdTimer);
  }, []);

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {phase !== 'out' && (
        <motion.div
          key="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-950"
        >
          {/* Soft radial glow behind the logo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 rounded-full bg-stone-200/60 dark:bg-stone-800/40 blur-3xl" />
          </div>

          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.55, type: 'spring', stiffness: 180, damping: 18 }}
            className="relative flex flex-col items-center gap-5"
          >
            {/* Logo */}
            <div className="w-20 h-20 bg-stone-900 dark:bg-stone-800 rounded-[1.75rem] flex items-center justify-center shadow-2xl shadow-stone-400/20 dark:shadow-black/40 ring-8 ring-stone-100 dark:ring-stone-900/60">
              <Moon className="w-9 h-9 text-stone-50 fill-current" />
            </div>

            {/* App name */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="text-center"
            >
              <h1 className="text-3xl font-serif font-medium tracking-tight text-stone-900 dark:text-stone-50">
                Rest &amp; Renewal
              </h1>
              <p className="text-xs uppercase tracking-[0.28em] text-stone-400 dark:text-stone-500 mt-1.5">
                A mindful sleep journal
              </p>
            </motion.div>
          </motion.div>

          {/* Bottom pulsing dot */}
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-16 w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-600"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
