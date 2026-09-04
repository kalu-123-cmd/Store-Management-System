import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, TrendingUp, AlertTriangle, ShoppingBag,
  DollarSign, Package, BarChart3, Activity,
  RefreshCw, ArrowUpRight, CheckCircle, XCircle,
  Sparkles, Target, Zap, ArrowDown, ArrowUp,
  Calendar, Clock, Users, Eye, PieChart,
  Truck, Tag, Wallet, PlusCircle, ClipboardList
} from 'lucide-react';
import { fmt, fmtInt } from '../lib/currency';

const GET_AI_OVERVIEW = gql`
  query GetAIOverview {
    dashboardStats {
      id
      todaySales
      yesterdaySales
      weekSales
      lastWeekSales
      totalStock
      lowStockCount
      expiringCount
      pendingPurchases
      outstandingReceivables
      outstandingPayables
      totalProducts
      totalCategories
      totalSuppliers
      totalCustomers
      inventoryValue
      monthlyRevenue
      monthlyProfit
      lastMonthRevenue
      outOfStockCount
    }
    salesByCategory {
      category
      totalSales
      totalRevenue
    }
    sales {
      id
      invoiceNo
      totalAmount
      createdAt
      customer { id name }
    }
  }
`;

const GET_AI_ALERTS = gql`
  query GetAIAlerts {
    dashboardStats {
      id
      lowStockCount
      outOfStockCount
      expiringCount
      pendingPurchases
      outstandingReceivables
      outstandingPayables
      totalProducts
      monthlyRevenue
      monthlyProfit
    }
    lowStockProducts {
      id
      name
      stock
      minStockLevel
      costPrice
      sellingPrice
      category { name }
      supplier { name }
    }
    expiringBatches(days: 30) {
      id
      batchNumber
      expiryDate
      currentQuantity
      unitCost
      product {
        id
        name
        sellingPrice
      }
    }
  }
`;

interface DashboardStats {
  todaySales: number;
  yesterdaySales: number;
  weekSales: number;
  lastWeekSales: number;
  totalStock: number;
  lowStockCount: number;
  expiringCount: number;
  pendingPurchases: number;
  outstandingReceivables: number;
  outstandingPayables: number;
  totalProducts: number;
  totalCategories: number;
  totalSuppliers: number;
  totalCustomers: number;
  inventoryValue: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  lastMonthRevenue: number;
  outOfStockCount: number;
}

interface SalesByCategory {
  category: string;
  totalSales: number;
  totalRevenue: number;
}

interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  minStockLevel: number;
  costPrice: number;
  sellingPrice: number;
  category?: { name: string } | null;
  supplier?: { name: string } | null;
}

interface ExpiringBatch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  currentQuantity: number;
  unitCost: number;
  product?: { id: string; name: string; sellingPrice: number } | null;
}

interface Sale {
  id: string;
  invoiceNo: string;
  totalAmount: number;
  createdAt: string;
  customer?: { name: string } | null;
}

type TimeRange = 'today' | 'week' | 'month';
type Tab = 'overview' | 'alerts' | 'insights';

function suggestedReorderQty(stock: number, minStockLevel: number) {
  const target = Math.max(minStockLevel * 2, minStockLevel + 5);
  return Math.max(1, target - stock);
}

function daysUntil(dateStr: string) {
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return 999;
  return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
}

function expiryDiscount(days: number) {
  if (days <= 1) return 80;
  if (days <= 3) return 60;
  if (days <= 7) return 40;
  if (days <= 14) return 20;
  if (days <= 30) return 10;
  return 0;
}

function expiryUrgency(days: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (days <= 3) return 'CRITICAL';
  if (days <= 7) return 'HIGH';
  if (days <= 14) return 'MEDIUM';
  return 'LOW';
}

