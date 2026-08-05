import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, Truck, Mail, Phone, MapPin } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';

const GET_SUPPLIERS = gql`
  query { suppliers { id name contactName email phone address } }
`;
const CREATE_SUPPLIER = gql`mutation CreateSupplier($name:String!,$contactName:String,$email:String,$phone:String,$address:String) { createSupplier(name:$name,contactName:$contactName,email:$email,phone:$phone,address:$address) { id name } }`;
const UPDATE_SUPPLIER = gql`mutation UpdateSupplier($id:ID!,$name:String,$contactName:String,$email:String,$phone:String,$address:String) { updateSupplier(id:$id,name:$name,contactName:$contactName,email:$email,phone:$phone,address:$address) { id name } }`;
const DELETE_SUPPLIER = gql`mutation DeleteSupplier($id:ID!) { deleteSupplier(id:$id) }`;

function SupplierModal({ open, onClose, refetch, editSupplier }: any) {
  const { success, error: toastError } = useToast();
  const { register, handleSubmit, reset } = useForm({ defaultValues: editSupplier || {} });
  const [createSupplier, { loading: c }] = useMutation(CREATE_SUPPLIER);
  const [updateSupplier, { loading: u }] = useMutation(UPDATE_SUPPLIER);
  const onSubmit = async (values: any) => {
    try {
      if (editSupplier) await updateSupplier({ variables: { id: editSupplier.id, ...values } });
      else await createSupplier({ variables: values });
      success(editSupplier ? 'Supplier updated' : 'Supplier added', values.name);
      refetch(); reset(); onClose();
    } catch (e: any) { toastError('Failed', e.message); }
  };
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-lg font-semibold">{editSupplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
            <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div><label className="text-sm font-medium block mb-1">Company Name *</label><input {...register('name', { required: true })} placeholder="TechVision Ltd" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" /></div>
            <div><label className="text-sm font-medium block mb-1">Contact Name</label><input {...register('contactName')} placeholder="John Doe" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" /></div>
            <div><label className="text-sm font-medium block mb-1">Email</label><input {...register('email')} type="email" placeholder="john@company.com" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" /></div>
            <div><label className="text-sm font-medium block mb-1">Phone</label><input {...register('phone')} placeholder="+1-555-0101" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" /></div>
            <div><label className="text-sm font-medium block mb-1">Address</label><textarea {...register('address')} placeholder="123 Business Ave, City" rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none resize-none" /></div>
            <div className="flex gap-3"><button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button><button type="submit" disabled={c || u} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">{c || u ? 'Saving...' : editSupplier ? 'Update' : 'Create'}</button></div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Suppliers() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);
  const { data, loading, refetch } = useQuery(GET_SUPPLIERS);
  const [deleteSupplier] = useMutation(DELETE_SUPPLIER);
  const { success, error: toastError } = useToast();
  const { canMutate, canAdminDelete } = useRole();
  const suppliers = data?.suppliers || [];

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete supplier "${name}"?`)) return;
    try {
      await deleteSupplier({ variables: { id } });
      success('Supplier deleted', name);
      refetch();
    } catch (e: any) { toastError('Delete failed', e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">Suppliers</h2>
          <p className="text-sm text-muted-foreground">{suppliers.length} suppliers registered</p>
        </div>
        {canMutate && (
          <button onClick={() => { setEditSupplier(null); setModalOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
            <Plus size={16} /> Add Supplier
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s: any, i: number) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary"><Truck size={18} /></div>
                  <div>
                    <h3 className="font-semibold text-foreground">{s.name}</h3>
                    {s.contactName && <p className="text-xs text-muted-foreground">{s.contactName}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {canMutate && <button onClick={() => { setEditSupplier(s); setModalOpen(true); }} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"><Edit2 size={14} /></button>}
                  {canAdminDelete && <button onClick={() => handleDelete(s.id, s.name)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 size={14} /></button>}
                </div>
              </div>
              <div className="space-y-2">
                {s.email && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail size={13} />{s.email}</div>}
                {s.phone && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone size={13} />{s.phone}</div>}
                {s.address && <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin size={13} /><span className="line-clamp-1">{s.address}</span></div>}
              </div>
            </motion.div>
          ))}
          {suppliers.length === 0 && <div className="col-span-3 text-center py-12 text-muted-foreground">No suppliers yet. Add your first supplier!</div>}
        </div>
      )}
      <SupplierModal open={modalOpen} onClose={() => { setModalOpen(false); setEditSupplier(null); }} refetch={refetch} editSupplier={editSupplier} />
    </div>
  );
}
