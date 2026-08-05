import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import {
  createColumnHelper, flexRender, getCoreRowModel, useReactTable,
  getSortedRowModel, getPaginationRowModel,
} from '@tanstack/react-table';
import type { SortingState } from '@tanstack/react-table';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, ArrowUpDown, Edit2, Trash2, AlertTriangle,
  X, Package, ChevronLeft, ChevronRight, Filter, ImageIcon,
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
      id name sku barcode description imageUrl costPrice sellingPrice
      stock minStockLevel status profitMargin createdAt
      category { id name }
      supplier  { id name }
    }
    categories { id name }
    suppliers  { id name }
  }
`;

const DELETE_PRODUCT = gql`mutation DeleteProduct($id: ID!) { deleteProduct(id: $id) }`;

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
      id name sku stock sellingPrice costPrice status profitMargin imageUrl
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
      id name sku stock sellingPrice costPrice status profitMargin imageUrl
      category { id name } supplier { id name }
    }
  }
`;

// ── Zod ───────────────────────────────────────────────────────────────────────

const productSchema = z.object({
  name:          z.string().min(2, 'Name must be at least 2 characters'),
  sku:           z.string().min(2, 'SKU must be at least 2 characters'),
  barcode:       z.string().optional(),
  description:   z.string().optional(),
  imageUrl:      z.string().url('Must be a valid URL').optional().or(z.literal('')),
  costPrice:     z.number({ invalid_type_error: 'Enter a valid price' }).positive('Must be positive'),
  sellingPrice:  z.number({ invalid_type_error: 'Enter a valid price' }).positive('Must be positive'),
  categoryId:    z.string().min(1, 'Select a category'),
  supplierId:    z.string().optional(),
  stock:         z.number().int().min(0).optional(),
  minStockLevel: z.number().int().min(0),
  status:        z.string().optional(),
});
type ProductForm = z.infer<typeof productSchema>;

type Product = {
  id: string; name: string; sku: string; stock: number;
  sellingPrice: number; costPrice: number; status: string;
  profitMargin: number | null; minStockLevel: number;
  imageUrl: string | null;
  category: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
};

const columnHelper = createColumnHelper<Product>();

// ── Modal ─────────────────────────────────────────────────────────────────────

