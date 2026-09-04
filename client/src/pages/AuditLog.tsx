import React, { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Search, FileDown, User, Package,
  ShoppingCart, AlertTriangle, Trash2, Edit2,
  LogIn, Settings, Building2, Star,
  Globe, Smartphone, Server, Eye, Filter, X,
} from 'lucide-react';
import { useRole } from '../hooks/useRole';

// ── GraphQL ───────────────────────────────────────────────────────────────────

const GET_AUDIT_LOGS = gql`
  query GetAuditLogs($startDate: String, $endDate: String) {
    activityLogs(startDate: $startDate, endDate: $endDate) {
      id action details createdAt
      ipAddress entityType entityId
      oldValue newValue changes
      user { id name email role }
    }
  }
`;

// ── Action config ─────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  USER_LOGGED_IN:           { label: 'Login',              color: 'text-sky-600',     bg: 'bg-sky-500/10',     icon: <LogIn size={12}/> },
  USER_CREATED:             { label: 'User Created',       color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: <User size={12}/> },
  USER_DELETED:             { label: 'User Deleted',       color: 'text-destructive', bg: 'bg-destructive/10', icon: <Trash2 size={12}/> },
  USER_ROLE_CHANGED:        { label: 'Role Changed',       color: 'text-violet-600',  bg: 'bg-violet-500/10',  icon: <Shield size={12}/> },
  PROFILE_UPDATED:          { label: 'Profile Updated',    color: 'text-blue-600',    bg: 'bg-blue-500/10',    icon: <Settings size={12}/> },
  PRODUCT_CREATED:          { label: 'Product Added',      color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: <Package size={12}/> },
  PRODUCT_UPDATED:          { label: 'Product Updated',    color: 'text-amber-600',   bg: 'bg-amber-500/10',   icon: <Edit2 size={12}/> },
  PRODUCT_DELETED:          { label: 'Product Deleted',    color: 'text-destructive', bg: 'bg-destructive/10', icon: <Trash2 size={12}/> },
  PRODUCT_DEACTIVATED:      { label: 'Deactivated',        color: 'text-amber-600',   bg: 'bg-amber-500/10',   icon: <AlertTriangle size={12}/> },
  SALE_COMPLETED:           { label: 'Sale',               color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: <ShoppingCart size={12}/> },
  SALE_RETURNED:            { label: 'Refund',             color: 'text-destructive', bg: 'bg-destructive/10', icon: <ShoppingCart size={12}/> },
  STOCK_ADJUSTED:           { label: 'Stock Adjusted',     color: 'text-amber-600',   bg: 'bg-amber-500/10',   icon: <Package size={12}/> },
  CSV_SYNCHRONIZATION:      { label: 'CSV Import',         color: 'text-blue-600',    bg: 'bg-blue-500/10',    icon: <Server size={12}/> },
  TRADITIONAL_ITEM_CREATED: { label: 'Traditional Added',  color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: <Star size={12}/> },
  TRADITIONAL_ITEM_UPDATED: { label: 'Traditional Edited', color: 'text-amber-600',   bg: 'bg-amber-500/10',   icon: <Star size={12}/> },
  TRADITIONAL_ITEM_DELETED: { label: 'Traditional Deleted',color: 'text-destructive', bg: 'bg-destructive/10', icon: <Trash2 size={12}/> },
  BRANCH_CREATED:           { label: 'Branch Added',       color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: <Building2 size={12}/> },
  BRANCH_DELETED:           { label: 'Branch Deleted',     color: 'text-destructive', bg: 'bg-destructive/10', icon: <Trash2 size={12}/> },
  PO_CREATED:               { label: 'PO Created',         color: 'text-blue-600',    bg: 'bg-blue-500/10',    icon: <Package size={12}/> },
  PO_RECEIVED:              { label: 'PO Received',        color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: <Package size={12}/> },
  PO_SENT:                  { label: 'PO Sent',            color: 'text-sky-600',     bg: 'bg-sky-500/10',     icon: <Package size={12}/> },
  PO_CANCELLED:             { label: 'PO Cancelled',       color: 'text-destructive', bg: 'bg-destructive/10', icon: <Package size={12}/> },
  PO_DRAFT:                 { label: 'PO Draft',           color: 'text-slate-600',   bg: 'bg-slate-500/10',   icon: <Package size={12}/> },
};

const DEFAULT_ACTION = { label: 'Action', color: 'text-muted-foreground', bg: 'bg-muted', icon: <Settings size={12}/> };

const ROLE_COLORS: Record<string, string> = {
  ADMIN:   'bg-violet-500/10 text-violet-600',
  MANAGER: 'bg-blue-500/10 text-blue-600',
  CASHIER: 'bg-emerald-500/10 text-emerald-600',
};

