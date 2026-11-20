import { InvoiceLineItem, InvoiceRecord } from '../types/erp';
import { toKurus } from '../utils/money';

export interface ImageTransformOptions {
  rotateDeg: 0 | 90 | 180 | 270;
  enhanceContrast: boolean;
  crop?: { xPct: number; yPct: number; wPct: number; hPct: number }; // 0..100
}

export interface OcrExtractionResult {
  supplierName: string;
  supplierTaxNo: string;
  supplierTaxOffice: string;
  invoiceNo: string;
  ettn: string;
  issueDate: string;
  iban: string;
  invoiceType: InvoiceRecord['invoiceType'];
  subtotalKurus: number;
  vatTotalKurus: number;
  withholdingKurus: number;
  grandTotalKurus: number;
  items: InvoiceLineItem[];
  rawText: string;
  confidence: number;
  lowConfidenceFields: string[];
  engineUsed: 'backend-ai' | 'tesseract-ocr';
}

export async function computeFileSha256(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `fallback-${file.size}-${Date.now()}`;
}

/**
 * Generates an optimized preview copy (cropped/rotated/contrast-enhanced) while
 * leaving the original File completely untouched for archival storage.
 */
export async function generateEnhancedPreviewBlob(
  file: File,
  opts: ImageTransformOptions
): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const crop = opts.crop || { xPct: 0, yPct: 0, wPct: 100, hPct: 100 };
        const sx = Math.round((img.width * crop.xPct) / 100);
        const sy = Math.round((img.height * crop.yPct) / 100);
        const sw = Math.max(10, Math.round((img.width * crop.wPct) / 100));
        const sh = Math.max(10, Math.round((img.height * crop.hPct) / 100));

        const swapAxes = opts.rotateDeg === 90 || opts.rotateDeg === 270;
        const maxDim = 1800;
        const scale = Math.min(1, maxDim / Math.max(sw, sh));
        const dw = Math.round(sw * scale);
        const dh = Math.round(sh * scale);

        const canvas = document.createElement('canvas');
        canvas.width = swapAxes ? dh : dw;
        canvas.height = swapAxes ? dw : dh;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(file);
          return;
        }

        if (opts.enhanceContrast) {
          ctx.filter = 'grayscale(100%) contrast(145%) brightness(106%)';
        }

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((opts.rotateDeg * Math.PI) / 180);
        ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            resolve(blob || file);
          },
          'image/jpeg',
          0.88
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function parseTurkishNumber(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/\s+/g, '');
  // Turkish format: 12.345,67 or 12345,67 or 12345.67
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return parseFloat(cleaned.replace(',', '.')) || 0;
  }
  return parseFloat(cleaned.replace(/,/g, '')) || 0;
}

