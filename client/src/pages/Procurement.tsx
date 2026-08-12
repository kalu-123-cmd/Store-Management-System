import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, FileDown, RefreshCw, ChevronDown, ChevronUp,
  ClipboardList, FileText, Handshake, AlertTriangle, CheckCircle2,
  Clock, Send, Trash2,
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { fmt } from '../lib/currency';

// ── GraphQL ───────────────────────────────────────────────────────────────────

const GET_ALL = gql`
  query GetProcurementAll {
    procurementRequests {
      id requestNumber departmentId requiredDate priority justification
      estimatedTotal status createdAt
      items { id description quantity unitOfMeasure estimatedUnitCost estimatedTotal }
    }
    tenders {
      id tenderNumber projectName procurementCategory procurementMethod
      marketType submissionDeadline bidValidityPeriod bidSecurity
      currency contractType status description createdAt
      items { id description quantity unit }
    }
    contracts {
      id contractNumber supplierId startDate endDate contractValue
      currency paymentTerms deliveryTerms status description createdAt
      supplier { name }
      items { id description quantity unit unitPrice totalPrice }
    }
    suppliers { id name }
  }
`;

const CREATE_REQUEST = gql`
  mutation CreateProcReq(
    $departmentId: String $organizationId: String
    $items: [ProcurementRequestItemInput!]
    $justification: String $urgency: String $requiredBy: String
  ) {
    createProcurementRequest(
      departmentId: $departmentId organizationId: $organizationId
      items: $items justification: $justification
      urgency: $urgency requiredBy: $requiredBy
    ) { id requestNumber status }
  }
`;

const SUBMIT_REQUEST = gql`
  mutation SubmitRequest($id: ID!) {
    submitProcurementRequest(id: $id) { id status }
  }
`;

const APPROVE_REQUEST = gql`
  mutation ApproveRequest($id: ID!) {
    approveProcurementRequest(id: $id) { id status }
  }
`;

const CREATE_TENDER = gql`
  mutation CreateTender(
    $projectName: String! $procurementCategory: String!
    $procurementMethod: String! $marketType: String!
    $submissionDeadline: String! $bidValidityPeriod: Int!
    $bidSecurity: Float $currency: String $contractType: String!
    $description: String $procurementRefId: String
  ) {
    createTender(
      projectName: $projectName procurementCategory: $procurementCategory
      procurementMethod: $procurementMethod marketType: $marketType
      submissionDeadline: $submissionDeadline bidValidityPeriod: $bidValidityPeriod
      bidSecurity: $bidSecurity currency: $currency contractType: $contractType
      description: $description procurementRefId: $procurementRefId
    ) { id tenderNumber status }
  }
`;

const PUBLISH_TENDER = gql`
  mutation PublishTender($id: ID!) { publishTender(id: $id) { id status } }
`;

const CREATE_CONTRACT = gql`
  mutation CreateContract(
    $supplierId: String! $startDate: String! $endDate: String!
    $contractValue: Float! $currency: String $paymentTerms: String
    $deliveryTerms: String $description: String
  ) {
    createContract(
      supplierId: $supplierId startDate: $startDate endDate: $endDate
      contractValue: $contractValue currency: $currency
      paymentTerms: $paymentTerms deliveryTerms: $deliveryTerms
      description: $description
    ) { id contractNumber status }
  }
`;

const ACTIVATE_CONTRACT = gql`
  mutation ActivateContract($id: ID!) { activateContract(id: $id) { id status } }
`;

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, string> = {
  LOW:    'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  NORMAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT:                    'bg-slate-100 text-slate-600',
  SUBMITTED:                'bg-blue-100 text-blue-700',
  UNDER_REVIEW:             'bg-amber-100 text-amber-700',
  APPROVED:                 'bg-green-100 text-green-700',
  REJECTED:                 'bg-red-100 text-red-700',
  PROCUREMENT_IN_PROGRESS:  'bg-purple-100 text-purple-700',
  COMPLETED:                'bg-emerald-100 text-emerald-700',
  CANCELLED:                'bg-red-100 text-red-600',
  PUBLISHED:                'bg-green-100 text-green-700',
  OPEN:                     'bg-sky-100 text-sky-700',
  CLOSED:                   'bg-slate-100 text-slate-600',
  EVALUATION:               'bg-amber-100 text-amber-700',
  AWARDED:                  'bg-emerald-100 text-emerald-700',
  ACTIVE:                   'bg-green-100 text-green-700',
  EXPIRED:                  'bg-slate-100 text-slate-500',
  TERMINATED:               'bg-red-100 text-red-700',
};

