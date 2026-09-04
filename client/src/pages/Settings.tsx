import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon, Globe, Bell, Moon, Sun,
  Palette, Database, Shield, Save,
  Volume2, VolumeX, Mail,
} from 'lucide-react';
import { useLangContext } from '../lib/LangContext';
import { useDarkMode } from '../hooks/useDarkMode';
import { LANGUAGES } from '../lib/i18n';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';

// ── Setting Section ───────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
        <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </motion.div>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`relative w-10 h-5.5 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
      style={{ height: '22px', width: '40px' }}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { lang, setLang } = useLangContext();
  const [dark, setDark] = useDarkMode();
  const { success } = useToast();
  const { isAdmin } = useRole();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Sound preference
  const [sound, setSound] = useState(() => localStorage.getItem('storeos-sound') !== 'off');
  const toggleSound = (v: boolean) => {
    setSound(v);
    localStorage.setItem('storeos-sound', v ? 'on' : 'off');
  };

  // Store info (stored in localStorage — no backend needed)
  const [storeName, setStoreName]   = useState(() => localStorage.getItem('store-name') || 'StoreOS');
  const [storeCurrency, setStoreCurrency] = useState(() => localStorage.getItem('store-currency') || 'ETB');
  const [storePhone, setStorePhone] = useState(() => localStorage.getItem('store-phone') || '');
  const [storeAddress, setStoreAddress] = useState(() => localStorage.getItem('store-address') || '');

  const saveStoreInfo = () => {
    localStorage.setItem('store-name', storeName);
    localStorage.setItem('store-currency', storeCurrency);
    localStorage.setItem('store-phone', storePhone);
    localStorage.setItem('store-address', storeAddress);
    success('Settings saved', 'Store information updated.');
  };

  const ic = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none';

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <SettingsIcon size={22} className="text-primary" /> Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Configure your StoreOS preferences</p>
      </div>

      {/* ── Appearance ── */}
      <Section title="Appearance" icon={<Palette size={14} />}>
        <Row label="Dark Mode" description="Switch between light and dark theme">
          <div className="flex items-center gap-2">
            <Sun size={14} className="text-muted-foreground" />
            <Toggle checked={dark} onChange={setDark} />
            <Moon size={14} className="text-muted-foreground" />
          </div>
        </Row>
      </Section>

      {/* ── Language ── */}
      <Section title="Language" icon={<Globe size={14} />}>
        <Row label="Interface Language" description="Changes all text in the app">
          <select value={lang} onChange={e => setLang(e.target.value as any)}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.flag} {l.native} — {l.label}</option>
            ))}
          </select>
        </Row>
      </Section>

      {/* ── Notifications ── */}
      <Section title="Notifications & Sound" icon={<Bell size={14} />}>
        <Row label="Alert Sound" description="Play bell sound when stock hits threshold">
          <div className="flex items-center gap-2">
            {sound ? <Volume2 size={14} className="text-muted-foreground" /> : <VolumeX size={14} className="text-muted-foreground" />}
            <Toggle checked={sound} onChange={toggleSound} />
          </div>
        </Row>
        <Row label="Stock Alert Threshold" description="Alerts fire when stock ≤ each product's minimum level">
          <span className="text-xs bg-amber-500/10 text-amber-700 px-2.5 py-1 rounded-full font-medium">
            Per-product minimum
          </span>
        </Row>
      </Section>

      {/* ── Store Info (Admin only) ── */}
      {isAdmin && (
        <Section title="Store Information" icon={<Database size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium block mb-1">Store Name</label>
              <input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="StoreOS" className={ic} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">Currency</label>
                <select value={storeCurrency} onChange={e => setStoreCurrency(e.target.value)}
                  className={ic}>
                  <option value="ETB">ETB — Ethiopian Birr</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="KES">KES — Kenyan Shilling</option>
                  <option value="UGX">UGX — Ugandan Shilling</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Phone</label>
                <input value={storePhone} onChange={e => setStorePhone(e.target.value)} placeholder="+251-911-..." className={ic} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Address</label>
              <input value={storeAddress} onChange={e => setStoreAddress(e.target.value)} placeholder="Addis Ababa, Ethiopia" className={ic} />
            </div>
            <button onClick={saveStoreInfo}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Save size={14} /> Save Store Info
            </button>
          </div>
        </Section>
      )}

      {/* ── Account ── */}
      <Section title="Account" icon={<Shield size={14} />}>
        <Row label="Logged in as" description={user.email}>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            user.role === 'ADMIN' ? 'bg-violet-500/10 text-violet-600' :
            user.role === 'MANAGER' ? 'bg-blue-500/10 text-blue-600' :
            'bg-emerald-500/10 text-emerald-600'
          }`}>
            {user.role}
          </span>
        </Row>
        <Row label="Change Password" description="Update your login password">
          <a href="/profile" className="text-xs text-primary hover:underline">
            Go to Profile →
          </a>
        </Row>
        {isAdmin && (
          <Row label="Manage Staff" description="Add, edit, or remove team members">
            <a href="/users" className="text-xs text-primary hover:underline">
              Go to Users →
            </a>
          </Row>
        )}
      </Section>

      {/* ── Email ── */}
      <Section title="Email Notifications" icon={<Mail size={14} />}>
        <p className="text-xs text-muted-foreground">
          Email notifications are configured via environment variables on the server.
        </p>
        <div className="bg-muted/40 rounded-lg p-3 font-mono text-xs space-y-1 text-muted-foreground">
          <p>SMTP_HOST=smtp.gmail.com</p>
          <p>SMTP_PORT=587</p>
          <p>SMTP_USER=your@gmail.com</p>
          <p>SMTP_PASS=your-app-password</p>
          <p>STORE_ADMIN_EMAIL=admin@store.com</p>
        </div>
        <p className="text-xs text-muted-foreground">
          When configured: receipts are emailed to customers after sales, and low-stock alerts go to STORE_ADMIN_EMAIL.
        </p>
      </Section>

      {/* ── About ── */}
      <div className="flex items-center justify-between px-5 py-3 bg-muted/20 rounded-xl border border-border text-xs text-muted-foreground">
        <span>StoreOS — Ethiopian Store Management System</span>
        <div className="flex gap-0.5">
          <span className="w-3 h-4 bg-green-600 rounded-l-sm inline-block" />
          <span className="w-3 h-4 bg-yellow-400 inline-block" />
          <span className="w-3 h-4 bg-red-600 rounded-r-sm inline-block" />
        </div>
      </div>
    </div>
  );
}