export function extractFieldsFromTurkishInvoiceText(
  rawText: string,
  baseConfidence = 0.72
): Omit<OcrExtractionResult, 'rawText' | 'engineUsed'> {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // VKN (10 digits) or TCKN (11 digits)
  const vknMatch = rawText.match(/(?:VKN|Vergi\s*(?:No|Kimlik\s*No)?|TCKN)\s*[:\-]?\s*(\d{10,11})/i);
  const supplierTaxNo = vknMatch?.[1] || '';

  // Vergi Dairesi
  const vdMatch = rawText.match(/Vergi\s*Dairesi\s*[:\-]?\s*([A-ZÇĞİÖŞÜa-zçğıöşü\s]{3,40})/i);
  const supplierTaxOffice = vdMatch?.[1]?.split(/\r?\n/)[0]?.trim() || '';

  // ETTN UUID
  const ettnMatch = rawText.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  const ettn = ettnMatch?.[0] || '';

  // Fatura No (e-Fatura 16 char AAA2026000000001 or general)
  const invNoMatch =
    rawText.match(/\b([A-Z0-9]{3}20\d{2}\d{9})\b/) ||
    rawText.match(/Fatura\s*No\s*[:\-]?\s*([A-Z0-9\-\/]{5,24})/i);
  const invoiceNo = invNoMatch?.[1] || '';

  // Issue Date (DD.MM.YYYY or YYYY-MM-DD or DD/MM/YYYY)
  let issueDate = '';
  const dmy = rawText.match(/(\d{2})[.\/-](\d{2})[.\/-](20\d{2})/);
  const ymd = rawText.match(/(20\d{2})[-.\/](\d{2})[-.\/](\d{2})/);
  if (ymd) {
    issueDate = `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  } else if (dmy) {
    issueDate = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }

  // IBAN
  const ibanMatch = rawText.match(/TR\s*\d{2}(?:\s*\d{4}){5}\s*\d{2}/i);
  const iban = ibanMatch ? ibanMatch[0].replace(/\s+/g, '').toUpperCase() : '';

  // Supplier Name heuristic: first prominent company line (A.Ş., LTD, ŞTİ, SAN, TİC)
  const companyLine =
    lines.find((l) => /(?:LTD|ŞTİ|A\.Ş\.|SANAYİ|TİCARET|İNŞAAT|MÜHENDİSLİK)/i.test(l)) ||
    lines[0] ||
    '';
  const supplierName = companyLine.slice(0, 80);

  // Totals (prioritize unambiguous grand-total labels before fallback TOPLAM)
  const totalMatch =
    rawText.match(/(?:Ödenecek\s*Tutar|Genel\s*Toplam)\s*[:\-]?\s*([\d.,]+)\s*(?:TL|₺)?/i) ||
    rawText.match(/(?:Toplam\s*Tutar|\bTOPLAM\b)\s*[:\-]?\s*([\d.,]+)\s*(?:TL|₺)?/i);
  const subMatch = rawText.match(
    /(?:Mal\s*Hizmet\s*Toplam|Ara\s*Toplam|Matrah)\s*[:\-]?\s*([\d.,]+)/i
  );
  const vatMatch = rawText.match(
    /(?:Hesaplanan\s*KDV|Toplam\s*KDV|KDV)\s*(?:%\d+\s*)?[:\-]?\s*([\d.,]+)/i
  );
  const tevkifatMatch = rawText.match(/Tevkifat\s*[:\-]?\s*([\d.,]+)/i);

  const grandTl = parseTurkishNumber(totalMatch?.[1] || '0');
  const subTl = parseTurkishNumber(subMatch?.[1] || '0');
  const vatTl = parseTurkishNumber(vatMatch?.[1] || '0');
  const withTl = parseTurkishNumber(tevkifatMatch?.[1] || '0');

  const grandTotalKurus = toKurus(grandTl);
  const subtotalKurus = toKurus(subTl || (vatTl > 0 ? Math.max(0, grandTl - vatTl) : grandTl));
  const vatTotalKurus = toKurus(vatTl);
  const withholdingKurus = toKurus(withTl);

  const lowConfidenceFields: string[] = [];
  if (!supplierName || supplierName.length < 4) lowConfidenceFields.push('supplierName');
  if (!supplierTaxNo) lowConfidenceFields.push('supplierTaxNo');
  if (!invoiceNo) lowConfidenceFields.push('invoiceNo');
  if (!issueDate) lowConfidenceFields.push('issueDate');
  if (grandTotalKurus <= 0) lowConfidenceFields.push('grandTotal');

  const items: InvoiceLineItem[] =
    grandTotalKurus > 0
      ? [
          {
            id: `ocr-line-1`,
            name: `${supplierName || 'Fatura'} — Malzeme / Hizmet Kalemi`,
            quantity: 1,
            unit: 'Adet',
            unitPriceKurus: subtotalKurus || grandTotalKurus,
            discountKurus: 0,
            vatRate:
              subtotalKurus > 0 && vatTotalKurus > 0
                ? Math.round((vatTotalKurus / subtotalKurus) * 100)
                : 20,
            netKurus: subtotalKurus || grandTotalKurus,
            vatKurus: vatTotalKurus,
            grossKurus: grandTotalKurus,
            confidence: baseConfidence,
          },
        ]
      : [];

  return {
    supplierName,
    supplierTaxNo,
    supplierTaxOffice,
    invoiceNo,
    ettn,
    issueDate,
    iban,
    invoiceType: withholdingKurus > 0 ? 'TEVKİFATLI' : 'SATIŞ',
    subtotalKurus,
    vatTotalKurus,
    withholdingKurus,
    grandTotalKurus,
    items,
    confidence: baseConfidence,
    lowConfidenceFields,
  };
}

export async function runInvoiceOcr(
  imageOrPdfBlob: Blob,
  aiBackendEndpoint?: string
): Promise<OcrExtractionResult> {
  // 1. If secure backend AI OCR endpoint is configured, use it first
  if (aiBackendEndpoint) {
    try {
      const formData = new FormData();
      formData.append('file', imageOrPdfBlob);
      const res = await fetch(`${aiBackendEndpoint.replace(/\/$/, '')}/ocr-invoice`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        return { ...data, engineUsed: 'backend-ai' };
      }
    } catch {
      // Fallback safely to on-device Tesseract OCR
    }
  }

  // 2. Local Tesseract.js OCR (works 100% client-side without leaking keys)
  if (!imageOrPdfBlob.type.startsWith('image/')) {
    return {
      supplierName: '',
      supplierTaxNo: '',
      supplierTaxOffice: '',
      invoiceNo: '',
      ettn: '',
      issueDate: '',
      iban: '',
      invoiceType: 'SATIŞ',
      subtotalKurus: 0,
      vatTotalKurus: 0,
      withholdingKurus: 0,
      grandTotalKurus: 0,
      items: [],
      rawText: 'PDF belgesi yüklendi. Otomatik alan çıkarma için görsel veya XML e-Fatura kullanabilir ya da alanları manuel doğrulayabilirsiniz.',
      confidence: 0,
      lowConfidenceFields: ['supplierName', 'invoiceNo', 'grandTotal'],
      engineUsed: 'tesseract-ocr',
    };
  }

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('tur+eng');
  try {
    const result = await worker.recognize(imageOrPdfBlob);
    const rawText = result.data.text || '';
    const conf = Math.max(0, Math.min(1, (result.data.confidence || 60) / 100));
    const parsed = extractFieldsFromTurkishInvoiceText(rawText, conf);
    return {
      ...parsed,
      rawText,
      engineUsed: 'tesseract-ocr',
    };
  } finally {
    await worker.terminate();
  }
}

export function findDuplicateInvoice(
  candidate: {
    invoiceNo?: string;
    ettn?: string;
    supplierTaxNo?: string;
    grandTotalKurus?: number;
    fileSha256?: string;
  },
  existingInvoices: InvoiceRecord[]
): { duplicate: boolean; reason: string; matchedInvoice?: InvoiceRecord } {
  for (const inv of existingInvoices) {
    if (candidate.fileSha256 && inv.fileSha256 && candidate.fileSha256 === inv.fileSha256) {
      return {
        duplicate: true,
        reason: `Aynı dosya (SHA-256 özeti) daha önce #${inv.invoiceNo || inv.id} kaydında yüklendi.`,
        matchedInvoice: inv,
      };
    }
    if (
      candidate.ettn &&
      inv.ettn &&
      candidate.ettn.toLowerCase() === inv.ettn.toLowerCase()
    ) {
      return {
        duplicate: true,
        reason: `Aynı ETTN (${inv.ettn}) sistemde zaten mevcut.`,
        matchedInvoice: inv,
      };
    }
    if (
      candidate.invoiceNo &&
      inv.invoiceNo &&
      candidate.invoiceNo.toLowerCase() === inv.invoiceNo.toLowerCase() &&
      (!candidate.supplierTaxNo ||
        !inv.supplierTaxNo ||
        candidate.supplierTaxNo === inv.supplierTaxNo)
    ) {
      return {
        duplicate: true,
        reason: `Aynı fatura numarası (${inv.invoiceNo}) bu tedarikçi için zaten kayıtlı.`,
        matchedInvoice: inv,
      };
    }
  }
  return { duplicate: false, reason: '' };
}
