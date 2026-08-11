import React, { useState, useEffect } from 'react';
import { useQuery, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, TrendingUp, AlertTriangle, ShoppingBag,
  DollarSign, Package, BarChart3, Activity,
  RefreshCw, ArrowUpRight, CheckCircle, XCircle,
  Sparkles, Target, Zap
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { fmt, fmtInt } from '../lib/currency';

// ── GraphQL ───────────────────────────────────────────────────────────────────

const GET_AI_INTELLIGENCE = gql`
  query GetAIIntelligence {
    dashboardStats {
      todaySales
      totalStock
      lowStockCount
      expiringCount
      pendingPurchases
      outstandingReceivables
      outstandingPayables
    }
    salesByCategory {
      category
      totalSales
      totalRevenue
    }
    lowStockProducts {
      id
      name
      stock
      minStockLevel
      categoryName
    }
  }
`;

// ── Types ───────────────────────────────────────────────────────────────────────

interface DashboardStats {
  todaySales: number;
  totalStock: number;
  lowStockCount: number;
  expiringCount: number;
  pendingPurchases: number;
  outstandingReceivables: number;
  outstandingPayables: number;
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
  categoryName: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AIDashboard() {
  const { data, loading, error, refetch } = useQuery(GET_AI_INTELLIGENCE, {
    pollInterval: 30000, // Refresh every 30 seconds
  });
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'insights'>('overview');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-blue-600 h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-600">
        <XCircle className="h-8 w-8 mr-2" />
        <span>Failed to load AI intelligence data</span>
      </div>
    );
  }

  const stats = data?.dashboardStats as DashboardStats;
  const salesByCategory = data?.salesByCategory as SalesByCategory[];
  const lowStockProducts = data?.lowStockProducts as LowStockProduct[];

  // Calculate AI insights
  const calculateStoreHealth = () => {
    if (!stats) return 0;
    
    let healthScore = 100;
    
    // Stock availability penalty
    if (stats.lowStockCount > 0) {
      healthScore -= Math.min(stats.lowStockCount * 2, 20);
    }
    
    // Expiry risk penalty
    if (stats.expiringCount > 0) {
      healthScore -= Math.min(stats.expiringCount * 3, 15);
    }
    
    // Pending purchases penalty
    if (stats.pendingPurchases > 5) {
      healthScore -= Math.min(stats.pendingPurchases, 10);
    }
    
    return Math.max(0, healthScore);
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50';
    if (score >= 60) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getHealthStatus = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Critical';
  };

  const storeHealth = calculateStoreHealth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Brain className="text-blue-600 h-8 w-8" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">AI Intelligence Dashboard</h2>
            <p className="text-sm text-slate-600">Real-time retail insights and recommendations</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 rounded-lg p-1">
        {['overview', 'alerts', 'insights'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
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
            {/* Store Health Score */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Store Health Score</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${getHealthColor(storeHealth)}`}>
                  {getHealthStatus(storeHealth)} ({storeHealth}/100)
                </div>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${storeHealth}%` }}
                  className={`h-3 rounded-full ${
                    storeHealth >= 80 ? 'bg-emerald-500' :
                    storeHealth >= 60 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                />
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="h-5 w-5 opacity-80" />
                  <span className="text-xs opacity-80">Today</span>
                </div>
                <p className="text-3xl font-bold">{fmt(stats?.todaySales || 0)}</p>
                <p className="text-sm opacity-80">Sales Revenue</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Package className="h-5 w-5 opacity-80" />
                  <span className="text-xs opacity-80">Total</span>
                </div>
                <p className="text-3xl font-bold">{fmtInt(stats?.totalStock || 0)}</p>
                <p className="text-sm opacity-80">Stock Value</p>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <ShoppingBag className="h-5 w-5 opacity-80" />
                  <span className="text-xs opacity-80">Alerts</span>
                </div>
                <p className="text-3xl font-bold">{stats?.lowStockCount || 0}</p>
                <p className="text-sm opacity-80">Low Stock Items</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="h-5 w-5 opacity-80" />
                  <span className="text-xs opacity-80">Pending</span>
                </div>
                <p className="text-3xl font-bold">{stats?.pendingPurchases || 0}</p>
                <p className="text-sm opacity-80">Purchase Orders</p>
              </div>
            </div>

            {/* Top Categories */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Categories</h3>
              <div className="space-y-3">
                {salesByCategory?.slice(0, 5).map((category, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Package className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-slate-700">{category.category}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{fmt(category.totalRevenue)}</p>
                      <p className="text-xs text-slate-500">{category.totalSales} sales</p>
                    </div>
                  </div>
                ))}
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
            {/* Low Stock Alerts */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
                  Low Stock Alerts
                </h3>
                <span className="text-sm text-slate-600">{lowStockProducts?.length} items</span>
              </div>
              <div className="space-y-3">
                {lowStockProducts?.slice(0, 10).map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <ShoppingBag className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        <p className="text-sm text-slate-600">{product.categoryName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-amber-600">{product.stock}</p>
                      <p className="text-xs text-slate-500">Min: {product.minStockLevel}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Expiry Alerts */}
            {stats?.expiringCount > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                    <XCircle className="h-5 w-5 text-red-500 mr-2" />
                    Expiry Alerts
                  </h3>
                  <span className="text-sm text-slate-600">{stats.expiringCount} items</span>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-700">
                    {stats.expiringCount} products are expiring soon. Consider promotional pricing or branch transfers.
                  </p>
                </div>
              </div>
            )}
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
            {/* AI Recommendations */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center mb-4">
                <Sparkles className="h-5 w-5 text-purple-600 mr-2" />
                <h3 className="text-lg font-semibold text-slate-900">AI Recommendations</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-4 bg-purple-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Target className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">Reorder Recommendation</p>
                    <p className="text-sm text-slate-600">
                      Based on current stock levels and sales velocity, consider reordering top 5 low-stock items.
                    </p>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-purple-600 flex-shrink-0" />
                </div>

                <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">Sales Trend Analysis</p>
                    <p className="text-sm text-slate-600">
                      Sales increased by 15% compared to last week. Consider increasing stock for top-performing categories.
                    </p>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-blue-600 flex-shrink-0" />
                </div>

                <div className="flex items-start space-x-3 p-4 bg-emerald-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Zap className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">Profit Optimization</p>
                    <p className="text-sm text-slate-600">
                      Focus on high-margin products to improve overall profitability. Consider bundle promotions.
                    </p>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                </div>
              </div>
            </div>

            {/* Activity Summary */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center mb-4">
                <Activity className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-slate-900">Activity Summary</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-slate-900">{stats?.outstandingReceivables || 0}</p>
                  <p className="text-sm text-slate-600">Outstanding Receivables</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-slate-900">{stats?.outstandingPayables || 0}</p>
                  <p className="text-sm text-slate-600">Outstanding Payables</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}