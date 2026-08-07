import React, { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { FileDown, TrendingUp, Package, DollarSign, ShoppingCart, Percent } from 'lucide-react';
import { fmt, fmtCompact, fmtInt } from '../lib/currency';
import { useToast } from '../components/Toast';
import { useLangContext } from '../lib/LangContext';

// ── GraphQL ──────────────────────────────────────────────────────────────────

const GET_REPORTS = gql`
  query GetReports($startDate: String, $endDate: String) {
    sales(startDate: $startDate, endDate: $endDate) {
      id invoiceNo totalAmount createdAt
      customer { name }
      items { quantity price product { name costPrice } }
    }
    products {
      id name sku stock costPrice sellingPrice status minStockLevel
      category { name }
      saleItems { quantity price }
    }
    salesByCategory { name revenue count }
    monthlySalesByDay(startDate: $startDate, endDate: $endDate) { date revenue profit count }
  }
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function downloadCSV(data: any[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const csv = [
    keys.join(','),
    ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const PIE_COLORS = [
  'hsl(221,83%,53%)', 'hsl(142,71%,45%)', 'hsl(38,92%,50%)',
  'hsl(346,77%,49%)', 'hsl(270,70%,60%)',
];

function StatCard({ label, value, icon, color }: any) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Reports() {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [activeRange, setActiveRange] = useState({ start: '', end: '' });
  const { info } = useToast();
  const { t } = useLangContext();

  const { data, loading, refetch } = useQuery(GET_REPORTS, {
    variables: {
      startDate: activeRange.start || undefined,
      endDate:   activeRange.end   || undefined,
    },
    fetchPolicy: 'cache-and-network',
  });

  const sales    = data?.sales    || [];
  const products = data?.products || [];
  const catData  = data?.salesByCategory || [];
  const dailyRaw = data?.monthlySalesByDay || [];

  const dailyData = dailyRaw.map((d: any) => ({
    date:    new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: Math.round(d.revenue * 100) / 100,
    profit:  Math.round(d.profit  * 100) / 100,
  }));

  // KPI aggregations
  const totalRevenue = sales.reduce((s: number, x: any) => s + x.totalAmount, 0);
  const totalProfit  = sales.reduce((s: number, x: any) =>
    s + x.items.reduce((is: number, i: any) => is + (i.price - i.product.costPrice) * i.quantity, 0), 0);
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const inventoryValue = products.reduce((s: number, p: any) => s + p.costPrice * p.stock, 0);

  // Top products by units sold
  const productMap: Record<string, { name: string; qty: number; revenue: number; margin: number; costPrice: number; sellingPrice: number }> = {};
  sales.forEach((s: any) => s.items.forEach((i: any) => {
    const key = i.product?.name || 'Unknown';
    if (!productMap[key]) productMap[key] = { name: key, qty: 0, revenue: 0, margin: 0, costPrice: i.product.costPrice, sellingPrice: i.price };
    productMap[key].qty     += i.quantity;
    productMap[key].revenue += i.price * i.quantity;
  }));
  const topProducts = Object.values(productMap)
    .map(p => ({ ...p, margin: ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Profit margin by product (all inventory)
  const marginTable = products
    .map((p: any) => ({
      name:    p.name,
      sku:     p.sku,
      cat:     p.category?.name || '—',
      cost:    p.costPrice,
      sell:    p.sellingPrice,
      margin:  p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100 : 0,
      stock:   p.stock,
      sold:    (p.saleItems || []).reduce((s: number, i: any) => s + i.quantity, 0),
    }))
    .sort((a: any, b: any) => b.margin - a.margin);

  const applyFilter = () => { setActiveRange(dateRange); };
  const resetFilter = () => { setDateRange({ start: '', end: '' }); setActiveRange({ start: '', end: '' }); };

  const exportSales = () => {
    downloadCSV(sales.map((s: any) => ({
      invoice: s.invoiceNo, customer: s.customer?.name || 'Walk-in',
      total: s.totalAmount.toFixed(2), date: new Date(s.createdAt).toLocaleString(),
    })), 'sales-report.csv');
    info('Export ready', 'sales-report.csv downloaded.');
  };
  const exportProducts = () => {
    downloadCSV(products.map((p: any) => ({
      name: p.name, sku: p.sku, category: p.category?.name,
      stock: p.stock, costPrice: p.costPrice, sellingPrice: p.sellingPrice,
      margin: `${(((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100).toFixed(1)}%`,
    })), 'products-report.csv');
    info('Export ready', 'products-report.csv downloaded.');
  };
  const exportInventory = () => {
    downloadCSV(products.map((p: any) => ({
      name: p.name, sku: p.sku, stock: p.stock,
      value: (p.costPrice * p.stock).toFixed(2),
      status: p.stock === 0 ? 'Out of Stock' : p.stock <= p.minStockLevel ? 'Low Stock' : 'OK',
    })), 'inventory-report.csv');
    info('Export ready', 'inventory-report.csv downloaded.');
  };

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))',
    borderRadius: '8px', fontSize: '12px',
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('reports')} &amp; Analytics</h2>
          <p className="text-sm text-muted-foreground">Business intelligence and export tools</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportSales}
            className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted flex items-center gap-2 transition-colors">
            <FileDown size={14} /> Sales
          </button>
          <button onClick={exportProducts}
            className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted flex items-center gap-2 transition-colors">
            <FileDown size={14} /> Products
          </button>
          <button onClick={exportInventory}
            className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted flex items-center gap-2 transition-colors">
            <FileDown size={14} /> Inventory
          </button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Date Range:</span>
        <input type="date" value={dateRange.start}
          onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
        <span className="text-muted-foreground text-sm">to</span>
        <input type="date" value={dateRange.end}
          onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
        <button onClick={applyFilter}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          Apply
        </button>
        <button onClick={resetFilter}
          className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">
          Reset
        </button>
        {(activeRange.start || activeRange.end) && (
          <span className="text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-full">
            Filtered
          </span>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <StatCard label={t('revenue')}      value={fmt(totalRevenue)}  icon={<DollarSign size={16} className="text-primary" />}     color="bg-primary/10" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
          <StatCard label={t('profit')}       value={fmt(totalProfit)}   icon={<TrendingUp size={16} className="text-emerald-500" />} color="bg-emerald-500/10" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <StatCard label={t('margin')}       value={`${profitMargin.toFixed(1)}%`} icon={<Percent size={16} className="text-violet-500" />} color="bg-violet-500/10" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}>
          <StatCard label={t('inventoryValue')} value={fmtInt(inventoryValue)} icon={<Package size={16} className="text-amber-500" />} color="bg-amber-500/10" />
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Revenue by Day */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="lg:col-span-2 bg-card border border-border rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-foreground">Daily Revenue &amp; Profit</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeRange.start && activeRange.end
                  ? `${activeRange.start} → ${activeRange.end}`
                  : activeRange.start
                  ? `From ${activeRange.start}`
                  : activeRange.end
                  ? `Until ${activeRange.end}`
                  : 'Current month'}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Profit</span>
            </div>
          </div>
          <div className="h-[260px]">
            {dailyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No sales in this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={fmtCompact} />
                  <Tooltip formatter={(v: number) => [fmt(v)]} contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(221,83%,53%)"
                    strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="hsl(142,71%,45%)"
                    strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* Category Revenue Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <h3 className="text-base font-semibold text-foreground mb-1">Revenue by Category</h3>
          <p className="text-xs text-muted-foreground mb-4">All-time breakdown</p>
          {catData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data.</div>
          ) : (
            <>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={catData} dataKey="revenue" nameKey="name"
                      cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                      {catData.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [fmt(v)]} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-3">
                {catData.slice(0, 5).map((c: any, i: number) => (
                  <div key={c.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{c.name}</span>
                    </div>
                    <span className="font-semibold text-foreground">{fmtInt(c.revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Top Selling Products Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
        className="bg-card border border-border rounded-xl p-6"
      >
        <h3 className="text-base font-semibold text-foreground mb-5">Top Products by Revenue</h3>
        {topProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No sales data in this period.</p>
        ) : (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} margin={{ top: 0, right: 10, left: -10, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" angle={-30} textAnchor="end"
                  stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} interval={0} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={fmtCompact} />
                <Tooltip formatter={(v: number) => [fmt(v)]} contentStyle={tooltipStyle} />
                <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      {/* Profit Margin Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}
        className="bg-card border border-border rounded-xl shadow-sm overflow-hidden"
      >
        <div className="p-5 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Profit Margin by Product</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Sorted by margin — full inventory</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                {['Product', 'SKU', 'Category', 'Cost', 'Price', 'Margin', 'Stock', 'Units Sold'].map(h => (
                  <th key={h} className="px-5 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10">
                  <div className="flex justify-center">
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                </td></tr>
              ) : marginTable.map((p: any, i: number) => (
                <motion.tr key={p.sku}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-border hover:bg-muted/20 transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-foreground">{p.name}</td>
                  <td className="px-5 py-3.5">
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-muted-foreground">{p.sku}</code>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">{p.cat}</span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{fmt(p.cost)}</td>
                  <td className="px-5 py-3.5 font-medium">{fmt(p.sell)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${p.margin >= 30 ? 'bg-emerald-500' : p.margin >= 15 ? 'bg-amber-500' : 'bg-destructive'}`}
                          style={{ width: `${Math.min(p.margin, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold tabular-nums ${p.margin >= 30 ? 'text-emerald-500' : p.margin >= 15 ? 'text-amber-500' : 'text-destructive'}`}>
                        {p.margin.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`font-semibold ${p.stock === 0 ? 'text-destructive' : p.stock <= 10 ? 'text-amber-500' : 'text-foreground'}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-foreground">{p.sold}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

    </div>
  );
}
