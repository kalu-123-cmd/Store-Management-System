import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('pwa-dismissed')) return;
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 1200);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setShow(false);
      setInstalled(true);
    });

    const fallback = window.setTimeout(() => {
      if (!localStorage.getItem('pwa-dismissed')) setShow(true);
    }, 4000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.clearTimeout(fallback);
    };
  }, []);

  const handleInstall = async () => {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setShow(false);
      return;
    }
    window.alert(
      'Pin StoreOS to your desktop:\n\nChrome / Edge: click the install icon in the address bar (computer + plus), then choose Install.\nAfter that, right-click the app and Pin to taskbar or Send to Desktop.'
    );
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
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#1e40af] flex items-center justify-center">
            <img src="/icon-192.png" alt="StoreOS" className="w-12 h-12" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm leading-tight">Pin StoreOS to desktop</p>
            <p className="text-xs text-muted-foreground mt-0.5">Install as an app, then pin it like any Windows program</p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstall}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <Download size={13} /> {prompt ? 'Install' : 'How to pin'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex items-center justify-center gap-1 px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={12} /> Not now
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
