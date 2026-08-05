import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, Tag } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';

const GET_CATEGORIES = gql`
  query { categories { id name description productCount } }
`;
const CREATE_CATEGORY = gql`mutation CreateCategory($name:String!,$description:String) { createCategory(name:$name,description:$description) { id name } }`;
const UPDATE_CATEGORY = gql`mutation UpdateCategory($id:ID!,$name:String,$description:String) { updateCategory(id:$id,name:$name,description:$description) { id name } }`;
const DELETE_CATEGORY = gql`mutation DeleteCategory($id:ID!) { deleteCategory(id:$id) }`;

function CategoryModal({ open, onClose, refetch, editCategory }: any) {
  const { success, error: toastError } = useToast();
  const { register, handleSubmit, reset } = useForm({ defaultValues: editCategory || {} });
  const [createCategory, { loading: c }] = useMutation(CREATE_CATEGORY);
  const [updateCategory, { loading: u }] = useMutation(UPDATE_CATEGORY);
  const onSubmit = async (values: any) => {
    try {
      if (editCategory) await updateCategory({ variables: { id: editCategory.id, ...values } });
      else await createCategory({ variables: values });
      success(editCategory ? 'Category updated' : 'Category created', values.name);
      refetch(); reset(); onClose();
    } catch (e: any) { toastError('Failed', e.message); }
  };
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-lg font-semibold">{editCategory ? 'Edit Category' : 'Add Category'}</h2>
            <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div><label className="text-sm font-medium block mb-1">Category Name *</label><input {...register('name', { required: true })} placeholder="e.g. Electronics" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" /></div>
            <div><label className="text-sm font-medium block mb-1">Description</label><textarea {...register('description')} placeholder="Optional description" rows={3} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none resize-none" /></div>
            <div className="flex gap-3"><button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancel</button><button type="submit" disabled={c || u} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">{c || u ? 'Saving...' : editCategory ? 'Update' : 'Create'}</button></div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const COLORS = ['bg-blue-500/10 text-blue-600', 'bg-violet-500/10 text-violet-600', 'bg-emerald-500/10 text-emerald-600', 'bg-amber-500/10 text-amber-600', 'bg-rose-500/10 text-rose-600', 'bg-cyan-500/10 text-cyan-600'];

export default function Categories() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<any>(null);
  const { data, loading, refetch } = useQuery(GET_CATEGORIES);
  const [deleteCategory] = useMutation(DELETE_CATEGORY);
  const { success, error: toastError } = useToast();
  const { canMutate, canAdminDelete } = useRole();
  const categories = data?.categories || [];

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete category "${name}"? This may affect products.`)) return;
    try {
      await deleteCategory({ variables: { id } });
      success('Category deleted', name);
      refetch();
    } catch (e: any) { toastError('Delete failed', e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">Categories</h2>
          <p className="text-sm text-muted-foreground">{categories.length} categories total</p>
        </div>
        {canMutate && (
          <button onClick={() => { setEditCategory(null); setModalOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
            <Plus size={16} /> Add Category
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map((cat: any, i: number) => (
            <motion.div key={cat.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${COLORS[i % COLORS.length]}`}>
                  <Tag size={18} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canMutate && <button onClick={() => { setEditCategory(cat); setModalOpen(true); }} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"><Edit2 size={14} /></button>}
                  {canAdminDelete && <button onClick={() => handleDelete(cat.id, cat.name)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 size={14} /></button>}
                </div>
              </div>
              <h3 className="font-semibold text-foreground mb-1">{cat.name}</h3>
              {cat.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{cat.description}</p>}
              <p className="text-xs text-muted-foreground mt-2">{cat.productCount || 0} products</p>
            </motion.div>
          ))}
          {categories.length === 0 && <div className="col-span-4 text-center py-12 text-muted-foreground text-sm">No categories yet.</div>}
        </div>
      )}
      <CategoryModal open={modalOpen} onClose={() => { setModalOpen(false); setEditCategory(null); }} refetch={refetch} editCategory={editCategory} />
    </div>
  );
}
