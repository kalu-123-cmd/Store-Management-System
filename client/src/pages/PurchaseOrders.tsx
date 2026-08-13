import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Trash2, CheckCircle2, Send, Package,
  ChevronDown, ChevronUp, Truck, FileDown, Upload,
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';
import { fmt, fmtInt } from '../lib/currency';
import { useLangContext } from '../lib/LangContext';

// ── GraphQL ───────────────────────────────────────────────────────────────────

const GET_PO_DATA = gql`
  query GetPOData {
    purchaseOrders {
      id poNumber status notes totalCost createdAt updatedAt
      supplier { id name contactName phone }
      user { name }
      items { id quantity unitCost product { id name sku stock minStockLevel } }
    }
    products { id name sku stock minStockLevel costPrice supplier { id name } }
    suppliers { id name }
  }
`;

const CREATE_PO = gql`
  mutation CreatePO($supplierId: String, $notes: String, $items: [POItemInput!]!) {
    createPurchaseOrder(supplierId: $supplierId, notes: $notes, items: $items) { id poNumber status }
  }
`;

const UPDATE_STATUS = gql`
  mutation UpdatePOStatus($id: ID!, $status: String!) {
    updatePurchaseOrderStatus(id: $id, status: $status) { id status }
  }
`;

const RECEIVE_PO = gql`
  mutation ReceivePO($id: ID!) {
    receivePurchaseOrder(id: $id) { id status }
  }
`;

const DELETE_PO = gql`
  mutation DeletePO($id: ID!) { deletePurchaseOrder(id: $id) }
`;

