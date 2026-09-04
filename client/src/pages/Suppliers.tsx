import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, Trash2, X, Truck, Mail, Phone, MapPin,
  Search, Package, ShoppingCart, ExternalLink, FileDown,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';
import { fmt } from '../lib/currency';

// ── GraphQL ───────────────────────────────────────────────────────────────────

const GET_SUPPLIERS = gql`
  query GetSuppliers {
    suppliers {
      id name contactName email phone address
    }
    products {
      id name supplierId stock costPrice
    }
    purchaseOrders {
      id supplierId status totalCost createdAt
    }
  }
`;

const CREATE_SUPPLIER = gql`
  mutation CreateSupplier(
    $name: String! $contactName: String $email: String $phone: String $address: String
  ) {
    createSupplier(
      name: $name contactName: $contactName email: $email phone: $phone address: $address
    ) { id name contactName email phone address }
  }
`;

const UPDATE_SUPPLIER = gql`
  mutation UpdateSupplier(
    $id: ID! $name: String $contactName: String $email: String $phone: String $address: String
  ) {
    updateSupplier(
      id: $id name: $name contactName: $contactName email: $email phone: $phone address: $address
    ) { id name contactName email phone address }
  }
`;

const DELETE_SUPPLIER = gql`
  mutation DeleteSupplier($id: ID!) { deleteSupplier(id: $id) }
`;

// ── Zod schema ────────────────────────────────────────────────────────────────

const supplierSchema = z.object({
  name:        z.string().trim().min(2, 'Name must be at least 2 characters').max(200),
  contactName: z.string().trim().max(100).optional(),
  email:       z.string().trim().email('Invalid email').max(255).optional().or(z.literal('')),
  phone:       z.string().trim().max(30).optional(),
  address:     z.string().trim().max(300).optional(),
});
type SupplierForm = z.infer<typeof supplierSchema>;

// ── Modal ─────────────────────────────────────────────────────────────────────

