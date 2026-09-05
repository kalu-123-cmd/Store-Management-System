import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, Trash2, X, Mail, Phone, ShoppingBag,
  Search, ChevronRight, Receipt, Calendar, Wallet,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';
import { fmt } from '../lib/currency';
import { useLangContext } from '../lib/LangContext';

// ── GraphQL ──────────────────────────────────────────────────────────────────

const GET_CUSTOMERS = gql`
  query {
    customers {
      id name email phone createdAt totalSpent purchaseCount
      creditLimit currentDebt riskScore status
      creditAccount { id creditLimit currentBalance availableCredit status }
    }
  }
`;

const GET_CUSTOMER_HISTORY = gql`
  query GetCustomerHistory($id: ID!) {
    customer(id: $id) {
      id name email phone createdAt totalSpent purchaseCount currentDebt creditLimit
      sales {
        id invoiceNo totalAmount createdAt
        items { id quantity price product { name sku } }
      }
    }
    creditLedgerEntries(customerId: $id) {
      id entryType amount runningBalance notes createdAt
    }
    creditAccount(customerId: $id) {
      id creditLimit currentBalance availableCredit status riskScore
    }
  }
`;

const SET_CREDIT_LIMIT = gql`
  mutation SetCreditLimit($customerId: ID!, $creditLimit: Float!) {
    setCustomerCreditLimit(customerId: $customerId, creditLimit: $creditLimit) {
      id creditLimit currentBalance availableCredit
    }
  }
`;

const RECORD_CREDIT_PAY = gql`
  mutation RecordCreditPayment($customerId: ID!, $amount: Float!, $paymentMethod: String, $notes: String) {
    recordCreditPayment(customerId: $customerId, amount: $amount, paymentMethod: $paymentMethod, notes: $notes) {
      id currentBalance availableCredit
    }
  }
`;

const CREATE_CUSTOMER = gql`
  mutation CreateCustomer($name:String!,$email:String,$phone:String) {
    createCustomer(name:$name,email:$email,phone:$phone) { id name }
  }
`;
const UPDATE_CUSTOMER = gql`
  mutation UpdateCustomer($id:ID!,$name:String,$email:String,$phone:String) {
    updateCustomer(id:$id,name:$name,email:$email,phone:$phone) { id name }
  }
`;
const DELETE_CUSTOMER = gql`mutation DeleteCustomer($id:ID!) { deleteCustomer(id:$id) }`;

// ── Customer Modal ────────────────────────────────────────────────────────────

