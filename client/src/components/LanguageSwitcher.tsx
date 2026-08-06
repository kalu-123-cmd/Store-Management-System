import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { LANGUAGES, type Lang } from '../lib/i18n';

interface Props {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export default function LanguageSwitcher({ lang, setLang }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
        aria-label="Change language"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="text-xs font-medium text-foreground hidden sm:block">{current.native}</span>
        <ChevronDown size={12} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-10 w-48 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-1.5 space-y-0.5">
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  onClick={() => { setLang(l.code); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    lang === l.code
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <span className="text-base">{l.flag}</span>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium leading-tight">{l.native}</p>
                    <p className="text-xs text-muted-foreground">{l.label}</p>
                  </div>
                  {lang === l.code && <Check size={14} className="shrink-0" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