function ProductModal({ open, onClose, categories, suppliers, refetch, editProduct }: any) {
  const { success, error: toastError } = useToast();
  const [imagePreview, setImagePreview] = useState('');

  const defaultValues = editProduct
    ? {
        name: editProduct.name, sku: editProduct.sku,
        barcode: editProduct.barcode || '', description: editProduct.description || '',
        imageUrl: editProduct.imageUrl || '',
        costPrice: editProduct.costPrice, sellingPrice: editProduct.sellingPrice,
        categoryId: editProduct.category?.id || '',
        supplierId: editProduct.supplier?.id || '',
        minStockLevel: editProduct.minStockLevel,
        status: editProduct.status,
      }
    : { stock: 0, minStockLevel: 10, status: 'ACTIVE', imageUrl: '' };

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues,
  });

  const watchedImageUrl = watch('imageUrl');
  useEffect(() => {
    if (watchedImageUrl && watchedImageUrl.startsWith('http')) setImagePreview(watchedImageUrl);
    else setImagePreview('');
  }, [watchedImageUrl]);

  useEffect(() => {
    reset(editProduct
      ? {
          name: editProduct.name, sku: editProduct.sku,
          barcode: editProduct.barcode || '', description: editProduct.description || '',
          imageUrl: editProduct.imageUrl || '',
          costPrice: editProduct.costPrice, sellingPrice: editProduct.sellingPrice,
          categoryId: editProduct.category?.id || '',
          supplierId: editProduct.supplier?.id || '',
          minStockLevel: editProduct.minStockLevel, status: editProduct.status,
        }
      : { stock: 0, minStockLevel: 10, status: 'ACTIVE', imageUrl: '' }
    );
  }, [editProduct, reset]);

  const [createProduct, { loading: creating }] = useMutation(CREATE_PRODUCT);
  const [updateProduct, { loading: updating }] = useMutation(UPDATE_PRODUCT);

  const onSubmit = async (values: ProductForm) => {
    const payload = { ...values, imageUrl: values.imageUrl || null };
    try {
      if (editProduct) {
        const { stock, ...rest } = payload;
        await updateProduct({ variables: { id: editProduct.id, ...rest } });
        success('Product updated', `${values.name} has been saved.`);
      } else {
        await createProduct({ variables: payload });
        success('Product created', `${values.name} added to inventory.`);
      }
      refetch(); reset(); onClose();
    } catch (e: any) { toastError('Operation failed', e.message); }
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
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
            <h2 className="text-lg font-semibold text-foreground">
              {editProduct ? 'Edit Product' : 'Add New Product'}
            </h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            {/* Name + SKU */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lc}>Product Name *</label>
                <input {...register('name')} placeholder="e.g. iPhone 15 Pro" className={ic} />
                {errors.name && <p className={ec}>{errors.name.message}</p>}
              </div>
              <div>
                <label className={lc}>SKU *</label>
                <input {...register('sku')} placeholder="e.g. TECH-001" className={ic} />
                {errors.sku && <p className={ec}>{errors.sku.message}</p>}
              </div>
            </div>

            {/* Category + Supplier */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lc}>Category *</label>
                <select {...register('categoryId')} className={ic}>
                  <option value="">Select category...</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.categoryId && <p className={ec}>{errors.categoryId.message}</p>}
              </div>
              <div>
                <label className={lc}>Supplier</label>
                <select {...register('supplierId')} className={ic}>
                  <option value="">No supplier</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {/* Cost + Selling */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lc}>Cost Price *</label>
                <input {...register('costPrice', { valueAsNumber: true })} type="number" step="0.01" placeholder="0.00" className={ic} />
                {errors.costPrice && <p className={ec}>{errors.costPrice.message}</p>}
              </div>
              <div>
                <label className={lc}>Selling Price *</label>
                <input {...register('sellingPrice', { valueAsNumber: true })} type="number" step="0.01" placeholder="0.00" className={ic} />
                {errors.sellingPrice && <p className={ec}>{errors.sellingPrice.message}</p>}
              </div>
            </div>

            {/* Stock + Min (stock only on create) */}
            <div className="grid grid-cols-2 gap-4">
              {!editProduct && (
                <div>
                  <label className={lc}>Initial Stock</label>
                  <input {...register('stock', { valueAsNumber: true })} type="number" placeholder="0" className={ic} />
                  <p className="text-xs text-muted-foreground mt-1">Adjust via Inventory later</p>
                </div>
              )}
              <div className={editProduct ? 'col-span-2' : ''}>
                <label className={lc}>Min Stock Level</label>
                <input {...register('minStockLevel', { valueAsNumber: true })} type="number" placeholder="10" className={ic} />
              </div>
            </div>

            {/* Status (edit only) */}
            {editProduct && (
              <div>
                <label className={lc}>Status</label>
                <select {...register('status')} className={ic}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                </select>
              </div>
            )}

            {/* Image URL */}
            <div>
              <label className={lc}>Product Image URL</label>
              <div className="flex gap-3 items-start">
                <div className="flex-1">
                  <input {...register('imageUrl')} placeholder="https://example.com/image.jpg" className={ic} />
                  {errors.imageUrl && <p className={ec}>{errors.imageUrl.message}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Paste a direct link to the product photo</p>
                </div>
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" onError={() => setImagePreview('')}
                    className="w-14 h-14 rounded-lg object-cover border border-border shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                    <ImageIcon size={20} />
                  </div>
                )}
              </div>
            </div>

            {/* Barcode */}
            <div>
              <label className={lc}>Barcode / EAN</label>
              <input {...register('barcode')} placeholder="Optional — scan or type" className={ic} />
            </div>

            {/* Description */}
            <div>
              <label className={lc}>Description</label>
              <textarea {...register('description')} placeholder="Optional product description..." rows={3}
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
                {creating || updating ? 'Saving…' : editProduct ? 'Update Product' : 'Create Product'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
];

