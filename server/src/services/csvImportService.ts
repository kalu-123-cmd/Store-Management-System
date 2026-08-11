/**
 * CSV Import Service - Product and Inventory Import
 * 
 * Comprehensive CSV import system with validation, preview, and transactional import
 * Handles product creation, category management, inventory updates, and stock movements
 * 
 * Features:
 * - CSV parsing and validation
 * - Duplicate SKU detection
 * - Category auto-creation
 * - Transactional import with rollback support
 * - Import history tracking
 * - Audit logging
 * - Error reporting
 * 
 * @author Principal Software Architect
 * @version 1.0.0 - StoreOS Enterprise Edition
 */

import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

// Configure Decimal for financial precision
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

// ── Types ───────────────────────────────────────────────────────────────────────

export interface CSVRow {
  [key: string]: string;
}

export interface ProductCSVRow {
  name: string;
  sku: string;
  category: string;
  stock: string;
  costPrice: string;
  sellingPrice: string;
  margin?: string;
}

export interface InventoryCSVRow {
  name: string;
  sku: string;
  stock: string;
  value: string;
  status: string;
}

export interface ImportValidationResult {
  isValid: boolean;
  rowNumber: number;
  data: ProductCSVRow | InventoryCSVRow;
  errors: string[];
  warnings: string[];
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'ERROR';
}

export interface ImportPreview {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  createCount: number;
  updateCount: number;
  skipCount: number;
  validations: ImportValidationResult[];
}

export interface ImportResult {
  success: boolean;
  summary: {
    totalProcessed: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    stockChanges: number;
  };
  errors: Array<{
    rowNumber: number;
    sku: string;
    error: string;
  }>;
  importId?: string;
}

export interface ImportHistory {
  id: string;
  fileName: string;
  importType: 'PRODUCTS' | 'INVENTORY';
  userId: string;
  userName: string;
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  errorMessage?: string;
  createdAt: Date;
}

// ── CSV Parser with Column Normalization ─────────────────────────────────────────

export function parseCSV(content: string): CSVRow[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = normalizeHeaders(parseCSVLine(lines[0]));
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: CSVRow = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row);
  }

  return rows;
}

