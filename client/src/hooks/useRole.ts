/**
 * SmartStore OS — Role & Permission Hook
 *
 * Reads the current user's role from localStorage and exposes
 * permission-aware helpers for conditional UI rendering.
 *
 * IMPORTANT:
 * - These checks are purely cosmetic (show/hide buttons, redirect etc).
 * - All actual authorization is enforced on the backend.
 * - The backend uses the same role-to-permission matrix as defined here.
 *
 * Role hierarchy:
 *   ADMIN > MANAGER > CASHIER | INVENTORY_CLERK | ACCOUNTANT
 *
 * Usage:
 *   const { isAdmin, canMutate, can } = useRole();
 *   {can('sale:create') && <button>New Sale</button>}
 */

type Role = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'INVENTORY_CLERK' | 'ACCOUNTANT';

/** Permission matrix — mirrors server/src/auth/permissions.ts */
const ROLE_PERMISSIONS: Record<Role, ReadonlySet<string>> = {
  ADMIN: new Set([
    'product:read', 'product:create', 'product:update', 'product:delete', 'product:import',
    'inventory:view', 'inventory:adjust', 'inventory:transfer', 'inventory:audit',
    'inventory:stock_in', 'inventory:stock_out',
    'sale:create', 'sale:view', 'sale:cancel', 'sale:refund', 'sale:discount',
    'customer:create', 'customer:view', 'customer:update', 'customer:delete',
    'credit:view', 'credit:manage',
    'supplier:view', 'supplier:create', 'supplier:update', 'supplier:delete',
    'purchase:view', 'purchase:create', 'purchase:update', 'purchase:receive',
    'category:view', 'category:create', 'category:update', 'category:delete',
    'report:view', 'report:export',
    'audit:view',
    'user:view', 'user:create', 'user:update', 'user:delete', 'user:manage_roles',
    'org:view', 'org:manage',
    'branch:view', 'branch:manage',
    'warehouse:view', 'warehouse:manage',
    'role:manage',
    'settings:view', 'settings:modify',
  ]),

  MANAGER: new Set([
    'product:read', 'product:create', 'product:update', 'product:delete', 'product:import',
    'inventory:view', 'inventory:adjust', 'inventory:transfer', 'inventory:audit',
    'inventory:stock_in', 'inventory:stock_out',
    'sale:create', 'sale:view', 'sale:cancel', 'sale:refund', 'sale:discount',
    'customer:create', 'customer:view', 'customer:update', 'customer:delete',
    'credit:view', 'credit:manage',
    'supplier:view', 'supplier:create', 'supplier:update', 'supplier:delete',
    'purchase:view', 'purchase:create', 'purchase:update', 'purchase:receive',
    'category:view', 'category:create', 'category:update', 'category:delete',
    'report:view', 'report:export',
    'audit:view',
    'org:view', 'org:manage',
    'branch:view', 'branch:manage',
    'warehouse:view', 'warehouse:manage',
    'settings:view',
  ]),

  CASHIER: new Set([
    'product:read',
    'inventory:view',
    'sale:create', 'sale:view',
    'customer:create', 'customer:view', 'customer:update',
    'credit:view',
    'category:view',
    'supplier:view',
  ]),

  INVENTORY_CLERK: new Set([
    'product:read',
    'inventory:view', 'inventory:adjust', 'inventory:transfer', 'inventory:audit',
    'inventory:stock_in', 'inventory:stock_out',
    'purchase:view', 'purchase:receive',
    'category:view',
    'supplier:view',
    'warehouse:view',
    'branch:view',
  ]),

  ACCOUNTANT: new Set([
    'product:read',
    'inventory:view',
    'sale:view',
    'customer:view',
    'credit:view',
    'supplier:view',
    'purchase:view',
    'category:view',
    'report:view', 'report:export',
    'audit:view',
    'branch:view',
    'warehouse:view',
  ]),
};

export function useRole() {
  let role: Role = 'CASHIER'; // safe default — least privilege
  let userId = '';
  let userName = '';

  try {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored) as { role?: string; id?: string; name?: string };
      if (parsed?.role) role = parsed.role as Role;
      if (parsed?.id) userId = parsed.id;
      if (parsed?.name) userName = parsed.name;
    }
  } catch {
    // ignore parse errors
  }

  const isAdmin         = role === 'ADMIN';
  const isManager       = role === 'MANAGER';
  const isCashier       = role === 'CASHIER';
  const isInventoryClerk = role === 'INVENTORY_CLERK';
  const isAccountant    = role === 'ACCOUNTANT';

  /** True if ADMIN or MANAGER (can modify core business records) */
  const canMutate = isAdmin || isManager;

  /** True if ADMIN only (destructive operations) */
  const canAdminDelete = isAdmin;

  /**
   * Check if the current user has a specific permission.
   * Maps directly to the server-side permission matrix.
   *
   * @param permission - Permission string e.g. 'sale:create', 'product:update'
   */
  const can = (permission: string): boolean => {
    const perms = ROLE_PERMISSIONS[role];
    if (!perms) return false;
    return perms.has(permission);
  };

  /**
   * Check if the current user has any of the given permissions.
   */
  const canAny = (...permissions: string[]): boolean => {
    return permissions.some(p => can(p));
  };

  return {
    role,
    userId,
    userName,
    isAdmin,
    isManager,
    isCashier,
    isInventoryClerk,
    isAccountant,
    canMutate,
    canAdminDelete,
    can,
    canAny,
  };
}
