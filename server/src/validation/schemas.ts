/**
 * SmartStore OS — Centralized Backend Validation Schemas
 *
 * All GraphQL resolver inputs MUST be validated through these schemas
 * before any database operation. Frontend validation is UX-only and
 * cannot be trusted as a security boundary.
 *
 * Rules enforced here:
 *  - Required fields are non-empty
 *  - Prices / quantities are positive numbers
 *  - IDs are non-empty strings (UUID format where possible)
 *  - Emails are syntactically valid
 *  - Phone numbers are reasonable length
 *  - Enum values are from allowed sets
 *  - Free-text fields are length-capped to prevent oversized payloads
 *  - Financial values are finite (no Infinity / NaN)
 */

import { z } from 'zod';

// ── Primitives ─────────────────────────────────────────────────────────────────

/** Non-empty trimmed string */
const nonEmptyStr = (max = 500) =>
  z.string().trim().min(1, 'Required').max(max, `Must be ${max} characters or fewer`);

/** Optional string — trims, converts empty to undefined */
const optStr = (max = 500) =>
  z.string().trim().max(max).optional().transform(v => (v === '' ? undefined : v));

/** Positive finite price/amount — must be >= 0 */
const price = z
  .number({ invalid_type_error: 'Must be a number' })
  .finite('Must be a finite number')
  .min(0, 'Cannot be negative');

/** Positive integer quantity */
const positiveInt = z
  .number({ invalid_type_error: 'Must be a number' })
  .int('Must be a whole number')
  .positive('Must be greater than zero');

/** Non-negative integer (stock levels, min stock, etc.) */
const nonNegInt = z
  .number({ invalid_type_error: 'Must be a number' })
  .int('Must be a whole number')
  .min(0, 'Cannot be negative');

/** UUID-like ID — non-empty string */
const id = z.string().trim().min(1, 'ID is required').max(100);

/** Email */
const email = z.string().trim().email('Invalid email address').max(255).optional();

/** Phone — optional, loose validation */
const phone = z
  .string()
  .trim()
  .regex(/^[\d\s\+\-\(\)]{6,20}$/, 'Invalid phone number')
  .optional();

// ── Auth ───────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  name:     nonEmptyStr(100),
  email:    z.string().trim().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role:     z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'INVENTORY_CLERK', 'ACCOUNTANT']).optional(),
});

export const LoginSchema = z.object({
  email:    z.string().trim().min(1, 'Email is required').max(255),
  password: z.string().min(1, 'Password is required').max(128),
});

export const UpdateProfileSchema = z.object({
  name:            optStr(100),
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword:     z.string().min(8, 'New password must be at least 8 characters').max(128).optional(),
});

// ── Category ───────────────────────────────────────────────────────────────────

export const CreateCategorySchema = z.object({
  name:        nonEmptyStr(100),
  description: optStr(500),
});

export const UpdateCategorySchema = z.object({
  id,
  name:        optStr(100),
  description: optStr(500),
});

// ── Supplier ───────────────────────────────────────────────────────────────────

export const CreateSupplierSchema = z.object({
  name:        nonEmptyStr(200),
  contactName: optStr(100),
  email,
  phone,
  address:     optStr(300),
});

export const UpdateSupplierSchema = z.object({
  id,
  name:        optStr(200),
  contactName: optStr(100),
  email,
  phone,
  address:     optStr(300),
});

// ── Customer ───────────────────────────────────────────────────────────────────

export const CreateCustomerSchema = z.object({
  name:    nonEmptyStr(200),
  email,
  phone,
  address: optStr(300),
  taxId:   optStr(50),
  notes:   optStr(1000),
});

export const UpdateCustomerSchema = z.object({
  id,
  name:    optStr(200),
  email,
  phone,
  address: optStr(300),
  notes:   optStr(1000),
});

// ── Product ────────────────────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  name:          nonEmptyStr(200),
  sku:           nonEmptyStr(100),
  barcode:       optStr(100),
  description:   optStr(1000),
  imageUrl:      optStr(500),
  costPrice:     price,
  sellingPrice:  price,
  categoryId:    id,
  supplierId:    optStr(100),
  stock:         nonNegInt.optional().default(0),
  minStockLevel: nonNegInt.optional().default(10),
  status:        z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional().default('ACTIVE'),
}).refine(
  data => data.sellingPrice >= data.costPrice,
  { message: 'Selling price should not be less than cost price', path: ['sellingPrice'] }
);

