const sanitizeHtml = require('sanitize-html');

function sanitizeMailHtml(input) {
  const raw = String(input || '');
  if (!raw.trim()) return '';
  return sanitizeHtml(raw, {
    allowedTags: [
      'a', 'b', 'br', 'blockquote', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'hr',
      'i', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody', 'thead',
      'tr', 'td', 'th', 'u', 'ul', 'center', 'font', 'small', 'sub', 'sup',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      td: ['colspan', 'rowspan', 'align', 'valign', 'width', 'height'],
      th: ['colspan', 'rowspan', 'align', 'valign', 'width', 'height'],
      table: ['width', 'align', 'border', 'cellpadding', 'cellspacing'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (_tag, attribs) => {
        const href = attribs.href || '';
        const safe = /^(https?:|mailto:)/i.test(href) ? href : undefined;
        const next = { target: '_blank', rel: 'noreferrer noopener' };
        if (safe) next.href = safe;
        return { tagName: 'a', attribs: next };
      },
      img: (_tag, attribs) => {
        const src = attribs.src || '';
        const ok = /^(https?:\/\/|data:image\/(?:png|jpe?g|gif|webp);base64,)/i.test(src);
        const next = { alt: attribs.alt || '' };
        if (ok) next.src = src;
        if (attribs.width) next.width = attribs.width;
        if (attribs.height) next.height = attribs.height;
        return { tagName: 'img', attribs: next };
      },
    },
  });
}

function textToHtml(text) {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  if (!escaped.trim()) return '';
  return `<p>${escaped.replace(/\n/g, '<br>')}</p>`;
}

function visibleText(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = { sanitizeMailHtml, textToHtml, visibleText };
