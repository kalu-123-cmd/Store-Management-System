import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Search, AlertTriangle, Clock, Layers,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';
import { fmt, fmtInt } from '../lib/currency';

const GET_BATCHES = gql`
  query GetBatches {
    itemBatches {
      id batchNumber manufacturingDate expiryDate
      initialQuantity currentQuantity unitCost status
      product { id name sku }
      supplier { id name }
    }
    expiringBatches(days: 30) {
      id batchNumber expiryDate currentQuantity
      product { id name sku }
    }
    products { id name sku costPrice }
    suppliers { id name }
  }
`;

const CREATE_BATCH = gql`
  mutation CreateItemBatch(
    $productId: String!
    $batchNumber: String!
    $manufacturingDate: String
    $expiryDate: String
    $initialQuantity: Int!
    $unitCost: Float!
    $supplierId: String
  ) {
    createItemBatch(
      productId: $productId
      batchNumber: $batchNumber
      manufacturingDate: $manufacturingDate
      expiryDate: $expiryDate
      initialQuantity: $initialQuantity
      unitCost: $unitCost
      supplierId: $supplierId
    ) { id batchNumber }
  }
`;

const batchSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  batchNumber: z.string().trim().min(1, 'Batch number required').max(80),
  manufacturingDate: z.string().optional(),
  expiryDate: z.string().optional(),
  initialQuantity: z.coerce.number().int().positive('Quantity must be positive'),
  unitCost: z.coerce.number().min(0, 'Cost cannot be negative'),
  supplierId: z.string().optional(),
});
type BatchForm = z.infer<typeof batchSchema>;

type SortMode = 'FEFO' | 'FIFO';

