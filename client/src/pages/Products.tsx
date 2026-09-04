import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useApolloClient, gql } from '@apollo/client';
import {
  createColumnHelper, flexRender, getCoreRowModel, useReactTable,
  getSortedRowModel, getPaginationRowModel, getFilteredRowModel,
} from '@tanstack/react-table';
import type { SortingState } from '@tanstack/react-table';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, ArrowUpDown, Edit2, AlertTriangle,
  X, Package, ChevronLeft, ChevronRight, Filter, ImageIcon, Upload,
  Archive, RotateCcw, FileDown, Barcode, Tag,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';
import { fmt } from '../lib/currency';

// ── GraphQL ───────────────────────────────────────────────────────────────────

const GET_PRODUCTS = gql`
  query GetProducts($search: String, $categoryId: String, $status: String) {
    products(search: $search, categoryId: $categoryId, status: $status) {
      id name sku barcode description imageUrl
      costPrice sellingPrice stock minStockLevel status profitMargin
      createdAt updatedAt
      category { id name }
      supplier  { id name }
    }
    categories { id name productCount }
    suppliers  { id name }
  }
`;

const DELETE_PRODUCT = gql`
  mutation DeleteProduct($id: ID!) { deleteProduct(id: $id) }
`;

const CREATE_PRODUCT = gql`
  mutation CreateProduct(
    $name: String! $sku: String! $costPrice: Float! $sellingPrice: Float!
    $categoryId: String! $supplierId: String $stock: Int $minStockLevel: Int
    $description: String $barcode: String $imageUrl: String $status: String
  ) {
    createProduct(
      name: $name sku: $sku costPrice: $costPrice sellingPrice: $sellingPrice
      categoryId: $categoryId supplierId: $supplierId stock: $stock
      minStockLevel: $minStockLevel description: $description
      barcode: $barcode imageUrl: $imageUrl status: $status
    ) {
      id name sku barcode stock sellingPrice costPrice status profitMargin imageUrl
      category { id name } supplier { id name }
    }
  }
`;

const UPDATE_PRODUCT = gql`
  mutation UpdateProduct(
    $id: ID! $name: String $sku: String $costPrice: Float $sellingPrice: Float
    $categoryId: String $supplierId: String $minStockLevel: Int
    $description: String $barcode: String $imageUrl: String $status: String
  ) {
    updateProduct(
      id: $id name: $name sku: $sku costPrice: $costPrice sellingPrice: $sellingPrice
      categoryId: $categoryId supplierId: $supplierId minStockLevel: $minStockLevel
      description: $description barcode: $barcode imageUrl: $imageUrl status: $status
    ) {
      id name sku barcode stock sellingPrice costPrice status profitMargin imageUrl
      category { id name } supplier { id name }
    }
  }
`;

// ── Zod schema ────────────────────────────────────────────────────────────────

const productSchema = z.object({
  name:          z.string().min(2, 'Name must be at least 2 characters').max(200),
  amharicName:   z.string().max(200).optional(),
  sku:           z.string().min(1, 'SKU is required').max(100),
  barcode:       z.string().max(100).optional(),
  description:   z.string().max(1000).optional(),
  imageUrl:      z.string().max(500).optional().or(z.literal('')),
  costPrice:     z.number({ invalid_type_error: 'Enter a valid price' }).min(0, 'Cannot be negative'),
  sellingPrice:  z.number({ invalid_type_error: 'Enter a valid price' }).min(0, 'Cannot be negative'),
  categoryId:    z.string().min(1, 'Select a category'),
  supplierId:    z.string().optional(),
  stock:         z.number().int().min(0).optional(),
  minStockLevel: z.number().int().min(0),
  status:        z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
}).refine(
  d => d.sellingPrice >= d.costPrice,
  { message: 'Selling price should not be less than cost price', path: ['sellingPrice'] }
);
type ProductForm = z.infer<typeof productSchema>;

type Product = {
  id: string; name: string; sku: string; barcode: string | null;
  stock: number; sellingPrice: number; costPrice: number;
  status: string; profitMargin: number | null; minStockLevel: number;
  imageUrl: string | null; description: string | null;
  category: { id: string; name: string } | null;
  supplier:  { id: string; name: string } | null;
  createdAt: string; updatedAt: string;
};

const columnHelper = createColumnHelper<Product>();

// ── Image preview ─────────────────────────────────────────────────────────────

