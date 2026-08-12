import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Building2, Layers, Warehouse as WarehouseIcon,
  RefreshCw, Pencil, Trash2, MapPin, Phone, Mail,
  User, Package, CheckCircle, XCircle,
} from 'lucide-react';
import { useToast } from '../components/Toast';

// ── GraphQL ───────────────────────────────────────────────────────────────────

const GET_ALL = gql`
  query GetOrgAll {
    organizations {
      id name code type description address phone email website isActive createdAt
      units { id name code type isActive }
    }
    organizationUnits {
      id name code type organizationId headOfUnit address phone isActive createdAt
      organization { id name }
    }
    departments {
      id name code organizationUnitId headOfDepartment budgetCode description isActive createdAt
      organizationUnit { id name organization { name } }
    }
    warehouses {
      id name code type organizationUnitId address phone manager capacity isActive createdAt
      organizationUnit { id name organization { name } }
    }
  }
`;

const CREATE_ORG = gql`
  mutation CreateOrg($name:String!$code:String!$type:String!$description:String$address:String$phone:String$email:String$website:String){
    createOrganization(name:$name code:$code type:$type description:$description address:$address phone:$phone email:$email website:$website){ id name }
  }`;

const UPDATE_ORG = gql`
  mutation UpdateOrg($id:ID!$name:String$code:String$type:String$description:String$address:String$phone:String$email:String$website:String$isActive:Boolean){
    updateOrganization(id:$id name:$name code:$code type:$type description:$description address:$address phone:$phone email:$email website:$website isActive:$isActive){ id name }
  }`;

const DELETE_ORG = gql`mutation DeleteOrg($id:ID!){ deleteOrganization(id:$id) }`;

const CREATE_DEPT = gql`
  mutation CreateDept($name:String!$code:String!$organizationUnitId:String$headOfDepartment:String$budgetCode:String$description:String){
    createDepartment(name:$name code:$code organizationUnitId:$organizationUnitId headOfDepartment:$headOfDepartment budgetCode:$budgetCode description:$description){ id name }
  }`;

const UPDATE_DEPT = gql`
  mutation UpdateDept($id:ID!$name:String$code:String$organizationUnitId:String$headOfDepartment:String$budgetCode:String$description:String$isActive:Boolean){
    updateDepartment(id:$id name:$name code:$code organizationUnitId:$organizationUnitId headOfDepartment:$headOfDepartment budgetCode:$budgetCode description:$description isActive:$isActive){ id name }
  }`;

const DELETE_DEPT = gql`mutation DeleteDept($id:ID!){ deleteDepartment(id:$id) }`;

const CREATE_WH = gql`
  mutation CreateWH($name:String!$code:String!$type:String!$organizationUnitId:String$address:String$phone:String$manager:String$capacity:Float){
    createWarehouse(name:$name code:$code type:$type organizationUnitId:$organizationUnitId address:$address phone:$phone manager:$manager capacity:$capacity){ id name }
  }`;

const UPDATE_WH = gql`
  mutation UpdateWH($id:ID!$name:String$code:String$type:String$organizationUnitId:String$address:String$phone:String$manager:String$capacity:Float$isActive:Boolean){
    updateWarehouse(id:$id name:$name code:$code type:$type organizationUnitId:$organizationUnitId address:$address phone:$phone manager:$manager capacity:$capacity isActive:$isActive){ id name }
  }`;

const DELETE_WH = gql`mutation DeleteWH($id:ID!){ deleteWarehouse(id:$id) }`;

// ── Helpers ───────────────────────────────────────────────────────────────────

const ic = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none';
const lbl = 'block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide';

const ORG_TYPES   = ['MINISTRY','AGENCY','NGO','UNIVERSITY','HOSPITAL','COMPANY','OTHER'];
const UNIT_TYPES  = ['REGION','ZONE','DISTRICT','DEPARTMENT','WAREHOUSE'];
const WH_TYPES    = ['CENTRAL','REGIONAL','DEPARTMENTAL'];

function Badge({ active }: { active: boolean }) {
  return active
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle size={10}/>Active</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"><XCircle size={10}/>Inactive</span>;
}

function Spinner() {
  return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin"/></div>;
}

