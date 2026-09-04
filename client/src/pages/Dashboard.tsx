import React, { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package, TrendingUp, DollarSign, Users, ShoppingCart,
  AlertTriangle, BarChart2, Layers, ArrowRight, ChevronLeft, ChevronRight, FileDown,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

// ── Queries ─────────────────────────────────────────────────────────────────

const GET_DASHBOARD_MAIN = gql`
  query GetDashboardMain($year: Int, $month: Int) {
    dashboardStats {
      id
      totalProducts
      totalCategories
      totalSuppliers
      totalCustomers
      inventoryValue
      todaySales
      monthlyRevenue
      monthlyProfit
      lowStockCount
      outOfStockCount
      totalStock
      expiringCount
      pendingPurchases
      outstandingReceivables
      outstandingPayables
    }
    lowStockProducts {
      id name stock minStockLevel
      category { name }
    }
    sales {
      id invoiceNo totalAmount createdAt
      customer { id name }
    }
    monthlySalesByDay(year: $year, month: $month) {
      date revenue profit count
    }
    salesByCategory {
      category
      totalSales
      totalRevenue
    }
  }
`;

// Separate query — activityLogs requires ADMIN/MANAGER role.
// We suppress errors so CASHIER users still see the full dashboard.
const GET_ACTIVITY = gql`
  query GetActivity {
    activityLogs {
      id action details createdAt
    }
  }
`;

import { fmtCompact, fmt, fmtInt } from '../lib/currency';
import { useLangContext } from '../lib/LangContext';

// ── Dashboard PDF print ───────────────────────────────────────────────────────
function printDashboardPDF(stats: any, chartData: any[], catData: any[], recentSales: any[]) {
  const rows = recentSales.map(s =>
    `<tr><td>${s.invoiceNo}</td><td>${s.customer?.name || 'Walk-in'}</td><td>${fmt(s.totalAmount)}</td><td>${new Date(s.createdAt).toLocaleDateString()}</td></tr>`
  ).join('');

  const cats = catData.map(c =>
    `<tr><td>${c.category}</td><td>${fmt(c.totalRevenue)}</td><td>${c.totalSales}</td></tr>`
  ).join('');

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(`
    <html><head><title>StoreOS Dashboard Report</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; padding: 32px; color: #111; font-size: 12px; }
      h1 { font-size: 22px; margin-bottom: 4px; color: #1d4ed8; }
      .sub { color: #666; margin-bottom: 24px; font-size: 11px; }
      .kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 24px; }
      .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
      .kpi-label { font-size: 10px; text-transform: uppercase; color: #666; margin-bottom: 4px; }
      .kpi-value { font-size: 20px; font-weight: bold; color: #111; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #f1f5f9; text-align: left; padding: 8px; font-size: 10px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
      td { padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
      h2 { font-size: 14px; margin: 24px 0 8px; color: #1d4ed8; }
      .flag { display: inline-flex; gap: 2px; margin-left: 8px; }
      .flag span { display: inline-block; width: 8px; height: 14px; }
      @media print { button { display: none; } }
    </style></head>
    <body onload="window.print()">
      <h1>StoreOS Dashboard Report
        <span class="flag">
          <span style="background:#2d6a2d"></span>
          <span style="background:#f0b90b"></span>
          <span style="background:#c41e1e"></span>
        </span>
      </h1>
      <p class="sub">Generated: ${new Date().toLocaleString()} · Ethiopian Store Management System</p>

      <div class="kpis">
        <div class="kpi"><div class="kpi-label">Monthly Revenue</div><div class="kpi-value">${fmt(stats?.monthlyRevenue || 0)}</div></div>
        <div class="kpi"><div class="kpi-label">Monthly Profit</div><div class="kpi-value">${fmt(stats?.monthlyProfit || 0)}</div></div>
        <div class="kpi"><div class="kpi-label">Today's Sales</div><div class="kpi-value">${fmt(stats?.todaySales || 0)}</div></div>
        <div class="kpi"><div class="kpi-label">Inventory Value</div><div class="kpi-value">${fmtInt(stats?.inventoryValue || 0)}</div></div>
        <div class="kpi"><div class="kpi-label">Total Products</div><div class="kpi-value">${stats?.totalProducts || 0}</div></div>
        <div class="kpi"><div class="kpi-label">Total Customers</div><div class="kpi-value">${stats?.totalCustomers || 0}</div></div>
        <div class="kpi"><div class="kpi-label">Low Stock</div><div class="kpi-value">${stats?.lowStockCount || 0}</div></div>
        <div class="kpi"><div class="kpi-label">Out of Stock</div><div class="kpi-value">${stats?.outOfStockCount || 0}</div></div>
      </div>

      <h2>Recent Sales</h2>
      <table><thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Date</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">No sales yet.</td></tr>'}</tbody></table>

      <h2>Sales by Category</h2>
      <table><thead><tr><th>Category</th><th>Revenue</th><th>Items Sold</th></tr></thead>
      <tbody>${cats || '<tr><td colspan="3">No data.</td></tr>'}</tbody></table>
    </body></html>
  `);
  w.document.close();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PIE_COLORS = [
  'hsl(221,83%,53%)', 'hsl(142,71%,45%)', 'hsl(38,92%,50%)',
  'hsl(346,77%,49%)', 'hsl(270,70%,60%)', 'hsl(190,80%,45%)',
];

const actionColor: Record<string, string> = {
  SALE_COMPLETED:   'bg-emerald-500',
  PRODUCT_CREATED:  'bg-primary',
  PRODUCT_UPDATED:  'bg-violet-500',
  PRODUCT_DELETED:  'bg-destructive',
  STOCK_ADJUSTED:   'bg-amber-500',
  USER_LOGGED_IN:   'bg-sky-500',
};

// ── Sub-components ───────────────────────────────────────────────────────────

function KPICard({ title, value, icon, sub, color, delay, trend }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        {trend != null && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wide">{title}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </motion.div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useLangContext();
  const now = new Date();
  const [chartYear, setChartYear]   = useState(now.getFullYear());
  const [chartMonth, setChartMonth] = useState(now.getMonth()); // 0-indexed

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const { data, loading, refetch } = useQuery(GET_DASHBOARD_MAIN, {
    variables: { year: chartYear, month: chartMonth },
    fetchPolicy: 'network-only',
    errorPolicy: 'ignore',
  });
  const { data: actData } = useQuery(GET_ACTIVITY, { fetchPolicy: 'cache-and-network', errorPolicy: 'ignore' });

  const stats      = data?.dashboardStats;
  const lowStock   = data?.lowStockProducts  || [];
  const recentSales = (data?.sales || []).slice(0, 6);
  const logs        = actData?.activityLogs   || [];
  const chartData   = (data?.monthlySalesByDay || []).map((d: any) => ({
    date: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: Math.round(d.revenue * 100) / 100,
    profit:  Math.round(d.profit  * 100) / 100,
  }));
  const catData = data?.salesByCategory || [];

  if (loading && !stats) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Top bar with PDF button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('dashboard')}</h2>
          <p className="text-xs text-muted-foreground">StoreOS · {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button
          onClick={() => printDashboardPDF(stats, chartData, catData, recentSales)}
          className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
        >
          <FileDown size={14} /> Export PDF
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title={t('revenue')}        value={fmt(stats?.monthlyRevenue || 0)}   icon={<DollarSign size={20} className="text-primary" />}        color="bg-primary/10"   delay={0} />
        <KPICard title={t('profit')}          value={fmt(stats?.monthlyProfit || 0)}    icon={<TrendingUp size={20} className="text-emerald-500" />}    color="bg-emerald-500/10" delay={0.07} />
        <KPICard title={t('products')}        value={stats?.totalProducts || 0}          icon={<Package size={20} className="text-violet-500" />}        color="bg-violet-500/10" delay={0.14} sub={stats?.lowStockCount ? `${stats.lowStockCount} ${t('lowStock')}` : undefined} />
        <KPICard title={t('customers')}       value={stats?.totalCustomers || 0}         icon={<Users size={20} className="text-amber-500" />}           color="bg-amber-500/10" delay={0.21} />
      </div>

      {/* ── KPI Row 2 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title={t('todaySales')}      value={fmt(stats?.todaySales || 0)}       icon={<ShoppingCart size={20} className="text-sky-500" />}      color="bg-sky-500/10"   delay={0.28} />
        <KPICard title={t('inventoryValue')}  value={fmtInt(stats?.inventoryValue || 0)} icon={<BarChart2 size={20} className="text-indigo-500" />}      color="bg-indigo-500/10" delay={0.35} />
        <KPICard title={t('outOfStock')}      value={stats?.outOfStockCount || 0}        icon={<AlertTriangle size={20} className="text-destructive" />} color="bg-destructive/10" delay={0.42} />
        <KPICard title={t('categories')}      value={stats?.totalCategories || 0}        icon={<Layers size={20} className="text-orange-500" />}         color="bg-orange-500/10" delay={0.49} />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Revenue & Profit — real API data */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-foreground">{t('revenue')} &amp; {t('profit')} — This Month</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Daily breakdown from live sales data</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Month/Year navigator */}
              <div className="flex items-center gap-1 bg-muted/40 rounded-lg px-2 py-1">
                <button onClick={() => {
                  if (chartMonth === 0) { setChartMonth(11); setChartYear(y => y - 1); }
                  else setChartMonth(m => m - 1);
                }} className="p-0.5 hover:text-primary transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-medium text-foreground w-16 text-center">
                  {MONTHS[chartMonth]} {chartYear}
                </span>
                <button onClick={() => {
                  if (chartMonth === 11) { setChartMonth(0); setChartYear(y => y + 1); }
                  else setChartMonth(m => m + 1);
                }} disabled={chartYear === now.getFullYear() && chartMonth === now.getMonth()}
                className="p-0.5 hover:text-primary transition-colors disabled:opacity-30">
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />{t('revenue')}</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />{t('profit')}</span>
              </div>
            </div>
          </div>
          <div className="h-[260px]">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No sales recorded this month yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(221,83%,53%)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="hsl(221,83%,53%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(142,71%,45%)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="hsl(142,71%,45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                  <Tooltip
                    formatter={(v: number) => [fmt(v)]}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(221,83%,53%)" strokeWidth={2.5} fillOpacity={1} fill="url(#gRev)" />
                  <Area type="monotone" dataKey="profit"  name="Profit"  stroke="hsl(142,71%,45%)" strokeWidth={2.5} fillOpacity={1} fill="url(#gProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* Sales by Category Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
          className="bg-card border border-border rounded-xl p-6 shadow-sm"
        >
          <h3 className="text-base font-semibold text-foreground mb-1">{t('sales')} by Category</h3>
          <p className="text-xs text-muted-foreground mb-4">Revenue breakdown</p>
          {catData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data yet.</div>
          ) : (
            <>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={catData}
                      dataKey="totalRevenue"
                      nameKey="category"
                      cx="50%" cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {catData.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [fmt(v)]}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-3">
                {catData.slice(0, 4).map((c: any, i: number) => (
                  <div key={c.category} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground truncate max-w-[100px]">{c.category}</span>
                    </div>
                    <span className="font-semibold text-foreground">{fmtInt(c.totalRevenue)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ── Bottom Row: Recent Sales + Low Stock + Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Sales */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="bg-card border border-border rounded-xl shadow-sm overflow-hidden"
        >
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{t('recentSales')}</h3>
            <Link to="/sales" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No sales yet.</p>
            ) : recentSales.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground font-mono">{s.invoiceNo}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.customer?.name || 'Walk-in'} · {new Date(s.createdAt).toLocaleDateString()}</p>
                </div>
                <span className="text-sm font-bold text-emerald-500 shrink-0 ml-3">{fmt(s.totalAmount)}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Low Stock */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}
          className="bg-card border border-border rounded-xl shadow-sm overflow-hidden"
        >
          <div className="p-5 border-b border-border flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h3 className="text-base font-semibold text-foreground">Low Stock Alerts</h3>
            {lowStock.length > 0 && (
              <span className="ml-auto text-xs font-semibold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
                {lowStock.length}
              </span>
            )}
          </div>
          <div className="divide-y divide-border">
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">All stock levels healthy ✓</p>
            ) : lowStock.slice(0, 6).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category?.name}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className={`text-sm font-bold ${p.stock === 0 ? 'text-destructive' : 'text-amber-500'}`}>{p.stock}</p>
                  <p className="text-xs text-muted-foreground">min {p.minStockLevel}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.59 }}
          className="bg-card border border-border rounded-xl shadow-sm overflow-hidden"
        >
          <div className="p-5 border-b border-border">
            <h3 className="text-base font-semibold text-foreground">Recent Activity</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Admin &amp; Manager only</p>
          </div>
          <div className="divide-y divide-border">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No activity logs available.</p>
            ) : logs.slice(0, 7).map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${actionColor[log.action] || 'bg-muted-foreground'}`} />
                <div className="min-w-0">
                  <p className="text-sm text-foreground leading-snug truncate">{log.details || log.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(log.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