function daysToExpiry(expiry?: string | null): number | null {
  if (!expiry) return null;
  const ms = new Date(expiry).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function urgency(days: number | null): { label: string; cls: string } {
  if (days == null) return { label: 'No expiry', cls: 'bg-muted text-muted-foreground' };
  if (days < 0) return { label: 'Expired', cls: 'bg-destructive/10 text-destructive' };
  if (days <= 7) return { label: `${days}d · critical`, cls: 'bg-destructive/10 text-destructive' };
  if (days <= 30) return { label: `${days}d · warning`, cls: 'bg-amber-500/10 text-amber-700' };
  return { label: `${days}d`, cls: 'bg-emerald-500/10 text-emerald-700' };
}

function BatchModal({ open, onClose, products, suppliers, refetch }: {
  open: boolean; onClose: () => void; products: any[]; suppliers: any[]; refetch: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [createBatch, { loading }] = useMutation(CREATE_BATCH);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<BatchForm>({
    resolver: zodResolver(batchSchema),
  });

  const onSubmit = async (values: BatchForm) => {
    try {
      await createBatch({
        variables: {
          ...values,
          manufacturingDate: values.manufacturingDate || null,
          expiryDate: values.expiryDate || null,
          supplierId: values.supplierId || null,
        },
      });
      success('Batch created', values.batchNumber);
      reset(); onClose(); refetch();
    } catch (e: any) {
      toastError('Could not create batch', e.message);
    }
  };

  if (!open) return null;
  const ic = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none';

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-lg font-semibold">New batch</h2>
            <button onClick={onClose} aria-label="Close"><X size={20} className="text-muted-foreground" /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-3">
            <div>
              <label className="text-sm font-medium block mb-1">Product *</label>
              <select {...register('productId')} className={ic}>
                <option value="">Select…</option>
                {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
              {errors.productId && <p className="text-xs text-destructive mt-1">{errors.productId.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Batch number *</label>
              <input {...register('batchNumber')} className={ic} placeholder="LOT-2026-001" />
              {errors.batchNumber && <p className="text-xs text-destructive mt-1">{errors.batchNumber.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">Manufactured</label>
                <input type="date" {...register('manufacturingDate')} className={ic} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Expiry</label>
                <input type="date" {...register('expiryDate')} className={ic} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">Quantity *</label>
                <input type="number" {...register('initialQuantity')} className={ic} min={1} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Unit cost *</label>
                <input type="number" step="0.01" {...register('unitCost')} className={ic} min={0} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Supplier</label>
              <select {...register('supplierId')} className={ic}>
                <option value="">None</option>
                {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-60">
                {loading ? 'Saving…' : 'Create batch'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Batches() {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('FEFO');
  const [modalOpen, setModalOpen] = useState(false);
  const { data, loading, refetch } = useQuery(GET_BATCHES, { fetchPolicy: 'cache-and-network' });
  const { canMutate } = useRole();

  const batches: any[] = data?.itemBatches || [];
  const expiring: any[] = data?.expiringBatches || [];

  const sorted = useMemo(() => {
    const list = data?.itemBatches || [];
    const q = search.toLowerCase();
    const filtered = list.filter((b: any) =>
      b.batchNumber.toLowerCase().includes(q) ||
      b.product?.name?.toLowerCase().includes(q) ||
      b.product?.sku?.toLowerCase().includes(q)
    );
    return [...filtered].sort((a: any, b: any) => {
      if (sortMode === 'FEFO') {
        const ae = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.POSITIVE_INFINITY;
        const be = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.POSITIVE_INFINITY;
        return ae - be;
      }
      return new Date(a.manufacturingDate || a.createdAt || 0).getTime()
        - new Date(b.manufacturingDate || b.createdAt || 0).getTime();
    });
  }, [data?.itemBatches, search, sortMode]);

  const expiredCount = batches.filter(b => {
    const d = daysToExpiry(b.expiryDate);
    return d != null && d < 0 && b.currentQuantity > 0;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Batch tracking</h2>
          <p className="text-sm text-muted-foreground">
            FEFO sells earliest-expiry first. FIFO uses manufacture / receive order.
          </p>
        </div>
        {canMutate && (
          <button onClick={() => setModalOpen(true)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus size={16} /> New batch
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase">Active lots</p>
          <p className="text-2xl font-bold mt-1">{fmtInt(batches.filter(b => b.status === 'ACTIVE').length)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase">Expiring ≤ 30d</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{expiring.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase">Already expired</p>
          <p className="text-2xl font-bold mt-1 text-destructive">{expiredCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase">Units on hand</p>
          <p className="text-2xl font-bold mt-1">{fmtInt(batches.reduce((s, b) => s + (b.currentQuantity || 0), 0))}</p>
        </div>
      </div>

      {expiring.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3" role="status">
          <AlertTriangle className="text-amber-600 shrink-0" size={18} />
          <div>
            <p className="text-sm font-semibold text-foreground">Expiry warnings</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {expiring.length} batch{expiring.length !== 1 ? 'es' : ''} expire within 30 days. Prefer FEFO at checkout.
            </p>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search lot, product, SKU…"
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
            {(['FEFO', 'FIFO'] as SortMode[]).map(mode => (
              <button key={mode} onClick={() => setSortMode(mode)}
                className={`px-3 py-2 ${sortMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                {mode === 'FEFO' ? 'FEFO (expiry)' : 'FIFO (received)'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                {['Lot', 'Product', 'Qty', 'Cost', 'Expiry', 'Status', 'Pick order'].map(h => (
                  <th key={h} className="px-5 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                </td></tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Layers size={28} />
                      <p className="font-medium text-foreground">No batches yet</p>
                      <p className="text-sm">Create lots when receiving stock so expiry and FEFO picking work.</p>
                    </div>
                  </td>
                </tr>
              ) : sorted.map((b, i) => {
                const days = daysToExpiry(b.expiryDate);
                const u = urgency(days);
                return (
                  <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="border-b border-border hover:bg-muted/20">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-primary">{b.batchNumber}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium">{b.product?.name}</p>
                      <p className="text-[11px] text-muted-foreground">{b.product?.sku}</p>
                    </td>
                    <td className="px-5 py-3">{b.currentQuantity} / {b.initialQuantity}</td>
                    <td className="px-5 py-3">{fmt(b.unitCost)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full inline-flex items-center gap-1 ${u.cls}`}>
                        <Clock size={11} /> {u.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs">{b.status}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">#{i + 1}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <BatchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        products={data?.products || []}
        suppliers={data?.suppliers || []}
        refetch={refetch}
      />
    </div>
  );
}