function Empty({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <div className="opacity-20 mb-3">{icon}</div>
      <p className="text-sm">{label}</p>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: any) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}>
        <motion.div initial={{ scale:0.95,opacity:0 }} animate={{ scale:1,opacity:1 }} exit={{ scale:0.95,opacity:0 }}
          onClick={e=>e.stopPropagation()}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18}/></button>
          </div>
          <div className="p-5 space-y-4">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ModalActions({ onCancel, onSave, loading, saveLabel = 'Save' }: any) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onCancel} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
      <button onClick={onSave} disabled={loading}
        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
        {loading ? <RefreshCw size={13} className="animate-spin"/> : <Plus size={13}/>}
        {saveLabel}
      </button>
    </div>
  );
}

// ── Organization Modal ────────────────────────────────────────────────────────
function OrgModal({ open, onClose, refetch, editing }: any) {
  const { toast } = useToast();
  const blank = { name:'', code:'', type:'COMPANY', description:'', address:'', phone:'', email:'', website:'' };
  const [f, setF] = useState(blank);
  const [createOrg, { loading: cLoad }] = useMutation(CREATE_ORG);
  const [updateOrg, { loading: uLoad }] = useMutation(UPDATE_ORG);

  React.useEffect(() => {
    if (editing) setF({ name:editing.name, code:editing.code, type:editing.type,
      description:editing.description||'', address:editing.address||'',
      phone:editing.phone||'', email:editing.email||'', website:editing.website||'' });
    else setF(blank);
  }, [editing, open]);

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!f.name || !f.code) { toast({ type:'error', title:'Missing', message:'Name and code are required' }); return; }
    try {
      if (editing) {
        await updateOrg({ variables: { id: editing.id, ...f } });
        toast({ type:'success', title:'Updated', message: f.name });
      } else {
        await createOrg({ variables: f });
        toast({ type:'success', title:'Organization created', message: f.name });
      }
      refetch(); onClose();
    } catch (e: any) { toast({ type:'error', title:'Failed', message: e.message }); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Organization' : 'New Organization'}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={lbl}>Name *</label><input value={f.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. StoreOS Ethiopia" className={ic}/></div>
        <div><label className={lbl}>Code *</label><input value={f.code} onChange={e=>set('code',e.target.value.toUpperCase())} placeholder="e.g. STORE-ETH" className={ic}/></div>
        <div><label className={lbl}>Type</label>
          <select value={f.type} onChange={e=>set('type',e.target.value)} className={ic}>
            {ORG_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="col-span-2"><label className={lbl}>Description</label><textarea value={f.description} onChange={e=>set('description',e.target.value)} rows={2} className={ic} placeholder="Short description..."/></div>
        <div><label className={lbl}>Address</label><input value={f.address} onChange={e=>set('address',e.target.value)} placeholder="Addis Ababa" className={ic}/></div>
        <div><label className={lbl}>Phone</label><input value={f.phone} onChange={e=>set('phone',e.target.value)} placeholder="+251-911-..." className={ic}/></div>
        <div><label className={lbl}>Email</label><input value={f.email} onChange={e=>set('email',e.target.value)} placeholder="org@example.com" className={ic}/></div>
        <div><label className={lbl}>Website</label><input value={f.website} onChange={e=>set('website',e.target.value)} placeholder="https://..." className={ic}/></div>
      </div>
      <ModalActions onCancel={onClose} onSave={handleSave} loading={cLoad||uLoad} saveLabel={editing?'Update':'Create'} />
    </Modal>
  );
}

