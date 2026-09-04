import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, AlertTriangle, X, Package, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStockAlerts } from '../hooks/useStockAlerts';
import { useToast } from './Toast';
import { useLangContext } from '../lib/LangContext';
import { t } from '../lib/i18n';

let audioContext: AudioContext | null = null;

function unlockAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
}

// ── Bell sound using Web Audio API (no external files needed) ─────────────────
function playBellSound(type: 'out' | 'low' = 'low') {
  try {
    if (!audioContext || audioContext.state !== 'running') return;
    const ctx = audioContext;

    const playTone = (freq: number, startTime: number, duration: number, gain: number) => {
      const oscillator = ctx.createOscillator();
      const gainNode   = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(freq * 0.5, startTime + duration);

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    if (type === 'out') {
      // Three descending urgent tones for out-of-stock
      playTone(880, ctx.currentTime,        0.4, 0.5);
      playTone(660, ctx.currentTime + 0.45, 0.4, 0.5);
      playTone(440, ctx.currentTime + 0.9,  0.6, 0.6);
    } else {
      // Two gentle bell tones for low stock
      playTone(660, ctx.currentTime,        0.5, 0.35);
      playTone(880, ctx.currentTime + 0.55, 0.7, 0.3);
    }
  } catch {
    // Web Audio not available — silent fail
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StockAlertBell() {
  const [open, setOpen]       = useState(false);
  const [hasNew, setHasNew]   = useState(false);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('storeos-sound') !== 'off');
  const panelRef = useRef<HTMLDivElement>(null);
  const { warning, error: toastError } = useToast();
  const { lang } = useLangContext();

  useEffect(() => {
    const handleUserGesture = () => unlockAudio();
    window.addEventListener('pointerdown', handleUserGesture, { once: true });
    window.addEventListener('keydown', handleUserGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
  }, []);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSoundOn(prev => {
      const next = !prev;
      localStorage.setItem('storeos-sound', next ? 'on' : 'off');
      return next;
    });
  };

  const handleAlerts = useCallback((newAlerts: any[]) => {
    if (!newAlerts.length) return;

    const outAlerts = newAlerts.filter(a => a.type === 'out');
    const lowAlerts = newAlerts.filter(a => a.type === 'low');

    // Play sound
    if (soundOn) {
      if (outAlerts.length > 0) playBellSound('out');
      else if (lowAlerts.length > 0) playBellSound('low');
    }

    // Fire toasts
    outAlerts.slice(0, 3).forEach(a => {
      toastError(t('outOfStockAlert', lang), `${a.name} (${a.sku})`);
    });
    if (lowAlerts.length > 0) {
      warning(t('lowStockAlert', lang), `${lowAlerts.length} ${t('lowStock', lang)}`);
    }

    setHasNew(true);
  }, [soundOn, lang]);

  const { alerts } = useStockAlerts(handleAlerts);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const outAlerts  = alerts.filter(a => a.type === 'out');
  const lowAlerts  = alerts.filter(a => a.type === 'low');
  const totalAlerts = alerts.length;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); setHasNew(false); }}
        aria-label={t('stockAlert', lang)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Bell size={18} className={totalAlerts > 0 ? (outAlerts.length > 0 ? 'text-destructive' : 'text-amber-500') : ''} />
        {totalAlerts > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full text-[10px] font-bold flex items-center justify-center px-1 ${
            outAlerts.length > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-amber-500 text-white'
          } ${hasNew ? 'animate-bounce' : ''}`}>
            {totalAlerts > 9 ? '9+' : totalAlerts}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">{t('stockAlert', lang)}</span>
                {totalAlerts > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                    {totalAlerts}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {/* Sound toggle */}
                <button
                  onClick={toggleSound}
                  title={soundOn ? 'Mute alerts' : 'Unmute alerts'}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
                </button>
                <button onClick={() => setOpen(false)}>
                  <X size={14} className="text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            </div>

            {/* Alert list */}
            <div className="max-h-72 overflow-y-auto">
              {totalAlerts === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                    <Package size={20} className="text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{t('inStock', lang)}</p>
                  <p className="text-xs text-muted-foreground">{t('noData', lang)}</p>
                </div>
              ) : (
                <>
                  {outAlerts.map(alert => (
                    <div key={alert.id} className="flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-muted/20 transition-colors">
                      <div className="w-7 h-7 bg-destructive/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle size={13} className="text-destructive" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{alert.name}</p>
                        <p className="text-xs text-muted-foreground">{alert.sku} · {alert.category?.name}</p>
                        <p className="text-xs font-bold text-destructive mt-0.5">{t('outOfStockAlert', lang)}</p>
                      </div>
                    </div>
                  ))}
                  {lowAlerts.map(alert => (
                    <div key={alert.id} className="flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-muted/20 transition-colors">
                      <div className="w-7 h-7 bg-amber-500/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle size={13} className="text-amber-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{alert.name}</p>
                        <p className="text-xs text-muted-foreground">{alert.sku} · {alert.category?.name}</p>
                        <p className="text-xs font-medium text-amber-600 mt-0.5">
                          {alert.stock} {t('stockThreshold', lang)} · min {alert.minStockLevel}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {totalAlerts > 0 && (
              <Link to="/inventory" onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-medium text-primary hover:bg-primary/5 transition-colors border-t border-border">
                {t('inventory', lang)} <ChevronRight size={12} />
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
