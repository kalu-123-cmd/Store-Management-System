/**
 * Reads the current user's role from localStorage.
 * Returns helpers that are safe to call on every render — no async, no network.
 *
 * Role hierarchy:  ADMIN > MANAGER > CASHIER
 *
 * Usage:
 *   const { isAdmin, isManager, canMutate } = useRole();
 *   {canMutate && <button>Add Product</button>}
 */
export function useRole() {
  let role = 'CASHIER'; // safe default — least privilege
  try {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.role) role = parsed.role as string;
    }
  } catch {
    // ignore parse errors
  }

  const isAdmin   = role === 'ADMIN';
  const isManager = role === 'MANAGER';
  const isCashier = role === 'CASHIER';

  /** ADMIN or MANAGER — can create / update / delete records */
  const canMutate = isAdmin || isManager;

  /** ADMIN only — user management, category delete, supplier delete, product delete */
  const canAdminDelete = isAdmin;

  return { role, isAdmin, isManager, isCashier, canMutate, canAdminDelete };
}
