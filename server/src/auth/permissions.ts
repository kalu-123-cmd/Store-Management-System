/**
 * SmartStore OS — RBAC Permission System
 *
 * Defines the complete permission matrix for the system.
 * Each role has a fixed set of allowed permissions.
 *
 * Architecture:
 * - User.role is the primary authorization field (fast, no DB query)
 * - The DB Role/Permission/UserRole tables exist for advanced fine-grained overrides
 *   but the in-memory matrix is the source of truth for standard operations.
 *
 * Design decisions:
 * - CASHIER can only create sales and view what they need for POS
 * - INVENTORY_CLERK can manage stock but not prices or sales
 * - ACCOUNTANT can view financial reports but not modify products or users
 * - MANAGER can do everything except user management and system configuration
 * - ADMIN has full access
 *
 * IMPORTANT: ALL permission checks happen on the backend.
 * Frontend role checks are purely cosmetic (hide buttons etc).
 */

// ── Permission constants ───────────────────────────────────────────────────────

export const PERMISSIONS = {
  // Products
  PRODUCT_READ:         'product:read',
  PRODUCT_CREATE:       'product:create',
  PRODUCT_UPDATE:       'product:update',
  PRODUCT_DELETE:       'product:delete',
  PRODUCT_IMPORT:       'product:import',

  // Inventory
  INVENTORY_VIEW:       'inventory:view',
  INVENTORY_ADJUST:     'inventory:adjust',
  INVENTORY_TRANSFER:   'inventory:transfer',
  INVENTORY_AUDIT:      'inventory:audit',
  STOCK_IN:             'inventory:stock_in',
  STOCK_OUT:            'inventory:stock_out',

  // Sales
  SALE_CREATE:          'sale:create',
  SALE_VIEW:            'sale:view',
  SALE_CANCEL:          'sale:cancel',
  SALE_REFUND:          'sale:refund',
  SALE_DISCOUNT:        'sale:discount',

  // Customers
  CUSTOMER_CREATE:      'customer:create',
  CUSTOMER_VIEW:        'customer:view',
  CUSTOMER_UPDATE:      'customer:update',
  CUSTOMER_DELETE:      'customer:delete',

  // Credit
  CREDIT_VIEW:          'credit:view',
  CREDIT_MANAGE:        'credit:manage',

  // Suppliers
  SUPPLIER_VIEW:        'supplier:view',
  SUPPLIER_CREATE:      'supplier:create',
  SUPPLIER_UPDATE:      'supplier:update',
  SUPPLIER_DELETE:      'supplier:delete',

  // Purchases
  PURCHASE_VIEW:        'purchase:view',
  PURCHASE_CREATE:      'purchase:create',
  PURCHASE_UPDATE:      'purchase:update',
  PURCHASE_RECEIVE:     'purchase:receive',

  // Categories
  CATEGORY_VIEW:        'category:view',
  CATEGORY_CREATE:      'category:create',
  CATEGORY_UPDATE:      'category:update',
  CATEGORY_DELETE:      'category:delete',

  // Reports & Analytics
  REPORT_VIEW:          'report:view',
  REPORT_EXPORT:        'report:export',
  AUDIT_LOG_VIEW:       'audit:view',

  // Users & RBAC
  USER_VIEW:            'user:view',
  USER_CREATE:          'user:create',
  USER_UPDATE:          'user:update',
  USER_DELETE:          'user:delete',
  USER_MANAGE_ROLES:    'user:manage_roles',

  // Organization
  ORG_VIEW:             'org:view',
  ORG_MANAGE:           'org:manage',

  // Branches & Warehouses
  BRANCH_VIEW:          'branch:view',
  BRANCH_MANAGE:        'branch:manage',
  WAREHOUSE_VIEW:       'warehouse:view',
  WAREHOUSE_MANAGE:     'warehouse:manage',

  // System / Role management
  ROLE_MANAGE:          'role:manage',
  SETTINGS_VIEW:        'settings:view',
  SETTINGS_MODIFY:      'settings:modify',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ── Role definitions ──────────────────────────────────────────────────────────

/**
 * Valid application roles.
 * SUPER_ADMIN is reserved for system-level operations.
 */
export const ROLES = ['ADMIN', 'MANAGER', 'CASHIER', 'INVENTORY_CLERK', 'ACCOUNTANT'] as const;
export type Role = typeof ROLES[number];

/**
 * Permission matrix — what each role is allowed to do.
 * This is the single source of truth for authorization.
 */
const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set([
    // Full access
    ...Object.values(PERMISSIONS),
  ] as Permission[]),

  MANAGER: new Set([
    // Products
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_UPDATE,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.PRODUCT_IMPORT,
    // Inventory
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.INVENTORY_AUDIT,
    PERMISSIONS.STOCK_IN,
    PERMISSIONS.STOCK_OUT,
    // Sales
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CANCEL,
    PERMISSIONS.SALE_REFUND,
    PERMISSIONS.SALE_DISCOUNT,
    // Customers
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_UPDATE,
    PERMISSIONS.CUSTOMER_DELETE,
    // Credit
    PERMISSIONS.CREDIT_VIEW,
    PERMISSIONS.CREDIT_MANAGE,
    // Suppliers
    PERMISSIONS.SUPPLIER_VIEW,
    PERMISSIONS.SUPPLIER_CREATE,
    PERMISSIONS.SUPPLIER_UPDATE,
    PERMISSIONS.SUPPLIER_DELETE,
    // Purchases
    PERMISSIONS.PURCHASE_VIEW,
    PERMISSIONS.PURCHASE_CREATE,
    PERMISSIONS.PURCHASE_UPDATE,
    PERMISSIONS.PURCHASE_RECEIVE,
    // Categories
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_UPDATE,
    PERMISSIONS.CATEGORY_DELETE,
    // Reports
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_LOG_VIEW,
    // Org/Branch/Warehouse (view + manage)
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.ORG_MANAGE,
    PERMISSIONS.BRANCH_VIEW,
    PERMISSIONS.BRANCH_MANAGE,
    PERMISSIONS.WAREHOUSE_VIEW,
    PERMISSIONS.WAREHOUSE_MANAGE,
    // Settings view only
    PERMISSIONS.SETTINGS_VIEW,
  ] as Permission[]),

  CASHIER: new Set([
    // POS: read products, create sales, view customers
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_UPDATE,
    PERMISSIONS.CREDIT_VIEW,
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.SUPPLIER_VIEW,
  ] as Permission[]),

  INVENTORY_CLERK: new Set([
    // Stock management — no sales, no prices, no users
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.INVENTORY_AUDIT,
    PERMISSIONS.STOCK_IN,
    PERMISSIONS.STOCK_OUT,
    PERMISSIONS.PURCHASE_VIEW,
    PERMISSIONS.PURCHASE_RECEIVE,
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.SUPPLIER_VIEW,
    PERMISSIONS.WAREHOUSE_VIEW,
    PERMISSIONS.BRANCH_VIEW,
  ] as Permission[]),

  ACCOUNTANT: new Set([
    // Financial view only — no mutations to products, inventory, or users
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CREDIT_VIEW,
    PERMISSIONS.SUPPLIER_VIEW,
    PERMISSIONS.PURCHASE_VIEW,
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_LOG_VIEW,
    PERMISSIONS.BRANCH_VIEW,
    PERMISSIONS.WAREHOUSE_VIEW,
  ] as Permission[]),
};