export const UpdateProductSchema = z.object({
  id,
  name:          optStr(200),
  sku:           optStr(100),
  barcode:       optStr(100),
  description:   optStr(1000),
  imageUrl:      optStr(500),
  costPrice:     price.optional(),
  sellingPrice:  price.optional(),
  categoryId:    optStr(100),
  supplierId:    optStr(100),
  minStockLevel: nonNegInt.optional(),
  status:        z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
});

// ── Inventory ──────────────────────────────────────────────────────────────────

export const AdjustStockSchema = z.object({
  productId: id,
  quantity:  positiveInt,
  type:      z.enum(['IN', 'OUT', 'ADJUSTMENT'], { errorMap: () => ({ message: 'Type must be IN, OUT, or ADJUSTMENT' }) }),
  notes:     optStr(500),
});

// ── Sale ───────────────────────────────────────────────────────────────────────

export const SaleItemInputSchema = z.object({
  productId: id,
  quantity:  positiveInt,
  price:     price,
});

export const CreateSaleSchema = z.object({
  customerId:     optStr(100),
  items:          z.array(SaleItemInputSchema).min(1, 'At least one item is required').max(100, 'Too many items'),
  paymentMethod:  z.enum([
    'CASH', 'BANK_TRANSFER', 'CARD', 'TELEBIRR', 'CBE_BIRR', 'CREDIT', 'OTHER'
  ]).optional().default('CASH'),
  paymentAmount:  price.optional(),
  branchId:       optStr(100),
  notes:          optStr(500),
  idempotencyKey: z
    .string()
    .trim()
    .regex(/^[0-9a-f-]{32,36}$/i, 'idempotencyKey must be a UUID')
    .optional(),
});

export const ReturnItemSchema = z.object({
  saleItemId: id,
  quantity:   positiveInt,
});

export const ReturnSaleSchema = z.object({
  saleId:  id,
  reason:  optStr(500),
  items:   z.array(ReturnItemSchema).optional(),
});

// ── Purchase Order ─────────────────────────────────────────────────────────────

export const POItemInputSchema = z.object({
  productId: id,
  quantity:  positiveInt,
  unitCost:  price,
});

export const CreatePurchaseOrderSchema = z.object({
  supplierId: optStr(100),
  notes:      optStr(1000),
  items:      z.array(POItemInputSchema).min(1, 'At least one item is required').max(200),
});

// ── Branch ─────────────────────────────────────────────────────────────────────

export const CreateBranchSchema = z.object({
  name:    nonEmptyStr(200),
  address: optStr(300),
  phone,
  manager: optStr(100),
});

export const UpdateBranchSchema = z.object({
  id,
  name:     optStr(200),
  address:  optStr(300),
  phone,
  manager:  optStr(100),
  isActive: z.boolean().optional(),
});

// ── User Management ────────────────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  name:     nonEmptyStr(100),
  email:    z.string().trim().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role:     z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'INVENTORY_CLERK', 'ACCOUNTANT']),
});

export const UpdateUserRoleSchema = z.object({
  id,
  role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'INVENTORY_CLERK', 'ACCOUNTANT']),
});

// ── Organization ───────────────────────────────────────────────────────────────

export const CreateOrganizationSchema = z.object({
  name:        nonEmptyStr(200),
  code:        nonEmptyStr(50),
  type:        z.enum(['MINISTRY', 'AGENCY', 'NGO', 'UNIVERSITY', 'HOSPITAL', 'COMPANY', 'OTHER']),
  description: optStr(1000),
  address:     optStr(300),
  phone,
  email,
  website:     optStr(300),
});

// ── Validation helper ──────────────────────────────────────────────────────────

/**
 * Validate input against a Zod schema and throw a descriptive GraphQL error
 * if validation fails. Returns the parsed (coerced + typed) data.
 *
 * Usage in resolvers:
 *   const data = validate(CreateProductSchema, args);
 */
export function validate<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const messages = result.error.errors
      .map(e => `${e.path.join('.') || 'input'}: ${e.message}`)
      .join('; ');
    throw new Error(`Validation failed — ${messages}`);
  }
  return result.data;
}

/**
 * Same as validate() but throws errors formatted for a specific field context.
 */
export function validatePartial<T>(schema: z.ZodSchema<T>, input: unknown, context: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const messages = result.error.errors
      .map(e => `${e.path.join('.') || 'input'}: ${e.message}`)
      .join('; ');
    throw new Error(`${context}: ${messages}`);
  }
  return result.data;
}