function CustomerModal({ open, onClose, refetch, editCustomer }: any) {
  const { success, error: toastError } = useToast();
  const { register, handleSubmit, reset } = useForm({ defaultValues: editCustomer || {} });
  const [createCustomer, { loading: c }] = useMutation(CREATE_CUSTOMER);
  const [updateCustomer, { loading: u }] = useMutation(UPDATE_CUSTOMER);

  const onSubmit = async (values: any) => {
    try {
      if (editCustomer) await updateCustomer({ variables: { id: editCustomer.id, ...values } });
      else await createCustomer({ variables: values });
      success(editCustomer ? 'Customer updated' : 'Customer added', values.name);
      refetch(); reset(); onClose();
    } catch (e: any) { toastError('Failed', e.message); }
  };

  if (!open) return null;
  const ic = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none';
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-lg font-semibold">{editCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
            <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Full Name *</label>
              <input {...register('name', { required: true })} placeholder="Alice Johnson" className={ic} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Email</label>
              <input {...register('email')} type="email" placeholder="alice@example.com" className={ic} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Phone</label>
              <input {...register('phone')} placeholder="+1-555-0001" className={ic} />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={c || u}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {c || u ? 'Saving…' : editCustomer ? 'Update' : 'Add Customer'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Purchase History Drawer ───────────────────────────────────────────────────

function HistoryDrawer({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [payAmt, setPayAmt] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [limitAmt, setLimitAmt] = useState('');
  const { data, loading, refetch } = useQuery(GET_CUSTOMER_HISTORY, {
    variables: { id: customerId },
    fetchPolicy: 'cache-and-network',
  });
  const [recordPay] = useMutation(RECORD_CREDIT_PAY);
  const [setLimit] = useMutation(SET_CREDIT_LIMIT);
  const { success, error: toastError } = useToast();
  const { canMutate } = useRole();

  const customer = data?.customer;
  const sales: any[] = customer?.sales || [];
  const ledger: any[] = data?.creditLedgerEntries || [];
  const account = data?.creditAccount;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-40"
      />

      {/* Drawer */}
      <motion.aside
        key="drawer"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border shadow-2xl z-50 flex flex-col"
      >
        {/* Drawer header */}
        <div className="p-5 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Purchase History</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <X size={18} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-muted" />
              <div className="space-y-1.5">
                <div className="h-3 w-28 bg-muted rounded" />
                <div className="h-2.5 w-20 bg-muted rounded" />
              </div>
            </div>
          ) : customer ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold shrink-0">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{customer.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {customer.email && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail size={11} />{customer.email}
                    </span>
                  )}
                  {customer.phone && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone size={11} />{customer.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Stats strip */}
        {customer && (
          <div className="grid grid-cols-3 divide-x divide-border border-b border-border shrink-0">
            <div className="p-3 text-center">
              <p className="text-lg font-bold text-foreground">{customer.purchaseCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Orders</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-lg font-bold text-emerald-500">{fmt(customer.totalSpent || 0)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Total Spent</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-lg font-bold text-amber-600">{fmt(customer.currentDebt || 0)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Utang</p>
            </div>
          </div>
        )}

        {customer && canMutate && (
          <div className="p-4 border-b border-border space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1"><Wallet size={12} /> Credit / utang</p>
            <p className="text-xs text-muted-foreground">
              Limit {fmt(account?.creditLimit ?? customer.creditLimit ?? 0)} · Available {fmt(account?.availableCredit ?? 0)}
            </p>
            <div className="flex gap-2">
              <input type="number" min={0} value={limitAmt} onChange={e => setLimitAmt(e.target.value)} placeholder="Set limit"
                className="flex-1 px-2 py-1.5 bg-background border border-border rounded text-sm" />
              <button onClick={async () => {
                try {
                  await setLimit({ variables: { customerId, creditLimit: Number(limitAmt) } });
                  success('Credit limit updated'); refetch();
                } catch (e: any) { toastError('Failed', e.message); }
              }} className="px-3 py-1.5 bg-muted rounded text-xs font-medium">Save limit</button>
            </div>
            <div className="flex gap-2">
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                className="px-2 py-1.5 bg-background border border-border rounded text-xs">
                {['CASH','TELEBIRR','CBE_BIRR','BANK_TRANSFER','CARD'].map(m => (
                  <option key={m} value={m}>{m.replace('_',' ')}</option>
                ))}
              </select>
              <input type="number" min={0} value={payAmt} onChange={e => setPayAmt(e.target.value)} placeholder="Amount"
                className="flex-1 px-2 py-1.5 bg-background border border-border rounded text-sm" />
              <button onClick={async () => {
                try {
                  await recordPay({ variables: { customerId, amount: Number(payAmt), paymentMethod: payMethod } });
                  success('Payment recorded'); setPayAmt(''); refetch();
                } catch (e: any) { toastError('Failed', e.message); }
              }} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium">Record</button>
            </div>
            {ledger.length > 0 && (
              <ul className="max-h-28 overflow-y-auto text-xs space-y-1">
                {ledger.slice(0, 8).map((e: any) => (
                  <li key={e.id} className="flex justify-between text-muted-foreground">
                    <span>{e.entryType} · {new Date(e.createdAt).toLocaleDateString()}</span>
                    <span className={e.amount < 0 ? 'text-emerald-600' : 'text-amber-700'}>{fmt(e.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Sales list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
                <ShoppingBag size={22} className="text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">No purchases yet</p>
              <p className="text-sm text-muted-foreground">This customer hasn't made any orders.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sales.map((sale: any) => (
                <div key={sale.id}>
                  {/* Sale row — click to expand */}
                  <button
                    onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                        <Receipt size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-primary">{sale.invoiceNo}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(sale.createdAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                          {' · '}
                          {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-sm text-foreground">{fmt(sale.totalAmount)}</span>
                      <motion.span
                        animate={{ rotate: expandedSale === sale.id ? 90 : 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <ChevronRight size={15} className="text-muted-foreground" />
                      </motion.span>
                    </div>
                  </button>

                  {/* Expanded line items */}
                  <AnimatePresence initial={false}>
                    {expandedSale === sale.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-muted/20 border-t border-border px-5 py-3 space-y-2">
                          {sale.items.map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-muted-foreground shrink-0">{item.quantity}×</span>
                                <span className="text-foreground truncate">{item.product?.name}</span>
                                {item.product?.sku && (
                                  <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                                    {item.product.sku}
                                  </code>
                                )}
                              </div>
                              <span className="font-medium text-foreground shrink-0 ml-3">
                                {fmt(item.price * item.quantity)}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between pt-2 border-t border-border text-sm font-semibold">
                            <span className="text-muted-foreground">Total</span>
                            <span className="text-emerald-500">{fmt(sale.totalAmount)}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Customers() {
  const [modalOpen, setModalOpen]       = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [historyId, setHistoryId]       = useState<string | null>(null);
  const [search, setSearch]             = useState('');
  const { data, loading, refetch }      = useQuery(GET_CUSTOMERS);
  const [deleteCustomer]                = useMutation(DELETE_CUSTOMER);
  const { success, error: toastError }  = useToast();
  const { canMutate }                   = useRole();
  const { t }                           = useLangContext();
  const all: any[]                      = data?.customers || [];

  const customers = all.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete customer "${name}"?`)) return;
    try {
      await deleteCustomer({ variables: { id } });
      success('Customer deleted', name);
      refetch();
    } catch (e: any) { toastError('Delete failed', e.message); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('customers')}</h2>
          <p className="text-sm text-muted-foreground">{all.length} {t('customers').toLowerCase()} registered</p>
        </div>
        {canMutate && (
          <button
            onClick={() => { setEditCustomer(null); setModalOpen(true); }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Plus size={16} /> {t('add')} {t('customer')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {/* Search */}
          <div className="p-4 border-b border-border bg-muted/20 flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder={`${t('search')} name or email…`}
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">Click a customer to view order history</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
                <tr>
                  {['Customer', 'Contact', t('sales'), 'Total Spent', 'Utang', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      No customers found.
                    </td>
                  </tr>
                ) : customers.map((c: any, i: number) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    onClick={() => setHistoryId(c.id)}
                    className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer group"
                  >
                    {/* Name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{c.name}</p>
                          {c.purchaseCount > 0 && (
                            <p className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1 mt-0.5">
                              <ChevronRight size={10} /> View history
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail size={12} />{c.email}
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone size={12} />{c.phone}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Orders */}
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1.5 text-sm">
                        <ShoppingBag size={13} className="text-muted-foreground" />{c.purchaseCount}
                      </span>
                    </td>

                    {/* Total spent */}
                    <td className="px-5 py-4">
                      <span className="font-semibold text-emerald-500">{fmt(c.totalSpent || 0)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-semibold ${(c.currentDebt || 0) > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        {fmt(c.currentDebt || 0)}
                      </span>
                    </td>

                    {/* Joined */}
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>

                    {/* Actions — stop propagation so row click doesn't fire */}
                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2">
                        {canMutate && (
                          <button
                            onClick={() => { setEditCustomer(c); setModalOpen(true); }}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        {canMutate && (
                          <button
                            onClick={() => handleDelete(c.id, c.name)}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CustomerModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditCustomer(null); }}
        refetch={refetch}
        editCustomer={editCustomer}
      />

      {historyId && (
        <HistoryDrawer customerId={historyId} onClose={() => setHistoryId(null)} />
      )}
    </div>
  );
}