const IMPORT_PO_CSV = gql`
  mutation ImportPOCSV($csvContent: String!) {
    importPurchaseOrdersCSV(csvContent: $csvContent) {
      success
      summary {
        totalProcessed
        created
        updated
        failed
      }
      errors {
        rowNumber
        sku
        error
      }
    }
  }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  DRAFT:     'bg-muted text-muted-foreground',
  SENT:      'bg-sky-500/10 text-sky-700',
  RECEIVED:  'bg-emerald-500/10 text-emerald-700',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

function downloadCSV(orders: any[]) {
  if (!orders.length) return;
  const rows = [
    ['PO Number','Supplier','Status','Items','Total Cost (ETB)','Created By','Date'],
    ...orders.map(o => [
      o.poNumber,
      o.supplier?.name || 'No Supplier',
      o.status,
      o.items.length,
      o.totalCost.toFixed(2),
      o.user?.name,
      new Date(o.createdAt).toLocaleDateString(),
    ]),
  ];
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'purchase-orders.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Create PO Modal ───────────────────────────────────────────────────────────

type POLine = { productId: string; name: string; sku: string; quantity: number; unitCost: number; currentStock: number; minStock: number };

function CreatePOModal({ open, onClose, products, suppliers, refetch }: any) {
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes]           = useState('');
  const [lines, setLines]           = useState<POLine[]>([]);
  const [search, setSearch]         = useState('');
  const { success, error: toastError } = useToast();
  const [createPO, { loading }]     = useMutation(CREATE_PO);

  const ic = 'px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none w-full';

  const filteredProducts = (products || []).filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const addLine = (p: any) => {
    if (lines.find(l => l.productId === p.id)) return;
    setLines(prev => [...prev, {
      productId: p.id, name: p.name, sku: p.sku,
      quantity: Math.max(1, p.minStockLevel - p.stock),
      unitCost: p.costPrice,
      currentStock: p.stock, minStock: p.minStockLevel,
    }]);
    setSearch('');
  };

  const removeLine = (productId: string) => setLines(prev => prev.filter(l => l.productId !== productId));
  const updateLine = (productId: string, field: 'quantity' | 'unitCost', val: number) =>
    setLines(prev => prev.map(l => l.productId === productId ? { ...l, [field]: val } : l));

  const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  const handleCreate = async () => {
    if (!lines.length) { toastError('Empty order', 'Add at least one product.'); return; }
    try {
      const result = await createPO({
        variables: {
          supplierId: supplierId || null,
          notes: notes || null,
          items: lines.map(l => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost })),
        },
      });
      success('Purchase Order created', `${result.data.createPurchaseOrder.poNumber} — DRAFT`);
      setLines([]); setSupplierId(''); setNotes('');
      refetch(); onClose();
    } catch (e: any) { toastError('Failed', e.message); }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale:0.95, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.95, opacity:0 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">

          <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
            <div>
              <h2 className="text-lg font-semibold text-foreground">New Purchase Order</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Create a restock order to send to a supplier</p>
            </div>
            <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
          </div>

          <div className="p-5 space-y-5">
            {/* Supplier + Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">Supplier</label>
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={ic}>
                  <option value="">No supplier</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Notes</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" className={ic} />
              </div>
            </div>

            {/* Product search */}
            <div>
              <label className="text-sm font-medium block mb-1">Add Products</label>
              <div className="relative">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search product name or SKU to add…" className={ic} />
                {search && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-card border border-border rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto mt-1">
                    {filteredProducts.slice(0, 8).map((p: any) => (
                      <button key={p.id} onClick={() => addLine(p)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted text-left transition-colors border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.sku} · Stock: {p.stock} · Min: {p.minStockLevel}</p>
                        </div>
                        {p.stock <= p.minStockLevel && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.stock === 0 ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-700'}`}>
                            {p.stock === 0 ? 'Out' : 'Low'}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Line items */}
            {lines.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left">Product</th>
                      <th className="px-4 py-3 text-center">Curr. Stock</th>
                      <th className="px-4 py-3 text-center">Order Qty</th>
                      <th className="px-4 py-3 text-right">Unit Cost (ETB)</th>
                      <th className="px-4 py-3 text-right">Subtotal</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(line => (
                      <tr key={line.productId} className="border-b border-border">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{line.name}</p>
                          <code className="text-xs text-muted-foreground">{line.sku}</code>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold text-sm ${line.currentStock === 0 ? 'text-destructive' : line.currentStock <= line.minStock ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {line.currentStock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input type="number" min={1} value={line.quantity}
                            onChange={e => updateLine(line.productId, 'quantity', Math.max(1, Number(e.target.value)))}
                            className="w-20 px-2 py-1 bg-background border border-border rounded text-sm text-center focus:ring-2 focus:ring-primary outline-none" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input type="number" min={0} step="0.01" value={line.unitCost}
                            onChange={e => updateLine(line.productId, 'unitCost', Number(e.target.value))}
                            className="w-28 px-2 py-1 bg-background border border-border rounded text-sm text-right focus:ring-2 focus:ring-primary outline-none" />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">{fmt(line.quantity * line.unitCost)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => removeLine(line.productId)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/20">
                      <td colSpan={4} className="px-4 py-3 text-right font-semibold text-foreground">Total Order Cost:</td>
                      <td className="px-4 py-3 text-right font-bold text-primary text-base">{fmt(total)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={loading || !lines.length}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                {loading ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Plus size={15} />}
                {loading ? 'Creating…' : 'Create Purchase Order'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── PO Row ────────────────────────────────────────────────────────────────────

function PORow({ order, refetch, canMutate, canAdminDelete }: any) {
  const [expanded, setExpanded] = useState(false);
  const { success, error: toastError } = useToast();
  const [updateStatus, { loading: updating }] = useMutation(UPDATE_STATUS);
  const [receivePO,    { loading: receiving }] = useMutation(RECEIVE_PO);
  const [deletePO,     { loading: deleting  }] = useMutation(DELETE_PO);

  const handleStatus = async (status: string) => {
    try {
      await updateStatus({ variables: { id: order.id, status } });
      success('Status updated', `${order.poNumber} → ${status}`);
      refetch();
    } catch (e: any) { toastError('Failed', e.message); }
  };

  const handleReceive = async () => {
    if (!window.confirm(`Mark ${order.poNumber} as RECEIVED? This will add stock to all items.`)) return;
    try {
      await receivePO({ variables: { id: order.id } });
      success('Stock received!', `${order.poNumber} — stock updated for ${order.items.length} products.`);
      refetch();
    } catch (e: any) { toastError('Failed', e.message); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${order.poNumber}?`)) return;
    try {
      await deletePO({ variables: { id: order.id } });
      success('Deleted', order.poNumber);
      refetch();
    } catch (e: any) { toastError('Delete failed', e.message); }
  };

  return (
    <>
      <motion.tr initial={{ opacity:0 }} animate={{ opacity:1 }}
        className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}>
        <td className="px-5 py-4">
          <p className="font-mono text-sm font-semibold text-primary">{order.poNumber}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{new Date(order.createdAt).toLocaleDateString()}</p>
        </td>
        <td className="px-5 py-4">
          <div className="flex items-center gap-2">
            <Truck size={13} className="text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground">{order.supplier?.name || '—'}</span>
          </div>
        </td>
        <td className="px-5 py-4">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[order.status] || STATUS_STYLES.DRAFT}`}>
            {order.status}
          </span>
        </td>
        <td className="px-5 py-4 text-sm text-muted-foreground">{order.items.length} items</td>
        <td className="px-5 py-4 font-semibold text-foreground">{fmt(order.totalCost)}</td>
        <td className="px-5 py-4 text-xs text-muted-foreground">{order.user?.name}</td>
        <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            {canMutate && order.status === 'DRAFT' && (
              <button onClick={() => handleStatus('SENT')} disabled={updating}
                title="Mark as Sent"
                className="p-1.5 text-muted-foreground hover:text-sky-500 hover:bg-sky-500/10 rounded-lg transition-colors">
                <Send size={14} />
              </button>
            )}
            {canMutate && order.status === 'SENT' && (
              <button onClick={handleReceive} disabled={receiving}
                title="Receive — add stock"
                className="p-1.5 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors">
                <CheckCircle2 size={14} />
              </button>
            )}
            {canMutate && order.status !== 'RECEIVED' && order.status !== 'CANCELLED' && (
              <button onClick={() => handleStatus('CANCELLED')} disabled={updating}
                title="Cancel"
                className="p-1.5 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors">
                <X size={14} />
              </button>
            )}
            {canAdminDelete && order.status !== 'RECEIVED' && (
              <button onClick={handleDelete} disabled={deleting}
                title="Delete"
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </td>
        <td className="px-5 py-4">
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronDown size={15} className="text-muted-foreground" />
          </motion.span>
        </td>
      </motion.tr>

      {/* Expanded line items */}
      <AnimatePresence initial={false}>
        {expanded && (
          <tr>
            <td colSpan={8} className="p-0">
              <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
                className="overflow-hidden bg-muted/10 border-b border-border">
                <div className="px-5 py-4">
                  {order.notes && <p className="text-xs text-muted-foreground mb-3 italic">📝 {order.notes}</p>}
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-muted-foreground uppercase">
                      <th className="text-left pb-2">Product</th>
                      <th className="text-center pb-2">Current Stock</th>
                      <th className="text-center pb-2">Order Qty</th>
                      <th className="text-right pb-2">Unit Cost</th>
                      <th className="text-right pb-2">Subtotal</th>
                    </tr></thead>
                    <tbody>
                      {order.items.map((item: any) => (
                        <tr key={item.id} className="border-t border-border/50">
                          <td className="py-2">
                            <p className="font-medium text-foreground">{item.product?.name}</p>
                            <code className="text-xs text-muted-foreground">{item.product?.sku}</code>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`font-semibold text-sm ${item.product?.stock === 0 ? 'text-destructive' : item.product?.stock <= item.product?.minStockLevel ? 'text-amber-500' : 'text-emerald-500'}`}>
                              {item.product?.stock}
                            </span>
                          </td>
                          <td className="py-2 text-center font-medium">{item.quantity}</td>
                          <td className="py-2 text-right text-muted-foreground">{fmt(item.unitCost)}</td>
                          <td className="py-2 text-right font-semibold">{fmt(item.quantity * item.unitCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ── CSV Import Modal ───────────────────────────────────────────────────────────

function ImportCSVModal({ open, onClose, refetch }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const { success, error: toastError } = useToast();
  const [importPOCSV] = useMutation(IMPORT_PO_CSV);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === 'text/csv') {
      setFile(selected);
      // Simple preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const lines = text.split('\n').slice(0, 6); // Preview first 5 rows
        const headers = lines[0]?.split(',') || [];
        const data = lines.slice(1).filter(l => l.trim()).map(line => {
          const values = line.split(',');
          const row: any = {};
          headers.forEach((h, i) => row[h.trim()] = values[i]?.trim());
          return row;
        });
        setPreview(data);
      };
      reader.readAsText(selected);
    } else {
      toastError('Invalid file', 'Please select a CSV file');
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const csvContent = ev.target?.result as string;
        const result = await importPOCSV({ variables: { csvContent } });
        if (result.data.importPOCSV.success) {
          success('Import successful', `${result.data.importPOCSV.summary.created} purchase orders imported`);
          refetch();
          onClose();
          setFile(null);
          setPreview([]);
        } else {
          toastError('Import failed', result.data.importPOCSV.errors[0]?.error || 'Unknown error');
        }
        setImporting(false);
      };
      reader.readAsText(file);
    } catch (e: any) {
      toastError('Import error', e.message);
      setImporting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale:0.95, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.95, opacity:0 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Import Purchase Orders CSV</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Import purchase orders from a CSV file</p>
            </div>
            <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
          </div>
          <div className="p-5 space-y-4">
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
              <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" id="csv-upload" />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground">Click to upload CSV file</p>
                <p className="text-xs text-muted-foreground mt-1">Format: PO Number, Supplier, Status, Items, Total Cost, Created By, Date</p>
              </label>
            </div>
            {preview.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground uppercase">
                  Preview (first 5 rows)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {Object.keys(preview[0]).map(key => (
                          <th key={key} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-b border-border/50">
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="px-3 py-2 text-xs">{val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleImport} disabled={!file || importing}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                {importing ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Upload size={15} />}
                {importing ? 'Importing...' : 'Import CSV'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PurchaseOrders() {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const { data, loading, refetch } = useQuery(GET_PO_DATA, { fetchPolicy: 'cache-and-network' });
  const { success } = useToast();
  const { canMutate, canAdminDelete } = useRole();
  const { t } = useLangContext();

  const orders:    any[] = data?.purchaseOrders || [];
  const products:  any[] = data?.products       || [];
  const suppliers: any[] = data?.suppliers      || [];

  // Stats
  const draft     = orders.filter(o => o.status === 'DRAFT').length;
  const sent      = orders.filter(o => o.status === 'SENT').length;
  const received  = orders.filter(o => o.status === 'RECEIVED').length;
  const totalSpend = orders.filter(o => o.status === 'RECEIVED').reduce((s, o) => s + o.totalCost, 0);

  // Products below min stock — suggest for reorder
  const suggested = products.filter((p: any) => p.stock <= p.minStockLevel);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Purchase Orders</h2>
          <p className="text-sm text-muted-foreground">{orders.length} orders · {suggested.length} products need restocking</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { downloadCSV(orders); success('Export ready', 'purchase-orders.csv downloaded.'); }}
            className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted flex items-center gap-2 transition-colors">
            <FileDown size={14} /> Export CSV
          </button>
          {canMutate && (
            <button onClick={() => setImportOpen(true)}
              className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted flex items-center gap-2 transition-colors">
              <Upload size={14} /> Import CSV
            </button>
          )}
          {canMutate && (
            <button onClick={() => setCreateOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm">
              <Plus size={16} /> New Order
            </button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Draft',    value: draft,           color: 'text-muted-foreground' },
          { label: 'Sent',     value: sent,            color: 'text-sky-600'          },
          { label: 'Received', value: received,        color: 'text-emerald-600'      },
          { label: 'Total Spent', value: fmtInt(totalSpend), color: 'text-primary'   },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Suggested restock alert */}
      {suggested.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-700 mb-2">
            ⚠ {suggested.length} product{suggested.length !== 1 ? 's' : ''} need restocking
          </p>
          <div className="flex flex-wrap gap-2">
            {suggested.slice(0, 8).map((p: any) => (
              <span key={p.id} className={`text-xs px-2.5 py-1 rounded-full font-medium ${p.stock === 0 ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-700'}`}>
                {p.name} ({p.stock}/{p.minStockLevel})
              </span>
            ))}
            {suggested.length > 8 && <span className="text-xs text-muted-foreground px-2 py-1">+{suggested.length - 8} more</span>}
          </div>
        </div>
      )}

      {/* Orders table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                {['PO Number', 'Supplier', 'Status', 'Items', 'Total Cost', 'Created By', 'Actions', ''].map(h => (
                  <th key={h} className="px-5 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-14">
                  <div className="flex justify-center"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
                </td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-14">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
                      <Package size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-sm">No purchase orders yet.</p>
                    {canMutate && <button onClick={() => setCreateOpen(true)} className="text-primary text-sm hover:underline">Create your first order →</button>}
                  </div>
                </td></tr>
              ) : orders.map(order => (
                <PORow key={order.id} order={order} refetch={refetch} canMutate={canMutate} canAdminDelete={canAdminDelete} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CreatePOModal open={createOpen} onClose={() => setCreateOpen(false)} products={products} suppliers={suppliers} refetch={refetch} />
      <ImportCSVModal open={importOpen} onClose={() => setImportOpen(false)} refetch={refetch} />
    </div>
  );
}