function SupplierModal({ open, onClose, refetch, editSupplier }: {
  open: boolean; onClose: () => void; refetch: () => void; editSupplier: any;
}) {
  const { success, error: toastError } = useToast();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<SupplierForm>({
    resolver: zodResolver(supplierSchema),
    defaultValues: editSupplier
      ? { name: editSupplier.name, contactName: editSupplier.contactName || '', email: editSupplier.email || '', phone: editSupplier.phone || '', address: editSupplier.address || '' }
      : {},
  });

  useEffect(() => {
    if (open) {
      reset(editSupplier
        ? { name: editSupplier.name, contactName: editSupplier.contactName || '', email: editSupplier.email || '', phone: editSupplier.phone || '', address: editSupplier.address || '' }
        : { name: '', contactName: '', email: '', phone: '', address: '' }
      );
    }
  }, [open, editSupplier, reset]);

  const [createSupplier, { loading: creating }] = useMutation(CREATE_SUPPLIER, {
    onCompleted: () => refetch(),
  });
  const [updateSupplier, { loading: updating }] = useMutation(UPDATE_SUPPLIER, {
    onCompleted: () => refetch(),
  });

  const onSubmit = async (values: SupplierForm) => {
    try {
      const data = {
        name:        values.name,
        contactName: values.contactName || null,
        email:       values.email       || null,
        phone:       values.phone       || null,
        address:     values.address     || null,
      };
      if (editSupplier) {
        await updateSupplier({ variables: { id: editSupplier.id, ...data } });
        success('Supplier updated', values.name);
      } else {
        await createSupplier({ variables: data });
        success('Supplier added', values.name);
      }
      reset(); onClose();
    } catch (e: any) { toastError('Failed', e.message); }
  };

  if (!open) return null;

  const ic = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-colors';
  const lc = 'text-sm font-medium text-foreground block mb-1';
  const ec = 'text-xs text-destructive mt-1';

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">
              {editSupplier ? 'Edit Supplier' : 'Add Supplier'}
            </h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div>
              <label className={lc}>Company Name *</label>
              <input {...register('name')} placeholder="e.g. Abyssinia Trading PLC" className={ic} />
              {errors.name && <p className={ec}>{errors.name.message}</p>}
            </div>
            <div>
              <label className={lc}>Contact Person</label>
              <input {...register('contactName')} placeholder="e.g. Abebe Girma" className={ic} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lc}>Email</label>
                <input {...register('email')} type="email" placeholder="contact@supplier.com" className={ic} />
                {errors.email && <p className={ec}>{errors.email.message}</p>}
              </div>
              <div>
                <label className={lc}>Phone</label>
                <input {...register('phone')} placeholder="+251 9XX XXX XXX" className={ic} />
              </div>
            </div>
            <div>
              <label className={lc}>Address</label>
              <textarea {...register('address')} placeholder="Bole, Addis Ababa, Ethiopia" rows={2}
                className={`${ic} resize-none`} />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={creating || updating}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                {(creating || updating) && <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />}
                {creating || updating ? 'Saving…' : editSupplier ? 'Update Supplier' : 'Add Supplier'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportSuppliersCSV(suppliers: any[], stats: Map<string, any>) {
  const headers = ['Name', 'Contact', 'Email', 'Phone', 'Address', 'Products', 'Total Stock Value', 'Total PO Value'];
  const rows = suppliers.map(s => {
    const st = stats.get(s.id) ?? {};
    return [s.name, s.contactName ?? '', s.email ?? '', s.phone ?? '', s.address ?? '',
            st.productCount ?? 0, (st.stockValue ?? 0).toFixed(2), (st.poValue ?? 0).toFixed(2)];
  });
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `suppliers-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Suppliers() {
  const [modalOpen, setModalOpen]     = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);
  const [search, setSearch]           = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const { data, loading, refetch }    = useQuery(GET_SUPPLIERS, { fetchPolicy: 'cache-and-network' });
  const [deleteSupplier]              = useMutation(DELETE_SUPPLIER, { onCompleted: () => refetch() });
  const { success, error: toastError } = useToast();
  const { canMutate, canAdminDelete } = useRole();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebounced(v), 250);
  }, []);
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  const allSuppliers: any[] = data?.suppliers     || [];
  const allProducts:  any[] = data?.products      || [];
  const allOrders:    any[] = data?.purchaseOrders || [];

  // Compute per-supplier stats
  const supplierStats = new Map<string, { productCount: number; stockValue: number; poValue: number; poCount: number }>();
  allSuppliers.forEach(s => supplierStats.set(s.id, { productCount: 0, stockValue: 0, poValue: 0, poCount: 0 }));
  allProducts.forEach((p: any) => {
    if (!p.supplierId) return;
    const st = supplierStats.get(p.supplierId);
    if (st) { st.productCount++; st.stockValue += p.costPrice * p.stock; }
  });
  allOrders.forEach((o: any) => {
    if (!o.supplierId) return;
    const st = supplierStats.get(o.supplierId);
    if (st) { st.poCount++; if (o.status === 'RECEIVED') st.poValue += o.totalCost; }
  });

  const suppliers = allSuppliers.filter(s =>
    !debouncedSearch ||
    s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    (s.contactName && s.contactName.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
    (s.email && s.email.toLowerCase().includes(debouncedSearch.toLowerCase()))
  );

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete supplier "${name}"?\n\nThis cannot be undone. Products linked to this supplier will have their supplier removed.`)) return;
    try {
      await deleteSupplier({ variables: { id } });
      success('Supplier deleted', name);
    } catch (e: any) { toastError('Delete failed', e.message); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Suppliers</h2>
          <p className="text-sm text-muted-foreground">
            {allSuppliers.length} supplier{allSuppliers.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <div className="flex items-center gap-2">
          {allSuppliers.length > 0 && (
            <button onClick={() => exportSuppliersCSV(suppliers, supplierStats)}
              className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2 text-muted-foreground">
              <FileDown size={14} /> Export
            </button>
          )}
          {canMutate && (
            <button onClick={() => { setEditSupplier(null); setModalOpen(true); }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
              <Plus size={16} /> Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => handleSearch(e.target.value)}
          placeholder="Search by name, contact or email…"
          className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
        {search && (
          <button onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16">
          <Truck size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">
            {debouncedSearch ? 'No suppliers match your search.' : 'No suppliers yet.'}
          </p>
          {canMutate && !debouncedSearch && (
            <button onClick={() => { setEditSupplier(null); setModalOpen(true); }}
              className="mt-3 text-primary text-sm font-medium hover:underline">
              Add your first supplier →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map((s: any, i: number) => {
            const st = supplierStats.get(s.id);
            return (
              <motion.div key={s.id}
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">

                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                      <Truck size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{s.name}</h3>
                      {s.contactName && (
                        <p className="text-xs text-muted-foreground truncate">{s.contactName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {canMutate && (
                      <button onClick={() => { setEditSupplier(s); setModalOpen(true); }}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Edit">
                        <Edit2 size={14} />
                      </button>
                    )}
                    {canAdminDelete && (
                      <button onClick={() => handleDelete(s.id, s.name)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Delete">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-1.5">
                  {s.email && (
                    <a href={`mailto:${s.email}`}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <Mail size={12} className="shrink-0" />
                      <span className="truncate">{s.email}</span>
                      <ExternalLink size={10} className="shrink-0" />
                    </a>
                  )}
                  {s.phone && (
                    <a href={`tel:${s.phone}`}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <Phone size={12} className="shrink-0" />
                      <span className="truncate">{s.phone}</span>
                    </a>
                  )}
                  {s.address && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin size={12} className="shrink-0" />
                      <span className="line-clamp-2 leading-tight">{s.address}</span>
                    </div>
                  )}
                  {!s.email && !s.phone && !s.address && (
                    <p className="text-xs text-muted-foreground/50 italic">No contact details</p>
                  )}
                </div>

                {/* Stats */}
                {st && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-xs">
                      <Package size={13} className="text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">{st.productCount}</p>
                        <p className="text-muted-foreground">Product{st.productCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <ShoppingCart size={13} className="text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">{fmt(st.poValue)}</p>
                        <p className="text-muted-foreground">Purchased</p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <SupplierModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditSupplier(null); }}
        refetch={refetch}
        editSupplier={editSupplier}
      />
    </div>
  );
}
