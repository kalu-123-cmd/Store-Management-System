import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow]     = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Don't show if already installed or dismissed this session
    if (localStorage.getItem('pwa-dismissed')) return;
    if (window.matchMedia('(display-mode: standalone)').matches) { setInstalled(true); return; }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      // Show banner after 3 seconds delay
      setTimeout(() => setShow(true), 3000);
    };
    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setShow(false);
      setInstalled(true);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-dismissed', '1');
  };

  if (installed || !show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 80 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4"
      >
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 flex items-center gap-4">
          {/* Icon */}
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
            <Smartphone size={24} />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm leading-tight">Install StoreOS</p>
            <p className="text-xs text-muted-foreground mt-0.5">Add to home screen for faster access</p>
            {/* Ethiopian flag accent */}
            <div className="flex gap-0.5 mt-1.5">
              <div className="w-4 h-1 bg-green-600 rounded-l-full" />
              <div className="w-4 h-1 bg-yellow-400" />
              <div className="w-4 h-1 bg-red-600 rounded-r-full" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <button onClick={handleInstall}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors">
              <Download size={13} /> Install
            </button>
            <button onClick={handleDismiss}
              className="flex items-center justify-center gap-1 px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X size={12} /> Not now
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