const ic = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none';
const lbl = 'block text-sm font-medium text-foreground mb-1';

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, subtitle, children }: any) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="p-5 space-y-4">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── New Request Modal ─────────────────────────────────────────────────────────
function NewRequestModal({ open, onClose, refetch }: any) {
  const { toast } = useToast();
  const [justification, setJustification] = useState('');
  const [requiredBy, setRequiredBy]       = useState('');
  const [urgency, setUrgency]             = useState('NORMAL');
  const [lines, setLines]                 = useState([{ description: '', quantity: 1, unitOfMeasure: 'PCS', estimatedUnitCost: 0 }]);
  const [createRequest, { loading }]      = useMutation(CREATE_REQUEST);

  const addLine = () => setLines(l => [...l, { description: '', quantity: 1, unitOfMeasure: 'PCS', estimatedUnitCost: 0 }]);
  const removeLine = (i: number) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: string, val: any) =>
    setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [field]: val } : ln));

  const total = lines.reduce((s, l) => s + l.quantity * l.estimatedUnitCost, 0);

  const handleSubmit = async () => {
    if (!requiredBy) { toast({ type: 'error', title: 'Missing field', message: 'Required by date is needed' }); return; }
    if (lines.some(l => !l.description)) { toast({ type: 'error', title: 'Missing field', message: 'All items need a description' }); return; }
    try {
      const res = await createRequest({
        variables: {
          justification, urgency, requiredBy,
          items: lines.map(l => ({ ...l, estimatedUnitCost: Number(l.estimatedUnitCost), quantity: Number(l.quantity) })),
        },
      });
      toast({ type: 'success', title: 'Request created', message: res.data.createProcurementRequest.requestNumber });
      refetch(); onClose();
      setJustification(''); setRequiredBy(''); setUrgency('NORMAL');
      setLines([{ description: '', quantity: 1, unitOfMeasure: 'PCS', estimatedUnitCost: 0 }]);
    } catch (e: any) { toast({ type: 'error', title: 'Failed', message: e.message }); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Procurement Request" subtitle="Create a new purchase request for approval">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Required By *</label>
          <input type="date" value={requiredBy} onChange={e => setRequiredBy(e.target.value)} className={ic} />
        </div>
        <div>
          <label className={lbl}>Priority</label>
          <select value={urgency} onChange={e => setUrgency(e.target.value)} className={ic}>
            {['LOW','NORMAL','HIGH','URGENT'].map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={lbl}>Justification</label>
        <textarea value={justification} onChange={e => setJustification(e.target.value)}
          rows={2} placeholder="Why is this purchase needed?" className={ic} />
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={lbl + ' mb-0'}>Items *</label>
          <button onClick={addLine} className="text-xs text-primary hover:underline flex items-center gap-1">
            <Plus size={13} /> Add item
          </button>
        </div>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center bg-muted/20 rounded-lg p-2">
              <input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)}
                placeholder="Description" className={ic + ' col-span-4'} />
              <input type="number" min={1} value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)}
                className={ic + ' col-span-2'} placeholder="Qty" />
              <input value={line.unitOfMeasure} onChange={e => updateLine(i, 'unitOfMeasure', e.target.value)}
                placeholder="Unit" className={ic + ' col-span-2'} />
              <input type="number" min={0} step="0.01" value={line.estimatedUnitCost}
                onChange={e => updateLine(i, 'estimatedUnitCost', e.target.value)}
                placeholder="Unit cost" className={ic + ' col-span-3'} />
              <button onClick={() => removeLine(i)} disabled={lines.length === 1}
                className="col-span-1 text-muted-foreground hover:text-destructive disabled:opacity-30">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-right text-muted-foreground mt-2">
          Estimated Total: <span className="font-semibold text-foreground">{fmt(total)}</span>
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
        <button onClick={handleSubmit} disabled={loading}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
          Create Request
        </button>
      </div>
    </Modal>
  );
}

