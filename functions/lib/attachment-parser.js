const zlib = require('node:zlib');

// TODO(security): External antivirus/CDR scanning is not integrated for in-memory IMAP
// attachment inspection; attachments are never written to disk or executed, and strict
// magic-byte, entry-count, and decompression size caps are enforced below.

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB per attachment
const MAX_MULTIMODAL_BYTES = 4 * 1024 * 1024; // 4 MB inline base64 cap
const MAX_ZIP_ENTRIES = 200;
const MAX_ZIP_ENTRY_UNCOMPRESSED = 5 * 1024 * 1024; // 5 MB single XML sheet
const MAX_ZIP_TOTAL_UNCOMPRESSED = 10 * 1024 * 1024; // 10 MB total zip-bomb guard
const MAX_TEXT_CHARS_PER_FILE = 12000;

const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

function detectMagicMime(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return null;
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf'; // %PDF
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return 'application/zip'; // PK..
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  return null;
}

function decodeXmlEntities(str) {
  // Safe static XML entity decoding: no external entity (XXE) or DTD resolution.
  return String(str || '')
    .replace(/&#x([0-9a-fA-F]{1,6});/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return code >= 0x20 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
    })
    .replace(/&#([0-9]{1,7});/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return code >= 0x20 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function isSafeZipEntryName(name) {
  if (!name || typeof name !== 'string' || name.length > 260) return false;
  if (name.includes('\0') || name.startsWith('/') || name.startsWith('\\')) return false;
  const parts = name.split(/[\\/]+/);
  return !parts.some((p) => p === '..');
}

function parseZipEntries(buf, wantedPredicate) {
  const entries = new Map();
  if (!Buffer.isBuffer(buf) || buf.length < 22) return entries;

  // Locate End of Central Directory (EOCD) signature 0x06054b50
  const minPos = Math.max(0, buf.length - 65557);
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= minPos; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) return entries;

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  if (totalEntries > MAX_ZIP_ENTRIES || cdOffset >= buf.length) return entries;

  let ptr = cdOffset;
  let totalUncompressed = 0;

  for (let idx = 0; idx < totalEntries && ptr + 46 <= buf.length; idx += 1) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
    const compressionMethod = buf.readUInt16LE(ptr + 10);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const uncompressedSize = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localHeaderOffset = buf.readUInt32LE(ptr + 42);

    const nameEnd = ptr + 46 + nameLen;
    if (nameEnd > buf.length) break;
    const rawName = buf.subarray(ptr + 46, nameEnd).toString('utf8');
    ptr = nameEnd + extraLen + commentLen;

    if (!isSafeZipEntryName(rawName)) continue;
    if (wantedPredicate && !wantedPredicate(rawName)) continue;
    if (uncompressedSize > MAX_ZIP_ENTRY_UNCOMPRESSED) continue;
    if (totalUncompressed + uncompressedSize > MAX_ZIP_TOTAL_UNCOMPRESSED) break;

    if (localHeaderOffset + 30 > buf.length) continue;
    if (buf.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buf.length) continue;

    const slice = buf.subarray(dataStart, dataEnd);
    try {
      let out;
      if (compressionMethod === 0) {
        out = slice;
      } else if (compressionMethod === 8) {
        out = zlib.inflateRawSync(slice, { maxOutputLength: MAX_ZIP_ENTRY_UNCOMPRESSED });
      } else {
        continue;
      }
      totalUncompressed += out.length;
      if (totalUncompressed > MAX_ZIP_TOTAL_UNCOMPRESSED) break;
      entries.set(rawName, out);
    } catch {
      // Ignore malformed compressed entry
    }
  }

  return entries;
}