// ── Department Modal ──────────────────────────────────────────────────────────
function DeptModal({ open, onClose, refetch, editing, units }: any) {
  const { toast } = useToast();
  const blank = { name:'', code:'', organizationUnitId:'', headOfDepartment:'', budgetCode:'', description:'' };
  const [f, setF] = useState(blank);
  const [createDept, { loading: cLoad }] = useMutation(CREATE_DEPT);
  const [updateDept, { loading: uLoad }] = useMutation(UPDATE_DEPT);

  React.useEffect(() => {
    if (editing) setF({ name:editing.name, code:editing.code,
      organizationUnitId:editing.organizationUnitId||'',
      headOfDepartment:editing.headOfDepartment||'',
      budgetCode:editing.budgetCode||'', description:editing.description||'' });
    else setF(blank);
  }, [editing, open]);

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!f.name || !f.code) { toast({ type:'error', title:'Missing', message:'Name and code are required' }); return; }
    try {
      const vars = { ...f, organizationUnitId: f.organizationUnitId || null };
      if (editing) { await updateDept({ variables: { id:editing.id, ...vars } }); toast({ type:'success', title:'Updated', message:f.name }); }
      else { await createDept({ variables: vars }); toast({ type:'success', title:'Department created', message:f.name }); }
      refetch(); onClose();
    } catch (e: any) { toast({ type:'error', title:'Failed', message:e.message }); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing?'Edit Department':'New Department'}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={lbl}>Name *</label><input value={f.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Finance Department" className={ic}/></div>
        <div><label className={lbl}>Code *</label><input value={f.code} onChange={e=>set('code',e.target.value.toUpperCase())} placeholder="FIN-001" className={ic}/></div>
        <div><label className={lbl}>Organization Unit</label>
          <select value={f.organizationUnitId} onChange={e=>set('organizationUnitId',e.target.value)} className={ic}>
            <option value="">— None —</option>
            {(units||[]).map((u:any)=><option key={u.id} value={u.id}>{u.name} ({u.organization?.name})</option>)}
          </select>
        </div>
        <div><label className={lbl}>Head of Department</label><input value={f.headOfDepartment} onChange={e=>set('headOfDepartment',e.target.value)} placeholder="Name of head" className={ic}/></div>
        <div><label className={lbl}>Budget Code</label><input value={f.budgetCode} onChange={e=>set('budgetCode',e.target.value)} placeholder="e.g. BUD-2026-001" className={ic}/></div>
        <div className="col-span-2"><label className={lbl}>Description</label><textarea value={f.description} onChange={e=>set('description',e.target.value)} rows={2} className={ic}/></div>
      </div>
      <ModalActions onCancel={onClose} onSave={handleSave} loading={cLoad||uLoad} saveLabel={editing?'Update':'Create'} />
    </Modal>
  );
}

// ── Warehouse Modal ───────────────────────────────────────────────────────────
function WHModal({ open, onClose, refetch, editing, units }: any) {
  const { toast } = useToast();
  const blank = { name:'', code:'', type:'CENTRAL', organizationUnitId:'', address:'', phone:'', manager:'', capacity:'' };
  const [f, setF] = useState(blank);
  const [createWH, { loading: cLoad }] = useMutation(CREATE_WH);
  const [updateWH, { loading: uLoad }] = useMutation(UPDATE_WH);

  React.useEffect(() => {
    if (editing) setF({ name:editing.name, code:editing.code, type:editing.type,
      organizationUnitId:editing.organizationUnitId||'',
      address:editing.address||'', phone:editing.phone||'',
      manager:editing.manager||'', capacity:editing.capacity?.toString()||'' });
    else setF(blank);
  }, [editing, open]);

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!f.name || !f.code) { toast({ type:'error', title:'Missing', message:'Name and code are required' }); return; }
    try {
      const vars = { ...f, organizationUnitId:f.organizationUnitId||null, capacity:f.capacity?Number(f.capacity):null };
      if (editing) { await updateWH({ variables:{id:editing.id,...vars} }); toast({ type:'success', title:'Updated', message:f.name }); }
      else { await createWH({ variables:vars }); toast({ type:'success', title:'Warehouse created', message:f.name }); }
      refetch(); onClose();
    } catch (e: any) { toast({ type:'error', title:'Failed', message:e.message }); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing?'Edit Warehouse':'New Warehouse'}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={lbl}>Name *</label><input value={f.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Central Warehouse Addis" className={ic}/></div>
        <div><label className={lbl}>Code *</label><input value={f.code} onChange={e=>set('code',e.target.value.toUpperCase())} placeholder="WH-ADD-001" className={ic}/></div>
        <div><label className={lbl}>Type</label>
          <select value={f.type} onChange={e=>set('type',e.target.value)} className={ic}>
            {WH_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="col-span-2"><label className={lbl}>Organization Unit</label>
          <select value={f.organizationUnitId} onChange={e=>set('organizationUnitId',e.target.value)} className={ic}>
            <option value="">— None —</option>
            {(units||[]).map((u:any)=><option key={u.id} value={u.id}>{u.name} ({u.organization?.name})</option>)}
          </select>
        </div>
        <div><label className={lbl}>Address</label><input value={f.address} onChange={e=>set('address',e.target.value)} placeholder="Bole, Addis Ababa" className={ic}/></div>
        <div><label className={lbl}>Phone</label><input value={f.phone} onChange={e=>set('phone',e.target.value)} placeholder="+251-..." className={ic}/></div>
        <div><label className={lbl}>Manager</label><input value={f.manager} onChange={e=>set('manager',e.target.value)} placeholder="Manager name" className={ic}/></div>
        <div><label className={lbl}>Capacity (m²)</label><input type="number" min={0} value={f.capacity} onChange={e=>set('capacity',e.target.value)} placeholder="e.g. 500" className={ic}/></div>
      </div>
      <ModalActions onCancel={onClose} onSave={handleSave} loading={cLoad||uLoad} saveLabel={editing?'Update':'Create'} />
    </Modal>
  );
}

