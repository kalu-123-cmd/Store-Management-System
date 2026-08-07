import React, { useState } from 'react';
import { useMutation, gql } from '@apollo/client';
import { motion } from 'framer-motion';
import { User, Lock, Save, Eye, EyeOff, ShieldCheck, Shield } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useLangContext } from '../lib/LangContext';

const UPDATE_PROFILE = gql`
  mutation UpdateProfile($name: String, $currentPassword: String!, $newPassword: String) {
    updateProfile(name: $name, currentPassword: $currentPassword, newPassword: $newPassword) {
      id name email role
    }
  }
`;

const ROLE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ADMIN:   { label: 'Admin',   color: 'bg-violet-500/10 text-violet-600', icon: <ShieldCheck size={16} /> },
  MANAGER: { label: 'Manager', color: 'bg-blue-500/10 text-blue-600',     icon: <Shield size={16} /> },
  CASHIER: { label: 'Cashier', color: 'bg-emerald-500/10 text-emerald-600', icon: <User size={16} /> },
};

export default function Profile() {
  const { t } = useLangContext();
  const { success, error: toastError } = useToast();
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');

  const [name, setName]               = useState(storedUser.name || '');
  const [currentPwd, setCurrentPwd]   = useState('');
  const [newPwd, setNewPwd]           = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [tab, setTab]                 = useState<'profile' | 'password'>('profile');

  const [updateProfile, { loading }] = useMutation(UPDATE_PROFILE);

  const roleMeta = ROLE_META[storedUser.role] || ROLE_META.CASHIER;

  const handleProfileSave = async () => {
    if (!currentPwd) { toastError('Required', 'Enter your current password to confirm changes.'); return; }
    try {
      const { data } = await updateProfile({ variables: { name: name || undefined, currentPassword: currentPwd } });
      // Update localStorage
      const updated = { ...storedUser, name: data.updateProfile.name };
      localStorage.setItem('user', JSON.stringify(updated));
      success('Profile updated', `Name changed to ${data.updateProfile.name}`);
      setCurrentPwd('');
    } catch (e: any) { toastError('Update failed', e.message); }
  };

  const handlePasswordSave = async () => {
    if (!currentPwd) { toastError('Required', 'Enter your current password.'); return; }
    if (!newPwd)     { toastError('Required', 'Enter a new password.'); return; }
    if (newPwd.length < 6) { toastError('Too short', 'Password must be at least 6 characters.'); return; }
    if (newPwd !== confirmPwd) { toastError('Mismatch', 'New passwords do not match.'); return; }
    try {
      await updateProfile({ variables: { currentPassword: currentPwd, newPassword: newPwd } });
      success('Password changed', 'Your password has been updated.');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (e: any) { toastError('Update failed', e.message); }
  };

  const ic = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-colors';
  const lc = 'text-sm font-medium text-foreground block mb-1.5';

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">My Profile</h2>
        <p className="text-sm text-muted-foreground">Manage your account settings</p>
      </div>

      {/* User card */}
      <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
        className="bg-card border border-border rounded-xl p-6 flex items-center gap-5">
        <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
          {(storedUser.name || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-foreground">{storedUser.name}</p>
          <p className="text-sm text-muted-foreground">{storedUser.email}</p>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mt-2 ${roleMeta.color}`}>
            {roleMeta.icon} {roleMeta.label}
          </span>
        </div>
      </motion.div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-lg w-fit">
        {([['profile', 'Edit Name'], ['password', 'Change Password']] as const).map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); setCurrentPwd(''); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <motion.div key="profile" initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }}
          className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className={lc}><User size={14} className="inline mr-1.5" />Display Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className={ic} />
          </div>
          <div>
            <label className={lc}><Lock size={14} className="inline mr-1.5" />Current Password (required to save)</label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} value={currentPwd}
                onChange={e => setCurrentPwd(e.target.value)} placeholder="••••••••" className={`${ic} pr-10`} />
              <button type="button" onClick={() => setShowCurrent(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button onClick={handleProfileSave} disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {loading ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Save size={15} />}
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </motion.div>
      ) : (
        <motion.div key="password" initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }}
          className="bg-card border border-border rounded-xl p-6 space-y-4">
          {[
            { label: 'Current Password', val: currentPwd, set: setCurrentPwd, show: showCurrent, toggle: () => setShowCurrent(s => !s) },
            { label: 'New Password',     val: newPwd,     set: setNewPwd,     show: showNew,    toggle: () => setShowNew(s => !s) },
            { label: 'Confirm New Password', val: confirmPwd, set: setConfirmPwd, show: showNew, toggle: () => setShowNew(s => !s) },
          ].map(({ label, val, set, show, toggle }) => (
            <div key={label}>
              <label className={lc}>{label}</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={val} onChange={e => set(e.target.value)}
                  placeholder="••••••••" className={`${ic} pr-10`} />
                <button type="button" onClick={toggle}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {label === 'Confirm New Password' && newPwd && confirmPwd && newPwd !== confirmPwd && (
                <p className="text-xs text-destructive mt-1">Passwords do not match</p>
              )}
            </div>
          ))}
          <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
            Password must be at least 6 characters.
          </div>
          <button onClick={handlePasswordSave} disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {loading ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Lock size={15} />}
            {loading ? 'Saving…' : 'Change Password'}
          </button>
        </motion.div>
      )}
    </div>
  );
}