// ── New Tender Modal ──────────────────────────────────────────────────────────
function NewTenderModal({ open, onClose, refetch }: any) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    projectName: '', procurementCategory: '', procurementMethod: 'OPEN',
    marketType: 'NATIONAL', submissionDeadline: '', bidValidityPeriod: 30,
    bidSecurity: '', currency: 'ETB', contractType: 'SUPPLY', description: '',
  });
  const [createTender, { loading }] = useMutation(CREATE_TENDER);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.projectName || !form.submissionDeadline) {
      toast({ type: 'error', title: 'Missing fields', message: 'Project name and deadline are required' }); return;
    }
    try {
      const res = await createTender({
        variables: {
          ...form,
          bidValidityPeriod: Number(form.bidValidityPeriod),
          bidSecurity: form.bidSecurity ? Number(form.bidSecurity) : null,
        },
      });
      toast({ type: 'success', title: 'Tender created', message: res.data.createTender.tenderNumber });
      refetch(); onClose();
      setForm({ projectName: '', procurementCategory: '', procurementMethod: 'OPEN', marketType: 'NATIONAL', submissionDeadline: '', bidValidityPeriod: 30, bidSecurity: '', currency: 'ETB', contractType: 'SUPPLY', description: '' });
    } catch (e: any) { toast({ type: 'error', title: 'Failed', message: e.message }); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Tender" subtitle="Create a new tender for supplier bidding">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={lbl}>Project Name *</label>
          <input value={form.projectName} onChange={e => set('projectName', e.target.value)} placeholder="e.g. Office Equipment Supply 2026" className={ic} />
        </div>
        <div>
          <label className={lbl}>Category</label>
          <input value={form.procurementCategory} onChange={e => set('procurementCategory', e.target.value)} placeholder="e.g. Electronics, Furniture" className={ic} />
        </div>
        <div>
          <label className={lbl}>Contract Type *</label>
          <select value={form.contractType} onChange={e => set('contractType', e.target.value)} className={ic}>
            {['SUPPLY','WORKS','SERVICES','CONSULTANCY'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Method</label>
          <select value={form.procurementMethod} onChange={e => set('procurementMethod', e.target.value)} className={ic}>
            {['OPEN','RESTRICTED','DIRECT','EMERGENCY'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Market</label>
          <select value={form.marketType} onChange={e => set('marketType', e.target.value)} className={ic}>
            <option value="NATIONAL">NATIONAL</option>
            <option value="INTERNATIONAL">INTERNATIONAL</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Submission Deadline *</label>
          <input type="date" value={form.submissionDeadline} onChange={e => set('submissionDeadline', e.target.value)} className={ic} />
        </div>
        <div>
          <label className={lbl}>Bid Validity (days)</label>
          <input type="number" min={1} value={form.bidValidityPeriod} onChange={e => set('bidValidityPeriod', e.target.value)} className={ic} />
        </div>
        <div>
          <label className={lbl}>Bid Security (ETB)</label>
          <input type="number" min={0} value={form.bidSecurity} onChange={e => set('bidSecurity', e.target.value)} placeholder="Optional" className={ic} />
        </div>
        <div>
          <label className={lbl}>Currency</label>
          <select value={form.currency} onChange={e => set('currency', e.target.value)} className={ic}>
            {['ETB','USD','EUR'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className={lbl}>Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className={ic} placeholder="Scope and details..." />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
        <button onClick={handleSubmit} disabled={loading}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
          Create Tender
        </button>
      </div>
    </Modal>
  );
}

// ── New Contract Modal ────────────────────────────────────────────────────────
function NewContractModal({ open, onClose, refetch, suppliers }: any) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    supplierId: '', startDate: '', endDate: '', contractValue: '',
    currency: 'ETB', paymentTerms: '', deliveryTerms: '', description: '',
  });
  const [createContract, { loading }] = useMutation(CREATE_CONTRACT);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.supplierId || !form.startDate || !form.endDate || !form.contractValue) {
      toast({ type: 'error', title: 'Missing fields', message: 'Supplier, dates and value are required' }); return;
    }
    try {
      const res = await createContract({ variables: { ...form, contractValue: Number(form.contractValue) } });
      toast({ type: 'success', title: 'Contract created', message: res.data.createContract.contractNumber });
      refetch(); onClose();
      setForm({ supplierId: '', startDate: '', endDate: '', contractValue: '', currency: 'ETB', paymentTerms: '', deliveryTerms: '', description: '' });
    } catch (e: any) { toast({ type: 'error', title: 'Failed', message: e.message }); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Contract" subtitle="Create a supplier contract">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={lbl}>Supplier *</label>
          <select value={form.supplierId} onChange={e => set('supplierId', e.target.value)} className={ic}>
            <option value="">Select supplier…</option>
            {(suppliers || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Start Date *</label>
          <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={ic} />
        </div>
        <div>
          <label className={lbl}>End Date *</label>
          <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className={ic} />
        </div>
        <div>
          <label className={lbl}>Contract Value (ETB) *</label>
          <input type="number" min={0} value={form.contractValue} onChange={e => set('contractValue', e.target.value)} className={ic} />
        </div>
        <div>
          <label className={lbl}>Currency</label>
          <select value={form.currency} onChange={e => set('currency', e.target.value)} className={ic}>
            {['ETB','USD','EUR'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Payment Terms</label>
          <input value={form.paymentTerms} onChange={e => set('paymentTerms', e.target.value)} placeholder="e.g. Net 30" className={ic} />
        </div>
        <div>
          <label className={lbl}>Delivery Terms</label>
          <input value={form.deliveryTerms} onChange={e => set('deliveryTerms', e.target.value)} placeholder="e.g. FOB Addis" className={ic} />
        </div>
        <div className="col-span-2">
          <label className={lbl}>Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className={ic} placeholder="Contract scope..." />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
        <button onClick={handleSubmit} disabled={loading}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
          Create Contract
        </button>
      </div>
    </Modal>
  );
}

// ── Requests Tab ──────────────────────────────────────────────────────────────
function RequestsTab({ requests, loading, refetch }: any) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submitRequest] = useMutation(SUBMIT_REQUEST);
  const [approveRequest] = useMutation(APPROVE_REQUEST);

  const handleSubmit = async (id: string, num: string) => {
    try {
      await submitRequest({ variables: { id } });
      toast({ type: 'success', title: 'Submitted', message: `${num} sent for review` });
      refetch();
    } catch (e: any) { toast({ type: 'error', title: 'Failed', message: e.message }); }
  };

  const handleApprove = async (id: string, num: string) => {
    try {
      await approveRequest({ variables: { id } });
      toast({ type: 'success', title: 'Approved', message: `${num} approved` });
      refetch();
    } catch (e: any) { toast({ type: 'error', title: 'Failed', message: e.message }); }
  };

  if (loading) return <Spinner />;
  if (!requests?.length) return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <ClipboardList size={40} className="mb-3 opacity-30" />
      <p className="text-sm">No procurement requests yet.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {requests.map((req: any) => (
        <div key={req.id} className="bg-card border border-border rounded-xl overflow-hidden">
          <div
            className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors"
            onClick={() => setExpanded(e => e === req.id ? null : req.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-sm font-semibold text-primary">{req.requestNumber}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_STYLES[req.priority] || PRIORITY_STYLES.NORMAL}`}>{req.priority}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[req.status] || 'bg-slate-100 text-slate-600'}`}>{req.status}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">{req.justification || 'No justification provided'}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-foreground">{fmt(req.estimatedTotal)}</p>
              <p className="text-xs text-muted-foreground">{req.items.length} items · Due {req.requiredDate ? new Date(req.requiredDate).toLocaleDateString() : '—'}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
              {req.status === 'DRAFT' && (
                <button onClick={() => handleSubmit(req.id, req.requestNumber)}
                  className="px-3 py-1.5 bg-sky-500 text-white rounded-lg text-xs font-medium hover:bg-sky-600 transition-colors flex items-center gap-1.5" title="Submit for review">
                  <Send size={12} /> Submit
                </button>
              )}
              {req.status === 'SUBMITTED' && (
                <button onClick={() => handleApprove(req.id, req.requestNumber)}
                  className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors flex items-center gap-1.5" title="Approve">
                  <CheckCircle2 size={12} /> Approve
                </button>
              )}
              {req.status === 'APPROVED' && (
                <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> Approved
                </span>
              )}
            </div>
            <motion.span animate={{ rotate: expanded === req.id ? 180 : 0 }} transition={{ duration: 0.15 }}>
              <ChevronDown size={15} className="text-muted-foreground" />
            </motion.span>
          </div>

          <AnimatePresence initial={false}>
            {expanded === req.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-border bg-muted/10">
                <div className="px-5 py-4">
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-muted-foreground uppercase">
                      <th className="text-left pb-2">Description</th>
                      <th className="text-center pb-2">Qty</th>
                      <th className="text-center pb-2">Unit</th>
                      <th className="text-right pb-2">Unit Cost</th>
                      <th className="text-right pb-2">Total</th>
                    </tr></thead>
                    <tbody>
                      {req.items.map((item: any) => (
                        <tr key={item.id} className="border-t border-border/40 hover:bg-muted/20 cursor-pointer transition-colors">
                          <td className="py-2 text-foreground">{item.description}</td>
                          <td className="py-2 text-center">{item.quantity}</td>
                          <td className="py-2 text-center text-muted-foreground">{item.unitOfMeasure}</td>
                          <td className="py-2 text-right text-muted-foreground">{fmt(item.estimatedUnitCost)}</td>
                          <td className="py-2 text-right font-semibold">{fmt(item.estimatedTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-right text-muted-foreground mt-2">
                    Created: {new Date(req.createdAt).toLocaleString()}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// ── Tenders Tab ───────────────────────────────────────────────────────────────
function TendersTab({ tenders, loading, refetch }: any) {
  const { toast } = useToast();
  const [publishTender] = useMutation(PUBLISH_TENDER);

  const handlePublish = async (id: string, num: string) => {
    try {
      await publishTender({ variables: { id } });
      toast({ type: 'success', title: 'Published', message: `${num} is now open for bids` });
      refetch();
    } catch (e: any) { toast({ type: 'error', title: 'Failed', message: e.message }); }
  };

  if (loading) return <Spinner />;
  if (!tenders?.length) return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <FileText size={40} className="mb-3 opacity-30" />
      <p className="text-sm">No tenders yet.</p>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
            <tr>
              {['Tender #','Project','Category','Method','Market','Deadline','Validity','Status','Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenders.map((t: any) => (
              <tr key={t.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{t.tenderNumber}</td>
                <td className="px-4 py-3 font-medium text-foreground max-w-[160px] truncate">{t.projectName}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.procurementCategory}</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-muted rounded text-xs">{t.procurementMethod}</span></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{t.marketType}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(t.submissionDeadline).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{t.bidValidityPeriod}d</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[t.status] || 'bg-slate-100 text-slate-600'}`}>{t.status}</span>
                </td>
                <td className="px-4 py-3">
                  {t.status === 'DRAFT' && (
                    <button onClick={() => handlePublish(t.id, t.tenderNumber)}
                      className="p-1.5 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Publish">
                      <Send size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Contracts Tab ─────────────────────────────────────────────────────────────
function ContractsTab({ contracts, loading, refetch }: any) {
  const { toast } = useToast();
  const [activateContract] = useMutation(ACTIVATE_CONTRACT);

  const handleActivate = async (id: string, num: string) => {
    try {
      await activateContract({ variables: { id } });
      toast({ type: 'success', title: 'Activated', message: `${num} is now active` });
      refetch();
    } catch (e: any) { toast({ type: 'error', title: 'Failed', message: e.message }); }
  };

  if (loading) return <Spinner />;
  if (!contracts?.length) return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Handshake size={40} className="mb-3 opacity-30" />
      <p className="text-sm">No contracts yet.</p>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
            <tr>
              {['Contract #','Supplier','Value','Currency','Start','End','Payment','Status','Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contracts.map((c: any) => (
              <tr key={c.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{c.contractNumber}</td>
                <td className="px-4 py-3 font-medium text-foreground">{c.supplier?.name || c.supplierId}</td>
                <td className="px-4 py-3 font-semibold">{fmt(c.contractValue)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{c.currency}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(c.startDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(c.endDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{c.paymentTerms || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[c.status] || 'bg-slate-100 text-slate-600'}`}>{c.status}</span>
                </td>
                <td className="px-4 py-3">
                  {c.status === 'DRAFT' && (
                    <button onClick={() => handleActivate(c.id, c.contractNumber)}
                      className="p-1.5 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Activate">
                      <CheckCircle2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
type Tab = 'requests' | 'tenders' | 'contracts';

export default function Procurement() {
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [newRequestOpen, setNewRequestOpen]   = useState(false);
  const [newTenderOpen, setNewTenderOpen]     = useState(false);
  const [newContractOpen, setNewContractOpen] = useState(false);

  const { data, loading, refetch } = useQuery(GET_ALL, {
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });

  const requests  = data?.procurementRequests || [];
  const tenders   = data?.tenders             || [];
  const contracts = data?.contracts           || [];
  const suppliers = data?.suppliers           || [];

  // KPIs
  const pendingReqs   = requests.filter((r: any)  => ['DRAFT','SUBMITTED','UNDER_REVIEW'].includes(r.status)).length;
  const activeTenders = tenders.filter((t: any)   => ['PUBLISHED','OPEN','EVALUATION'].includes(t.status)).length;
  const activeContracts = contracts.filter((c: any) => c.status === 'ACTIVE').length;
  const totalContractValue = contracts
    .filter((c: any) => c.status === 'ACTIVE')
    .reduce((s: number, c: any) => s + c.contractValue, 0);

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'requests',  label: 'Requests',  icon: <ClipboardList size={15} />, count: requests.length  },
    { key: 'tenders',   label: 'Tenders',   icon: <FileText size={15} />,      count: tenders.length   },
    { key: 'contracts', label: 'Contracts', icon: <Handshake size={15} />,     count: contracts.length },
  ];

  const handleNew = () => {
    if (activeTab === 'requests')  setNewRequestOpen(true);
    if (activeTab === 'tenders')   setNewTenderOpen(true);
    if (activeTab === 'contracts') setNewContractOpen(true);
  };

  const newLabels: Record<Tab, string> = {
    requests:  'New Request',
    tenders:   'New Tender',
    contracts: 'New Contract',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Procurement Management</h2>
          <p className="text-sm text-muted-foreground">
            {requests.length} requests · {tenders.length} tenders · {contracts.length} contracts
          </p>
        </div>
        <button
          onClick={handleNew}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
        >
          <Plus size={16} /> {newLabels[activeTab]}
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending Requests',    value: pendingReqs,                   color: 'text-amber-600'   },
          { label: 'Active Tenders',      value: activeTenders,                 color: 'text-sky-600'     },
          { label: 'Active Contracts',    value: activeContracts,               color: 'text-emerald-600' },
          { label: 'Contract Value',      value: fmt(totalContractValue),       color: 'text-primary'     },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon} {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  activeTab === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'requests'  && <RequestsTab  requests={requests}   loading={loading} refetch={refetch} />}
      {activeTab === 'tenders'   && <TendersTab   tenders={tenders}     loading={loading} refetch={refetch} />}
      {activeTab === 'contracts' && <ContractsTab contracts={contracts} loading={loading} refetch={refetch} suppliers={suppliers} />}

      {/* Modals */}
      <NewRequestModal  open={newRequestOpen}  onClose={() => setNewRequestOpen(false)}  refetch={refetch} />
      <NewTenderModal   open={newTenderOpen}   onClose={() => setNewTenderOpen(false)}   refetch={refetch} />
      <NewContractModal open={newContractOpen} onClose={() => setNewContractOpen(false)} refetch={refetch} suppliers={suppliers} />
    </div>
  );
}
