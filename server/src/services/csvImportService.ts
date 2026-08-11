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

// ── CSV Parser ───────────────────────────────────────────────────────────────────

export function parseCSV(content: string): CSVRow[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
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

// ── Validation ───────────────────────────────────────────────────────────────────

export function validateProductRow(row: CSVRow, rowNumber: number): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const name = row['name']?.trim() || '';
  const sku = row['sku']?.trim() || '';
  const category = row['category']?.trim() || '';
  const stock = row['stock']?.trim() || '0';
  const costPrice = row['costPrice']?.trim() || '0';
  const sellingPrice = row['sellingPrice']?.trim() || '0';
  const margin = row['margin']?.trim();

  // Required fields
  if (!name) errors.push('Product name is required');
  if (!sku) errors.push('SKU is required');
  if (!category) errors.push('Category is required');

  // Numeric validation
  const stockNum = parseInt(stock);
  if (isNaN(stockNum) || stockNum < 0) {
    errors.push('Stock must be a non-negative number');
  }

  const costPriceNum = parseFloat(costPrice);
  if (isNaN(costPriceNum) || costPriceNum < 0) {
    errors.push('Cost price must be a non-negative number');
  }

  const sellingPriceNum = parseFloat(sellingPrice);
  if (isNaN(sellingPriceNum) || sellingPriceNum < 0) {
    errors.push('Selling price must be a non-negative number');
  }

  // Business logic validation
  if (!isNaN(costPriceNum) && !isNaN(sellingPriceNum) && sellingPriceNum < costPriceNum) {
    warnings.push('Selling price is below cost price (loss-making product)');
  }

  // Margin validation
  if (margin) {
    const marginNum = parseFloat(margin);
    if (isNaN(marginNum)) {
      errors.push('Margin must be a valid number');
    } else if (marginNum < 0 || marginNum > 100) {
      errors.push('Margin must be between 0 and 100');
    }
  }

  // SKU format validation
  if (sku && !/^[A-Z0-9-]+$/.test(sku)) {
    warnings.push('SKU contains non-standard characters (recommended: uppercase letters, numbers, hyphens)');
  }

  return {
    isValid: errors.length === 0,
    rowNumber,
    data: { name, sku, category, stock, costPrice, sellingPrice, margin },
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
   * Preview product CSV import
   */
  async previewProductImport(csvContent: string, userId: string): Promise<ImportPreview> {
    const rows = parseCSV(csvContent);
    const validations: ImportValidationResult[] = [];
    let createCount = 0;
    let updateCount = 0;
    let skipCount = 0;

    // Get existing SKUs
    const existingProducts = await this.prisma.product.findMany({
      select: { sku: true, id: true, name: true },
    });
    const existingSKUs = new Map(existingProducts.map(p => [p.sku, p]));

    for (let i = 0; i < rows.length; i++) {
      const validation = validateProductRow(rows[i], i + 1);
      
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
   * Execute product CSV import
   */
  async importProducts(csvContent: string, userId: string): Promise<ImportResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const preview = await this.previewProductImport(csvContent, userId);
        const errors: Array<{ rowNumber: number; sku: string; error: string }> = [];
        let created = 0;
        let updated = 0;
        let skipped = 0;

        // Get existing products and categories
        const existingProducts = await tx.product.findMany({
          select: { sku: true, id: true, name: true },
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
          const stock = parseInt(data.stock);
          const costPrice = parseFloat(data.costPrice);
          const sellingPrice = parseFloat(data.sellingPrice);

          // Find or create category
          let categoryId = categoryMap.get(data.category.toLowerCase());
          if (!categoryId) {
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
                categoryId,
                costPrice,
                sellingPrice,
                stock,
                minStockLevel: 10,
                status: 'ACTIVE',
              },
            });

            // Create initial stock movement
            await tx.transaction.create({
              data: {
                productId: newProduct.id,
                quantity: stock,
                type: 'IN',
                notes: 'Initial CSV import',
                userId,
                unitPrice: costPrice,
                subtotal: stock * costPrice,
                vatAmount: stock * costPrice * 0.15,
                totalAmount: stock * costPrice * 1.15,
              },
            });

            created++;
          } else if (validation.action === 'UPDATE') {
            // Update existing product
            const existingProduct = existingSKUs.get(data.sku);
            if (existingProduct) {
              await tx.product.update({
                where: { id: existingProduct.id },
                data: {
                  costPrice,
                  sellingPrice,
                  stock,
                },
              });

              // Create stock adjustment movement
              await tx.transaction.create({
                data: {
                  productId: existingProduct.id,
                  quantity: stock,
                  type: 'ADJUSTMENT',
                  notes: 'CSV import update',
                  userId,
                  unitPrice: costPrice,
                  subtotal: stock * costPrice,
                  vatAmount: stock * costPrice * 0.15,
                  totalAmount: stock * costPrice * 1.15,
                },
              });

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
            status: errors.length > 0 ? 'PARTIAL' : 'COMPLETED',
            errorMessage: errors.length > 0 ? JSON.stringify(errors) : null,
          },
        });

        // Create audit log
        await tx.activityLog.create({
          data: {
            entityType: 'IMPORT',
            entityId: importRecord.id,
            action: 'PRODUCT_CSV_IMPORT',
            userId,
            previousValue: '{}',
            newValue: JSON.stringify({
              totalRows: preview.totalRows,
              created,
              updated,
              failed: errors.length,
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