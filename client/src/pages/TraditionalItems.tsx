import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, X, Edit2, Trash2, Filter,
  ImageIcon, Upload, AlertTriangle, Package2,
  MapPin, Layers, ChevronDown, ChevronUp, FileDown,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';
import { fmt, fmtInt } from '../lib/currency';

// ── GraphQL ───────────────────────────────────────────────────────────────────

const GET_ITEMS = gql`
  query GetTraditionalItems($search: String, $category: String, $region: String) {
    traditionalItems(search: $search, category: $category, region: $region) {
      id name amharicName region material category description
      culturalNote imageUrl costPrice sellingPrice stock
      minStockLevel status profitMargin createdAt
    }
  }
`;
const CREATE_ITEM = gql`
  mutation CreateTraditionalItem(
    $name:String! $amharicName:String $region:String! $material:String
    $category:String! $description:String $culturalNote:String $imageUrl:String
    $costPrice:Float! $sellingPrice:Float! $stock:Int $minStockLevel:Int $status:String
  ) {
    createTraditionalItem(
      name:$name amharicName:$amharicName region:$region material:$material
      category:$category description:$description culturalNote:$culturalNote
      imageUrl:$imageUrl costPrice:$costPrice sellingPrice:$sellingPrice
      stock:$stock minStockLevel:$minStockLevel status:$status
    ) { id name stock status }
  }
`;
const UPDATE_ITEM = gql`
  mutation UpdateTraditionalItem(
    $id:ID! $name:String $amharicName:String $region:String $material:String
    $category:String $description:String $culturalNote:String $imageUrl:String
    $costPrice:Float $sellingPrice:Float $minStockLevel:Int $status:String
  ) {
    updateTraditionalItem(
      id:$id name:$name amharicName:$amharicName region:$region material:$material
      category:$category description:$description culturalNote:$culturalNote
      imageUrl:$imageUrl costPrice:$costPrice sellingPrice:$sellingPrice
      minStockLevel:$minStockLevel status:$status
    ) { id name stock status }
  }
`;
const DELETE_ITEM  = gql`mutation DeleteTraditionalItem($id:ID!) { deleteTraditionalItem(id:$id) }`;
const ADJUST_STOCK = gql`
  mutation AdjustTraditionalStock($id:ID!, $quantity:Int!, $type:String!, $notes:String) {
    adjustTraditionalStock(id:$id, quantity:$quantity, type:$type, notes:$notes) { id stock }
  }
`;

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Clothing & Textiles', 'Pottery & Ceramics', 'Jewelry & Accessories',
  'Musical Instruments', 'Coffee Ceremony', 'Baskets & Weaving',
  'Wooden Crafts', 'Leather Goods', 'Religious Items', 'Spices & Food',
];

const REGIONS = [
  'Amhara', 'Tigray', 'Oromia', 'SNNPR', 'Afar',
  'Somali', 'Harari', 'Dire Dawa', 'Addis Ababa', 'Nationwide',
];

const CATEGORY_COLORS: Record<string, string> = {
  'Clothing & Textiles':   'bg-violet-500/10 text-violet-600',
  'Pottery & Ceramics':    'bg-amber-500/10 text-amber-700',
  'Jewelry & Accessories': 'bg-yellow-500/10 text-yellow-700',
  'Musical Instruments':   'bg-sky-500/10 text-sky-700',
  'Coffee Ceremony':       'bg-orange-500/10 text-orange-700',
  'Baskets & Weaving':     'bg-lime-500/10 text-lime-700',
  'Wooden Crafts':         'bg-brown-500/10 text-amber-800',
  'Leather Goods':         'bg-rose-500/10 text-rose-700',
  'Religious Items':       'bg-indigo-500/10 text-indigo-700',
  'Spices & Food':         'bg-green-500/10 text-green-700',
};