export default function Products() {
  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sorting, setSorting]           = useState<SortingState>([]);
  const [modalOpen, setModalOpen]       = useState(false);
  const [editProduct, setEditProduct]   = useState<any>(null);
  const { success, error: toastError }  = useToast();
  const { canMutate, canAdminDelete }   = useRole();

  const { data, loading, refetch } = useQuery(GET_PRODUCTS, {
    variables: { search: debouncedSearch || undefined, status: statusFilter || undefined },
  });
  const [deleteProduct] = useMutation(DELETE_PRODUCT);

  const products: Product[] = data?.products  || [];
  const categories          = data?.categories || [];
  const suppliers           = data?.suppliers  || [];

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any).__st);
    (window as any).__st = setTimeout(() => setDebounced(v), 300);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Permanently delete "${name}"?`)) return;
    try {
      await deleteProduct({ variables: { id } });
      success('Product deleted', `"${name}" removed.`);
      refetch();
    } catch (e: any) { toastError('Delete failed', e.message); }
  };

  const statusColors: Record<string, string> = {
    ACTIVE:       'bg-emerald-500/10 text-emerald-600',
    INACTIVE:     'bg-muted text-muted-foreground',
    OUT_OF_STOCK: 'bg-destructive/10 text-destructive',
  };

  const columns = [
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-1.5 font-semibold hover:text-primary transition-colors">
          Name <ArrowUpDown size={13} />
        </button>
      ),
      cell: info => {
        const img = info.row.original.imageUrl;
        return (
          <div className="flex items-center gap-3">
            {img ? (
              <img src={img} alt={info.getValue()} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                className="w-8 h-8 rounded-lg object-cover shrink-0 border border-border" />
            ) : (
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                <Package size={15} />
              </div>
            )}
            <div>
              <p className="font-medium text-foreground leading-tight">{info.getValue()}</p>
              {info.row.original.supplier?.name && (
                <p className="text-xs text-muted-foreground">{info.row.original.supplier.name}</p>
              )}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor('sku', {
      header: 'SKU',
      cell: info => <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-muted-foreground">{info.getValue()}</code>,
    }),
    columnHelper.accessor('category.name', {
      header: 'Category',
      cell: info => (
        <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">{info.getValue() || '—'}</span>
      ),
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
        return <span className={`font-semibold ${v >= 30 ? 'text-emerald-500' : v >= 15 ? 'text-amber-500' : 'text-destructive'}`}>{v.toFixed(1)}%</span>;
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
            <span className={`font-bold tabular-nums ${v === 0 ? 'text-destructive' : v <= min ? 'text-amber-500' : 'text-emerald-500'}`}>{v}</span>
          </div>
        );
      },
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[info.getValue()] || statusColors.ACTIVE}`}>
          {info.getValue().replace(/_/g, ' ')}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          {canMutate && (
            <button onClick={() => { setEditProduct(row.original); setModalOpen(true); }}
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit">
              <Edit2 size={14} />
            </button>
          )}
          {canAdminDelete && (
            <button onClick={() => handleDelete(row.original.id, row.original.name)}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Delete">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: products, columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize  = table.getState().pagination.pageSize;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Products</h2>
          <p className="text-sm text-muted-foreground">{products.length} products in inventory</p>
        </div>
        {canMutate && (
          <button onClick={() => { setEditProduct(null); setModalOpen(true); }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm">
            <Plus size={16} /> Add Product
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-muted/20">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Search name, SKU or barcode…"
              value={search} onChange={e => handleSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none">
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

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
                <tr><td colSpan={8} className="px-5 py-14 text-center">
                  <div className="flex justify-center"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
                </td></tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-14 text-center text-muted-foreground text-sm">No products found.</td></tr>
              ) : table.getRowModel().rows.map((row, i) => (
                <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.025 }}
                  className="border-b border-border hover:bg-muted/20 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-5 py-3.5 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {products.length === 0 ? 'No products' : (
              <>Showing <span className="font-medium text-foreground">{pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, products.length)}</span>{' '}of{' '}<span className="font-medium text-foreground">{products.length}</span> products</>
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
                  className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${pageIndex === i ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>
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

      <ProductModal open={modalOpen} onClose={() => { setModalOpen(false); setEditProduct(null); }}
        categories={categories} suppliers={suppliers} refetch={refetch} editProduct={editProduct} />
    </div>
  );
}