function ImagePreview({ src, onClear }: { src: string; onClear: () => void }) {
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => { setBroken(false); }, [src]);

  return (
    <div className="relative w-16 h-16 shrink-0">
      {broken ? (
        <div className="w-16 h-16 rounded-lg bg-destructive/10 border border-destructive/30 flex flex-col items-center justify-center gap-0.5">
          <ImageIcon size={16} className="text-destructive" />
          <p className="text-[8px] text-destructive text-center leading-tight px-1">Can't load</p>
        </div>
      ) : (
        <img
          src={src} alt="Preview"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="w-16 h-16 rounded-lg object-cover border border-border"
        />
      )}
      <button type="button" onClick={onClear}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md hover:bg-destructive/90 transition-colors">
        <X size={10} />
      </button>
    </div>
  );
}

// ── Product Modal ─────────────────────────────────────────────────────────────

function ProductModal({
  open, onClose, categories, suppliers, products, refetch, editProduct,
}: {
  open: boolean;
  onClose: () => void;
  categories: any[];
  suppliers: any[];
  products: Product[];
  refetch: () => void;
  editProduct: Product | null;
}) {
  const { success, error: toastError } = useToast();
  const client = useApolloClient();
  const [imagePreview, setImagePreview] = useState('');
  const [imageTab, setImageTab] = useState<'url' | 'upload'>('url');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultValues = editProduct
    ? {
        name:          editProduct.name,
        sku:           editProduct.sku,
        amharicName:   '',
        barcode:       editProduct.barcode || '',
        description:   editProduct.description || '',
        imageUrl:      editProduct.imageUrl || '',
        costPrice:     editProduct.costPrice,
        sellingPrice:  editProduct.sellingPrice,
        categoryId:    editProduct.category?.id || '',
        supplierId:    editProduct.supplier?.id || '',
        minStockLevel: editProduct.minStockLevel,
        status:        (editProduct.status as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') ?? 'ACTIVE',
      }
    : { stock: 0, minStockLevel: 10, status: 'ACTIVE' as const, imageUrl: '', amharicName: '' };

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues,
  });

  const watchedImageUrl   = watch('imageUrl');
  const watchedSku        = watch('sku');
  const watchedBarcode    = watch('barcode');
  const watchedCost       = watch('costPrice');
  const watchedSelling    = watch('sellingPrice');

  // Compute live margin for display
  const liveMargin = watchedSelling > 0 && watchedCost >= 0
    ? ((watchedSelling - watchedCost) / watchedSelling * 100)
    : null;

  // Image preview sync
  useEffect(() => {
    setImagePreview(watchedImageUrl?.trim() || '');
  }, [watchedImageUrl]);

  // Reset when editProduct changes
  useEffect(() => {
    const vals = editProduct
      ? {
          name:          editProduct.name,
          sku:           editProduct.sku,
          amharicName:   '',
          barcode:       editProduct.barcode || '',
          description:   editProduct.description || '',
          imageUrl:      editProduct.imageUrl || '',
          costPrice:     editProduct.costPrice,
          sellingPrice:  editProduct.sellingPrice,
          categoryId:    editProduct.category?.id || '',
          supplierId:    editProduct.supplier?.id || '',
          minStockLevel: editProduct.minStockLevel,
          status:        (editProduct.status as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') ?? 'ACTIVE',
        }
      : { stock: 0, minStockLevel: 10, status: 'ACTIVE' as const, imageUrl: '', amharicName: '' };
    reset(vals);
    setImagePreview(editProduct?.imageUrl || '');
    setImageTab('url');
  }, [editProduct, reset]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toastError('Image too large', 'Please choose an image under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setValue('imageUrl', base64, { shouldValidate: true });
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setValue('imageUrl', '', { shouldValidate: true });
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [createProduct, { loading: creating }] = useMutation(CREATE_PRODUCT, {
    onCompleted: () => client.cache.evict({ fieldName: 'products' }),
  });
  const [updateProduct, { loading: updating }] = useMutation(UPDATE_PRODUCT, {
    onCompleted: (data) => {
      client.cache.evict({ id: client.cache.identify({ __typename: 'Product', id: data.updateProduct.id }) });
      client.cache.gc();
    },
  });

  const onSubmit = async (values: ProductForm) => {
    const { amharicName, ...rest } = values;
    const description = [
      amharicName ? `[አማርኛ: ${amharicName}]` : '',
      rest.description || '',
    ].filter(Boolean).join('\n') || undefined;

    const payload = { ...rest, description, imageUrl: rest.imageUrl || null };
    try {
      if (editProduct) {
        const { stock: _stock, ...updateRest } = payload;
        await updateProduct({ variables: { id: editProduct.id, ...updateRest } });
        success('Product updated', `${values.name} has been saved.`);
      } else {
        await createProduct({ variables: payload });
        success('Product created', `${values.name} added to inventory.`);
      }
      refetch(); reset(); onClose();
    } catch (e: any) { toastError('Operation failed', e.message); }
  };

  // Live duplicate checks
  const skuDuplicate    = watchedSku    && products.some(p => p.sku     === watchedSku    && p.id !== editProduct?.id);
  const barcodeDuplicate = watchedBarcode && products.some(p => p.barcode === watchedBarcode && p.id !== editProduct?.id);

  if (!open) return null;

  const ic = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-colors';
  const lc = 'text-sm font-medium text-foreground block mb-1';
  const ec = 'text-xs text-destructive mt-1';

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {editProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              {editProduct && (
                <p className="text-xs text-muted-foreground mt-0.5">SKU: {editProduct.sku}</p>
              )}
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">

            {/* Name + SKU */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lc}>Product Name *</label>
                <input {...register('name')} placeholder="e.g. Jebena Coffee Pot" className={ic} />
                {errors.name && <p className={ec}>{errors.name.message}</p>}
              </div>
              <div>
                <label className={lc}>SKU *</label>
                <input {...register('sku')} placeholder="e.g. ELC-001" className={ic} />
                {errors.sku && <p className={ec}>{errors.sku.message}</p>}
                {skuDuplicate && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertTriangle size={11} /> SKU already exists
                  </p>
                )}
              </div>
            </div>

            {/* Amharic Name */}
            <div>
              <label className={lc}>
                ስም በአማርኛ <span className="text-muted-foreground font-normal text-xs">(optional — local language name)</span>
              </label>
              <div className="flex gap-2">
                <input {...register('amharicName')}
                  placeholder="ለምሳሌ፡ ጀበና  · መሶብ · ዳቦ"
                  className={`${ic} flex-1`}
                  lang="am" dir="ltr"
                  style={{ fontFamily: "'Noto Sans Ethiopic', serif", fontSize: '1.05em' }}
                />
                <button type="button"
                  onClick={() => {
                    const nameEl = document.querySelector<HTMLInputElement>('input[name="name"]');
                    const name = nameEl?.value ?? '';
                    if (!name) return;
                    window.open(`https://translate.google.com/?sl=en&tl=am&text=${encodeURIComponent(name)}&op=translate`, '_blank');
                  }}
                  className="px-3 py-2 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors shrink-0">
                  🌐 Translate
                </button>
              </div>
            </div>

            {/* Category + Supplier */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lc}>Category *</label>
                <select {...register('categoryId')} className={ic}>
                  <option value="">Select category…</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.categoryId && <p className={ec}>{errors.categoryId.message}</p>}
              </div>
              <div>
                <label className={lc}>Supplier</label>
                <select {...register('supplierId')} className={ic}>
                  <option value="">No supplier</option>
                  {suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lc}>Cost Price (ETB) *</label>
                <input {...register('costPrice', { valueAsNumber: true })}
                  type="number" step="0.01" min="0" placeholder="0.00" className={ic} />
                {errors.costPrice && <p className={ec}>{errors.costPrice.message}</p>}
              </div>
              <div>
                <label className={lc}>Selling Price (ETB) *</label>
                <input {...register('sellingPrice', { valueAsNumber: true })}
                  type="number" step="0.01" min="0" placeholder="0.00" className={ic} />
                {errors.sellingPrice && <p className={ec}>{errors.sellingPrice.message}</p>}
              </div>
            </div>

            {/* Live margin indicator */}
            {liveMargin !== null && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                liveMargin < 0
                  ? 'bg-destructive/10 text-destructive'
                  : liveMargin < 15
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-emerald-500/10 text-emerald-600'
              }`}>
                <Tag size={14} />
                <span>
                  Profit margin: <strong>{liveMargin.toFixed(1)}%</strong>
                  {liveMargin < 0 && ' — selling price is below cost!'}
                  {liveMargin >= 0 && liveMargin < 15 && ' — low margin'}
                  {liveMargin >= 15 && liveMargin < 30 && ' — acceptable'}
                  {liveMargin >= 30 && ' — good margin'}
                </span>
              </div>
            )}

            {/* Stock */}
            <div className="grid grid-cols-2 gap-4">
              {!editProduct && (
                <div>
                  <label className={lc}>Initial Stock</label>
                  <input {...register('stock', { valueAsNumber: true })}
                    type="number" min="0" placeholder="0" className={ic} />
                  <p className="text-xs text-muted-foreground mt-1">Adjust via Inventory later</p>
                </div>
              )}
              <div className={editProduct ? 'col-span-2' : ''}>
                <label className={lc}>Min Stock Level (reorder alert)</label>
                <input {...register('minStockLevel', { valueAsNumber: true })}
                  type="number" min="0" placeholder="10" className={ic} />
              </div>
            </div>

            {/* Status (edit only) */}
            {editProduct && (
              <div>
                <label className={lc}>Status</label>
                <select {...register('status')} className={ic}>
                  <option value="ACTIVE">Active — visible in POS</option>
                  <option value="INACTIVE">Inactive — hidden from POS</option>
                  <option value="ARCHIVED">Archived — historical records preserved</option>
                </select>
              </div>
            )}

            {/* Image */}
            <div>
              <label className={lc}>Product Image</label>
              <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit mb-3">
                {(['url', 'upload'] as const).map(tab => (
                  <button key={tab} type="button" onClick={() => setImageTab(tab)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      imageTab === tab ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {tab === 'url' ? 'URL' : 'Upload File'}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 items-start">
                <div className="flex-1">
                  {imageTab === 'url' ? (
                    <>
                      <input {...register('imageUrl')}
                        placeholder="https://example.com/product.jpg" className={ic} />
                      <p className="text-xs text-muted-foreground mt-1">Paste a direct image link (.jpg, .png, .webp)</p>
                    </>
                  ) : (
                    <>
                      <input ref={fileInputRef} type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={handleFileChange}
                        className="hidden" id="product-image-file" />
                      <label htmlFor="product-image-file"
                        className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors w-full justify-center">
                        <Upload size={15} />
                        {imagePreview && watchedImageUrl?.startsWith('data:')
                          ? 'Change image' : 'Choose image (PNG, JPG, WebP — max 2 MB)'}
                      </label>
                    </>
                  )}
                </div>
                <div className="relative shrink-0">
                  {imagePreview
                    ? <ImagePreview src={imagePreview} onClear={clearImage} />
                    : <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-muted-foreground border border-border"><ImageIcon size={22} /></div>
                  }
                </div>
              </div>
            </div>

            {/* Barcode */}
            <div>
              <label className={lc}>Barcode / EAN</label>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Barcode size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input {...register('barcode')}
                    placeholder="Scan or type barcode"
                    className={`${ic} pl-9`} />
                </div>
              </div>
              {barcodeDuplicate && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle size={11} /> Barcode already assigned to another product
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className={lc}>Description</label>
              <textarea {...register('description')}
                placeholder="Optional product description…" rows={3}
                className={`${ic} resize-none`} />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={creating || updating || !!skuDuplicate || !!barcodeDuplicate}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                {(creating || updating) && (
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                )}
                {creating || updating ? 'Saving…' : editProduct ? 'Update Product' : 'Create Product'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── CSV Export helper ─────────────────────────────────────────────────────────

function exportToCSV(products: Product[]) {
  const headers = ['Name', 'SKU', 'Barcode', 'Category', 'Supplier', 'Cost Price', 'Selling Price', 'Margin %', 'Stock', 'Min Stock', 'Status'];
  const rows = products.map(p => [
    p.name,
    p.sku,
    p.barcode ?? '',
    p.category?.name ?? '',
    p.supplier?.name ?? '',
    p.costPrice.toFixed(2),
    p.sellingPrice.toFixed(2),
    p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice * 100).toFixed(1) : '0',
    p.stock,
    p.minStockLevel,
    p.status,
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export default function Products() {
  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sorting, setSorting]           = useState<SortingState>([]);
  const [modalOpen, setModalOpen]       = useState(false);
  const [editProduct, setEditProduct]   = useState<Product | null>(null);
  const { success, error: toastError }  = useToast();
  const { canMutate, can }              = useRole();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, loading, refetch } = useQuery(GET_PRODUCTS, {
    variables: {
      search:     debouncedSearch || undefined,
      categoryId: categoryFilter  || undefined,
      status:     statusFilter    || undefined,
    },
    fetchPolicy: 'cache-and-network',
  });

  const [deleteProduct] = useMutation(DELETE_PRODUCT);

  const products:   Product[] = data?.products   || [];
  const categories             = data?.categories || [];
  const suppliers              = data?.suppliers  || [];

  // Debounced search
  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebounced(v), 300);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  const handleDelete = async (id: string, name: string, status: string) => {
    if (status === 'ARCHIVED') {
      // Already archived — confirm hard attempt (backend will soft-delete if has sales)
      if (!window.confirm(`Remove "${name}" from the system?\n\nIf this product has sales history it will remain archived, otherwise it will be permanently deleted.`)) return;
    } else {
      if (!window.confirm(`Archive "${name}"?\n\nProducts with sales history will be archived (not deleted) to preserve historical records.`)) return;
    }
    try {
      await deleteProduct({ variables: { id } });
      success('Product archived', `"${name}" has been deactivated.`);
      refetch();
    } catch (e: any) { toastError('Operation failed', e.message); }
  };

  const handleRestore = async (product: Product) => {
    try {
      // Re-use updateProduct mutation through the edit flow
      setEditProduct({ ...product, status: 'ACTIVE' });
      setModalOpen(true);
    } catch (e: any) { toastError('Restore failed', e.message); }
  };

  // Summary counts
  const lowStockCount  = products.filter(p => p.stock > 0 && p.stock <= p.minStockLevel).length;
  const outOfStock     = products.filter(p => p.stock === 0 && p.status === 'ACTIVE').length;
  const totalValue     = products.reduce((sum, p) => sum + p.costPrice * p.stock, 0);

  const statusColors: Record<string, string> = {
    ACTIVE:   'bg-emerald-500/10 text-emerald-600',
    INACTIVE: 'bg-muted text-muted-foreground',
    ARCHIVED: 'bg-amber-500/10 text-amber-600',
  };

  const columns = [
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-1.5 font-semibold hover:text-primary transition-colors">
          Product <ArrowUpDown size={13} />
        </button>
      ),
      cell: info => {
        const img = info.row.original.imageUrl;
        const bc  = info.row.original.barcode;
        return (
          <div className="flex items-center gap-3">
            {img ? (
              <img src={img} alt={info.getValue()} referrerPolicy="no-referrer"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                className="w-8 h-8 rounded-lg object-cover shrink-0 border border-border" />
            ) : (
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                <Package size={15} />
              </div>
            )}
            <div>
              <p className="font-medium text-foreground leading-tight">{info.getValue()}</p>
              <div className="flex items-center gap-2">
                {info.row.original.supplier?.name && (
                  <p className="text-xs text-muted-foreground">{info.row.original.supplier.name}</p>
                )}
                {bc && (
                  <span className="text-[10px] text-muted-foreground/70 font-mono">{bc}</span>
                )}
              </div>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor('sku', {
      header: 'SKU',
      cell: info => (
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-muted-foreground">
          {info.getValue()}
        </code>
      ),
    }),
    columnHelper.accessor('category.name', {
      header: 'Category',
      cell: info => (
        <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          {info.getValue() || '—'}
        </span>
      ),
    }),
    columnHelper.accessor('costPrice', {
      header: ({ column }) => (
        <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-1.5 font-semibold hover:text-primary transition-colors">
          Cost <ArrowUpDown size={13} />
        </button>
      ),
      cell: info => <span className="text-muted-foreground text-sm">{fmt(info.getValue())}</span>,
    }),
    columnHelper.accessor('sellingPrice', {
      header: ({ column }) => (
        <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-1.5 font-semibold hover:text-primary transition-colors">
          Price <ArrowUpDown size={13} />
        </button>
      ),
      cell: info => <span className="font-semibold">{fmt(info.getValue())}</span>,
    }),
    columnHelper.accessor('profitMargin', {
      header: 'Margin',
      cell: info => {
        const v = info.getValue();
        if (v == null) return <span className="text-muted-foreground">—</span>;
        return (
          <span className={`font-semibold text-sm ${v >= 30 ? 'text-emerald-500' : v >= 15 ? 'text-amber-500' : 'text-destructive'}`}>
            {v.toFixed(1)}%
          </span>
        );
      },
    }),
    columnHelper.accessor('stock', {
      header: ({ column }) => (
        <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-1.5 font-semibold hover:text-primary transition-colors">
          Stock <ArrowUpDown size={13} />
        </button>
      ),
      cell: info => {
        const v = info.getValue(), min = info.row.original.minStockLevel;
        return (
          <div className="flex items-center gap-2">
            {v <= min && <AlertTriangle size={13} className={v === 0 ? 'text-destructive' : 'text-amber-500'} />}
            <span className={`font-bold tabular-nums ${v === 0 ? 'text-destructive' : v <= min ? 'text-amber-500' : 'text-emerald-500'}`}>
              {v}
            </span>
          </div>
        );
      },
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[info.getValue()] ?? statusColors['ACTIVE']}`}>
          {info.getValue().replace(/_/g, ' ')}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const p = row.original;
        const isArchived = p.status === 'ARCHIVED' || p.status === 'INACTIVE';
        return (
          <div className="flex items-center gap-1 justify-end">
            {canMutate && (
              <button onClick={() => { setEditProduct(p); setModalOpen(true); }}
                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                title="Edit product">
                <Edit2 size={14} />
              </button>
            )}
            {canMutate && isArchived && (
              <button onClick={() => handleRestore(p)}
                className="p-1.5 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors"
                title="Restore product">
                <RotateCcw size={14} />
              </button>
            )}
            {can('product:delete') && !isArchived && (
              <button onClick={() => handleDelete(p.id, p.name, p.status)}
                className="p-1.5 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 rounded-lg transition-colors"
                title="Archive product">
                <Archive size={14} />
              </button>
            )}
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: products,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize  = table.getState().pagination.pageSize;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Products</h2>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-sm text-muted-foreground">{products.length} total</span>
            {lowStockCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                <AlertTriangle size={11} /> {lowStockCount} low stock
              </span>
            )}
            {outOfStock > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                <AlertTriangle size={11} /> {outOfStock} out of stock
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Inventory value: <strong className="text-foreground">{fmt(totalValue)}</strong>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {products.length > 0 && (
            <button onClick={() => exportToCSV(products)}
              className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2 text-muted-foreground">
              <FileDown size={14} /> Export CSV
            </button>
          )}
          {canMutate && (
            <button onClick={() => { setEditProduct(null); setModalOpen(true); }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm">
              <Plus size={16} /> Add Product
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">

        {/* Filters */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-muted/20 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Search name, SKU or barcode…"
              value={search} onChange={e => handleSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-muted-foreground" />

            {/* Category filter */}
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none">
              <option value="">All Categories</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Status filter */}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none">
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* Clear filters */}
            {(search || categoryFilter || statusFilter) && (
              <button onClick={() => { handleSearch(''); setCategoryFilter(''); setStatusFilter(''); }}
                className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 border border-border rounded-lg hover:bg-muted transition-colors">
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Table body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(h => (
                    <th key={h.id} className="px-5 py-3 whitespace-nowrap">
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-14 text-center">
                  <div className="flex justify-center">
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                </td></tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-14 text-center">
                  <Package size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">
                    {search || categoryFilter || statusFilter ? 'No products match your filters.' : 'No products yet.'}
                  </p>
                  {canMutate && !search && !categoryFilter && !statusFilter && (
                    <button onClick={() => { setEditProduct(null); setModalOpen(true); }}
                      className="mt-3 text-primary text-sm font-medium hover:underline">
                      Add your first product →
                    </button>
                  )}
                </td></tr>
              ) : (
                table.getRowModel().rows.map((row, i) => (
                  <motion.tr key={row.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="border-b border-border hover:bg-muted/20 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-5 py-3.5 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {products.length === 0 ? 'No products' : (
              <>
                Showing <span className="font-medium text-foreground">
                  {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, products.length)}
                </span> of <span className="font-medium text-foreground">{products.length}</span> products
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
              className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={14} /> Prev
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(table.getPageCount(), 7) }, (_, i) => (
                <button key={i} onClick={() => table.setPageIndex(i)}
                  className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                    pageIndex === i ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                  }`}>
                  {i + 1}
                </button>
              ))}
            </div>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
              className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <ProductModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditProduct(null); }}
        categories={categories}
        suppliers={suppliers}
        products={products}
        refetch={refetch}
        editProduct={editProduct}
      />
    </div>
  );
}