const ENTITY_COLORS: Record<string, string> = {
  PRODUCT:          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  SALE:             'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  USER:             'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  IMPORT:           'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PURCHASE_ORDER:   'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  BRANCH:           'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

// ── IP / Device / Origin detection helpers ────────────────────────────────────

function detectOrigin(ip: string | null | undefined): { label: string; icon: React.ReactNode; color: string } {
  if (!ip) return { label: 'Unknown', icon: <Globe size={11}/>, color: 'text-muted-foreground' };
  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('localhost'))
    return { label: 'Localhost', icon: <Server size={11}/>, color: 'text-emerald-600' };
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.'))
    return { label: `LAN ${ip}`, icon: <Smartphone size={11}/>, color: 'text-blue-600' };
  return { label: ip, icon: <Globe size={11}/>, color: 'text-amber-600' };
}

function parseJsonSafe(str: string | null | undefined): any {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

function ChangesPanel({ oldValue, newValue, changes }: { oldValue?: string; newValue?: string; changes?: string }) {
  const ch = parseJsonSafe(changes);
  const ov = parseJsonSafe(oldValue);
  const _nv = parseJsonSafe(newValue);

  if (ch && typeof ch === 'object' && !Array.isArray(ch)) {
    const keys = Object.keys(ch);
    if (keys.length === 0) return null;
    return (
      <div className="mt-2 space-y-1">
        {keys.map(k => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="font-mono text-muted-foreground w-24 truncate shrink-0">{k}</span>
            <span className="line-through text-destructive/70 truncate max-w-[100px]">{String(ch[k]?.from ?? '—')}</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-emerald-600 truncate max-w-[100px]">{String(ch[k]?.to ?? '—')}</span>
          </div>
        ))}
      </div>
    );
  }
  if (ov && _nv) {
    const allKeys = [...new Set([...Object.keys(ov), ...Object.keys(_nv)])];
    const diffKeys = allKeys.filter(k => JSON.stringify(ov[k]) !== JSON.stringify(_nv[k]));
    if (!diffKeys.length) return null;
    return (
      <div className="mt-2 space-y-1">
        {diffKeys.map(k => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="font-mono text-muted-foreground w-24 truncate shrink-0">{k}</span>
            <span className="line-through text-destructive/70 truncate max-w-[100px]">{String(ov[k] ?? '—')}</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-emerald-600 truncate max-w-[100px]">{String(_nv[k] ?? '—')}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

// ── CSV export ────────────────────────────────────────────────────────────────

function downloadCSV(logs: any[]) {
  const rows = [
    ['Date & Time','User','Role','Email','IP Address','Origin Type','Entity','Action','Details','Changes'],
    ...logs.map(l => {
      const origin = detectOrigin(l.ipAddress);
      void parseJsonSafe(l.newValue); // parsed if needed for future use
      return [
        new Date(l.createdAt).toLocaleString(),
        l.user?.name || 'System',
        l.user?.role || '',
        l.user?.email || '',
        l.ipAddress || '',
        origin.label,
        l.entityType || '',
        l.action,
        l.details || '',
        l.changes || l.newValue || '',
      ];
    }),
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Filter constants ──────────────────────────────────────────────────────────

const ACTION_GROUPS = [
  { label: 'All Actions',     value: '' },
  { label: 'Logins',          value: 'USER_LOGGED_IN' },
  { label: 'Sales',           value: 'SALE' },
  { label: 'Products',        value: 'PRODUCT' },
  { label: 'Users',           value: 'USER' },
  { label: 'Stock',           value: 'STOCK' },
  { label: 'Purchase Orders', value: 'PO' },
  { label: 'CSV Import',      value: 'CSV' },
  { label: 'Traditional',     value: 'TRADITIONAL' },
  { label: 'Branches',        value: 'BRANCH' },
];

const ENTITY_GROUPS = [
  { label: 'All Entities',    value: '' },
  { label: 'Products',        value: 'PRODUCT' },
  { label: 'Sales',           value: 'SALE' },
  { label: 'Users',           value: 'USER' },
  { label: 'Import',          value: 'IMPORT' },
  { label: 'Purchase Orders', value: 'PURCHASE_ORDER' },
  { label: 'Branches',        value: 'BRANCH' },
];

// ── Row detail drawer ─────────────────────────────────────────────────────────

function LogDetailDrawer({ log, onClose }: { log: any; onClose: () => void }) {
  if (!log) return null;
  const cfg    = ACTION_CONFIG[log.action] || DEFAULT_ACTION;
  const origin = detectOrigin(log.ipAddress);

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
        <motion.div initial={{ x:'100%' }} animate={{ x:0 }} exit={{ x:'100%' }}
          transition={{ type:'spring', damping:25, stiffness:250 }}
          onClick={e=>e.stopPropagation()}
          className="bg-card border-l border-border w-full max-w-md h-full overflow-y-auto shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                {cfg.icon} {cfg.label}
              </span>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18}/></button>
          </div>

          <div className="p-5 space-y-5">
            {/* Timestamp */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Timestamp</p>
              <p className="text-sm font-medium text-foreground">{new Date(log.createdAt).toLocaleString('en-US', { dateStyle:'full', timeStyle:'medium' })}</p>
            </div>

            {/* User */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">User</p>
              <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {(log.user?.name || 'S').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{log.user?.name || 'System'}</p>
                  <p className="text-xs text-muted-foreground">{log.user?.email || '—'}</p>
                  {log.user?.role && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[log.user.role] || 'bg-muted text-muted-foreground'}`}>
                      {log.user.role}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Network / Origin */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Network Origin</p>
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">IP Address</span>
                  <span className={`flex items-center gap-1.5 text-xs font-mono font-medium ${origin.color}`}>
                    {origin.icon}
                    {log.ipAddress || 'Not recorded'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Origin Type</span>
                  <span className={`text-xs font-medium ${origin.color}`}>{origin.label.split(' ')[0]}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">API Endpoint</span>
                  <span className="text-xs font-mono text-muted-foreground">POST /graphql</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Server</span>
                  <span className="text-xs font-mono text-muted-foreground">localhost:4000</span>
                </div>
              </div>
            </div>

            {/* Entity */}
            {(log.entityType || log.entityId) && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Entity</p>
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  {log.entityType && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Type</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ENTITY_COLORS[log.entityType] || 'bg-muted text-muted-foreground'}`}>
                        {log.entityType}
                      </span>
                    </div>
                  )}
                  {log.entityId && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">ID</span>
                      <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">{log.entityId}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Details */}
            {log.details && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Details</p>
                <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3">{log.details}</p>
              </div>
            )}

            {/* Changes diff */}
            {(log.changes || log.oldValue || log.newValue) && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Changes</p>
                <div className="bg-muted/30 rounded-lg p-3">
                  <ChangesPanel oldValue={log.oldValue} newValue={log.newValue} changes={log.changes}/>
                  {/* Raw JSON fallback */}
                  {!log.changes && log.newValue && (
                    <pre className="text-[10px] text-muted-foreground mt-2 whitespace-pre-wrap break-all font-mono max-h-40 overflow-y-auto">
                      {JSON.stringify(parseJsonSafe(log.newValue), null, 2) || log.newValue}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuditLog() {
  const { isAdmin, isManager } = useRole();
  const [search, setSearch]           = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [userFilter,   setUserFilter]   = useState('');
  const [ipFilter,     setIpFilter]     = useState('');
  const [startDate,    setStartDate]    = useState('');
  const [endDate,      setEndDate]      = useState('');
  const [selectedLog,  setSelectedLog]  = useState<any>(null);
  const [showFilters,  setShowFilters]  = useState(false);

  const { data, loading, refetch } = useQuery(GET_AUDIT_LOGS, {
    variables: {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    fetchPolicy: 'cache-and-network',
  });
  const allLogs: any[] = data?.activityLogs || [];

  if (!isAdmin && !isManager) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center text-destructive">
          <AlertTriangle size={24}/>
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">Access Restricted</p>
          <p className="text-sm text-muted-foreground mt-1">Audit log requires Admin or Manager access.</p>
        </div>
      </div>
    );
  }

  // ── Filtering ───────────────────────────────────────────────────────────────
  const logs = allLogs.filter(log => {
    const s = search.toLowerCase();
    const matchSearch = !s ||
      log.user?.name?.toLowerCase().includes(s) ||
      log.user?.email?.toLowerCase().includes(s) ||
      log.details?.toLowerCase().includes(s) ||
      log.action?.toLowerCase().includes(s) ||
      log.entityType?.toLowerCase().includes(s) ||
      log.entityId?.toLowerCase().includes(s) ||
      log.ipAddress?.toLowerCase().includes(s);
    const matchAction = !actionFilter || log.action.includes(actionFilter);
    const matchEntity = !entityFilter || log.entityType === entityFilter;
    const matchUser   = !userFilter   || log.user?.name === userFilter;
    const matchIp     = !ipFilter     || (log.ipAddress || '').includes(ipFilter);
    return matchSearch && matchAction && matchEntity && matchUser && matchIp;
  });

  const uniqueUsers = [...new Set(allLogs.map(l => l.user?.name).filter(Boolean))];
  const uniqueIPs   = [...new Set(allLogs.map(l => l.ipAddress).filter(Boolean))];
  const activeFilters = [actionFilter, entityFilter, userFilter, ipFilter, search].filter(Boolean).length;

  // Stats
  const todayLogs    = allLogs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length;
  const salesCount   = allLogs.filter(l => l.action === 'SALE_COMPLETED').length;
  const _adminActions = allLogs.filter(l => l.user?.role === 'ADMIN').length;
  void _adminActions; // retained for potential future display
  const uniqueIPCount = new Set(allLogs.map(l => l.ipAddress).filter(Boolean)).size;

  const clearAll = () => { setSearch(''); setActionFilter(''); setEntityFilter(''); setUserFilter(''); setIpFilter(''); };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <Shield size={16}/>
            </div>
            <h2 className="text-xl font-bold text-foreground">Audit Log</h2>
          </div>
          <p className="text-sm text-muted-foreground">{allLogs.length} total events · {uniqueIPCount} unique IP addresses</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            <Server size={13}/> Refresh
          </button>
          <button onClick={() => downloadCSV(logs)}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            <FileDown size={13}/> Export CSV
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label:'Total Events',    value:allLogs.length, color:'text-foreground'  },
          { label:'Today',           value:todayLogs,      color:'text-primary'     },
          { label:'Sales',           value:salesCount,     color:'text-emerald-500' },
          { label:'Unique IPs',      value:uniqueIPCount,  color:'text-amber-500'   },
        ].map(k=>(
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search user, IP, entity, action, details…"
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"/>
          </div>
          <button onClick={()=>setShowFilters(f=>!f)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters || activeFilters ? 'border-primary text-primary bg-primary/5' : 'border-border hover:bg-muted'}`}>
            <Filter size={13}/>
            Filters {activeFilters>0 && <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeFilters}</span>}
          </button>
          {activeFilters>0 && (
            <button onClick={clearAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
              <X size={12}/> Clear all
            </button>
          )}
          <p className="text-xs text-muted-foreground ml-auto">
            <span className="font-semibold text-foreground">{logs.length}</span> / {allLogs.length}
          </p>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
              className="overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
                {/* Action filter */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Action Type</label>
                  <select value={actionFilter} onChange={e=>setActionFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
                    {ACTION_GROUPS.map(g=><option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                {/* Entity filter */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Entity Type</label>
                  <select value={entityFilter} onChange={e=>setEntityFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
                    {ENTITY_GROUPS.map(g=><option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                {/* User filter */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">User</label>
                  <select value={userFilter} onChange={e=>setUserFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
                    <option value="">All Users</option>
                    {uniqueUsers.map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">From</label>
                  <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"/>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">To</label>
                  <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"/>
                </div>
                {/* IP filter */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">IP Address</label>
                  <select value={ipFilter} onChange={e=>setIpFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
                    <option value="">All IPs</option>
                    {uniqueIPs.map(ip=><option key={ip} value={ip}>{ip}</option>)}
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Log table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                {['Date & Time','User / Role','IP Address','Origin','Entity','Action','Details',''].map(h=>(
                  <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12">
                  <div className="flex justify-center"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"/></div>
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">No log entries found.</td></tr>
              ) : logs.map((log, i) => {
                const cfg    = ACTION_CONFIG[log.action] || DEFAULT_ACTION;
                const origin = detectOrigin(log.ipAddress);
                return (
                  <motion.tr key={log.id}
                    initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay: Math.min(i*0.008, 0.3) }}
                    className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={()=>setSelectedLog(log)}>

                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs font-medium text-foreground">
                        {new Date(log.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(log.createdAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
                      </p>
                    </td>

                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          {(log.user?.name||'S').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground leading-tight">{log.user?.name||'System'}</p>
                          {log.user?.role && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[log.user.role]||'bg-muted text-muted-foreground'}`}>
                              {log.user.role}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* IP */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`flex items-center gap-1 text-xs font-mono ${origin.color}`}>
                        {origin.icon}
                        {log.ipAddress || <span className="text-muted-foreground italic">—</span>}
                      </span>
                    </td>

                    {/* Origin type */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-medium ${origin.color}`}>{origin.label.split(' ')[0]}</span>
                    </td>

                    {/* Entity */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {log.entityType
                        ? <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ENTITY_COLORS[log.entityType]||'bg-muted text-muted-foreground'}`}>
                            {log.entityType}
                          </span>
                        : <span className="text-muted-foreground text-xs">—</span>
                      }
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>

                    {/* Details */}
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-xs text-muted-foreground truncate">{log.details||log.action}</p>
                      {(log.changes||log.newValue) && (
                        <p className="text-[10px] text-primary mt-0.5">Has changes</p>
                      )}
                    </td>

                    {/* View */}
                    <td className="px-4 py-3">
                      <button className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="View details">
                        <Eye size={13}/>
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail drawer */}
      {selectedLog && <LogDetailDrawer log={selectedLog} onClose={()=>setSelectedLog(null)}/>}
    </div>
  );
}
