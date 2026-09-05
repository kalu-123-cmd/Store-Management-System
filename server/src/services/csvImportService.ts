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
import { recordMovement } from './inventoryLedgerService';

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
  barcode?: string;
  minStockLevel?: string;
  supplier?: string;
  unit?: string;
  expiryDate?: string;
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
  // Strip BOM (Excel UTF-8 CSVs often start with \uFEFF)
  const cleaned = content.replace(/^\uFEFF/, '');
  // Normalize CRLF → LF, then split
  const lines = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = normalizeHeaders(parseCSVLine(lines[0]));
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: CSVRow = {};

    headers.forEach((header, index) => {
      row[header] = (values[index] ?? '').trim();
    });

    // Skip completely empty rows
    const hasContent = Object.values(row).some(v => v.length > 0);
    if (hasContent) rows.push(row);
  }

  return rows;
}

// Normalize column headers to standard names
function normalizeHeaders(headers: string[]): string[] {
  const headerMap: Record<string, string> = {
    // Name variants
    'name': 'name',
    'product name': 'name',
    'product_name': 'name',
    'productname': 'name',
    'item name': 'name',
    'item_name': 'name',
    'description': 'name',
    'product description': 'name',

    // SKU / Code variants
    'sku': 'sku',
    'code': 'sku',
    'product code': 'sku',
    'product_code': 'sku',
    'item code': 'sku',
    'item_code': 'sku',
    'part number': 'sku',
    'part_number': 'sku',
    'barcode': 'barcode',
    'ean': 'barcode',
    'upc': 'barcode',

    // Category variants
    'category': 'category',
    'type': 'category',
    'product type': 'category',
    'group': 'category',

    // Stock / Quantity variants
    'stock': 'stock',
    'quantity': 'stock',
    'qty': 'stock',
    'currentstock': 'stock',
    'current_stock': 'stock',
    'current stock': 'stock',
    'on hand': 'stock',
    'on_hand': 'stock',

    // Min stock variants
    'minstocklevel': 'minStockLevel',
    'min_stock_level': 'minStockLevel',
    'min stock level': 'minStockLevel',
    'minimum stock': 'minStockLevel',
    'minimum_stock': 'minStockLevel',
    'reorder level': 'minStockLevel',
    'reorder_level': 'minStockLevel',
    'reorder point': 'minStockLevel',

    // Cost price variants
    'costprice': 'costPrice',
    'cost_price': 'costPrice',
    'cost price': 'costPrice',
    'unit cost': 'costPrice',
    'unit_cost': 'costPrice',
    'unit cost (etb)': 'costPrice',
    'purchase price': 'costPrice',
    'purchase_price': 'costPrice',
    'buy price': 'costPrice',

    // Selling price variants
    'sellingprice': 'sellingPrice',
    'selling_price': 'sellingPrice',
    'selling price': 'sellingPrice',
    'sale price': 'sellingPrice',
    'sale_price': 'sellingPrice',
    'price': 'sellingPrice',
    'retail price': 'sellingPrice',
    'retail_price': 'sellingPrice',

    // Supplier variants
    'supplier': 'supplier',
    'vendor': 'supplier',
    'supplier name': 'supplier',
    'vendor name': 'supplier',

    // Unit of measure
    'unit': 'unit',
    'uom': 'unit',
    'unit of measure': 'unit',

    // Expiry date
    'expiry date': 'expiryDate',
    'expiry_date': 'expiryDate',
    'expiration date': 'expiryDate',
    'expiration_date': 'expiryDate',
    'best before': 'expiryDate',
    'use by': 'expiryDate',

    // Status
    'status': 'status',

    // Margin (calculated, optional)
    'margin': 'margin',

    // Department (ignored, informational only)
    'department / user': '_ignore',
    'department/user': '_ignore',
    'department': '_ignore',
    'user': '_ignore',
  };

  return headers.map(header => {
    const normalized = header.toLowerCase().trim().replace(/\s+/g, ' ');
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

  const name        = row['name']?.trim()         || '';
  const sku         = row['sku']?.trim()           || '';
  const category    = row['category']?.trim()      || '';
  const stockStr    = row['stock']?.trim()         || '0';
  const costPriceStr = row['costPrice']?.trim()    || '';
  const sellingPriceStr = row['sellingPrice']?.trim() || '';
  const minStockStr  = row['minStockLevel']?.trim() || '';
  const margin      = row['margin']?.trim();
  const barcode     = row['barcode']?.trim()       || '';
  const supplier    = row['supplier']?.trim()      || '';
  const unit        = row['unit']?.trim()          || '';
  const expiryDate  = row['expiryDate']?.trim()    || '';

  // Required fields
  if (!name) errors.push('Product name is required');
  if (!sku)  errors.push('Product code / SKU is required');

  // Check for duplicate SKU in this CSV batch
  if (sku && existingSKUs.has(sku)) {
    errors.push(`Duplicate SKU "${sku}" in import file`);
  } else if (sku) {
    existingSKUs.add(sku);
  }

  // Stock validation
  const stockNum = parseInt(stockStr);
  if (stockStr && (isNaN(stockNum) || stockNum < 0)) {
    errors.push('Quantity must be a non-negative whole number');
  }

  // Min stock validation
  if (minStockStr) {
    const minStock = parseInt(minStockStr);
    if (isNaN(minStock) || minStock < 0) {
      errors.push('Minimum stock must be a non-negative whole number');
    }
  }

  // Cost price validation
  if (costPriceStr) {
    const cost = parseFloat(costPriceStr.replace(/,/g, ''));
    if (isNaN(cost) || cost < 0) {
      errors.push('Unit cost must be a non-negative number');
    }
  }

  // Selling price validation (optional — defaults to costPrice if missing)
  if (sellingPriceStr) {
    const selling = parseFloat(sellingPriceStr.replace(/,/g, ''));
    if (isNaN(selling) || selling < 0) {
      errors.push('Selling price must be a non-negative number');
    }
  }

  // Business logic: selling < cost warning
  if (costPriceStr && sellingPriceStr) {
    const cost    = parseFloat(costPriceStr.replace(/,/g, ''));
    const selling = parseFloat(sellingPriceStr.replace(/,/g, ''));
    if (!isNaN(cost) && !isNaN(selling) && selling < cost) {
      warnings.push('Selling price is below cost price (loss-making)');
    }
  }

  // Margin validation (optional informational field)
  if (margin) {
    const marginNum = parseFloat(margin);
    if (isNaN(marginNum)) {
      warnings.push('Margin could not be parsed (ignored)');
    }
  }

  // Expiry date validation (optional)
  if (expiryDate) {
    const d = new Date(expiryDate);
    if (isNaN(d.getTime())) {
      warnings.push(`Expiry date "${expiryDate}" could not be parsed (ignored)`);
    }
  }

  return {
    isValid: errors.length === 0,
    rowNumber,
    data: {
      name, sku, category,
      stock:        stockStr,
      costPrice:    costPriceStr,
      sellingPrice: sellingPriceStr,
      minStockLevel: minStockStr,
      margin, barcode, supplier, unit, expiryDate,
    },
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
          const stock        = data.stock        ? parseInt(data.stock)                          : 0;
          const costPrice    = data.costPrice     ? parseFloat((data.costPrice as string).replace(/,/g, ''))    : null;
          // If no sellingPrice, default to costPrice (government stores track cost only)
          const sellingPrice = data.sellingPrice  ? parseFloat((data.sellingPrice as string).replace(/,/g, '')) : costPrice;
          const minStockLevel = (data as any).minStockLevel ? parseInt((data as any).minStockLevel) : 10;
          const expiryDate    = (data as any).expiryDate   ? new Date((data as any).expiryDate)   : null;
          const supplierName  = (data as any).supplier     || null;

          // Find or create category
          let categoryId = categoryMap.get((data.category || '').toLowerCase());
          if (!categoryId && data.category) {
            const newCategory = await tx.category.create({
              data: { name: data.category },
            });
            categoryId = newCategory.id;
            categoryMap.set(data.category.toLowerCase(), categoryId);
          }

          // Find or create supplier (if provided)
          let supplierId: string | null = null;
          if (supplierName) {
            const existingSupplier = await tx.supplier.findFirst({
              where: { name: { equals: supplierName } },
              select: { id: true },
            });
            if (existingSupplier) {
              supplierId = existingSupplier.id;
            } else {
              const newSupplier = await tx.supplier.create({
                data: { name: supplierName },
              });
              supplierId = newSupplier.id;
            }
          }

          if (validation.action === 'CREATE') {
            // Create new product
            const newProduct = await tx.product.create({
              data: {
                name:          data.name,
                sku:           data.sku,
                categoryId:    categoryId || null,
                supplierId:    supplierId,
                costPrice:     costPrice    ?? 0,
                sellingPrice:  sellingPrice ?? costPrice ?? 0,
                stock,
                minStockLevel,
                status:        'ACTIVE',
                barcode:       data.barcode || null,
              },
            });

            // Create initial stock movement in legacy Transaction table
            await tx.transaction.create({
              data: {
                productId: newProduct.id,
                quantity:  stock,
                type:      'IN',
                notes:     'CSV Import — initial stock',
                userId,
                unitPrice:   costPrice ?? 0,
                subtotal:    stock * (costPrice ?? 0),
                vatAmount:   0,
                totalAmount: stock * (costPrice ?? 0),
                clearanceStatus: 'CLEARED',
              },
            });

            // Record in inventory ledger
            if (stock > 0) {
              await recordMovement(tx as any, {
                productId:     newProduct.id,
                movementType:  'STOCK_IN',
                quantity:      stock,
                previousStock: 0,
                newStock:      stock,
                referenceType: 'ADJUSTMENT',
                unitCost:      costPrice || 0,
                userId,
                notes:         'CSV import — initial stock',
              });
            }

            created++;
            stockChanges++;
          } else if (validation.action === 'UPDATE') {
            // Update existing product - only update fields that exist in CSV
            const existingProduct = existingSKUs.get(data.sku);
            if (existingProduct) {
              const updateData: any = {};
              
              // Only update fields that are provided in CSV
              if (data.name)              updateData.name         = data.name;
              if (categoryId)             updateData.categoryId   = categoryId;
              if (supplierId)             updateData.supplierId   = supplierId;
              if (costPrice    !== null)  updateData.costPrice    = costPrice;
              if (sellingPrice !== null)  updateData.sellingPrice = sellingPrice;
              if (data.stock   !== undefined) updateData.stock    = stock;
              if ((data as any).minStockLevel)    updateData.minStockLevel = minStockLevel;
              if (data.barcode)           updateData.barcode      = data.barcode;

              // Track stock change
              const previousStock = existingProduct.stock;
              const stockChanged = data.stock !== undefined && previousStock !== stock;

              await tx.product.update({
                where: { id: existingProduct.id },
                data:  updateData,
              });

              // Create stock adjustment movement if stock changed
              if (stockChanged) {
                const effectiveCost  = costPrice    ?? existingProduct.costPrice;
                const stockDifference = stock - previousStock;
                await tx.transaction.create({
                  data: {
                    productId: existingProduct.id,
                    quantity:  stock,
                    type:      'ADJUSTMENT',
                    notes:     `CSV Import — stock adjusted from ${previousStock} to ${stock}`,
                    userId,
                    unitPrice:   effectiveCost,
                    subtotal:    stock * effectiveCost,
                    vatAmount:   0,
                    totalAmount: stock * effectiveCost,
                    clearanceStatus: 'CLEARED',
                  },
                });
                // Record in inventory ledger
                await recordMovement(tx as any, {
                  productId:     existingProduct.id,
                  movementType:  'ADJUSTMENT',
                  quantity:      stockDifference,
                  previousStock,
                  newStock:      stock,
                  referenceType: 'ADJUSTMENT',
                  unitCost:      effectiveCost,
                  userId,
                  notes:         `CSV import — stock ${stockDifference > 0 ? '+' : ''}${stockDifference}`,
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
      importType: h.importType as 'PRODUCTS' | 'INVENTORY',
      status: h.status as 'COMPLETED' | 'PARTIAL' | 'FAILED',
      errorMessage: h.errorMessage ?? undefined,
      userName: userMap.get(h.userId) || 'Unknown',
    })) as ImportHistory[];
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