// ── Authorization functions ────────────────────────────────────────────────────

export interface AuthenticatedUser {
  id: string;
  role: string;
  email?: string;
}

/**
 * Assert that the request has a valid authenticated user.
 * Throws 'Not authenticated' if user is missing.
 */
export function requireAuth(user: AuthenticatedUser | null | undefined): asserts user is AuthenticatedUser {
  if (!user?.id) {
    throw new Error('Not authenticated');
  }
}

/**
 * Assert that the authenticated user has at least one of the given roles.
 * More restrictive than requirePermission — use when a specific role is
 * semantically required (e.g., only ADMIN can delete users).
 */
export function requireRole(user: AuthenticatedUser | null | undefined, ...roles: string[]): void {
  requireAuth(user);
  if (!roles.includes(user.role)) {
    throw new Error(`Not authorized — role '${user.role}' is not in [${roles.join(', ')}]`);
  }
}

/**
 * Assert that the authenticated user has the given permission.
 *
 * Permission resolution order:
 * 1. User.role is looked up in ROLE_PERMISSIONS matrix
 * 2. If found, check if permission is in the set
 *
 * This function does NOT do a DB query — it uses the in-memory matrix.
 * For DB-driven fine-grained overrides use checkPermissionWithDB().
 */
export function requirePermission(user: AuthenticatedUser | null | undefined, permission: Permission): void {
  requireAuth(user);

  const role = user.role as Role;
  const allowed = ROLE_PERMISSIONS[role];

  // Unknown role — deny by default
  if (!allowed) {
    throw new Error(`Not authorized — unknown role '${role}'`);
  }

  if (!allowed.has(permission)) {
    throw new Error(`Not authorized — '${role}' does not have permission '${permission}'`);
  }
}

/**
 * Check if a user has a permission (returns boolean, does not throw).
 * Useful for conditional logic.
 */
export function hasPermission(user: AuthenticatedUser | null | undefined, permission: Permission): boolean {
  if (!user?.id || !user.role) return false;
  const role = user.role as Role;
  const allowed = ROLE_PERMISSIONS[role];
  if (!allowed) return false;
  return allowed.has(permission);
}

/**
 * Returns the full set of permissions for a given role.
 * Used by the myPermissions GraphQL query and the seed script.
 */
export function getPermissionsForRole(role: string): Permission[] {
  const perms = ROLE_PERMISSIONS[role as Role];
  if (!perms) return [];
  return Array.from(perms);
}

/**
 * Returns true if the role string is a valid application role.
 */
export function isValidRole(role: string): role is Role {
  return (ROLES as readonly string[]).includes(role);
}