function extractXlsxText(buf) {
  const files = parseZipEntries(
    buf,
    (name) => name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/i.test(name),
  );
  if (files.size === 0) return '';

  const sharedStrings = [];
  const sharedBuf = files.get('xl/sharedStrings.xml');
  if (sharedBuf) {
    const xml = sharedBuf.toString('utf8');
    const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
    let siMatch;
    while ((siMatch = siRegex.exec(xml)) !== null) {
      const parts = [];
      const tRegex = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi;
      let tMatch;
      while ((tMatch = tRegex.exec(siMatch[1])) !== null) {
        parts.push(decodeXmlEntities(tMatch[1]));
      }
      sharedStrings.push(parts.join(''));
    }
  }

  const sheetNames = [...files.keys()]
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
    .sort()
    .slice(0, 5);

  const lines = [];
  for (const sheetName of sheetNames) {
    const sheetXml = files.get(sheetName).toString('utf8');
    const sheetLabel = sheetName.replace(/^xl\/worksheets\/|\.xml$/gi, '');
    if (sheetNames.length > 1) lines.push(`[Tablo: ${sheetLabel}]`);

    const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
    let rowMatch;
    let rowCount = 0;
    while ((rowMatch = rowRegex.exec(sheetXml)) !== null && rowCount < 250) {
      const cells = [];
      const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        const attrs = cellMatch[1] || '';
        const inner = cellMatch[2] || '';
        const typeMatch = /\bt="([^"]+)"/.exec(attrs);
        const cellType = typeMatch ? typeMatch[1] : '';
        let cellVal = '';
        if (cellType === 'inlineStr') {
          const tMatch = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/i.exec(inner);
          cellVal = tMatch ? decodeXmlEntities(tMatch[1]) : '';
        } else {
          const vMatch = /<v>([\s\S]*?)<\/v>/i.exec(inner);
          const rawV = vMatch ? decodeXmlEntities(vMatch[1]).trim() : '';
          if (cellType === 's') {
            const idx = Number(rawV);
            cellVal = Number.isInteger(idx) && idx >= 0 && idx < sharedStrings.length ? sharedStrings[idx] : rawV;
          } else {
            cellVal = rawV;
          }
        }
        if (cellVal !== '') cells.push(cellVal.replace(/\s+/g, ' ').trim());
      }
      if (cells.length > 0) {
        lines.push(cells.join(' | '));
        rowCount += 1;
      }
      if (lines.join('\n').length >= MAX_TEXT_CHARS_PER_FILE) break;
    }
  }

  return lines.join('\n').slice(0, MAX_TEXT_CHARS_PER_FILE);
}

function extractDocxText(buf) {
  const files = parseZipEntries(buf, (name) => name === 'word/document.xml');
  const docBuf = files.get('word/document.xml');
  if (!docBuf) return '';
  const xml = docBuf.toString('utf8');
  const paragraphs = [];
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(xml)) !== null) {
    const texts = [];
    const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gi;
    let tMatch;
    while ((tMatch = tRegex.exec(pMatch[1])) !== null) {
      texts.push(decodeXmlEntities(tMatch[1]));
    }
    const line = texts.join('').replace(/\s+/g, ' ').trim();
    if (line) paragraphs.push(line);
    if (paragraphs.join('\n').length >= MAX_TEXT_CHARS_PER_FILE) break;
  }
  return paragraphs.join('\n').slice(0, MAX_TEXT_CHARS_PER_FILE);
}

function decodePdfLiteralString(raw) {
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '\\' && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next === 'n') { out += '\n'; i += 1; }
      else if (next === 'r') { out += ' '; i += 1; }
      else if (next === 't') { out += ' '; i += 1; }
      else if (/[0-7]/.test(next)) {
        const oct = raw.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)[0];
        out += String.fromCharCode(parseInt(oct, 8));
        i += oct.length;
      } else {
        out += next;
        i += 1;
      }
    } else {
      out += ch;
    }
  }
  return out;
}

function decodePdfHexString(hex) {
  const clean = hex.replace(/\s+/g, '');
  if (!clean) return '';
  const padded = clean.length % 2 === 1 ? `${clean}0` : clean;
  const bytes = Buffer.from(padded, 'hex');
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    // UTF-16BE
    let out = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return out;
  }
  return bytes.toString('latin1');
}

