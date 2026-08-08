import React, { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { motion } from 'framer-motion';
import {
  Shield, Search, FileDown, User, Package,
  ShoppingCart, AlertTriangle, Trash2, Edit2,
  LogIn, Settings, Building2, Star,
} from 'lucide-react';
import { useLangContext } from '../lib/LangContext';
import { useRole } from '../hooks/useRole';

// ── GraphQL ───────────────────────────────────────────────────────────────────

const GET_AUDIT_LOGS = gql`
  query GetAuditLogs {
    activityLogs {
      id action details createdAt
      user { name email role }
    }
  }
`;

// ── Action config ─────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  USER_LOGGED_IN:           { label: 'Login',             color: 'text-sky-600',     bg: 'bg-sky-500/10',      icon: <LogIn size={13} /> },
  USER_CREATED:             { label: 'User Created',      color: 'text-emerald-600', bg: 'bg-emerald-500/10',  icon: <User size={13} /> },
  USER_DELETED:             { label: 'User Deleted',      color: 'text-destructive', bg: 'bg-destructive/10',  icon: <Trash2 size={13} /> },
  USER_ROLE_CHANGED:        { label: 'Role Changed',      color: 'text-violet-600',  bg: 'bg-violet-500/10',   icon: <Shield size={13} /> },
  PROFILE_UPDATED:          { label: 'Profile Updated',   color: 'text-blue-600',    bg: 'bg-blue-500/10',     icon: <Settings size={13} /> },
  PRODUCT_CREATED:          { label: 'Product Added',     color: 'text-emerald-600', bg: 'bg-emerald-500/10',  icon: <Package size={13} /> },
  PRODUCT_UPDATED:          { label: 'Product Updated',   color: 'text-amber-600',   bg: 'bg-amber-500/10',    icon: <Edit2 size={13} /> },
  PRODUCT_DELETED:          { label: 'Product Deleted',   color: 'text-destructive', bg: 'bg-destructive/10',  icon: <Trash2 size={13} /> },
  PRODUCT_DEACTIVATED:      { label: 'Deactivated',       color: 'text-amber-600',   bg: 'bg-amber-500/10',    icon: <AlertTriangle size={13} /> },
  SALE_COMPLETED:           { label: 'Sale',              color: 'text-emerald-600', bg: 'bg-emerald-500/10',  icon: <ShoppingCart size={13} /> },
  SALE_RETURNED:            { label: 'Refund',            color: 'text-destructive', bg: 'bg-destructive/10',  icon: <ShoppingCart size={13} /> },
  STOCK_ADJUSTED:           { label: 'Stock Adjusted',    color: 'text-amber-600',   bg: 'bg-amber-500/10',    icon: <Package size={13} /> },
  TRADITIONAL_ITEM_CREATED: { label: 'Traditional Added', color: 'text-emerald-600', bg: 'bg-emerald-500/10',  icon: <Star size={13} /> },
  TRADITIONAL_ITEM_UPDATED: { label: 'Traditional Edited',color: 'text-amber-600',   bg: 'bg-amber-500/10',    icon: <Star size={13} /> },
  TRADITIONAL_ITEM_DELETED: { label: 'Traditional Deleted',color: 'text-destructive',bg: 'bg-destructive/10',  icon: <Trash2 size={13} /> },
  BRANCH_CREATED:           { label: 'Branch Added',      color: 'text-emerald-600', bg: 'bg-emerald-500/10',  icon: <Building2 size={13} /> },
  BRANCH_DELETED:           { label: 'Branch Deleted',    color: 'text-destructive', bg: 'bg-destructive/10',  icon: <Trash2 size={13} /> },
  PO_CREATED:               { label: 'PO Created',        color: 'text-blue-600',    bg: 'bg-blue-500/10',     icon: <Package size={13} /> },
  PO_RECEIVED:              { label: 'PO Received',       color: 'text-emerald-600', bg: 'bg-emerald-500/10',  icon: <Package size={13} /> },
  PO_STATUS_CHANGED:        { label: 'PO Updated',        color: 'text-amber-600',   bg: 'bg-amber-500/10',    icon: <Package size={13} /> },
};

const DEFAULT_ACTION = { label: 'Action', color: 'text-muted-foreground', bg: 'bg-muted', icon: <Settings size={13} /> };

const ROLE_COLORS: Record<string, string> = {
  ADMIN:   'bg-violet-500/10 text-violet-600',
  MANAGER: 'bg-blue-500/10 text-blue-600',
  CASHIER: 'bg-emerald-500/10 text-emerald-600',
};