// Normalize column headers to standard names
function normalizeHeaders(headers: string[]): string[] {
  const headerMap: Record<string, string> = {
    'product name': 'name',
    'product_name': 'name',
    'productname': 'name',
    'sku': 'sku',
    'Sku': 'sku',
    'SKU': 'sku',
    'stock': 'stock',
    'quantity': 'stock',
    'currentstock': 'stock',
    'current_stock': 'stock',
    'cost price': 'costPrice',
    'cost_price': 'costPrice',
    'costprice': 'costPrice',
    'selling price': 'sellingPrice',
    'selling_price': 'sellingPrice',
    'sellingprice': 'sellingPrice',
    'price': 'sellingPrice',
    'category': 'category',
    'brand': 'brand',
    'barcode': 'barcode',
    'margin': 'margin',
    'status': 'status',
  };

  return headers.map(header => {
    const normalized = header.toLowerCase().trim();
    return headerMap[normalized] || normalized;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// ── Validation with Enhanced Rules ─────────────────────────────────────────────────

export function validateProductRow(row: CSVRow, rowNumber: number, existingSKUs: Set<string>): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const name = row['name']?.trim() || '';
  const sku = row['sku']?.trim() || '';
  const category = row['category']?.trim() || '';
  const stock = row['stock']?.trim() || '0';
  const costPrice = row['costPrice']?.trim() || '';
  const sellingPrice = row['sellingPrice']?.trim() || '';
  const margin = row['margin']?.trim();
  const barcode = row['barcode']?.trim() || '';

  // Required fields
  if (!name) errors.push('Product name is required');
  if (!sku) errors.push('SKU is required');

  // Check for duplicate SKU in this CSV batch
  if (sku && existingSKUs.has(sku)) {
    errors.push(`Duplicate SKU "${sku}" in CSV file`);
  } else if (sku) {
    existingSKUs.add(sku);
  }

  // Numeric validation (only if field exists)
  if (stock) {
    const stockNum = parseInt(stock);
    if (isNaN(stockNum) || stockNum < 0) {
      errors.push('Stock must be a non-negative number');
    }
  }

  if (costPrice) {
    const costPriceNum = parseFloat(costPrice);
    if (isNaN(costPriceNum) || costPriceNum < 0) {
      errors.push('Cost price must be a non-negative number');
    }
  }

  if (sellingPrice) {
    const sellingPriceNum = parseFloat(sellingPrice);
    if (isNaN(sellingPriceNum) || sellingPriceNum < 0) {
      errors.push('Selling price must be a non-negative number');
    }
  }

  // Business logic validation (only if both prices exist)
  if (costPrice && sellingPrice) {
    const costPriceNum = parseFloat(costPrice);
    const sellingPriceNum = parseFloat(sellingPrice);
    if (sellingPriceNum < costPriceNum) {
      warnings.push('Selling price is below cost price (loss-making product)');
    }
  }

  // Margin validation (only if provided)
  if (margin) {
    const marginNum = parseFloat(margin);
    if (isNaN(marginNum)) {
      errors.push('Margin must be a valid number');
    } else if (marginNum < 0 || marginNum > 100) {
      errors.push('Margin must be between 0 and 100');
    }
  }

  // SKU format validation
  if (sku && !/^[A-Z0-9-_]+$/.test(sku)) {
    warnings.push('SKU contains non-standard characters (recommended: uppercase letters, numbers, hyphens, underscores)');
  }

  // Barcode validation (if provided)
  if (barcode && !/^[A-Z0-9-_]+$/.test(barcode)) {
    warnings.push('Barcode contains non-standard characters');
  }

  return {
    isValid: errors.length === 0,
    rowNumber,
    data: { name, sku, category, stock, costPrice, sellingPrice, margin, barcode },
    errors,
    warnings,
    action: 'ERROR', // Will be determined by SKU check
  };
}

export function validateInventoryRow(row: CSVRow, rowNumber: number): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const name = row['name']?.trim() || '';
  const sku = row['sku']?.trim() || '';
  const stock = row['stock']?.trim() || '0';
  const value = row['value']?.trim() || '0';
  const status = row['status']?.trim() || 'OK';

  // Required fields
  if (!name) errors.push('Product name is required');
  if (!sku) errors.push('SKU is required');

  // Numeric validation
  const stockNum = parseInt(stock);
  if (isNaN(stockNum) || stockNum < 0) {
    errors.push('Stock must be a non-negative number');
  }

  const valueNum = parseFloat(value);
  if (isNaN(valueNum) || valueNum < 0) {
    errors.push('Value must be a non-negative number');
  }

  // Status validation
  const validStatuses = ['OK', 'LOW STOCK', 'OUT OF STOCK', 'OVERSTOCK', 'EXPIRING'];
  if (!validStatuses.includes(status.toUpperCase())) {
    warnings.push(`Status "${status}" is not a standard status (will be calculated by system)`);
  }

  return {
    isValid: errors.length === 0,
    rowNumber,
    data: { name, sku, stock, value, status },
    errors,
    warnings,
    action: 'ERROR',
  };
}

// ── Import Service ─────────────────────────────────────────────────────────────────

export class CSVImportService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Preview product CSV import with duplicate detection
   */
  async previewProductImport(csvContent: string, userId: string): Promise<ImportPreview> {
    const rows = parseCSV(csvContent);
    const validations: ImportValidationResult[] = [];
    let createCount = 0;
    let updateCount = 0;
    let skipCount = 0;

    // Get existing SKUs and products
    const existingProducts = await this.prisma.product.findMany({
      select: { sku: true, id: true, name: true, stock: true, costPrice: true, sellingPrice: true },
    });
    const existingSKUs = new Map(existingProducts.map(p => [p.sku, p]));
    const csvSKUs = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const validation = validateProductRow(rows[i], i + 1, csvSKUs);
      
      if (!validation.isValid) {
        validation.action = 'ERROR';
      } else {
        const data = validation.data as ProductCSVRow;
        
        if (existingSKUs.has(data.sku)) {
          validation.action = 'UPDATE';
          updateCount++;
        } else {
          validation.action = 'CREATE';
          createCount++;
        }
      }
      
      validations.push(validation);
    }

    const validRows = validations.filter(v => v.isValid).length;
    const warningRows = validations.filter(v => v.isValid && v.warnings.length > 0).length;
    const errorRows = validations.filter(v => !v.isValid).length;

    return {
      totalRows: rows.length,
      validRows,
      warningRows,
      errorRows,
      createCount,
      updateCount,
      skipCount,
      validations,
    };
  }

  /**
   * Execute product CSV import with automatic synchronization
   */
  async importProducts(csvContent: string, userId: string): Promise<ImportResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const preview = await this.previewProductImport(csvContent, userId);
        const errors: Array<{ rowNumber: number; sku: string; error: string }> = [];
        let created = 0;
        let updated = 0;
        let skipped = 0;
        let stockChanges = 0;

        // Get existing products and categories
        const existingProducts = await tx.product.findMany({
          select: { sku: true, id: true, name: true, stock: true, costPrice: true, sellingPrice: true, categoryId: true },
        });
        const existingSKUs = new Map(existingProducts.map(p => [p.sku, p]));

        const existingCategories = await tx.category.findMany({
          select: { name: true, id: true },
        });
        const categoryMap = new Map(existingCategories.map(c => [c.name.toLowerCase(), c.id]));

        // Process valid rows
        for (const validation of preview.validations) {
          if (!validation.isValid) {
            errors.push({
              rowNumber: validation.rowNumber,
              sku: (validation.data as ProductCSVRow).sku,
              error: validation.errors.join(', '),
            });
            continue;
          }

          const data = validation.data as ProductCSVRow;
          const stock = data.stock ? parseInt(data.stock) : 0;
          const costPrice = data.costPrice ? parseFloat(data.costPrice) : null;
          const sellingPrice = data.sellingPrice ? parseFloat(data.sellingPrice) : null;

          // Find or create category
          let categoryId = categoryMap.get(data.category.toLowerCase());
          if (!categoryId && data.category) {
            const newCategory = await tx.category.create({
              data: { name: data.category },
            });
            categoryId = newCategory.id;
            categoryMap.set(data.category.toLowerCase(), categoryId);
          }

          if (validation.action === 'CREATE') {
            // Create new product
            const newProduct = await tx.product.create({
              data: {
                name: data.name,
                sku: data.sku,
                categoryId: categoryId || null,
                costPrice: costPrice || 0,
                sellingPrice: sellingPrice || 0,
                stock,
                minStockLevel: 10,
                status: 'ACTIVE',
                barcode: data.barcode || null,
              },
            });

            // Create initial stock movement
            await tx.transaction.create({
              data: {
                productId: newProduct.id,
                quantity: stock,
                type: 'IN',
                notes: 'CSV SYNCHRONIZATION - Initial import',
                userId,
                unitPrice: costPrice || 0,
                subtotal: stock * (costPrice || 0),
                vatAmount: stock * (costPrice || 0) * 0.15,
                totalAmount: stock * (costPrice || 0) * 1.15,
              },
            });

            created++;
            stockChanges++;
          } else if (validation.action === 'UPDATE') {
            // Update existing product - only update fields that exist in CSV
            const existingProduct = existingSKUs.get(data.sku);
            if (existingProduct) {
              const updateData: any = {};
              
              // Only update fields that are provided in CSV
              if (data.name) updateData.name = data.name;
              if (categoryId) updateData.categoryId = categoryId;
              if (costPrice !== null) updateData.costPrice = costPrice;
              if (sellingPrice !== null) updateData.sellingPrice = sellingPrice;
              if (data.stock !== undefined) updateData.stock = stock;
              if (data.barcode) updateData.barcode = data.barcode;

              // Track stock change
              const previousStock = existingProduct.stock;
              const stockChanged = data.stock !== undefined && previousStock !== stock;

              await tx.product.update({
                where: { id: existingProduct.id },
                data: updateData,
              });

              // Create stock adjustment movement if stock changed
              if (stockChanged) {
                const stockDifference = stock - previousStock;
                await tx.transaction.create({
                  data: {
                    productId: existingProduct.id,
                    quantity: stock,
                    type: 'ADJUSTMENT',
                    notes: `CSV SYNCHRONIZATION - Stock adjusted from ${previousStock} to ${stock} (${stockDifference > 0 ? '+' : ''}${stockDifference})`,
                    userId,
                    unitPrice: costPrice || existingProduct.costPrice,
                    subtotal: stock * (costPrice || existingProduct.costPrice),
                    vatAmount: stock * (costPrice || existingProduct.costPrice) * 0.15,
                    totalAmount: stock * (costPrice || existingProduct.costPrice) * 1.15,
                  },
                });
                stockChanges++;
              }

              updated++;
            } else {
              skipped++;
            }
          }
        }

        // Create import history record
        const importRecord = await tx.importHistory.create({
          data: {
            fileName: 'products-import.csv',
            importType: 'PRODUCTS',
            userId,
            totalRows: preview.totalRows,
            created,
            updated,
            failed: errors.length,
            stockChanges,
            status: errors.length > 0 ? 'PARTIAL' : 'COMPLETED',
            errorMessage: errors.length > 0 ? JSON.stringify(errors) : null,
          },
        });

        // Create audit log
        await tx.activityLog.create({
          data: {
            entityType: 'IMPORT',
            entityId: importRecord.id,
            action: 'CSV_SYNCHRONIZATION',
            userId,
            previousValue: '{}',
            newValue: JSON.stringify({
              totalRows: preview.totalRows,
              created,
              updated,
              failed: errors.length,
              stockChanges,
            }),
          },
        });

        return {
          success: true,
          summary: {
            totalProcessed: preview.totalRows,
            created,
            updated,
            skipped,
            failed: errors.length,
            stockChanges,
          },
          errors,
          importId: importRecord.id,
        };
      });
    } catch (error) {
      console.error('Product import failed:', error);
      return {
        success: false,
        summary: {
          totalProcessed: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          failed: 0,
          stockChanges: 0,
        },
        errors: [{
          rowNumber: 0,
          sku: 'SYSTEM',
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        }],
      };
    }
  }

  /**
   * Get import history
   */
  async getImportHistory(): Promise<ImportHistory[]> {
    const history = await this.prisma.importHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Get user names
    const userIds = [...new Set(history.map(h => h.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map(u => [u.id, u.name]));

    return history.map(h => ({
      ...h,
      userName: userMap.get(h.userId) || 'Unknown',
    }));
  }
}

// ── Prisma Schema Extensions ───────────────────────────────────────────────────────

// Note: Add these models to your Prisma schema if they don't exist:

/*
model ImportHistory {
  id          String   @id @default(uuid())
  fileName    String
  importType  String   // 'PRODUCTS' or 'INVENTORY'
  userId      String
  totalRows   Int
  created     Int
  updated     Int
  failed      Int
  status      String   // 'COMPLETED', 'PARTIAL', 'FAILED'
  errorMessage String?
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
}
*/