function growthPct(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

const EMPTY_STATS: DashboardStats = {
  todaySales: 0,
  yesterdaySales: 0,
  weekSales: 0,
  lastWeekSales: 0,
  totalStock: 0,
  lowStockCount: 0,
  expiringCount: 0,
  pendingPurchases: 0,
  outstandingReceivables: 0,
  outstandingPayables: 0,
  totalProducts: 0,
  totalCategories: 0,
  totalSuppliers: 0,
  totalCustomers: 0,
  inventoryValue: 0,
  monthlyRevenue: 0,
  monthlyProfit: 0,
  lastMonthRevenue: 0,
  outOfStockCount: 0,
};

export default function AIDashboard() {
  const navigate = useNavigate();
  const overviewQ = useQuery(GET_AI_OVERVIEW, {
    pollInterval: 30000,
    errorPolicy: 'all',
  });
  const alertsQ = useQuery(GET_AI_ALERTS, {
    pollInterval: 30000,
    errorPolicy: 'all',
  });
  const loading = overviewQ.loading && alertsQ.loading && !overviewQ.data && !alertsQ.data;
  const error = overviewQ.error || alertsQ.error;
  const refetch = async () => {
    await Promise.all([overviewQ.refetch(), alertsQ.refetch()]);
  };
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [timeRange, setTimeRange] = useState<TimeRange>('today');

  const stats: DashboardStats = {
    ...EMPTY_STATS,
    ...(alertsQ.data?.dashboardStats || {}),
    ...(overviewQ.data?.dashboardStats || {}),
  };
  const salesByCategory = (overviewQ.data?.salesByCategory as SalesByCategory[]) || [];
  const lowStockProducts = (alertsQ.data?.lowStockProducts as LowStockProduct[]) || [];
  const expiringBatches = ((alertsQ.data?.expiringBatches as ExpiringBatch[]) || []).filter(
    (b) => b?.expiryDate && !Number.isNaN(new Date(b.expiryDate).getTime())
  );
  const recentSales = (overviewQ.data?.sales as Sale[]) || [];

  const periodRevenue = useMemo(() => {
    if (timeRange === 'week') return stats.weekSales;
    if (timeRange === 'month') return stats.monthlyRevenue;
    return stats.todaySales;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, stats.weekSales, stats.monthlyRevenue, stats.todaySales]);

  const periodCompare = useMemo(() => {
    if (timeRange === 'week') return { current: stats.weekSales, previous: stats.lastWeekSales, label: 'vs last week' };
    if (timeRange === 'month') return { current: stats.monthlyRevenue, previous: stats.lastMonthRevenue, label: 'vs last month' };
    return { current: stats.todaySales, previous: stats.yesterdaySales, label: 'vs yesterday' };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, stats.weekSales, stats.lastWeekSales, stats.monthlyRevenue, stats.lastMonthRevenue, stats.todaySales, stats.yesterdaySales]);

  const growth = growthPct(periodCompare.current, periodCompare.previous);
  const profitMargin = stats.monthlyRevenue > 0
    ? ((stats.monthlyProfit / stats.monthlyRevenue) * 100)
    : 0;
  const cashGap = stats.outstandingReceivables - stats.outstandingPayables;
  const atRisk = stats.lowStockCount + stats.outOfStockCount;

  const storeHealth = useMemo(() => {
    let score = 100;
    if (stats.lowStockCount > 0) score -= Math.min(stats.lowStockCount * 2, 20);
    if (stats.outOfStockCount > 0) score -= Math.min(stats.outOfStockCount * 5, 25);
    if (stats.expiringCount > 0) score -= Math.min(stats.expiringCount * 3, 15);
    if (stats.pendingPurchases > 5) score -= Math.min(stats.pendingPurchases, 10);
    if (stats.totalProducts === 0) score = 0;
    return Math.max(0, score);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.lowStockCount, stats.outOfStockCount, stats.expiringCount, stats.pendingPurchases, stats.totalProducts]);

  const healthColor = storeHealth >= 80
    ? 'text-emerald-700 bg-emerald-50'
    : storeHealth >= 60
      ? 'text-amber-700 bg-amber-50'
      : 'text-red-700 bg-red-50';

  const healthStatus = storeHealth >= 80 ? 'Excellent'
    : storeHealth >= 60 ? 'Good'
      : storeHealth >= 40 ? 'Fair'
        : 'Critical';

  const isEmptyStore = stats.totalProducts === 0 && stats.monthlyRevenue === 0;

  const insights = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      body: string;
      tone: string;
      icon: React.ReactNode;
      action?: { label: string; to: string };
    }> = [];

    if (isEmptyStore) {
      items.push({
        id: 'setup',
        title: 'Get your store live',
        body: 'Add categories and products, then record a sale so AI can score health and recommend reorders.',
        tone: 'bg-blue-50 hover:bg-blue-100',
        icon: <PlusCircle className="h-4 w-4 text-blue-600" />,
        action: { label: 'Add products', to: '/products' },
      });
      return items;
    }

    if (lowStockProducts.length > 0) {
      const top = lowStockProducts[0];
      const qty = suggestedReorderQty(top.stock, top.minStockLevel);
      items.push({
        id: 'reorder',
        title: 'Reorder now',
        body: `${lowStockProducts.length} SKUs need restock. Priority: ${top.name} — order ~${qty} units to reach safety stock.`,
        tone: 'bg-violet-50 hover:bg-violet-100',
        icon: <Target className="h-4 w-4 text-violet-600" />,
        action: { label: 'Create PO', to: '/purchases' },
      });
    }

    if (expiringBatches.length > 0) {
      const soonest = [...expiringBatches].sort(
        (a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate)
      )[0];
      const d = daysUntil(soonest.expiryDate);
      const discount = expiryDiscount(d);
      items.push({
        id: 'expiry',
        title: 'Clear stock before expiry',
        body: `${expiringBatches.length} batches expire within 30 days. ${soonest.product?.name || 'A batch'} needs ~${discount}% markdown (${d} days left).`,
        tone: 'bg-rose-50 hover:bg-rose-100',
        icon: <Tag className="h-4 w-4 text-rose-600" />,
        action: { label: 'Open inventory', to: '/inventory' },
      });
    }

    if (salesByCategory.length > 0) {
      const top = salesByCategory[0];
      const share = stats.monthlyRevenue > 0
        ? ((top.totalRevenue / stats.monthlyRevenue) * 100).toFixed(0)
        : '0';
      items.push({
        id: 'category',
        title: 'Protect top category',
        body: `${top.category} drives ${share}% of revenue (${fmt(top.totalRevenue)}). Keep it stocked and featured at POS.`,
        tone: 'bg-sky-50 hover:bg-sky-100',
        icon: <BarChart3 className="h-4 w-4 text-sky-600" />,
        action: { label: 'View categories', to: '/categories' },
      });
    }

    if (profitMargin > 0 && profitMargin < 15) {
      items.push({
        id: 'margin',
        title: 'Tighten margins',
        body: `Profit margin is ${profitMargin.toFixed(1)}%. Raise selling prices on slow movers or renegotiate supplier cost.`,
        tone: 'bg-emerald-50 hover:bg-emerald-100',
        icon: <Zap className="h-4 w-4 text-emerald-600" />,
        action: { label: 'Review products', to: '/products' },
      });
    } else if (profitMargin >= 15) {
      items.push({
        id: 'margin-ok',
        title: 'Healthy margin',
        body: `Margin sits at ${profitMargin.toFixed(1)}% on ${fmt(stats.monthlyRevenue)} monthly revenue. Keep high-margin SKUs visible.`,
        tone: 'bg-emerald-50 hover:bg-emerald-100',
        icon: <Zap className="h-4 w-4 text-emerald-600" />,
        action: { label: 'Sales report', to: '/reports' },
      });
    }

    if (stats.pendingPurchases > 0) {
      items.push({
        id: 'po',
        title: 'Follow up purchase orders',
        body: `${stats.pendingPurchases} POs are still open. Confirm supplier ETAs so shelves do not go empty.`,
        tone: 'bg-amber-50 hover:bg-amber-100',
        icon: <Truck className="h-4 w-4 text-amber-600" />,
        action: { label: 'Open purchases', to: '/purchases' },
      });
    }

    if (stats.outstandingReceivables > 0 || stats.outstandingPayables > 0) {
      items.push({
        id: 'cash',
        title: cashGap >= 0 ? 'Collect receivables' : 'Payables pressure',
        body: cashGap >= 0
          ? `You are owed ${fmt(stats.outstandingReceivables)}. Collecting improves cash for restocking.`
          : `Payables (${fmt(stats.outstandingPayables)}) exceed receivables. Prioritize collections and delay non-critical buys.`,
        tone: 'bg-indigo-50 hover:bg-indigo-100',
        icon: <Wallet className="h-4 w-4 text-indigo-600" />,
        action: { label: 'Customers', to: '/customers' },
      });
    }

    if (growth < -10 && periodCompare.previous > 0) {
      items.push({
        id: 'sales-dip',
        title: 'Sales soft vs prior period',
        body: `Revenue is ${Math.abs(growth).toFixed(0)}% ${periodCompare.label}. Push a promo on top sellers or run a flash sale on ageing stock.`,
        tone: 'bg-orange-50 hover:bg-orange-100',
        icon: <TrendingUp className="h-4 w-4 text-orange-600" />,
        action: { label: 'Open POS', to: '/sales' },
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'all-good',
        title: 'Store running smoothly',
        body: 'No urgent stock, expiry, or cash issues. Keep recording sales so recommendations stay fresh.',
        tone: 'bg-slate-50 hover:bg-slate-100',
        icon: <CheckCircle className="h-4 w-4 text-emerald-600" />,
        action: { label: 'New sale', to: '/sales' },
      });
    }

    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEmptyStore, lowStockProducts.length, expiringBatches.length, salesByCategory.length,
    stats.lowStockCount, stats.outOfStockCount, stats.expiringCount, stats.pendingPurchases,
    stats.monthlyRevenue, stats.outstandingReceivables, stats.outstandingPayables,
    stats.totalProducts, profitMargin, cashGap, growth,
    periodCompare.current, periodCompare.previous,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-blue-600 h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-3">
          <Brain className="text-blue-600 h-8 w-8" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">AI Intelligence Dashboard</h2>
            <p className="text-sm text-slate-600">Real-time retail insights and recommendations</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(['today', 'week', 'month'] as TimeRange[]).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md capitalize text-sm transition-colors ${
                  timeRange === range
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && !overviewQ.data?.dashboardStats && !alertsQ.data?.dashboardStats && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Some intelligence data could not load. Showing available metrics — try Refresh.
        </div>
      )}
      {(alertsQ.error && activeTab === 'alerts') && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Alerts partially failed to load. Low-stock and expiry lists may be incomplete.
        </div>
      )}

      <div className="flex space-x-1 bg-slate-100 rounded-lg p-1">
        {(['overview', 'alerts', 'insights'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md capitalize transition-colors ${
              activeTab === tab
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {isEmptyStore && (
              <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6">
                <div className="flex items-start gap-3 mb-4">
                  <ClipboardList className="h-6 w-6 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Start here — empty store detected</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Intelligence lights up after you add catalog data and record sales. Follow these steps:
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { step: '1', label: 'Create categories', to: '/categories' },
                    { step: '2', label: 'Add products & stock', to: '/products' },
                    { step: '3', label: 'Add suppliers', to: '/suppliers' },
                    { step: '4', label: 'Record first sale', to: '/sales' },
                  ].map((item) => (
                    <button
                      key={item.step}
                      type="button"
                      onClick={() => navigate(item.to)}
                      className="text-left rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <span className="text-xs font-semibold text-blue-600">Step {item.step}</span>
                      <p className="font-medium text-slate-900 mt-1">{item.label}</p>
                      <span className="text-xs text-blue-600 inline-flex items-center gap-1 mt-2">
                        Open <ArrowUpRight className="h-3 w-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center space-x-3">
                  <Brain className="text-blue-600 h-6 w-6" />
                  <h3 className="text-lg font-semibold text-slate-900">Store Health Score</h3>
                </div>
                <div className={`px-4 py-2 rounded-full text-sm font-semibold ${healthColor}`}>
                  {healthStatus} ({storeHealth}/100)
                </div>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-4 mb-4">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${storeHealth}%` }}
                  transition={{ duration: 1 }}
                  className={`h-4 rounded-full ${
                    storeHealth >= 80 ? 'bg-emerald-500' :
                    storeHealth >= 60 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => setActiveTab('alerts')}
                  className="flex items-center space-x-2 text-left hover:opacity-80"
                >
                  <div className={`w-2 h-2 rounded-full ${atRisk === 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="text-slate-600">Stock Status: {atRisk} items at risk</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('alerts')}
                  className="flex items-center space-x-2 text-left hover:opacity-80"
                >
                  <div className={`w-2 h-2 rounded-full ${stats.expiringCount > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  <span className="text-slate-600">Expiry Risk: {stats.expiringCount} items expiring</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/purchases')}
                  className="flex items-center space-x-2 text-left hover:opacity-80"
                >
                  <div className={`w-2 h-2 rounded-full ${stats.pendingPurchases > 5 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span className="text-slate-600">Procurement: {stats.pendingPurchases} pending orders</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <DollarSign className="h-5 w-5 opacity-80" />
                  <div className="flex items-center space-x-1 text-xs opacity-90">
                    <span className="capitalize">{timeRange}</span>
                    {growth !== 0 && (
                      growth > 0
                        ? <ArrowUp className="h-4 w-4 text-emerald-200" />
                        : <ArrowDown className="h-4 w-4 text-red-200" />
                    )}
                    <span>{growth > 0 ? '+' : ''}{growth.toFixed(0)}%</span>
                  </div>
                </div>
                <p className="text-3xl font-bold">{fmt(periodRevenue)}</p>
                <p className="text-sm opacity-80">Sales Revenue</p>
                <div className="mt-2 text-xs opacity-70">
                  {timeRange === 'today' && "Today's sales"}
                  {timeRange === 'week' && 'Last 7 days'}
                  {timeRange === 'month' && 'This month'}
                  {' · '}{periodCompare.label}
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/inventory')}
                className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg text-left hover:brightness-105 transition"
              >
                <div className="flex items-center justify-between mb-3">
                  <Package className="h-5 w-5 opacity-80" />
                  <Users className="h-4 w-4 opacity-80" />
                </div>
                <p className="text-3xl font-bold">{fmtInt(stats.totalStock)}</p>
                <p className="text-sm opacity-80">Total Stock</p>
                <div className="mt-2 text-xs opacity-70">
                  {stats.totalProducts} products · {stats.totalCategories} categories
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('alerts')}
                className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white shadow-lg text-left hover:brightness-105 transition"
              >
                <div className="flex items-center justify-between mb-3">
                  <AlertTriangle className="h-5 w-5 opacity-80" />
                  <Eye className="h-4 w-4 opacity-80" />
                </div>
                <p className="text-3xl font-bold">{atRisk}</p>
                <p className="text-sm opacity-80">Stock Alerts</p>
                <div className="mt-2 text-xs opacity-70">
                  {stats.lowStockCount} low · {stats.outOfStockCount} out of stock
                </div>
              </button>

              <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <PieChart className="h-5 w-5 opacity-80" />
                  <Zap className="h-4 w-4 opacity-80" />
                </div>
                <p className="text-3xl font-bold">{profitMargin.toFixed(1)}%</p>
                <p className="text-sm opacity-80">Profit Margin</p>
                <div className="mt-2 text-xs opacity-70">
                  Based on {fmt(stats.monthlyRevenue)} monthly revenue
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => navigate('/reports')}
                className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 text-left hover:border-blue-200 transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Monthly Revenue</p>
                    <p className="text-2xl font-bold text-slate-900">{fmt(stats.monthlyRevenue)}</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/inventory')}
                className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 text-left hover:border-emerald-200 transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <ShoppingBag className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Inventory Value</p>
                    <p className="text-2xl font-bold text-slate-900">{fmt(stats.inventoryValue)}</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/purchases')}
                className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 text-left hover:border-violet-200 transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-violet-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Pending Orders</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.pendingPurchases}</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'New sale', to: '/sales', icon: <DollarSign className="h-4 w-4" /> },
                { label: 'Reorder stock', to: '/purchases', icon: <Truck className="h-4 w-4" /> },
                { label: 'Inventory', to: '/inventory', icon: <Package className="h-4 w-4" /> },
                { label: 'Reports', to: '/reports', icon: <BarChart3 className="h-4 w-4" /> },
              ].map((a) => (
                <button
                  key={a.to}
                  type="button"
                  onClick={() => navigate(a.to)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-blue-200 transition"
                >
                  {a.icon}
                  {a.label}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Top Categories</h3>
                <button
                  type="button"
                  onClick={() => navigate('/categories')}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  View All <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                {salesByCategory.slice(0, 6).map((category, index) => {
                  const denom = stats.monthlyRevenue > 0 ? stats.monthlyRevenue : 1;
                  return (
                    <div
                      key={`${category.category}-${index}`}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Package className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{category.category}</p>
                          <p className="text-xs text-slate-500">{category.totalSales} items sold</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{fmt(category.totalRevenue)}</p>
                        <p className="text-xs text-slate-500">
                          {((category.totalRevenue / denom) * 100).toFixed(1)}% of monthly
                        </p>
                      </div>
                    </div>
                  );
                })}
                {salesByCategory.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <ShoppingBag className="h-12 w-12 mx-auto opacity-30 mb-2" />
                    <p>No sales data yet</p>
                    <button
                      type="button"
                      onClick={() => navigate('/sales')}
                      className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Record a sale
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'alerts' && (
          <motion.div
            key="alerts"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                  <div>
                    <p className="text-2xl font-bold text-amber-900">{stats.lowStockCount}</p>
                    <p className="text-sm text-amber-700">Low Stock Items</p>
                  </div>
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <XCircle className="h-6 w-6 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold text-red-900">{stats.outOfStockCount}</p>
                    <p className="text-sm text-red-700">Out of Stock</p>
                  </div>
                </div>
              </div>
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <Clock className="h-6 w-6 text-violet-600" />
                  <div>
                    <p className="text-2xl font-bold text-violet-900">{stats.expiringCount}</p>
                    <p className="text-sm text-violet-700">Expiring Soon</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
                  Low Stock Alerts
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">{lowStockProducts.length} items need attention</span>
                  {lowStockProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate('/purchases')}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      Bulk reorder
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {lowStockProducts.slice(0, 10).map((product) => {
                  const qty = suggestedReorderQty(product.stock, product.minStockLevel);
                  const urgency = product.stock === 0 ? 'OUT' : product.stock <= Math.ceil(product.minStockLevel / 2) ? 'CRITICAL' : 'LOW';
                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-4 bg-amber-50 rounded-lg gap-3 flex-wrap"
                    >
                      <div className="flex items-center space-x-4 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="h-6 w-6 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{product.name}</p>
                          <p className="text-sm text-slate-600">
                            {product.category?.name || 'Uncategorized'}
                            {product.supplier?.name ? ` · ${product.supplier.name}` : ''}
                          </p>
                          <p className="text-xs text-slate-500">
                            Cost: {fmt(product.costPrice)} · Sell: {fmt(product.sellingPrice)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold text-lg ${product.stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                          {product.stock}
                        </p>
                        <p className="text-xs text-slate-500">Min: {product.minStockLevel} · Suggest +{qty}</p>
                        <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          urgency === 'OUT' ? 'bg-red-100 text-red-700' :
                          urgency === 'CRITICAL' ? 'bg-orange-100 text-orange-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {urgency}
                        </span>
                        <button
                          type="button"
                          onClick={() => navigate('/purchases')}
                          className="block mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium ml-auto"
                        >
                          Reorder Now
                        </button>
                      </div>
                    </div>
                  );
                })}
                {lowStockProducts.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <CheckCircle className="h-12 w-12 mx-auto opacity-30 mb-2 text-emerald-500" />
                    <p>All products are well stocked</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <Tag className="h-5 w-5 text-rose-500 mr-2" />
                  Expiry & Markdown Advice
                </h3>
                <button
                  type="button"
                  onClick={() => navigate('/inventory')}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Inventory
                </button>
              </div>
              {expiringBatches.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle className="h-12 w-12 mx-auto opacity-30 mb-2 text-emerald-500" />
                  <p>No batches expiring in the next 30 days</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expiringBatches.slice(0, 8).map((batch) => {
                    const d = daysUntil(batch.expiryDate);
                    const discount = expiryDiscount(d);
                    const urgency = expiryUrgency(d);
                    const price = batch.product?.sellingPrice ?? 0;
                    const markdownPrice = price * (1 - discount / 100);
                    return (
                      <div key={batch.id} className="flex items-center justify-between p-4 bg-rose-50 rounded-lg gap-3 flex-wrap">
                        <div>
                          <p className="font-medium text-slate-900">{batch.product?.name || 'Unknown product'}</p>
                          <p className="text-sm text-slate-600">
                            Batch {batch.batchNumber} · Qty {batch.currentQuantity}
                          </p>
                          <p className="text-xs text-slate-500">
                            Expires {new Date(batch.expiryDate).toLocaleDateString()} ({d} days)
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            urgency === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                            urgency === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                            urgency === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {urgency}
                          </span>
                          <p className="text-sm font-semibold text-rose-700 mt-1">
                            Suggest {discount}% off → {fmt(markdownPrice)}
                          </p>
                          <p className="text-xs text-slate-500">Was {fmt(price)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <DollarSign className="h-5 w-5 text-blue-500 mr-2" />
                  Financial Summary
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/customers')}
                  className="p-4 bg-blue-50 rounded-lg text-left hover:bg-blue-100 transition"
                >
                  <p className="text-2xl font-bold text-blue-900">{fmt(stats.outstandingReceivables)}</p>
                  <p className="text-sm text-blue-700">Outstanding Receivables</p>
                </button>
                <div className="p-4 bg-violet-50 rounded-lg">
                  <p className="text-2xl font-bold text-violet-900">{fmt(stats.outstandingPayables)}</p>
                  <p className="text-sm text-violet-700">Outstanding Payables</p>
                </div>
                <div className={`p-4 rounded-lg ${cashGap >= 0 ? 'bg-emerald-50' : 'bg-orange-50'}`}>
                  <p className={`text-2xl font-bold ${cashGap >= 0 ? 'text-emerald-900' : 'text-orange-900'}`}>
                    {fmt(cashGap)}
                  </p>
                  <p className={`text-sm ${cashGap >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>
                    Net credit position
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'insights' && (
          <motion.div
            key="insights"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Sparkles className="h-5 w-5 text-violet-600 mr-2" />
                  <h3 className="text-lg font-semibold text-slate-900">AI Recommendations</h3>
                </div>
                <span className="text-xs text-violet-700 bg-violet-50 px-2 py-1 rounded-full">
                  Rule-based retail intelligence
                </span>
              </div>
              <div className="space-y-3">
                {insights.map((insight) => (
                  <button
                    key={insight.id}
                    type="button"
                    onClick={() => insight.action && navigate(insight.action.to)}
                    className={`w-full flex items-start space-x-3 p-4 rounded-lg transition-colors text-left ${insight.tone}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0">
                      {insight.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{insight.title}</p>
                      <p className="text-sm text-slate-600">{insight.body}</p>
                      {insight.action && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 mt-2">
                          {insight.action.label} <ArrowUpRight className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center mb-4">
                <Activity className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-slate-900">Store Statistics</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { n: stats.totalProducts, l: 'Total Products', to: '/products' },
                  { n: stats.totalCategories, l: 'Categories', to: '/categories' },
                  { n: stats.totalSuppliers, l: 'Suppliers', to: '/suppliers' },
                  { n: stats.totalCustomers, l: 'Customers', to: '/customers' },
                ].map((s) => (
                  <button
                    key={s.l}
                    type="button"
                    onClick={() => navigate(s.to)}
                    className="p-4 bg-slate-50 rounded-lg text-center hover:bg-slate-100 transition"
                  >
                    <p className="text-2xl font-bold text-slate-900">{s.n}</p>
                    <p className="text-sm text-slate-600">{s.l}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
                  <h3 className="text-lg font-semibold text-slate-900">Recent Sales</h3>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/sales')}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  View All
                </button>
              </div>
              {recentSales.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <DollarSign className="h-12 w-12 mx-auto opacity-30 mb-2" />
                  <p>No sales recorded yet</p>
                  <button
                    type="button"
                    onClick={() => navigate('/sales')}
                    className="mt-3 text-sm text-blue-600 font-medium"
                  >
                    Open POS
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentSales.slice(0, 5).map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <DollarSign className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{sale.invoiceNo}</p>
                          <p className="text-xs text-slate-500">{sale.customer?.name || 'Walk-in'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{fmt(sale.totalAmount)}</p>
                        <p className="text-xs text-slate-500">{new Date(sale.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
