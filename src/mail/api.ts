import { auth } from './firebase';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const API_BASE = String(import.meta.env.VITE_MAIL_API_BASE || '').replace(/\/$/, '');

export function resolveMailApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return API_BASE ? `${API_BASE}${path}` : path;
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, 'Oturum geçersiz');
  const token = await user.getIdToken();
  const res = await fetch(resolveMailApiUrl(path), {
    method: init?.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const record = data as { error?: string };
    throw new ApiError(res.status, record.error || 'Bağlantı hatası');
  }
  return data as T;
}

export async function uploadAttachment<T>(path: string, file: File): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, 'Oturum geçersiz');
  const token = await user.getIdToken();
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(resolveMailApiUrl(path), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const record = data as { error?: string };
    throw new ApiError(res.status, record.error || 'Ek yüklenemedi');
  }
  return data as T;
}

interface BlobCacheEntry {
  blob: Blob;
  expires: number;
}
const blobCache = new Map<string, BlobCacheEntry>();
const BLOB_CACHE_TTL = 15 * 60 * 1000;
const MAX_BLOB_CACHE_ENTRIES = 50;

export async function fetchAttachmentBlob(path: string): Promise<Blob> {
  const cached = blobCache.get(path);
  if (cached && cached.expires > Date.now()) {
    return cached.blob;
  }
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, 'Oturum geçersiz');
  const token = await user.getIdToken();
  const res = await fetch(resolveMailApiUrl(path), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const record = data as { error?: string };
    throw new ApiError(res.status, record.error || 'Ek yüklenemedi');
  }
  const blob = await res.blob();
  if (blobCache.size >= MAX_BLOB_CACHE_ENTRIES) {
    const firstKey = blobCache.keys().next().value;
    if (firstKey) blobCache.delete(firstKey);
  }
  blobCache.set(path, { blob, expires: Date.now() + BLOB_CACHE_TTL });
  return blob;
}

export async function downloadAttachment(path: string, filename: string) {
  const blob = await fetchAttachmentBlob(path);
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename || 'ek';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10000);
}
