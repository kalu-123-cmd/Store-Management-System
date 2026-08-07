import React, { useRef, useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { motion } from 'framer-motion';
import { Printer, Search, X, CheckSquare, Square } from 'lucide-react';
import { fmt } from '../lib/currency';
import { useLangContext } from '../lib/LangContext';

const GET_PRODUCTS = gql`
  query { products { id name sku barcode sellingPrice category { name } } }
`;

// ── Mini barcode renderer using CSS/Unicode bars ──────────────────────────────
// Uses a simple pattern to visualize the barcode visually without a library
function BarcodeVisual({ value }: { value: string }) {
  // Generate a deterministic bar pattern from the string
  const bars = value.split('').map((c, i) => {
    const w = ((c.charCodeAt(0) * (i + 3)) % 3) + 1;
    const isSpace = (c.charCodeAt(0) + i) % 4 === 0;
    return { w, isSpace };
  });

  return (
    <div className="flex items-end justify-center gap-px h-12">
      {/* Guard bar left */}
      <div className="w-0.5 h-full bg-black" />
      <div className="w-px h-full bg-white" />
      <div className="w-0.5 h-full bg-black" />
      {bars.map((b, i) => (
        <div
          key={i}
          style={{ width: `${b.w * 1.5}px` }}
          className={`${b.isSpace ? 'bg-white' : 'bg-black'} h-full`}
        />
      ))}
      {/* Guard bar right */}
      <div className="w-0.5 h-full bg-black" />
      <div className="w-px h-full bg-white" />
      <div className="w-0.5 h-full bg-black" />
    </div>
  );
}

function BarcodeLabel({ product, showPrice }: { product: any; showPrice: boolean }) {
  return (
    <div className="border border-gray-300 rounded p-2 bg-white text-black w-48 shrink-0" style={{ fontFamily: 'monospace' }}>
      <p className="text-[9px] font-bold text-center truncate mb-1">{product.name}</p>
      <BarcodeVisual value={product.barcode || product.sku} />
      <p className="text-[8px] text-center mt-1 tracking-widest">{product.barcode || product.sku}</p>
      {showPrice && (
        <p className="text-[9px] font-bold text-center mt-0.5">{fmt(product.sellingPrice)}</p>
      )}
    </div>
  );
}

export default function BarcodePrint() {
  const { data, loading } = useQuery(GET_PRODUCTS, { fetchPolicy: 'cache-and-network' });
  const { t } = useLangContext();
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [copies, setCopies]         = useState(1);
  const [showPrice, setShowPrice]   = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const products = (data?.products || []).filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map((p: any) => p.id)));
  };

  const selectedProducts = products.filter((p: any) => selected.has(p.id));

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;
    w.document.write(`
      <html><head><title>Barcode Labels — StoreOS</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: monospace; background: white; padding: 8px; }
        .grid { display: flex; flex-wrap: wrap; gap: 4px; }
        .label { border: 1px solid #ccc; padding: 6px; width: 192px; text-align: center; }
        .bars { display: flex; align-items: flex-end; justify-content: center; gap: 1px; height: 48px; margin: 4px 0; }
        .bar { height: 100%; }
        p { font-size: 8px; margin: 2px 0; }
        .bold { font-weight: bold; font-size: 9px; }
      </style></head>
      <body onload="window.print();window.close()">
        <div class="grid">${content}</div>
      </body></html>
    `);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Barcode Labels</h2>
          <p className="text-sm text-muted-foreground">Select products and print barcode labels</p>
        </div>
        <button
          onClick={handlePrint}
          disabled={selected.size === 0}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-40"
        >
          <Printer size={16} /> {t('print')} {selected.size > 0 ? `(${selected.size})` : ''}
        </button>
      </div>

      {/* Options */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Copies per label:</label>
          <input type="number" min={1} max={20} value={copies}
            onChange={e => setCopies(Math.max(1, Math.min(20, Number(e.target.value))))}
            className="w-16 px-2 py-1.5 bg-background border border-border rounded-lg text-sm text-center outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)}
            className="rounded" />
          Show price
        </label>
        <button onClick={toggleAll}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline">
          {selected.size === products.length ? <CheckSquare size={15} /> : <Square size={15} />}
          {selected.size === products.length ? 'Deselect all' : 'Select all'}
        </button>
        {selected.size > 0 && (
          <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Product list */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="px-4 py-3 w-10"></th>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Barcode</th>
                <th className="px-4 py-3 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p: any, i: number) => (
                <motion.tr key={p.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  onClick={() => toggle(p.id)}
                  className={`border-b border-border cursor-pointer transition-colors ${selected.has(p.id) ? 'bg-primary/5' : 'hover:bg-muted/20'}`}>
                  <td className="px-4 py-3">
                    {selected.has(p.id)
                      ? <CheckSquare size={16} className="text-primary" />
                      : <Square size={16} className="text-muted-foreground" />}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3"><code className="text-xs bg-muted px-2 py-1 rounded">{p.sku}</code></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{p.barcode || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(p.sellingPrice)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Hidden print area */}
      <div ref={printRef} className="hidden">
        {selectedProducts.flatMap((p: any) =>
          Array.from({ length: copies }, (_, i) => (
            <div key={`${p.id}-${i}`} className="label">
              <p className="bold">{p.name}</p>
              <div className="bars">
                {(p.barcode || p.sku).split('').map((c: string, j: number) => (
                  <div key={j} className="bar"
                    style={{
                      width: `${((c.charCodeAt(0) * (j + 3)) % 3 + 1) * 1.5}px`,
                      backgroundColor: (c.charCodeAt(0) + j) % 4 === 0 ? 'white' : 'black',
                    }} />
                ))}
              </div>
              <p>{p.barcode || p.sku}</p>
              {showPrice && <p className="bold">{fmt(p.sellingPrice)}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
