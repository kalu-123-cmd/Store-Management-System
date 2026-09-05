import React, { useState } from 'react';
import { useMutation, useQuery, useApolloClient, gql } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Upload, FileText, AlertTriangle, CheckCircle, Download,
  RefreshCw, Eye, Play, X, ChevronRight,
} from 'lucide-react';
import { useToast } from '../components/Toast';

// ── GraphQL ───────────────────────────────────────────────────────────────────

const PREVIEW_IMPORT = gql`
  mutation PreviewProductImport($csvContent: String!) {
    previewProductImport(csvContent: $csvContent) {
      totalRows
      validRows
      warningRows
      errorRows
      createCount
      updateCount
      skipCount
      validations {
        isValid
        rowNumber
        data
        errors
        warnings
        action
      }
    }
  }
`;

const IMPORT_PRODUCTS = gql`
  mutation ImportProducts($csvContent: String!) {
    importProducts(csvContent: $csvContent) {
      success
      summary {
        totalProcessed
        created
        updated
        skipped
        failed
        stockChanges
      }
      errors {
        rowNumber
        sku
        error
      }
      importId
    }
  }
`;

const GET_IMPORT_HISTORY = gql`
  query GetImportHistory {
    getImportHistory {
      id
      fileName
      importType
      userId
      userName
      totalRows
      created
      updated
      failed
      stockChanges
      status
      errorMessage
      createdAt
    }
  }
`;

// Queries to invalidate after a successful import so the dashboard refreshes
const _DASHBOARD_QUERIES = ['GetDashboardMain', 'GetActivity']; // kept for reference

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportValidation {
  isValid: boolean;
  rowNumber: number;
  data: any;
  errors: string[];
  warnings: string[];
  action: string;
}

interface ImportPreview {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  createCount: number;
  updateCount: number;
  skipCount: number;
  validations: ImportValidation[];
}

// ── Excel / CSV conversion helper ─────────────────────────────────────────────

/**
 * Accepts a File of any supported type (.csv, .xlsx, .xls) and resolves with
 * a plain CSV string that the backend can parse.
 */
function readFileAsCSV(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    if (file.name.toLowerCase().endsWith('.csv')) {
      // Plain text — read as-is
      reader.onload = (e) => resolve(e.target?.result as string ?? '');
      reader.onerror = () => reject(new Error('Failed to read CSV file'));
      reader.readAsText(file);
    } else {
      // Excel (.xlsx / .xls) — read as binary, convert first sheet → CSV
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const csv = XLSX.utils.sheet_to_csv(firstSheet);
          resolve(csv);
        } catch {
          reject(new Error('Failed to parse Excel file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read Excel file'));
      reader.readAsArrayBuffer(file);
    }
  });
}

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];
const ACCEPTED_MIME = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
].join(',');