function extractTextFromPdfStream(streamText) {
  const chunks = [];
  const blockRegex = /BT\b([\s\S]*?)ET\b/g;
  let block;
  while ((block = blockRegex.exec(streamText)) !== null) {
    const content = block[1];
    const tokenRegex = /\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>/g;
    let tok;
    const lineParts = [];
    while ((tok = tokenRegex.exec(content)) !== null) {
      const rawTok = tok[0];
      const decoded = rawTok.startsWith('<')
        ? decodePdfHexString(rawTok.slice(1, -1))
        : decodePdfLiteralString(rawTok.slice(1, -1));
      const cleaned = decoded.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ').trim();
      if (cleaned) lineParts.push(cleaned);
    }
    if (lineParts.length > 0) chunks.push(lineParts.join(' '));
  }
  return chunks.join('\n');
}

function extractPdfTextFallback(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 8) return '';
  const rawLatin1 = buf.toString('latin1');
  const pieces = [];

  const streamRegex = /<<([\s\S]*?)>>\s*stream\r?\n/g;
  let match;
  let streamCount = 0;
  while ((match = streamRegex.exec(rawLatin1)) !== null && streamCount < 60) {
    streamCount += 1;
    const dict = match[1] || '';
    const startOffset = match.index + match[0].length;
    const endOffset = rawLatin1.indexOf('endstream', startOffset);
    if (endOffset < 0) break;
    let sliceEnd = endOffset;
    if (rawLatin1[sliceEnd - 1] === '\n') sliceEnd -= 1;
    if (rawLatin1[sliceEnd - 1] === '\r') sliceEnd -= 1;
    if (sliceEnd <= startOffset || sliceEnd - startOffset > MAX_ZIP_ENTRY_UNCOMPRESSED) continue;

    const streamBuf = buf.subarray(startOffset, sliceEnd);
    let decodedStream = '';
    if (/\/FlateDecode\b/.test(dict)) {
      try {
        const inflated = zlib.inflateSync(streamBuf, { maxOutputLength: MAX_ZIP_ENTRY_UNCOMPRESSED });
        decodedStream = inflated.toString('latin1');
      } catch {
        try {
          const inflatedRaw = zlib.inflateRawSync(streamBuf, { maxOutputLength: MAX_ZIP_ENTRY_UNCOMPRESSED });
          decodedStream = inflatedRaw.toString('latin1');
        } catch {
          continue;
        }
      }
    } else if (!/\/Filter\b/.test(dict)) {
      decodedStream = streamBuf.toString('latin1');
    }

    if (decodedStream && decodedStream.includes('BT')) {
      const txt = extractTextFromPdfStream(decodedStream);
      if (txt) pieces.push(txt);
    }
    if (pieces.join('\n').length >= MAX_TEXT_CHARS_PER_FILE) break;
  }

  return pieces.join('\n').replace(/[ \t]+/g, ' ').trim().slice(0, MAX_TEXT_CHARS_PER_FILE);
}

