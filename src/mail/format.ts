import DOMPurify from 'dompurify';

export function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Dün';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export function formatFull(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function initials(name: string, email: string) {
  const source = (name || email || '?').replace(/<[^>]+>/g, '').trim();
  return source.slice(0, 1).toLocaleUpperCase('tr-TR');
}

const REMOTE_SRC = /^\s*(https?:)?\/\//i;

export function hasRemoteImages(html: string) {
  return /<img\b[^>]*\bsrc\s*=\s*["']?\s*(https?:)?\/\//i.test(String(html || ''));
}

export function mailDocument(html: string, options: { remoteImages?: boolean } = {}) {
  const remote = options.remoteImages === true;
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'link', 'meta'],
    FORBID_ATTR: remote ? [] : ['srcset', 'background'],
    RETURN_DOM: true,
  }) as HTMLElement;
  if (!remote) {
    clean.querySelectorAll('img').forEach((img) => {
      if (REMOTE_SRC.test(img.getAttribute('src') || '')) {
        img.removeAttribute('src');
        img.setAttribute('alt', img.getAttribute('alt') || '[resim]');
      }
    });
  }
  const imgSrc = remote ? 'data: https: http:' : 'data:';
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${imgSrc}; style-src 'unsafe-inline';"><base target="_blank"><style>
    html{height:100%;overflow-y:auto;scrollbar-width:auto;scrollbar-color:#94a3b8 #f1f5f9;-webkit-overflow-scrolling:touch}
    body{margin:0;padding:16px 14px 36px;min-height:100%;box-sizing:border-box;font:14.5px/1.62 "Inter","Segoe UI Variable Text","Segoe UI",-apple-system,Roboto,"Helvetica Neue",sans-serif;color:#090d16;word-wrap:break-word;overflow-wrap:anywhere;overflow-x:auto}
    img{max-width:100%;height:auto;display:inline-block} table{max-width:100%} a{color:#0a52c6;font-weight:500}
    blockquote{margin:12px 0;padding-left:12px;border-left:3px solid #94a3b8;color:#334155}
    ::-webkit-scrollbar{width:10px;height:10px}
    ::-webkit-scrollbar-track{background:#f1f5f9}
    ::-webkit-scrollbar-thumb{background:#94a3b8;border-radius:6px;border:2px solid #f1f5f9}
    ::-webkit-scrollbar-thumb:hover{background:#64748b}
  </style></head><body>${clean.innerHTML}</body></html>`;
}

export function sanitizeComposeHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'div', 'span', 'h2', 'h3', 'hr'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
  });
}

export function textToHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

export function htmlToText(html: string) {
  const element = document.createElement('div');
  element.innerHTML = sanitizeComposeHtml(html).replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(p|div|li|blockquote)>/gi, '\n');
  return element.textContent?.trim() || '';
}

export function fileKind(type: string, name = '') {
  const haystack = `${type} ${name}`.toLowerCase();
  if (haystack.includes('pdf')) return 'PDF';
  if (haystack.includes('image') || /\.(png|jpe?g|gif|webp)$/i.test(name)) return 'Görsel';
  if (haystack.includes('word') || /\.docx?$/i.test(name)) return 'Word';
  if (haystack.includes('excel') || /\.xlsx?$/i.test(name)) return 'Excel';
  if (haystack.includes('zip') || haystack.includes('compressed')) return 'Arşiv';
  return 'Dosya';
}

export function fileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
