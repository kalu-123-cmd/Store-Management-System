import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpCircle, ArrowDownCircle, SlidersHorizontal, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';

const GET_INVENTORY = gql`
  query GetInventory {
    products {
      id name sku stock minStockLevel costPrice sellingPrice status
      category { name }
    }
    transactions {
      id type quantity notes createdAt
      product { name }
    }
  }
`;
const ADJUST_STOCK = gql`
  mutation AdjustStock($productId: ID!, $quantity: Int!, $type: String!, $notes: String) {
    adjustStock(productId: $productId, quantity: $quantity, type: $type, notes: $notes) { id type quantity createdAt }
  }
`;

function AdjustModal({ open, onClose, products, refetch }: any) {
  const { success, error: toastError } = useToast();
  const { register, handleSubmit, reset, watch } = useForm<{ productId: string; type: string; quantity: number; notes: string }>({ defaultValues: { type: 'IN', quantity: 1 } });
  const [adjustStock, { loading }] = useMutation(ADJUST_STOCK);
  const type = watch('type');

  const onSubmit = async (values: any) => {
    try {
      await adjustStock({ variables: { ...values, quantity: Number(values.quantity) } });
      const product = products.find((p: any) => p.id === values.productId);
      success('Stock adjusted', `${values.type} ${values.quantity} units${product ? ` of ${product.name}` : ''}`);
      refetch(); reset(); onClose();
    } catch (e: any) { toastError('Adjustment failed', e.message); }
  };

  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2"><SlidersHorizontal size={18} className="text-primary" /> Stock Adjustment</h2>
            <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Product *</label>
              <select {...register('productId', { required: true })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none">
                <option value="">Select product...</option>
                {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} (Current: {p.stock})</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Adjustment Type *</label>
              <div className="grid grid-cols-3 gap-2">
                {[{ value: 'IN', label: 'Stock In', icon: <ArrowUpCircle size={16} />, color: 'text-emerald-500' },
                  { value: 'OUT', label: 'Stock Out', icon: <ArrowDownCircle size={16} />, color: 'text-destructive' },
                  { value: 'ADJUSTMENT', label: 'Set Qty', icon: <SlidersHorizontal size={16} />, color: 'text-amber-500' }].map(opt => (
                  <label key={opt.value} className={`flex flex-col items-center gap-1.5 p-3 border rounded-lg cursor-pointer transition-all ${type === opt.value ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                    <input type="radio" {...register('type')} value={opt.value} className="hidden" />
                    <span className={opt.color}>{opt.icon}</span>
                    <span className="text-xs font-medium">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Quantity *</label>
              <input {...register('quantity', { required: true, min: 1 })} type="number" min="1" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Notes</label>
              <textarea {...register('notes')} placeholder="Reason for adjustment..." rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none resize-none" />
            </div>
            <div className="flex gap-3"><button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button><button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">{loading ? 'Adjusting...' : 'Adjust Stock'}</button></div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Inventory() {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [tab, setTab] = useState<'products' | 'transactions'>('products');
  const { data, loading, refetch } = useQuery(GET_INVENTORY, { fetchPolicy: 'cache-and-network' });
  const { canMutate } = useRole();
  const products = data?.products || [];
  const transactions = data?.transactions || [];

  const lowStock = products.filter((p: any) => p.stock > 0 && p.stock <= p.minStockLevel);
  const outOfStock = products.filter((p: any) => p.stock === 0);
  const totalValue = products.reduce((sum: number, p: any) => sum + p.costPrice * p.stock, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">Inventory</h2>
          <p className="text-sm text-muted-foreground">Stock management and movement tracking</p>
        </div>
        {canMutate && (
          <button onClick={() => setAdjustOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
            <SlidersHorizontal size={16} /> Adjust Stock
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Inventory Value</p>
          <p className="text-xl font-bold text-foreground">${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Products</p>
          <p className="text-xl font-bold text-foreground">{products.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Low Stock</p>
          <p className="text-xl font-bold text-amber-500">{lowStock.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Out of Stock</p>
          <p className="text-xl font-bold text-destructive">{outOfStock.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-lg w-fit">
        {(['products', 'transactions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{t}</button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {tab === 'products' ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>{['Product', 'SKU', 'Category', 'Current Stock', 'Min Level', 'Unit Cost', 'Stock Value', 'Status'].map(h => <th key={h} className="px-5 py-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="text-center py-12"><div className="flex justify-center"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div></td></tr>
                : products.map((p: any, i: number) => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-foreground">{p.name}</td>
                  <td className="px-5 py-3.5"><code className="text-xs bg-muted px-2 py-1 rounded font-mono text-muted-foreground">{p.sku}</code></td>
                  <td className="px-5 py-3.5"><span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">{p.category?.name || '—'}</span></td>
                  <td className="px-5 py-3.5">
                    <span className={`font-bold ${p.stock === 0 ? 'text-destructive' : p.stock <= p.minStockLevel ? 'text-amber-500' : 'text-emerald-500'}`}>{p.stock}</span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{p.minStockLevel}</td>
                  <td className="px-5 py-3.5">${p.costPrice.toFixed(2)}</td>
                  <td className="px-5 py-3.5 font-medium">${(p.costPrice * p.stock).toFixed(2)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${p.stock === 0 ? 'bg-destructive/10 text-destructive' : p.stock <= p.minStockLevel ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                      {p.stock === 0 ? 'Out of Stock' : p.stock <= p.minStockLevel ? 'Low Stock' : 'In Stock'}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>{['Product', 'Type', 'Quantity', 'Notes', 'Date'].map(h => <th key={h} className="px-5 py-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {transactions.map((t: any, i: number) => (
                <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-foreground">{t.product?.name}</td>
                  <td className="px-5 py-3.5">
                    <span className={`flex items-center gap-1.5 text-xs font-medium w-fit px-2.5 py-1 rounded-full ${t.type === 'IN' ? 'bg-emerald-500/10 text-emerald-600' : t.type === 'OUT' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-600'}`}>
                      {t.type === 'IN' ? <ArrowUpCircle size={12} /> : t.type === 'OUT' ? <ArrowDownCircle size={12} /> : <SlidersHorizontal size={12} />}
                      {t.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-semibold">{t.type === 'IN' ? '+' : t.type === 'OUT' ? '-' : ''}{t.quantity}</td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">{t.notes || '—'}</td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <AdjustModal open={adjustOpen} onClose={() => setAdjustOpen(false)} products={products} refetch={refetch} />
    </div>
  );
}
