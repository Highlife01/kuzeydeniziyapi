import { useEffect, useState } from 'react';

export const THUMB_MAX_BYTES = 5 * 1024 * 1024;

/** Küçük önizleme yalnızca güvenli raster görseller için üretilir (SVG hariç). */
export function isThumbnailable(contentType: string, filename: string, size: number) {
  if (size > THUMB_MAX_BYTES) return false;
  if (/svg/i.test(contentType) || /\.svg$/i.test(filename)) return false;
  return /^image\/(png|jpe?g|gif|webp|bmp)/i.test(contentType) || /\.(png|jpe?g|gif|webp|bmp)$/i.test(filename);
}

type Props = {
  load: () => Promise<Blob>;
  filename: string;
  fallback: string;
  onOpen: () => void;
  disabled?: boolean;
};

export default function AttachmentThumb({ load, filename, fallback, onOpen, disabled }: Props) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    setUrl('');
    setFailed(false);
    load()
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (objectUrl) {
        try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed || !url) {
    return <span className="file-kind">{fallback}</span>;
  }
  return (
    <div
      className="file-thumb"
      role="button"
      tabIndex={0}
      aria-disabled={disabled || undefined}
      title={`${filename} — büyütmek için tıklayın`}
      onClick={() => { if (!disabled) onOpen(); }}
      onKeyDown={(event) => {
        if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <img src={url} alt={filename} loading="lazy" decoding="async" />
    </div>
  );
}

