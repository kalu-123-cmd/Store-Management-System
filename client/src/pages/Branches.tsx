import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, MapPin, Phone, User, Building2, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';
import { useLangContext } from '../lib/LangContext';

const GET_BRANCHES = gql`query { branches { id name address phone manager isActive createdAt } }`;
const CREATE_BRANCH = gql`mutation CreateBranch($name:String!,$address:String,$phone:String,$manager:String) { createBranch(name:$name,address:$address,phone:$phone,manager:$manager) { id name isActive } }`;
const UPDATE_BRANCH = gql`mutation UpdateBranch($id:ID!,$name:String,$address:String,$phone:String,$manager:String,$isActive:Boolean) { updateBranch(id:$id,name:$name,address:$address,phone:$phone,manager:$manager,isActive:$isActive) { id name isActive } }`;
const DELETE_BRANCH = gql`mutation DeleteBranch($id:ID!) { deleteBranch(id:$id) }`;

function BranchModal({ open, onClose, refetch, editBranch }: any) {
  const { success, error: toastError } = useToast();
  const { register, handleSubmit, reset } = useForm({ defaultValues: editBranch || {} });
  const [createBranch, { loading: c }] = useMutation(CREATE_BRANCH);
  const [updateBranch, { loading: u }] = useMutation(UPDATE_BRANCH);

  const onSubmit = async (values: any) => {
    try {
      if (editBranch) await updateBranch({ variables: { id: editBranch.id, ...values } });
      else await createBranch({ variables: values });
      success(editBranch ? 'Branch updated' : 'Branch created', values.name);
      refetch(); reset(); onClose();
    } catch (e: any) { toastError('Failed', e.message); }
  };

  if (!open) return null;
  const ic = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none';
  const lc = 'text-sm font-medium text-foreground block mb-1';

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <Building2 size={16} />
              </div>
              <h2 className="text-lg font-semibold text-foreground">{editBranch ? 'Edit Branch' : 'Add Branch'}</h2>
            </div>
            <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div>
              <label className={lc}>Branch Name *</label>
              <input {...register('name', { required: true })} placeholder="e.g. Bole Branch" className={ic} />
            </div>
            <div>
              <label className={lc}>Address</label>
              <input {...register('address')} placeholder="e.g. Bole Road, Addis Ababa" className={ic} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lc}>Phone</label>
                <input {...register('phone')} placeholder="+251-911-..." className={ic} />
              </div>
              <div>
                <label className={lc}>Branch Manager</label>
                <input {...register('manager')} placeholder="Manager name" className={ic} />
              </div>
            </div>
            {editBranch && (
              <div className="flex items-center gap-3">
                <input type="checkbox" {...register('isActive')} id="isActive" className="rounded" />
                <label htmlFor="isActive" className="text-sm font-medium text-foreground cursor-pointer">Active branch</label>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button type="submit" disabled={c || u}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {c || u ? 'Saving…' : editBranch ? 'Update' : 'Create Branch'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Branches() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<any>(null);
  const { data, loading, refetch } = useQuery(GET_BRANCHES, { fetchPolicy: 'cache-and-network' });
  const [deleteBranch] = useMutation(DELETE_BRANCH);
  const { success, error: toastError } = useToast();
  const { isAdmin } = useRole();
  const { t: _t } = useLangContext();

  const branches: any[] = data?.branches || [];
  const active   = branches.filter(b => b.isActive).length;
  const inactive = branches.filter(b => !b.isActive).length;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center text-destructive">
          <AlertTriangle size={24} />
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">Access Restricted</p>
          <p className="text-sm text-muted-foreground mt-1">Branch management requires Admin privileges.</p>
        </div>
      </div>
    );
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete branch "${name}"?`)) return;
    try {
      await deleteBranch({ variables: { id } });
      success('Branch deleted', name);
      refetch();
    } catch (e: any) { toastError('Delete failed', e.message); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">Branches</h2>
          <p className="text-sm text-muted-foreground">{branches.length} branches · {active} active · {inactive} inactive</p>
        </div>
        <button onClick={() => { setEditBranch(null); setModalOpen(true); }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm">
          <Plus size={16} /> Add Branch
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Branches', value: branches.length,  color: 'text-foreground'  },
          { label: 'Active',         value: active,           color: 'text-emerald-500' },
          { label: 'Inactive',       value: inactive,         color: 'text-muted-foreground' },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Branch cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {branches.map((branch, i) => (
            <motion.div key={branch.id}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className={`bg-card border rounded-xl p-5 shadow-sm hover:shadow-md transition-all ${branch.isActive ? 'border-border' : 'border-border opacity-60'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{branch.name}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${branch.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                      {branch.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditBranch(branch); setModalOpen(true); }}
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(branch.id, branch.name)}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {branch.address && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin size={12} className="shrink-0 mt-0.5" />
                    <span>{branch.address}</span>
                  </div>
                )}
                {branch.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone size={12} className="shrink-0" />
                    <span>{branch.phone}</span>
                  </div>
                )}
                {branch.manager && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User size={12} className="shrink-0" />
                    <span>{branch.manager}</span>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground mt-4 pt-3 border-t border-border">
                Added {new Date(branch.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      <BranchModal open={modalOpen} onClose={() => { setModalOpen(false); setEditBranch(null); }} refetch={refetch} editBranch={editBranch} />
    </div>
  );
}
