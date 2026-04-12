/**
 * Offline queue for InstallerPortal — uses IndexedDB to store
 * pending photos (as base64), check-ins, and completions.
 */

const DB_NAME = "installer_offline";
const DB_VERSION = 1;
const STORE_NAME = "queue";

export type QueueItemType = "photo" | "checkin" | "completion";

export interface QueueItem {
  id?: number; // auto-incremented
  type: QueueItemType;
  createdAt: string;
  payload: Record<string, any>;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Add an item to the offline queue */
export async function enqueue(item: Omit<QueueItem, "id">): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(item);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

/** Get all queued items sorted by id (FIFO) */
export async function getAllQueued(): Promise<QueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as QueueItem[]);
    req.onerror = () => reject(req.error);
  });
}

/** Remove a single item by id after successful sync */
export async function dequeue(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Count items in the queue (optionally by type) */
export async function queueCount(type?: QueueItemType): Promise<number> {
  const items = await getAllQueued();
  if (!type) return items.length;
  return items.filter((i) => i.type === type).length;
}

/** Clear entire queue */
export async function clearQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Convert a Blob/File to base64 string for IndexedDB storage */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Convert a base64 data-url back to a Blob */
export function base64ToBlob(base64: string): Blob {
  const [header, data] = base64.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
