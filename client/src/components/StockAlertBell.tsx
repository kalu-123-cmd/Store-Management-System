import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, AlertTriangle, X, Package, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStockAlerts } from '../hooks/useStockAlerts';
import { useToast } from './Toast';
import type { Lang } from '../lib/i18n';
import { t } from '../lib/i18n';

interface Props {
  lang: Lang;
}

export default function StockAlertBell({ lang }: Props) {
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { warning, error: toastError } = useToast();

  const { alerts } = useStockAlerts((newAlerts) => {
    if (!newAlerts.length) return;

    const outAlerts = newAlerts.filter(a => a.type === 'out');
    const lowAlerts = newAlerts.filter(a => a.type === 'low');

    // Fire toasts for out-of-stock (max 3 to avoid spam)
    outAlerts.slice(0, 3).forEach(a => {
      toastError(
        t('outOfStockAlert', lang),
        `${a.name} (${a.sku}) — ${t('outOfStock', lang)}`
      );
    });

    // Fire a single summary toast for low stock
    if (lowAlerts.length > 0) {
      warning(
        t('lowStockAlert', lang),
        `${lowAlerts.length} ${lang === 'en' ? 'product(s) below threshold' : t('lowStock', lang)}`
      );
    }

    setHasNew(true);
  });

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const outAlerts = alerts.filter(a => a.type === 'out');
  const lowAlerts = alerts.filter(a => a.type === 'low');
  const totalAlerts = alerts.length;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); setHasNew(false); }}
        aria-label="Stock alerts"
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Bell size={18} />
        {totalAlerts > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full text-[10px] font-bold flex items-center justify-center px-1 ${
            outAlerts.length > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-amber-500 text-white'
          } ${hasNew ? 'animate-bounce' : ''}`}>
            {totalAlerts > 9 ? '9+' : totalAlerts}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
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
              <button onClick={() => setOpen(false)}>
                <X size={14} className="text-muted-foreground hover:text-foreground" />
              </button>
            </div>

            {/* Alert list */}
            <div className="max-h-72 overflow-y-auto">
              {totalAlerts === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                    <Package size={20} className="text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium text-foreground">All stock levels healthy</p>
                  <p className="text-xs text-muted-foreground">No alerts at this time.</p>
                </div>
              ) : (
                <>
                  {/* Out of stock — shown first */}
                  {outAlerts.map(alert => (
                    <div key={alert.id}
                      className="flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-muted/20 transition-colors">
                      <div className="w-7 h-7 bg-destructive/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle size={13} className="text-destructive" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{alert.name}</p>
                        <p className="text-xs text-muted-foreground">{alert.sku} · {alert.category?.name}</p>
                        <p className="text-xs font-bold text-destructive mt-0.5">
                          {t('outOfStockAlert', lang)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Low stock */}
                  {lowAlerts.map(alert => (
                    <div key={alert.id}
                      className="flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-muted/20 transition-colors">
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

            {/* Footer link */}
            {totalAlerts > 0 && (
              <Link
                to="/inventory"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-medium text-primary hover:bg-primary/5 transition-colors border-t border-border"
              >
                View in Inventory <ChevronRight size={12} />
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