// ── Organizations Tab ─────────────────────────────────────────────────────────
function OrgsTab({ orgs, refetch, onNew }: any) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<any>(null);
  const [deleteOrg] = useMutation(DELETE_ORG);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try { await deleteOrg({ variables: { id } }); toast({ type:'success', title:'Deleted', message:name }); refetch(); }
    catch (e:any) { toast({ type:'error', title:'Failed', message:e.message }); }
  };

  if (!orgs?.length) return <Empty icon={<Building2 size={48}/>} label="No organizations yet. Click 'New Organization' to add one."/>;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {orgs.map((org: any) => (
          <motion.div key={org.id} initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }}
            className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 size={20} className="text-primary"/>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={()=>setEditing(org)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"><Pencil size={13}/></button>
                <button onClick={()=>handleDelete(org.id,org.name)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 size={13}/></button>
              </div>
            </div>
            <h3 className="font-semibold text-foreground text-sm mb-1 truncate">{org.name}</h3>
            <p className="text-xs text-muted-foreground font-mono mb-2">{org.code}</p>
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">{org.type}</span>
              <Badge active={org.isActive}/>
            </div>
            {(org.address || org.phone || org.email) && (
              <div className="mt-3 pt-3 border-t border-border space-y-1">
                {org.address && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin size={10}/>{org.address}</p>}
                {org.phone   && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone   size={10}/>{org.phone}</p>}
                {org.email   && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail    size={10}/>{org.email}</p>}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">{org.units?.length || 0} units</p>
          </motion.div>
        ))}
      </div>
      <OrgModal open={!!editing} onClose={()=>setEditing(null)} refetch={refetch} editing={editing}/>
    </>
  );
}

