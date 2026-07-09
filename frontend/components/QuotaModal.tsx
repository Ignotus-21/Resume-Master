'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, X, Sparkles, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function QuotaModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [resetTime, setResetTime] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const handleQuotaExceeded = (e: any) => {
      if (e.detail?.resetAt) {
        setResetTime(new Date(e.detail.resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
      setIsOpen(true);
    };

    window.addEventListener('quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('quota-exceeded', handleQuotaExceeded);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white border border-[#dadce0] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header Gradient */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-purple-900/50 to-blue-900/50 opacity-50" />

            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/5 hover:bg-white/10 text-[#5f6368] hover:text-[#202124] transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative p-8 pt-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1a73e8] to-[#174ea6] flex items-center justify-center mb-6 shadow-lg shadow-blue-500/10">
                <Sparkles className="h-8 w-8 text-white" />
              </div>

              <h2 className="text-2xl font-bold text-[#202124] mb-2">Free AI Quota Reached</h2>
              <p className="text-[#5f6368] mb-8 max-w-sm">
                You've hit the limit for our shared community key. It will automatically reset at <strong className="text-[#202124]">{resetTime || 'later'}</strong>.
              </p>

              <div className="w-full space-y-4">
                {!user ? (
                  <button
                    onClick={() => { setIsOpen(false); router.push('/signup'); }}
                    className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold py-3 px-6 rounded-xl hover:bg-zinc-200 transition"
                  >
                    <LogIn className="h-5 w-5" />
                    Sign Up & Bring Your Own Key
                  </button>
                ) : (
                  <button
                    onClick={() => { setIsOpen(false); router.push('/settings'); }}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#1a73e8] to-[#174ea6] text-white font-bold py-3 px-6 rounded-xl hover:opacity-90 transition shadow-lg shadow-blue-500/10"
                  >
                    <KeyRound className="h-5 w-5" />
                    Add Your Gemini API Key
                  </button>
                )}

                {!user && (
                  <p className="text-xs text-[#5f6368]">
                    Good news: All your guest data will automatically sync when you sign up!
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
