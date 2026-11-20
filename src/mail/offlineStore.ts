import type { FolderRole, ListResult, MailMessage } from './types';

const DB_NAME = 'safirmail_offline_v1';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not supported'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Posta listesi önbelleği
        if (!db.objectStoreNames.contains('mailLists')) {
          db.createObjectStore('mailLists', { keyPath: 'key' });
        }
        // Tekil posta gövdesi ve detay önbelleği
        if (!db.objectStoreNames.contains('messages')) {
          db.createObjectStore('messages', { keyPath: 'key' });
        }
        // İletişim rehberi önbelleği
        if (!db.objectStoreNames.contains('contacts')) {
          db.createObjectStore('contacts', { keyPath: 'email' });
        }
      };
    });
  }
  return dbPromise;
}

export async function idbSaveList(accountId: string, folder: FolderRole, data: ListResult): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('mailLists', 'readwrite');
    const store = tx.objectStore('mailLists');
    store.put({
      key: `${accountId}:${folder}`,
      accountId,
      folder,
      data,
      savedAt: Date.now(),
    });
  } catch {
    // IndexedDB hatası akışı engellemez
  }
}

export async function idbGetList(accountId: string, folder: FolderRole): Promise<ListResult | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('mailLists', 'readonly');
      const store = tx.objectStore('mailLists');
      const req = store.get(`${accountId}:${folder}`);
      req.onsuccess = () => {
        resolve(req.result?.data || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function idbUpdateList(
  accountId: string,
  folder: FolderRole,
  updater: (current: ListResult) => ListResult,
): Promise<void> {
  try {
    const current = await idbGetList(accountId, folder);
    if (!current) return;
    await idbSaveList(accountId, folder, updater(current));
  } catch {
    // IndexedDB güncelleme hatası akışı engellemez
  }
}

export async function idbSaveMessage(accountId: string, folder: FolderRole, uid: number, message: MailMessage): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    store.put({
      key: `${accountId}:${folder}:${uid}`,
      accountId,
      folder,
      uid,
      message,
      savedAt: Date.now(),
    });
  } catch {
    // yoksay
  }
}

export async function idbGetMessage(accountId: string, folder: FolderRole, uid: number): Promise<MailMessage | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const req = store.get(`${accountId}:${folder}:${uid}`);
      req.onsuccess = () => {
        resolve(req.result?.message || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function idbClearAll(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(['mailLists', 'messages', 'contacts'], 'readwrite');
    tx.objectStore('mailLists').clear();
    tx.objectStore('messages').clear();
    tx.objectStore('contacts').clear();
  } catch {
    // yoksay
  }
}
