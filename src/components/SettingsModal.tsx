import { useState, useRef } from 'react';
import { X, Download, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SleepEntry } from '../types';
import { getEntries, saveEntries } from '../store';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export default function SettingsModal({ isOpen, onClose, onDataChanged }: SettingsModalProps) {
  const [statusMsg, setStatusMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const entries = getEntries();
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sleep-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showStatus('Data exported successfully.');
    } catch (err) {
      showStatus('Failed to export data.');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content) as SleepEntry[];
        
        if (!Array.isArray(parsed)) {
          throw new Error('Invalid format');
        }

        saveEntries(parsed);
        showStatus('Data imported successfully!');
        onDataChanged();
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (err) {
        showStatus('Invalid file format. Import failed.');
      }
    };
    reader.readAsText(file);
  };
  
  const handleClear = () => {
    if (confirm('Are you absolutely sure? This will delete all your sleep data irreversibly.')) {
      saveEntries([]);
      showStatus('All data cleared.');
      onDataChanged();
    }
  };

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-stone-900/40 dark:bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-stone-900 rounded-[1.75rem] border border-stone-200 dark:border-stone-800 shadow-2xl p-6 sm:p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-serif font-medium text-stone-900 dark:text-stone-100">Data & Settings</h2>
              <button
                onClick={onClose}
                className="p-2 text-stone-400 dark:text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 stroke-[1.5]" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-medium text-stone-800 dark:text-stone-100 mb-1">Export Data</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Download a JSON backup of your resting records.</p>
                </div>
                <button
                  onClick={handleExport}
                  className="flex flex-1 items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 text-sm font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Backup Now
                </button>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-medium text-stone-800 dark:text-stone-100 mb-1">Import Data</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Restore your records from a previous JSON backup.</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 text-sm font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Select Backup File
                </button>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImport}
                />
              </div>

              <div className="p-4 sm:p-5 rounded-2xl border border-rose-100 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/20 flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-medium text-rose-800 dark:text-rose-400 mb-1">Danger Zone</h3>
                  <p className="text-xs text-rose-600/70 dark:text-rose-500/70">Permanently delete all your tracking data.</p>
                </div>
                <button
                  onClick={handleClear}
                  className="flex flex-1 items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-stone-900 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-sm font-medium rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/40 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Data
                </button>
              </div>
            </div>

            {statusMsg && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4" />
                {statusMsg}
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