// ── Departments Tab ───────────────────────────────────────────────────────────
function DeptsTab({ depts, units, refetch }: any) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<any>(null);
  const [deleteDept] = useMutation(DELETE_DEPT);

  const handleDelete = async (id:string, name:string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try { await deleteDept({ variables:{id} }); toast({ type:'success', title:'Deleted', message:name }); refetch(); }
    catch (e:any) { toast({ type:'error', title:'Failed', message:e.message }); }
  };

  if (!depts?.length) return <Empty icon={<Layers size={48}/>} label="No departments yet. Click 'New Department' to add one."/>;

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                {['Name','Code','Organization Unit','Organization','Head','Budget Code','Status','Actions'].map(h=>(
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {depts.map((d:any)=>(
                <tr key={d.id} className="border-b border-border hover:bg-muted/10 transition-colors group">
                  <td className="px-4 py-3 font-medium text-foreground">{d.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-primary">{d.code}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{d.organizationUnit?.name||'—'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{d.organizationUnit?.organization?.name||'—'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {d.headOfDepartment
                      ? <span className="flex items-center gap-1"><User size={11}/>{d.headOfDepartment}</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{d.budgetCode||'—'}</td>
                  <td className="px-4 py-3"><Badge active={d.isActive}/></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={()=>setEditing(d)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"><Pencil size={13}/></button>
                      <button onClick={()=>handleDelete(d.id,d.name)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <DeptModal open={!!editing} onClose={()=>setEditing(null)} refetch={refetch} editing={editing} units={units}/>
    </>
  );
}

// ── Warehouses Tab ────────────────────────────────────────────────────────────
function WHTab({ warehouses, units, refetch }: any) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<any>(null);
  const [deleteWH] = useMutation(DELETE_WH);

  const handleDelete = async (id:string, name:string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try { await deleteWH({ variables:{id} }); toast({ type:'success', title:'Deleted', message:name }); refetch(); }
    catch (e:any) { toast({ type:'error', title:'Failed', message:e.message }); }
  };

  if (!warehouses?.length) return <Empty icon={<WarehouseIcon size={48}/>} label="No warehouses yet. Click 'New Warehouse' to add one."/>;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map((wh:any)=>(
          <motion.div key={wh.id} initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }}
            className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <WarehouseIcon size={20} className="text-amber-500"/>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={()=>setEditing(wh)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"><Pencil size={13}/></button>
                <button onClick={()=>handleDelete(wh.id,wh.name)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 size={13}/></button>
              </div>
            </div>
            <h3 className="font-semibold text-foreground text-sm mb-1 truncate">{wh.name}</h3>
            <p className="text-xs text-muted-foreground font-mono mb-2">{wh.code}</p>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded text-xs">{wh.type}</span>
              <Badge active={wh.isActive}/>
            </div>
            <div className="space-y-1">
              {wh.organizationUnit && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Building2 size={10}/>{wh.organizationUnit.organization?.name} › {wh.organizationUnit.name}
                </p>
              )}
              {wh.address  && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin  size={10}/>{wh.address}</p>}
              {wh.manager  && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><User    size={10}/>{wh.manager}</p>}
              {wh.capacity && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Package size={10}/>{wh.capacity} m²</p>}
            </div>
          </motion.div>
        ))}
      </div>
      <WHModal open={!!editing} onClose={()=>setEditing(null)} refetch={refetch} editing={editing} units={units}/>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
type Tab = 'organizations' | 'departments' | 'warehouses';

export default function Organizations() {
  const [activeTab, setActiveTab] = useState<Tab>('organizations');
  const [newOrgOpen,  setNewOrgOpen]  = useState(false);
  const [newDeptOpen, setNewDeptOpen] = useState(false);
  const [newWHOpen,   setNewWHOpen]   = useState(false);

  const { data, loading, refetch } = useQuery(GET_ALL, {
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });

  const orgs       = data?.organizations       || [];
  const units      = data?.organizationUnits   || [];
  const depts      = data?.departments         || [];
  const warehouses = data?.warehouses          || [];

  const activeOrgs = orgs.filter((o:any)  => o.isActive).length;
  const activeDepts= depts.filter((d:any) => d.isActive).length;
  const activeWHs  = warehouses.filter((w:any) => w.isActive).length;

  const TABS: { key:Tab; label:string; icon:React.ReactNode; count:number }[] = [
    { key:'organizations', label:'Organizations', icon:<Building2 size={15}/>,    count:orgs.length },
    { key:'departments',   label:'Departments',   icon:<Layers size={15}/>,        count:depts.length },
    { key:'warehouses',    label:'Warehouses',    icon:<WarehouseIcon size={15}/>, count:warehouses.length },
  ];

  const handleNew = () => {
    if (activeTab === 'organizations') setNewOrgOpen(true);
    if (activeTab === 'departments')   setNewDeptOpen(true);
    if (activeTab === 'warehouses')    setNewWHOpen(true);
  };

  const newLabel: Record<Tab,string> = {
    organizations: 'New Organization',
    departments:   'New Department',
    warehouses:    'New Warehouse',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Organization Management</h2>
          <p className="text-sm text-muted-foreground">
            {orgs.length} organizations · {depts.length} departments · {warehouses.length} warehouses
          </p>
        </div>
        <button onClick={handleNew}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm">
          <Plus size={16}/> {newLabel[activeTab]}
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label:'Active Organizations', value:activeOrgs,  color:'text-primary',      icon:<Building2 size={18} className="text-primary"/> },
          { label:'Active Departments',   value:activeDepts, color:'text-violet-600',    icon:<Layers    size={18} className="text-violet-500"/> },
          { label:'Active Warehouses',    value:activeWHs,   color:'text-amber-600',     icon:<WarehouseIcon size={18} className="text-amber-500"/> },
        ].map(k=>(
          <div key={k.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">{k.icon}</div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</p>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {TABS.map(tab=>(
            <button key={tab.key} onClick={()=>setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab===tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {tab.icon} {tab.label}
              {tab.count>0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  activeTab===tab.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {loading && !data ? <Spinner/> : (
        <>
          {activeTab==='organizations' && <OrgsTab  orgs={orgs}           refetch={refetch} onNew={()=>setNewOrgOpen(true)}/>}
          {activeTab==='departments'   && <DeptsTab depts={depts}         units={units} refetch={refetch}/>}
          {activeTab==='warehouses'    && <WHTab    warehouses={warehouses} units={units} refetch={refetch}/>}
        </>
      )}

      {/* Create modals */}
      <OrgModal  open={newOrgOpen}  onClose={()=>setNewOrgOpen(false)}  refetch={refetch} editing={null}/>
      <DeptModal open={newDeptOpen} onClose={()=>setNewDeptOpen(false)} refetch={refetch} editing={null} units={units}/>
      <WHModal   open={newWHOpen}   onClose={()=>setNewWHOpen(false)}   refetch={refetch} editing={null} units={units}/>
    </div>
  );
}
