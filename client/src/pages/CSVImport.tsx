import React, { useState } from 'react';
import { useMutation, useQuery, gql } from '@apollo/client';
import { Upload, FileText, AlertTriangle, CheckCircle, Download, RefreshCw, Eye, Play, X, ChevronRight } from 'lucide-react';
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
      status
      errorMessage
      createdAt
    }
  }
`;

// ── Types ───────────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export function CSVImportPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const [previewImport] = useMutation(PREVIEW_IMPORT);
  const [importProducts] = useMutation(IMPORT_PRODUCTS);
  const { data: historyData, refetch: refetchHistory } = useQuery(GET_IMPORT_HISTORY);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.endsWith('.csv')) {
        toast({
          type: 'error',
          title: 'Invalid file type',
          message: 'Please select a CSV file',
        });
        return;
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          type: 'error',
          title: 'File too large',
          message: 'Maximum file size is 10MB',
        });
        return;
      }

      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        setCsvContent(e.target?.result as string);
      };
      reader.readAsText(selectedFile);
    }
  };

  const handlePreview = async () => {
    if (!csvContent) return;

    try {
      const result = await previewImport({ variables: { csvContent } });
      setPreview(result.data.previewProductImport);
      setStep('preview');
    } catch (error) {
      toast({
        type: 'error',
        title: 'Preview failed',
        message: 'Failed to analyze CSV file',
      });
    }
  };

  const handleImport = async () => {
    if (!csvContent) return;

    setStep('importing');
    try {
      const result = await importProducts({ variables: { csvContent } });
      setImportResult(result.data.importProducts);
      setStep('complete');
      
      if (result.data.importProducts.success) {
        toast({
          type: 'success',
          title: 'Import completed',
          message: `Successfully imported ${result.data.importProducts.summary.created} products`,
        });
      } else {
        toast({
          type: 'warning',
          title: 'Import completed with errors',
          message: `${result.data.importProducts.summary.failed} rows failed to import`,
        });
      }
      
      refetchHistory();
    } catch (error) {
      toast({
        type: 'error',
        title: 'Import failed',
        message: 'Failed to import products',
      });
      setStep('preview');
    }
  };

  const handleReset = () => {
    setFile(null);
    setCsvContent('');
    setPreview(null);
    setImportResult(null);
    setStep('upload');
  };

  const downloadErrorReport = () => {
    if (!importResult?.errors || importResult.errors.length === 0) return;

    const csvContent = 'rowNumber,sku,error\n' + 
      importResult.errors.map(e => `${e.rowNumber},${e.sku},"${e.error}"`).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (step === 'upload') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">CSV Product Import</h2>
            <p className="text-sm text-slate-600">Import products from CSV files into your inventory</p>
          </div>
          <button
            onClick={() => refetchHistory()}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh History</span>
          </button>
        </div>

        {/* Upload Area */}
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className="cursor-pointer flex flex-col items-center space-y-4"
          >
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Upload className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-medium text-slate-900">Select CSV file</p>
              <p className="text-sm text-slate-600">Drag and drop or click to browse</p>
            </div>
            <p className="text-xs text-slate-500">Supported format: .csv (max 10MB)</p>
          </label>
        </div>

        {file && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-slate-900">{file.name}</p>
                <p className="text-sm text-slate-600">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-slate-500 hover:text-slate-700"
            >
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

        {/* Import History */}
        {historyData?.getImportHistory && historyData.getImportHistory.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Import History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">File</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Rows</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Updated</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Failed</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.getImportHistory.map((history: any) => (
                    <tr key={history.id} className="border-b border-slate-100">
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {new Date(history.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">{history.fileName}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{history.userName}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{history.totalRows}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{history.created}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{history.updated}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{history.failed}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          history.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                          history.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {history.status}
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

  if (step === 'preview' && preview) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Import Preview</h2>
            <p className="text-sm text-slate-600">Review and validate your CSV data before importing</p>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="text-sm text-slate-600 mb-1">Total Rows</div>
            <div className="text-3xl font-bold text-slate-900">{preview.totalRows}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="text-sm text-green-700 mb-1">Valid</div>
            <div className="text-3xl font-bold text-green-700">{preview.validRows}</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <div className="text-sm text-amber-700 mb-1">Warnings</div>
            <div className="text-3xl font-bold text-amber-700">{preview.warningRows}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="text-sm text-red-700 mb-1">Errors</div>
            <div className="text-3xl font-bold text-red-700">{preview.errorRows}</div>
          </div>
        </div>

        {/* Import Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-sm text-blue-700 mb-1">Will Create</div>
            <div className="text-2xl font-bold text-blue-700">{preview.createCount}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="text-sm text-purple-700 mb-1">Will Update</div>
            <div className="text-2xl font-bold text-purple-700">{preview.updateCount}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="text-sm text-slate-700 mb-1">Will Skip</div>
            <div className="text-2xl font-bold text-slate-700">{preview.skipCount}</div>
          </div>
        </div>

        {/* Validation Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Validation Results</h3>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Row</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.validations.map((validation, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-sm text-slate-900">{validation.rowNumber}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{validation.data.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{validation.data.sku}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{validation.data.category}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        validation.action === 'CREATE' ? 'bg-blue-100 text-blue-700' :
                        validation.action === 'UPDATE' ? 'bg-purple-100 text-purple-700' :
                        validation.action === 'SKIP' ? 'bg-slate-100 text-slate-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {validation.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {validation.isValid ? (
                        <span className="flex items-center space-x-1 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">Valid</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-red-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm">{validation.errors[0]}</span>
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
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={preview.errorRows > 0}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Play className="h-5 w-5" />
            <span>Import Products</span>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'importing') {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <RefreshCw className="animate-spin text-blue-600 h-12 w-12 mb-4" />
        <p className="text-lg text-slate-600">Importing products...</p>
      </div>
    );
  }

  if (step === 'complete' && importResult) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Import Complete</h2>
            <p className="text-sm text-slate-600">Your products have been imported successfully</p>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
            <span>Import More</span>
          </button>
        </div>

        {/* Summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div>
              <div className="text-sm text-slate-600 mb-1">Total Processed</div>
              <div className="text-3xl font-bold text-slate-900">{importResult.summary.totalProcessed}</div>
            </div>
            <div>
              <div className="text-sm text-green-600 mb-1">Created</div>
              <div className="text-3xl font-bold text-green-600">{importResult.summary.created}</div>
            </div>
            <div>
              <div className="text-sm text-blue-600 mb-1">Updated</div>
              <div className="text-3xl font-bold text-blue-600">{importResult.summary.updated}</div>
            </div>
            <div>
              <div className="text-sm text-slate-600 mb-1">Skipped</div>
              <div className="text-3xl font-bold text-slate-600">{importResult.summary.skipped}</div>
            </div>
            <div>
              <div className="text-sm text-red-600 mb-1">Failed</div>
              <div className="text-3xl font-bold text-red-600">{importResult.summary.failed}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <div className="flex space-x-4">
            <button
              onClick={() => window.location.href = '/products'}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Products
            </button>
            {importResult.errors.length > 0 && (
              <button
                onClick={downloadErrorReport}
                className="px-6 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center space-x-2"
              >
                <Download className="h-5 w-5" />
                <span>Download Error Report</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default CSVImportPage;