import { getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import { auth } from '../../core/firebase';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf', 'text/xml', 'application/xml'];
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.heic', '.webp', '.pdf', '.xml'];

export function validateErpFile(file: File): void {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Dosya boyutu 20 MB sınırını aşamaz.');
  }
  const lower = file.name.toLowerCase();
  const extOk = ALLOWED_EXTS.some((ext) => lower.endsWith(ext));
  const mimeOk = ALLOWED_MIME_PREFIXES.some((p) => file.type.startsWith(p));
  if (!extOk && !mimeOk) {
    throw new Error(
      'Desteklenmeyen dosya türü. Yalnızca JPG, JPEG, PNG, HEIC, WEBP, PDF veya XML dosyaları yüklenebilir.'
    );
  }
}

async function uploadViaApi(
  blob: Blob,
  storagePath: string,
  contentType: string,
  token: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('path', storagePath);
    const filename = storagePath.split('/').pop() || 'dosya';
    const fileObj = blob instanceof File ? blob : new File([blob], filename, { type: contentType });
    form.append('file', fileObj);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/erp/upload', true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        onProgress?.(Math.min(95, Math.round((ev.loaded / ev.total) * 100)));
      }
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && data.url) {
          onProgress?.(100);
          resolve(data.url);
        } else {
          reject(new Error(data.error || `Yükleme başarısız (${xhr.status})`));
        }
      } catch {
        reject(new Error(`Yükleme yanıtı okunamadı (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Yükleme sırasında ağ hatası oluştu.'));
    xhr.send(form);
  });
}

async function uploadViaClientSdk(
  blob: Blob,
  storagePath: string,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const storage = getStorage();
  const fullPath = `kuzeydenizi/${storagePath}`;
  const fileRef = ref(storage, fullPath);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(fileRef, blob, { contentType });
    task.on(
      'state_changed',
      (snap) => {
        const pct = snap.totalBytes > 0 ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
        onProgress?.(pct);
      },
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

export async function uploadToErpStorage(
  blob: Blob,
  storagePath: string,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  if (!auth.currentUser) {
    // Offline / local preview fallback using DataURL when small, or ObjectURL
    return new Promise((resolve) => {
      if (blob.size <= 1_500_000) {
        const reader = new FileReader();
        reader.onload = () => {
          onProgress?.(100);
          resolve(String(reader.result || ''));
        };
        reader.readAsDataURL(blob);
      } else {
        onProgress?.(100);
        resolve(URL.createObjectURL(blob));
      }
    });
  }

  const token = await auth.currentUser.getIdToken();
  try {
    return await uploadViaApi(blob, storagePath, contentType, token, onProgress);
  } catch (apiErr) {
    // Fallback to client Storage SDK (e.g. during standalone localhost vite preview without proxy)
    try {
      return await uploadViaClientSdk(blob, storagePath, contentType, onProgress);
    } catch {
      throw apiErr;
    }
  }
}
