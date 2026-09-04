/**
 * Offline-first POS queue.
 * Pending sales are stored in IndexedDB and flushed when the browser is online.
 */

const DB_NAME = 'storeos-offline';
const STORE = 'pending-sales';
const VERSION = 1;

export type PendingSale = {
  id: string;
  createdAt: string;
  variables: {
    customerId: string | null;
    items: Array<{ productId: string; quantity: number; price: number }>;
    paymentMethod: string;
    paymentAmount: number;
    notes?: string | null;
    idempotencyKey: string;
  };
  status: 'queued' | 'syncing' | 'failed';
  lastError?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueSale(variables: PendingSale['variables']): Promise<PendingSale> {
  const record: PendingSale = {
    id: variables.idempotencyKey,
    createdAt: new Date().toISOString(),
    variables,
    status: 'queued',
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return record;
}

export async function listPendingSales(): Promise<PendingSale[]> {
  const db = await openDb();
  const rows = await new Promise<PendingSale[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as PendingSale[]) || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removePendingSale(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function markPendingFailed(id: string, lastError: string): Promise<void> {
  const pending = (await listPendingSales()).find(p => p.id === id);
  if (!pending) return;
  pending.status = 'failed';
  pending.lastError = lastError;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(pending);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