function isAcceptedFile(file: File): boolean {
  return ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CSVImportPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const apolloClient = useApolloClient();

  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const [previewImport] = useMutation(PREVIEW_IMPORT);
  const [importProducts] = useMutation(IMPORT_PRODUCTS);
  const { data: historyData, refetch: refetchHistory } = useQuery(GET_IMPORT_HISTORY);

  // ── File selection ──────────────────────────────────────────────────────────

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    // Reset input so the same file can be re-selected after a reset
    event.target.value = '';

    if (!selectedFile) return;

    if (!isAcceptedFile(selectedFile)) {
      toast({ type: 'error', title: 'Invalid file type', message: 'Please select a CSV or Excel (.xlsx / .xls) file' });
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({ type: 'error', title: 'File too large', message: 'Maximum file size is 10 MB' });
      return;
    }

    try {
      const csv = await readFileAsCSV(selectedFile);
      setFile(selectedFile);
      setCsvContent(csv);
    } catch (err: any) {
      toast({ type: 'error', title: 'Read error', message: err.message ?? 'Could not read file' });
    }
  };

  // Drag-and-drop support
  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;

    if (!isAcceptedFile(droppedFile)) {
      toast({ type: 'error', title: 'Invalid file type', message: 'Please drop a CSV or Excel (.xlsx / .xls) file' });
      return;
    }
    if (droppedFile.size > 10 * 1024 * 1024) {
      toast({ type: 'error', title: 'File too large', message: 'Maximum file size is 10 MB' });
      return;
    }

    try {
      const csv = await readFileAsCSV(droppedFile);
      setFile(droppedFile);
      setCsvContent(csv);
    } catch (err: any) {
      toast({ type: 'error', title: 'Read error', message: err.message ?? 'Could not read file' });
    }
  };

  // ── Preview ─────────────────────────────────────────────────────────────────

  const handlePreview = async () => {
    if (!csvContent) return;
    try {
      const result = await previewImport({ variables: { csvContent } });
      setPreview(result.data.previewProductImport);
      setStep('preview');
    } catch {
      toast({ type: 'error', title: 'Preview failed', message: 'Failed to analyse the file' });
    }
  };

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!csvContent) return;
    setStep('importing');

    try {
      const result = await importProducts({ variables: { csvContent } });
      const data = result.data.importProducts;
      setImportResult(data);
      setStep('complete');

      const { created, updated, failed, stockChanges } = data.summary;

      if (data.success) {
        toast({
          type: 'success',
          title: 'Import completed',
          message: `Created ${created} · Updated ${updated} · Stock changes ${stockChanges}${failed > 0 ? ` · ${failed} failed` : ''}`,
        });
      } else {
        toast({
          type: 'warning',
          title: 'Import completed with errors',
          message: `${failed} rows failed to import`,
        });
      }

      // Evict all Apollo cache so dashboard, products, and inventory all
      // fetch fresh data immediately after the import completes.
      await apolloClient.refetchQueries({ include: 'active' });
      refetchHistory();
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Import failed',
        message: err?.message ?? 'An unexpected error occurred',
      });
      setStep('preview');
    }
  };

  // ── Reset ───────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setFile(null);
    setCsvContent('');
    setPreview(null);
    setImportResult(null);
    setStep('upload');
  };

  // ── Error report download ───────────────────────────────────────────────────

  const downloadErrorReport = () => {
    if (!importResult?.errors?.length) return;
    const content = 'rowNumber,sku,error\n' +
      importResult.errors.map((e: any) => `${e.rowNumber},${e.sku},"${e.error}"`).join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  // Allow import when at least one valid row exists (errors rows are just skipped)
  const canImport = preview ? preview.validRows > 0 : false;

  // ── Render ───────────────────────────────────────────────────────────────────

  // ── Step: upload ────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">CSV / Excel Product Import</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Import products from CSV or Excel files (.csv, .xlsx, .xls) into your inventory
            </p>
          </div>
          <button
            onClick={() => refetchHistory()}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh History</span>
          </button>
        </div>

        {/* Upload area */}
        <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-12 text-center">
          <input
            type="file"
            accept={ACCEPTED_MIME + ',' + ACCEPTED_EXTENSIONS.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className="cursor-pointer flex flex-col items-center space-y-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-medium text-slate-900 dark:text-white">Select or drag a file</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">CSV or Excel format</p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Supported: .csv · .xlsx · .xls (max 10 MB)</p>
          </label>
        </div>

        {/* Selected file badge */}
        {file && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{file.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            </div>
            <button onClick={() => { setFile(null); setCsvContent(''); }} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {file && (
          <button
            onClick={handlePreview}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
          >
            <Eye className="h-5 w-5" />
            <span>Preview Import</span>
          </button>
        )}

        {/* Template download hint */}
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 dark:text-white">Accepted column names</h3>
            <a
              href="/sample-products.csv"
              download="sample-products.csv"
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-300 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Download sample CSV
            </a>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Your file must contain a <strong>Product Name</strong> and a <strong>Product Code / SKU</strong>. All other columns are optional.
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Required</p>
              <div className="space-y-1">
                {[['Product Name / name', 'Product name'], ['Product Code / sku / code', 'Unique identifier']].map(([col, desc]) => (
                  <div key={col} className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded font-mono text-slate-700 dark:text-slate-300">{col}</span>
                    <span className="text-slate-500">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Optional (auto-detected)</p>
              <div className="flex flex-wrap gap-1">
                {['Category', 'Quantity / stock', 'Minimum Stock', 'Unit Cost (ETB)', 'Selling Price', 'Supplier', 'Barcode', 'Expiry Date'].map((col) => (
                  <span key={col} className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded font-mono text-slate-700 dark:text-slate-300">{col}</span>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 border-t border-slate-200 dark:border-slate-700 pt-3">
            ✅ Government institution format supported — <em>Unit Cost (ETB)</em> is used as cost price. Selling price defaults to cost price if not provided.
          </p>
        </div>

        {/* Import history */}
        {historyData?.getImportHistory?.length > 0 && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">Import History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50">
                    {['Date', 'File', 'User', 'Rows', 'Created', 'Updated', 'Failed', 'Stock Δ', 'Status'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historyData.getImportHistory.map((h: any) => (
                    <tr key={h.id} className="border-b border-slate-100 dark:border-slate-700">
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-200">{new Date(h.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-200">{h.fileName}</td>
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-200">{h.userName}</td>
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-200">{h.totalRows}</td>
                      <td className="px-6 py-4 text-sm text-green-600 font-medium">{h.created}</td>
                      <td className="px-6 py-4 text-sm text-blue-600 font-medium">{h.updated}</td>
                      <td className="px-6 py-4 text-sm text-red-600 font-medium">{h.failed}</td>
                      <td className="px-6 py-4 text-sm text-amber-600 font-medium">{h.stockChanges}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          h.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          h.status === 'PARTIAL'   ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {h.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Step: preview ────────────────────────────────────────────────────────────
  if (step === 'preview' && preview) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Import Preview</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Review data before importing — rows with errors will be skipped automatically</p>
          </div>
          <button onClick={handleReset} className="flex items-center space-x-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Rows',  value: preview.totalRows,   cls: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800',      txt: 'text-slate-900 dark:text-white' },
            { label: 'Valid',       value: preview.validRows,   cls: 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20',  txt: 'text-green-700 dark:text-green-400' },
            { label: 'Warnings',    value: preview.warningRows, cls: 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20',  txt: 'text-amber-700 dark:text-amber-400' },
            { label: 'Errors',      value: preview.errorRows,   cls: 'border-red-200   dark:border-red-700   bg-red-50   dark:bg-red-900/20',    txt: 'text-red-700   dark:text-red-400' },
          ].map(({ label, value, cls, txt }) => (
            <div key={label} className={`border rounded-xl p-6 ${cls}`}>
              <div className={`text-sm mb-1 ${txt}`}>{label}</div>
              <div className={`text-3xl font-bold ${txt}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Action breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Will Create',       value: preview.createCount,  cls: 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20',     txt: 'text-blue-700 dark:text-blue-400' },
            { label: 'Will Update',       value: preview.updateCount,  cls: 'border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20', txt: 'text-purple-700 dark:text-purple-400' },
            { label: 'Will Skip',         value: preview.skipCount,    cls: 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800',      txt: 'text-slate-700 dark:text-slate-300' },
            { label: 'Rows with Errors',  value: preview.errorRows,    cls: 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20',           txt: 'text-red-700 dark:text-red-400' },
          ].map(({ label, value, cls, txt }) => (
            <div key={label} className={`border rounded-xl p-4 ${cls}`}>
              <div className={`text-sm mb-1 ${txt}`}>{label}</div>
              <div className={`text-2xl font-bold ${txt}`}>{value}</div>
            </div>
          ))}
        </div>

        {preview.errorRows > 0 && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <span className="font-semibold">{preview.errorRows} rows have errors</span> and will be skipped. The remaining{' '}
              <span className="font-semibold">{preview.validRows} valid rows</span> will still be imported.
            </p>
          </div>
        )}

        {/* Validation table */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">Validation Results</h3>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50">
                  {['Row', 'Product', 'SKU', 'Category', 'Action', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.validations.map((v, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-200">{v.rowNumber}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-200">{v.data.name}</td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-slate-200">{v.data.sku}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-200">{v.data.category}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        v.action === 'CREATE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        v.action === 'UPDATE' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                        v.action === 'SKIP'   ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' :
                                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {v.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {v.isValid ? (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">{v.warnings.length > 0 ? v.warnings[0] : 'Valid'}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm">{v.errors[0]}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <button onClick={handleReset} className="px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!canImport}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Play className="h-5 w-5" />
            <span>Import {preview.validRows} Valid Rows</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Step: importing ──────────────────────────────────────────────────────────
  if (step === 'importing') {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <RefreshCw className="animate-spin text-blue-600 h-12 w-12" />
        <p className="text-lg text-slate-600 dark:text-slate-400">Importing products…</p>
        <p className="text-sm text-slate-500 dark:text-slate-500">Please wait, do not close this page</p>
      </div>
    );
  }

  // ── Step: complete ───────────────────────────────────────────────────────────
  if (step === 'complete' && importResult) {
    const { created, updated, skipped, failed, stockChanges, totalProcessed } = importResult.summary;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Import Complete</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Your products have been imported — the dashboard has been updated</p>
          </div>
          <button onClick={handleReset} className="flex items-center space-x-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
            <ChevronRight className="h-4 w-4" />
            <span>Import More</span>
          </button>
        </div>

        {/* Result summary */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
            {[
              { label: 'Total',   value: totalProcessed, cls: 'text-slate-900 dark:text-white' },
              { label: 'Created', value: created,        cls: 'text-green-600 dark:text-green-400' },
              { label: 'Updated', value: updated,        cls: 'text-blue-600 dark:text-blue-400' },
              { label: 'Skipped', value: skipped,        cls: 'text-slate-600 dark:text-slate-400' },
              { label: 'Failed',  value: failed,         cls: 'text-red-600 dark:text-red-400' },
              { label: 'Stock Δ', value: stockChanges,   cls: 'text-amber-600 dark:text-amber-400' },
            ].map(({ label, value, cls }) => (
              <div key={label}>
                <div className={`text-sm mb-1 ${cls}`}>{label}</div>
                <div className={`text-3xl font-bold ${cls}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <div className="flex space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => navigate('/products')}
              className="px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              View Products
            </button>
            {importResult.errors?.length > 0 && (
              <button
                onClick={downloadErrorReport}
                className="px-6 py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center space-x-2"
              >
                <Download className="h-5 w-5" />
                <span>Download Error Report</span>
              </button>
            )}
          </div>
        </div>

        {/* Error details (if any) */}
        {importResult.errors?.length > 0 && (
          <div className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
              <h3 className="font-semibold text-red-800 dark:text-red-300">Failed Rows ({importResult.errors.length})</h3>
            </div>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full">
                <thead>
                  <tr className="bg-red-50 dark:bg-red-900/10">
                    {['Row', 'SKU', 'Error'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-red-600 dark:text-red-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importResult.errors.map((e: any, i: number) => (
                    <tr key={i} className="border-b border-red-100 dark:border-red-800">
                      <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-200">{e.rowNumber}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-slate-200">{e.sku}</td>
                      <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{e.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default CSVImportPage;
