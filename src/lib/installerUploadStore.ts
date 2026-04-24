/**
 * Persistência de uploads pendentes do instalador via IndexedDB.
 * Permite retomar uploads após page reload / crash do browser.
 *
 * Falha graciosamente em ambientes sem IndexedDB (modo privado restrito,
 * cota cheia): operações rejeitam a Promise; chamadores devem fazer
 * try/catch e seguir em memória.
 */

const DB_NAME = "produzai-installer";
const STORE_NAME = "pending-uploads";
const DB_VERSION = 1;

export interface UploadMeta {
  storeId: string;
  campaignId: string;
  category: string;
  method: string;
  fileName: string;
}

export interface PendingUpload {
  id: string;
  blob: Blob;
  meta: UploadMeta;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available"));
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
    req.onblocked = () => reject(new Error("IndexedDB upgrade blocked"));
  });

  // Reset cache if the DB connection later closes/errors
  dbPromise.catch(() => { dbPromise = null; });

  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

export async function savePendingUpload(
  id: string,
  blob: Blob,
  meta: UploadMeta,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "readwrite");
    const record: PendingUpload = { id, blob, meta, createdAt: Date.now() };
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Failed to save pending upload"));
  });
}

export async function getPendingUploads(): Promise<PendingUpload[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "readonly");
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result as PendingUpload[]) ?? [];
      // Oldest first to preserve original capture order
      items.sort((a, b) => a.createdAt - b.createdAt);
      resolve(items);
    };
    req.onerror = () => reject(req.error ?? new Error("Failed to read pending uploads"));
  });
}

export async function deletePendingUpload(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "readwrite");
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Failed to delete pending upload"));
  });
}

export async function clearAll(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "readwrite");
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Failed to clear pending uploads"));
  });
}