function downloadCSV(logs: any[]) {
  const rows = [
    ['Date & Time', 'User', 'Role', 'Email', 'Action', 'Details'],
    ...logs.map(l => [
      new Date(l.createdAt).toLocaleString(),
      l.user?.name || 'System',
      l.user?.role || '',
      l.user?.email || '',
      l.action,
      l.details || '',
    ]),
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ACTION_GROUPS = [
  { label: 'All Actions', value: '' },
  { label: 'Logins', value: 'USER_LOGGED_IN' },
  { label: 'Sales', value: 'SALE' },
  { label: 'Products', value: 'PRODUCT' },
  { label: 'Users', value: 'USER' },
  { label: 'Stock', value: 'STOCK' },
  { label: 'Purchase Orders', value: 'PO' },
  { label: 'Traditional Items', value: 'TRADITIONAL' },
  { label: 'Branches', value: 'BRANCH' },
];

export default function AuditLog() {
  const { t } = useLangContext();
  const { isAdmin, isManager } = useRole();
  const [search, setSearch]     = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter]     = useState('');

  const { data, loading } = useQuery(GET_AUDIT_LOGS, { fetchPolicy: 'cache-and-network' });
  const allLogs: any[] = data?.activityLogs || [];

  // Access check
  if (!isAdmin && !isManager) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center text-destructive">
          <AlertTriangle size={24} />
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">Access Restricted</p>
          <p className="text-sm text-muted-foreground mt-1">Audit log requires Admin or Manager access.</p>
        </div>
      </div>
    );
  }

  // Filter
  const logs = allLogs.filter(log => {
    const matchSearch = !search ||
      log.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase());
    const matchAction = !actionFilter || log.action.includes(actionFilter);
    const matchUser = !userFilter || log.user?.name === userFilter;
    return matchSearch && matchAction && matchUser;
  });

  // Unique users for filter
  const uniqueUsers = [...new Set(allLogs.map(l => l.user?.name).filter(Boolean))];

  // Stats
  const todayLogs  = allLogs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length;
  const salesCount = allLogs.filter(l => l.action === 'SALE_COMPLETED').length;
  const adminActions = allLogs.filter(l => l.user?.role === 'ADMIN').length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <Shield size={16} />
            </div>
            <h2 className="text-xl font-bold text-foreground">Audit Log</h2>
          </div>
          <p className="text-sm text-muted-foreground">{allLogs.length} total events recorded</p>
        </div>
        <button
          onClick={() => downloadCSV(logs)}
          className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
        >
          <FileDown size={14} /> Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Events',    value: allLogs.length,   color: 'text-foreground'  },
          { label: 'Today',           value: todayLogs,        color: 'text-primary'     },
          { label: 'Sales Recorded',  value: salesCount,       color: 'text-emerald-500' },
          { label: 'Admin Actions',   value: adminActions,     color: 'text-violet-500'  },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search user, action, or details…"
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
          {ACTION_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
          <option value="">All Users</option>
          {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        {(search || actionFilter || userFilter) && (
          <button onClick={() => { setSearch(''); setActionFilter(''); setUserFilter(''); }}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors">
            Clear
          </button>
        )}
        <p className="text-xs text-muted-foreground ml-auto">
          Showing <span className="font-semibold text-foreground">{logs.length}</span> of {allLogs.length}
        </p>
      </div>

      {/* Log table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                {['Date & Time', 'User', 'Role', 'Action', 'Details'].map(h => (
                  <th key={h} className="px-5 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12">
                  <div className="flex justify-center">
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                  No log entries found.
                </td></tr>
              ) : logs.map((log, i) => {
                const cfg = ACTION_CONFIG[log.action] || DEFAULT_ACTION;
                return (
                  <motion.tr key={log.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                    className="border-b border-border hover:bg-muted/20 transition-colors">
                    {/* Date */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <p className="text-xs text-foreground font-medium">
                        {new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </td>
                    {/* User */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          {(log.user?.name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground leading-tight">{log.user?.name || 'System'}</p>
                          <p className="text-[11px] text-muted-foreground">{log.user?.email || ''}</p>
                        </div>
                      </div>
                    </td>
                    {/* Role */}
                    <td className="px-5 py-3.5">
                      {log.user?.role && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[log.user.role] || 'bg-muted text-muted-foreground'}`}>
                          {log.user.role}
                        </span>
                      )}
                    </td>
                    {/* Action badge */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </td>
                    {/* Details */}
                    <td className="px-5 py-3.5 text-sm text-muted-foreground max-w-xs">
                      <p className="truncate">{log.details || log.action}</p>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
