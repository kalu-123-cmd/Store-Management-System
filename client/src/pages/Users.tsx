import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, X, ShieldCheck, Shield, User,
  Mail, Edit2, AlertTriangle,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';

// ── GraphQL ──────────────────────────────────────────────────────────────────

const GET_USERS = gql`
  query GetUsers {
    users { id name email role createdAt }
    me    { id }
  }
`;

const CREATE_USER = gql`
  mutation CreateUser($name: String!, $email: String!, $password: String!, $role: String!) {
    createUser(name: $name, email: $email, password: $password, role: $role) {
      id name email role createdAt
    }
  }
`;

const UPDATE_ROLE = gql`
  mutation UpdateUserRole($id: ID!, $role: String!) {
    updateUserRole(id: $id, role: $role) { id name role }
  }
`;

const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) { deleteUser(id: $id) }
`;

// ── Zod schema ───────────────────────────────────────────────────────────────

const createSchema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters'),
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role:     z.enum(['ADMIN', 'MANAGER', 'CASHIER']),
});
type CreateForm = z.infer<typeof createSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ADMIN:   { label: 'Admin',   color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', icon: <ShieldCheck size={13} /> },
  MANAGER: { label: 'Manager', color: 'bg-blue-500/10   text-blue-600   dark:text-blue-400',   icon: <Shield      size={13} /> },
  CASHIER: { label: 'Cashier', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: <User size={13} /> },
};

// ── Create User Modal ─────────────────────────────────────────────────────────

function CreateUserModal({ open, onClose, refetch }: { open: boolean; onClose: () => void; refetch: () => void }) {
  const { success, error: toastError } = useToast();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'CASHIER' },
  });
  const [createUser, { loading }] = useMutation(CREATE_USER);

  const onSubmit = async (values: CreateForm) => {
    try {
      await createUser({ variables: values });
      success('User created', `${values.name} can now log in as ${values.role}.`);
      reset();
      refetch();
      onClose();
    } catch (e: any) {
      toastError('Failed to create user', e.message);
    }
  };

  if (!open) return null;

  const ic = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-colors';
  const lc = 'text-sm font-medium text-foreground block mb-1';
  const ec = 'text-xs text-destructive mt-1';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md"
        >
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Create Staff Account</h2>
              <p className="text-xs text-muted-foreground mt-0.5">New user can log in immediately</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div>
              <label className={lc}>Full Name *</label>
              <input {...register('name')} placeholder="Jane Smith" className={ic} />
              {errors.name && <p className={ec}>{errors.name.message}</p>}
            </div>
            <div>
              <label className={lc}>Email *</label>
              <input {...register('email')} type="email" placeholder="jane@store.com" className={ic} />
              {errors.email && <p className={ec}>{errors.email.message}</p>}
            </div>
            <div>
              <label className={lc}>Temporary Password *</label>
              <input {...register('password')} type="password" placeholder="Min 6 characters" className={ic} />
              {errors.password && <p className={ec}>{errors.password.message}</p>}
            </div>
            <div>
              <label className={lc}>Role *</label>
              <select {...register('role')} className={ic}>
                <option value="CASHIER">Cashier — can process sales, view inventory</option>
                <option value="MANAGER">Manager — can manage products &amp; customers</option>
                <option value="ADMIN">Admin — full access including user management</option>
              </select>
              {errors.role && <p className={ec}>{errors.role.message}</p>}
            </div>

            {/* Role capability summary */}
            <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground mb-1.5">Role permissions</p>
              <p><span className="text-emerald-500 font-medium">Cashier:</span> view dashboard, process sales, browse products</p>
              <p><span className="text-blue-500 font-medium">Manager:</span> + add/edit products, customers, suppliers, categories, adjust stock</p>
              <p><span className="text-violet-500 font-medium">Admin:</span> + delete records, manage users, view all reports</p>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                {loading && <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />}
                {loading ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Edit Role Modal ───────────────────────────────────────────────────────────

function EditRoleModal({ user: target, onClose, refetch }: { user: any; onClose: () => void; refetch: () => void }) {
  const { success, error: toastError } = useToast();
  const [role, setRole] = useState<string>(target.role);
  const [updateRole, { loading }] = useMutation(UPDATE_ROLE);

  const handleSave = async () => {
    try {
      await updateRole({ variables: { id: target.id, role } });
      success('Role updated', `${target.name} is now ${role}.`);
      refetch();
      onClose();
    } catch (e: any) {
      toastError('Failed', e.message);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm"
        >
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Change Role</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">Changing role for <span className="font-semibold text-foreground">{target.name}</span></p>
            <div className="space-y-2">
              {(['CASHIER', 'MANAGER', 'ADMIN'] as const).map(r => {
                const m = ROLE_META[r];
                return (
                  <label key={r} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${role === r ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}>
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="hidden" />
                    <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${m.color}`}>
                      {m.icon} {m.label}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={loading || role === target.role}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {loading ? 'Saving…' : 'Save Role'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Users() {
  const { isAdmin } = useRole();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser]     = useState<any>(null);
  const { success, error: toastError, warning } = useToast();

  const { data, loading, refetch } = useQuery(GET_USERS, { fetchPolicy: 'cache-and-network' });
  const [deleteUser] = useMutation(DELETE_USER);

  const users: any[]  = data?.users || [];
  const currentUserId = data?.me?.id;

  // Non-admins see an access denied wall
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center text-destructive">
          <AlertTriangle size={24} />
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">Access Restricted</p>
          <p className="text-sm text-muted-foreground mt-1">User management requires Admin privileges.</p>
        </div>
      </div>
    );
  }

  const handleDelete = async (id: string, name: string) => {
    if (id === currentUserId) {
      warning('Cannot delete yourself', 'Log in as another admin to delete this account.');
      return;
    }
    if (!window.confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteUser({ variables: { id } });
      success('User deleted', name);
      refetch();
    } catch (e: any) {
      toastError('Delete failed', e.message);
    }
  };

  const roleGroups = {
    ADMIN:   users.filter(u => u.role === 'ADMIN'),
    MANAGER: users.filter(u => u.role === 'MANAGER'),
    CASHIER: users.filter(u => u.role === 'CASHIER'),
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground">{users.length} staff account{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
        >
          <Plus size={16} /> Add Staff
        </button>
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {(['ADMIN', 'MANAGER', 'CASHIER'] as const).map(r => {
          const m = ROLE_META[r];
          const count = roleGroups[r].length;
          return (
            <div key={r} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${m.color}`}>
                {m.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">{m.label}{count !== 1 ? 's' : ''}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Users Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                {['Staff Member', 'Email', 'Role', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <div className="flex justify-center">
                      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-muted-foreground text-sm">
                    No users found.
                  </td>
                </tr>
              ) : users.map((u, i) => {
                const meta = ROLE_META[u.role] || ROLE_META.CASHIER;
                const isSelf = u.id === currentUserId;
                return (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-border hover:bg-muted/20 transition-colors"
                  >
                    {/* Name + avatar */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground leading-tight">
                            {u.name}
                            {isSelf && (
                              <span className="ml-2 text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">you</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail size={13} />
                        {u.email}
                      </div>
                    </td>

                    {/* Role badge */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.color}`}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>

                    {/* Joined */}
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditUser(u)}
                          disabled={isSelf}
                          title={isSelf ? 'Cannot change your own role' : 'Change role'}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id, u.name)}
                          disabled={isSelf}
                          title={isSelf ? 'Cannot delete yourself' : 'Delete user'}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
          {users.length} total staff · Admin-only page
        </div>
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} refetch={refetch} />
      {editUser && <EditRoleModal user={editUser} onClose={() => setEditUser(null)} refetch={refetch} />}
    </div>
  );
}