const schema = z.object({
  name:          z.string().min(2),
  amharicName:   z.string().optional(),
  region:        z.string().min(1, 'Select a region'),
  material:      z.string().optional(),
  category:      z.string().min(1, 'Select a category'),
  description:   z.string().optional(),
  culturalNote:  z.string().optional(),
  imageUrl:      z.string().optional(),
  costPrice:     z.number({ invalid_type_error: 'Required' }).min(0),
  sellingPrice:  z.number({ invalid_type_error: 'Required' }).positive(),
  stock:         z.number().int().min(0).optional(),
  minStockLevel: z.number().int().min(0),
  status:        z.string().optional(),
});
type ItemForm = z.infer<typeof schema>;

// ── Item Modal ────────────────────────────────────────────────────────────────

function ItemModal({ open, onClose, refetch, editItem }: any) {
  const { success, error: toastError } = useToast();
  const [imagePreview, setImagePreview] = useState('');
  const [imageTab, setImageTab] = useState<'url'|'upload'>('url');
  const fileRef = useRef<HTMLInputElement>(null);

  const dv = editItem ? {
    name: editItem.name, amharicName: editItem.amharicName || '',
    region: editItem.region, material: editItem.material || '',
    category: editItem.category, description: editItem.description || '',
    culturalNote: editItem.culturalNote || '', imageUrl: editItem.imageUrl || '',
    costPrice: editItem.costPrice, sellingPrice: editItem.sellingPrice,
    minStockLevel: editItem.minStockLevel, status: editItem.status,
  } : { stock: 0, minStockLevel: 5, status: 'ACTIVE', imageUrl: '' };

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ItemForm>({
    resolver: zodResolver(schema), defaultValues: dv,
  });

  const watchUrl = watch('imageUrl');
  useEffect(() => {
    if (watchUrl && (watchUrl.startsWith('http') || watchUrl.startsWith('data:'))) setImagePreview(watchUrl);
    else setImagePreview('');
  }, [watchUrl]);

  useEffect(() => { reset(dv); setImagePreview(editItem?.imageUrl || ''); setImageTab('url'); }, [editItem]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toastError('Too large', 'Max 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => { const b64 = reader.result as string; setValue('imageUrl', b64); setImagePreview(b64); };
    reader.readAsDataURL(f);
  };

  const [createItem, { loading: creating }] = useMutation(CREATE_ITEM);
  const [updateItem, { loading: updating }] = useMutation(UPDATE_ITEM);

  const onSubmit = async (vals: ItemForm) => {
    const payload = { ...vals, imageUrl: vals.imageUrl || null };
    try {
      if (editItem) {
        const { stock, ...rest } = payload;
        await updateItem({ variables: { id: editItem.id, ...rest } });
        success('Item updated', vals.name);
      } else {
        await createItem({ variables: payload });
        success('Item created', vals.name);
      }
      refetch(); reset(); onClose();
    } catch (e: any) { toastError('Failed', e.message); }
  };

  if (!open) return null;
  const ic = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none';
  const lc = 'text-sm font-medium text-foreground block mb-1';
  const ec = 'text-xs text-destructive mt-1';

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale:0.95, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.95, opacity:0 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{editItem ? 'Edit Item' : 'Add Traditional Item'}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Ethiopian cultural &amp; traditional product</p>
            </div>
            <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            {/* Name + Amharic */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lc}>Name (English) *</label>
                <input {...register('name')} placeholder="e.g. Jebena Coffee Pot" className={ic} />
                {errors.name && <p className={ec}>{errors.name.message}</p>}
              </div>
              <div>
                <label className={lc}>Name in Amharic አማርኛ</label>
                <input {...register('amharicName')} placeholder="ጀበና" className={ic} style={{ fontFamily: 'serif' }} />
              </div>
            </div>
            {/* Category + Region */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lc}>Category *</label>
                <select {...register('category')} className={ic}>
                  <option value="">Select category…</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.category && <p className={ec}>{errors.category.message}</p>}
              </div>
              <div>
                <label className={lc}>Region / Origin *</label>
                <select {...register('region')} className={ic}>
                  <option value="">Select region…</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {errors.region && <p className={ec}>{errors.region.message}</p>}
              </div>
            </div>
            {/* Material */}
            <div>
              <label className={lc}>Material</label>
              <input {...register('material')} placeholder="e.g. Clay, Cotton, Wood, Silver…" className={ic} />
            </div>
            {/* Price + Stock */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={lc}>Cost (ETB) *</label>
                <input {...register('costPrice', { valueAsNumber: true })} type="number" step="0.01" placeholder="0.00" className={ic} />
                {errors.costPrice && <p className={ec}>{errors.costPrice.message}</p>}
              </div>
              <div>
                <label className={lc}>Selling (ETB) *</label>
                <input {...register('sellingPrice', { valueAsNumber: true })} type="number" step="0.01" placeholder="0.00" className={ic} />
                {errors.sellingPrice && <p className={ec}>{errors.sellingPrice.message}</p>}
              </div>
              <div>
                {!editItem ? (
                  <>
                    <label className={lc}>Initial Stock</label>
                    <input {...register('stock', { valueAsNumber: true })} type="number" placeholder="0" className={ic} />
                  </>
                ) : (
                  <>
                    <label className={lc}>Min Stock</label>
                    <input {...register('minStockLevel', { valueAsNumber: true })} type="number" placeholder="5" className={ic} />
                  </>
                )}
              </div>
            </div>
            {!editItem && (
              <div>
                <label className={lc}>Min Stock Level</label>
                <input {...register('minStockLevel', { valueAsNumber: true })} type="number" placeholder="5" className={ic} />
              </div>
            )}
            {editItem && (
              <div>
                <label className={lc}>Status</label>
                <select {...register('status')} className={ic}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                </select>
              </div>
            )}
            {/* Image */}
            <div>
              <label className={lc}>Product Image</label>
              <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit mb-2">
                {(['url','upload'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setImageTab(t)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${imageTab===t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                    {t === 'url' ? 'URL' : 'Upload'}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 items-start">
                <div className="flex-1">
                  {imageTab === 'url' ? (
                    <input {...register('imageUrl')} placeholder="https://..." className={ic} />
                  ) : (
                    <>
                      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" id="trad-img" />
                      <label htmlFor="trad-img"
                        className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary cursor-pointer w-full justify-center transition-colors">
                        <Upload size={14} /> {imagePreview ? 'Change image' : 'Choose image (max 2 MB)'}
                      </label>
                    </>
                  )}
                </div>
                <div className="relative shrink-0">
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="preview" onError={() => setImagePreview('')}
                        className="w-16 h-16 rounded-lg object-cover border border-border" />
                      <button type="button" onClick={() => { setValue('imageUrl',''); setImagePreview(''); }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                        <X size={10} />
                      </button>
                    </>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center border border-border text-muted-foreground">
                      <ImageIcon size={22} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Cultural note */}
            <div>
              <label className={lc}>Cultural Significance</label>
              <textarea {...register('culturalNote')} placeholder="Describe the cultural importance of this item…" rows={2}
                className={`${ic} resize-none`} />
            </div>
            {/* Description */}
            <div>
              <label className={lc}>Description</label>
              <textarea {...register('description')} placeholder="Additional product details…" rows={2}
                className={`${ic} resize-none`} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={creating || updating}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                {(creating || updating) && <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />}
                {creating || updating ? 'Saving…' : editItem ? 'Update Item' : 'Add Item'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Adjust Stock Modal ────────────────────────────────────────────────────────

function AdjustStockModal({ item, onClose, refetch }: any) {
  const { success, error: toastError } = useToast();
  const [type, setType] = useState<'IN'|'OUT'|'SET'>('IN');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [adjustStock, { loading }] = useMutation(ADJUST_STOCK);

  const handleSave = async () => {
    try {
      await adjustStock({ variables: { id: item.id, quantity, type, notes: notes || null } });
      success('Stock adjusted', `${type} ${quantity} units of ${item.name}`);
      refetch(); onClose();
    } catch (e: any) { toastError('Failed', e.message); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale:0.95, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.95, opacity:0 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Adjust Stock</h2>
            <button onClick={onClose}><X size={18} className="text-muted-foreground" /></button>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">Current stock: <span className="font-bold text-foreground">{item.stock}</span> units</p>
            <div className="grid grid-cols-3 gap-2">
              {(['IN','OUT','SET'] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`py-2 rounded-lg text-sm font-semibold border transition-colors ${type===t ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                  {t === 'IN' ? '+ Add' : t === 'OUT' ? '− Remove' : '= Set'}
                </button>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Quantity</label>
              <input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Notes (optional)</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for adjustment…"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={loading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Item Card ─────────────────────────────────────────────────────────────────

function ItemCard({ item, onEdit, onDelete, onAdjust, canMutate, canAdminDelete, index }: any) {
  const [expanded, setExpanded] = useState(false);
  const catColor = CATEGORY_COLORS[item.category] || 'bg-primary/10 text-primary';
  const isLow = item.stock > 0 && item.stock <= item.minStockLevel;
  const isOut = item.stock === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
    >
      {/* Image */}
      <div className="relative h-40 bg-muted/40 overflow-hidden shrink-0">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} onError={e => { (e.target as HTMLImageElement).style.display='none'; }}
            className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Package2 size={36} className="opacity-30" />
            <span className="text-xs opacity-50">No image</span>
          </div>
        )}
        {/* Status badge */}
        <div className="absolute top-2 right-2">
          {isOut ? (
            <span className="text-[10px] font-semibold bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">Out of Stock</span>
          ) : isLow ? (
            <span className="text-[10px] font-semibold bg-amber-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle size={9} /> Low Stock
            </span>
          ) : null}
        </div>
        {/* Ethiopian flag accent */}
        <div className="absolute bottom-0 left-0 right-0 h-1 flex">
          <div className="flex-1 bg-green-600" />
          <div className="flex-1 bg-yellow-400" />
          <div className="flex-1 bg-red-600" />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground text-sm leading-tight truncate">{item.name}</h3>
            {item.amharicName && (
              <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: 'serif' }}>{item.amharicName}</p>
            )}
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${catColor}`}>
            {item.category.split(' & ')[0]}
          </span>
        </div>

        {/* Region + Material */}
        <div className="flex items-center gap-3 mb-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin size={10} /> {item.region}
          </span>
          {item.material && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Layers size={10} /> {item.material}
            </span>
          )}
        </div>

        {/* Price + Stock row */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-base font-bold text-primary">{fmt(item.sellingPrice)}</p>
            <p className="text-[10px] text-muted-foreground">Cost: {fmt(item.costPrice)}</p>
          </div>
          <div className="text-right">
            <p className={`text-base font-bold ${isOut ? 'text-destructive' : isLow ? 'text-amber-500' : 'text-emerald-500'}`}>{item.stock}</p>
            <p className="text-[10px] text-muted-foreground">in stock</p>
          </div>
        </div>

        {/* Expandable cultural note */}
        {item.culturalNote && (
          <div className="mb-3">
            <button onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-xs text-primary hover:underline">
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Cultural significance
            </button>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.p initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
                  className="text-xs text-muted-foreground mt-1.5 leading-relaxed overflow-hidden">
                  {item.culturalNote}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-3 border-t border-border">
          {canMutate && (
            <button onClick={() => onAdjust(item)}
              className="flex-1 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors">
              Adjust Stock
            </button>
          )}
          {canMutate && (
            <button onClick={() => onEdit(item)}
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
              <Edit2 size={14} />
            </button>
          )}
          {canAdminDelete && (
            <button onClick={() => onDelete(item.id, item.name)}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TraditionalItems() {
  const [modalOpen, setModalOpen]   = useState(false);
  const [editItem, setEditItem]     = useState<any>(null);
  const [adjustItem, setAdjustItem] = useState<any>(null);
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  const { data, loading, refetch } = useQuery(GET_ITEMS, {
    variables: {
      search:   search   || undefined,
      category: catFilter || undefined,
      region:   regionFilter || undefined,
    },
    fetchPolicy: 'cache-and-network',
  });

  const [deleteItem] = useMutation(DELETE_ITEM);
  const { success, error: toastError } = useToast();
  const { canMutate, canAdminDelete } = useRole();

  const items: any[] = data?.traditionalItems || [];

  // Summary stats
  const totalValue    = items.reduce((s, i) => s + i.sellingPrice * i.stock, 0);
  const lowStockCount = items.filter(i => i.stock > 0 && i.stock <= i.minStockLevel).length;
  const outCount      = items.filter(i => i.stock === 0).length;

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await deleteItem({ variables: { id } });
      success('Item deleted', name);
      refetch();
    } catch (e: any) { toastError('Delete failed', e.message); }
  };

  const exportCSV = () => {
    if (!items.length) return;
    const rows = [
      ['Name', 'Amharic Name', 'SKU', 'Category', 'Region', 'Material', 'Cost (ETB)', 'Price (ETB)', 'Stock', 'Min Stock', 'Status', 'Cultural Note'],
      ...items.map(i => [
        i.name, i.amharicName || '', i.id.slice(0,8).toUpperCase(),
        i.category, i.region, i.material || '',
        i.costPrice, i.sellingPrice, i.stock, i.minStockLevel,
        i.stock === 0 ? 'Out of Stock' : i.stock <= i.minStockLevel ? 'Low Stock' : 'OK',
        (i.culturalNote || '').replace(/,/g, ';'),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'traditional-items.csv'; a.click();
    URL.revokeObjectURL(url);
    success('Export ready', 'traditional-items.csv downloaded.');
  };

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            {/* Ethiopian flag colors accent */}
            <div className="flex gap-0.5 h-5">
              <div className="w-2 bg-green-600 rounded-l-sm" />
              <div className="w-2 bg-yellow-400" />
              <div className="w-2 bg-red-600 rounded-r-sm" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Ethiopian Traditional Items</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {items.length} items · {lowStockCount > 0 && <span className="text-amber-500 font-medium">{lowStockCount} low stock · </span>}
            {outCount > 0 && <span className="text-destructive font-medium">{outCount} out of stock · </span>}
            Total value: <span className="font-semibold text-foreground">{fmtInt(totalValue)}</span>
          </p>
        </div>
        {canMutate && (
          <button onClick={() => { setEditItem(null); setModalOpen(true); }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm">
            <Plus size={16} /> Add Item
          </button>
        )}
        <button onClick={exportCSV}
          className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted flex items-center gap-2 transition-colors">
          <FileDown size={14} /> Export CSV
        </button>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Items',     value: items.length,            color: 'text-foreground' },
          { label: 'Stock Value',     value: fmtInt(totalValue),      color: 'text-primary' },
          { label: 'Low Stock',       value: lowStockCount,           color: 'text-amber-500' },
          { label: 'Out of Stock',    value: outCount,                 color: 'text-destructive' },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, region, material…"
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
          <option value="">All Regions</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {(catFilter || regionFilter || search) && (
          <button onClick={() => { setSearch(''); setCatFilter(''); setRegionFilter(''); }}
            className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors">
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* ── Card Grid ── */}
      {loading && items.length === 0 ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-14 h-14 bg-muted rounded-xl flex items-center justify-center">
            <Package2 size={28} className="text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">No items found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your filters or add a new item.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map((item, i) => (
            <ItemCard
              key={item.id} item={item} index={i}
              canMutate={canMutate} canAdminDelete={canAdminDelete}
              onEdit={(item: any) => { setEditItem(item); setModalOpen(true); }}
              onDelete={handleDelete}
              onAdjust={(item: any) => setAdjustItem(item)}
            />
          ))}
        </div>
      )}

      <ItemModal open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }} refetch={refetch} editItem={editItem} />
      {adjustItem && <AdjustStockModal item={adjustItem} onClose={() => setAdjustItem(null)} refetch={refetch} />}
    </div>
  );
}