function parseAttachmentForAi({ filename = '', contentType = '', content }) {
  const safeName = String(filename || 'ek').replace(/[\r\n\0]/g, '').slice(0, 140);
  const lowerName = safeName.toLowerCase();
  const declaredMime = String(contentType || 'application/octet-stream').split(';')[0].trim().toLowerCase();

  if (!Buffer.isBuffer(content) || content.length === 0) {
    return { filename: safeName, contentType: declaredMime, size: 0, kind: 'empty', parsed: false, supported: false, reason: 'empty', warning: 'Boş dosya', extractedText: '', multimodal: null };
  }
  if (content.length > MAX_ATTACHMENT_BYTES) {
    return { filename: safeName, contentType: declaredMime, size: content.length, kind: 'skipped', parsed: false, supported: false, reason: 'too_large', warning: 'Boyut sınırı (8 MB) aşıldı', extractedText: '', multimodal: null };
  }

  const magic = detectMagicMime(content);

  // 1. PDF Document
  if (magic === 'application/pdf' || (declaredMime === 'application/pdf' && magic === 'application/pdf')) {
    const extractedText = extractPdfTextFallback(content);
    const multimodal = content.length <= MAX_MULTIMODAL_BYTES
      ? { kind: 'document', mimeType: 'application/pdf', base64: content.toString('base64'), filename: safeName }
      : null;
    const ok = Boolean(extractedText || multimodal);
    return {
      filename: safeName,
      contentType: 'application/pdf',
      size: content.length,
      kind: 'pdf',
      parsed: ok,
      supported: ok,
      extractedText,
      multimodal,
    };
  }

  // 2. Images (PNG, JPEG, WEBP, GIF) - strictly verify magic bytes
  if (magic && ALLOWED_IMAGE_MIMES.has(magic)) {
    const multimodal = content.length <= MAX_MULTIMODAL_BYTES
      ? { kind: 'image', mimeType: magic, base64: content.toString('base64'), filename: safeName }
      : null;
    const ok = Boolean(multimodal);
    return {
      filename: safeName,
      contentType: magic,
      size: content.length,
      kind: 'image',
      parsed: ok,
      supported: ok,
      extractedText: '',
      multimodal,
    };
  }

  // 3. OOXML Office Archives (.xlsx, .docx) - verify ZIP magic bytes
  if (magic === 'application/zip') {
    if (lowerName.endsWith('.xlsx') || declaredMime.includes('spreadsheetml')) {
      const extractedText = extractXlsxText(content);
      const ok = Boolean(extractedText);
      return {
        filename: safeName,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: content.length,
        kind: 'xlsx',
        parsed: ok,
        supported: ok,
        extractedText,
        multimodal: null,
        ...(!ok ? { warning: 'Tablo içinde okunabilir metin bulunamadı' } : {}),
      };
    }
    if (lowerName.endsWith('.docx') || declaredMime.includes('wordprocessingml')) {
      const extractedText = extractDocxText(content);
      const ok = Boolean(extractedText);
      return {
        filename: safeName,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: content.length,
        kind: 'docx',
        parsed: ok,
        supported: ok,
        extractedText,
        multimodal: null,
        ...(!ok ? { warning: 'Belge içinde okunabilir metin bulunamadı' } : {}),
      };
    }
  }

  // 4. Plain Text / CSV / TSV / JSON / XML / Markdown
  const isTextExt = /\.(csv|tsv|txt|md|json|xml|eml)$/i.test(lowerName);
  const isTextMime = declaredMime.startsWith('text/') || declaredMime === 'application/json' || declaredMime === 'application/csv' || declaredMime === 'application/xml';
  if ((isTextExt || isTextMime) && !magic) {
    const rawText = content
      .subarray(0, 256 * 1024)
      .toString('utf8')
      .replace(/\0/g, '')
      .trim()
      .slice(0, MAX_TEXT_CHARS_PER_FILE);
    const ok = Boolean(rawText);
    return {
      filename: safeName,
      contentType: declaredMime || 'text/plain',
      size: content.length,
      kind: lowerName.endsWith('.csv') ? 'csv' : 'text',
      parsed: ok,
      supported: ok,
      extractedText: rawText,
      multimodal: null,
    };
  }

  return {
    filename: safeName,
    contentType: declaredMime,
    size: content.length,
    kind: 'unsupported',
    parsed: false,
    supported: false,
    reason: 'unsupported_type',
    warning: 'Desteklenmeyen ek biçimi',
    extractedText: '',
    multimodal: null,
  };
}

module.exports = {
  MAX_ATTACHMENT_BYTES,
  MAX_MULTIMODAL_BYTES,
  detectMagicMime,
  parseZipEntries,
  extractXlsxText,
  extractDocxText,
  extractPdfTextFallback,
  parseAttachmentForAi,
};
