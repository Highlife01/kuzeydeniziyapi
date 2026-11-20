import { InvoiceLineItem } from '../types/erp';
import { toKurus } from '../utils/money';

export interface ParsedXmlInvoice {
  supplierName: string;
  supplierTaxNo: string;
  supplierTaxOffice: string;
  invoiceNo: string;
  ettn: string;
  issueDate: string;
  invoiceType: 'SATIŞ' | 'İADE' | 'TEVKİFATLI' | 'İSTİSNA' | 'ÖZEL MATRAH' | 'GİDER';
  iban: string;
  paymentInfo: string;
  subtotalKurus: number;
  discountTotalKurus: number;
  vatTotalKurus: number;
  withholdingKurus: number;
  grandTotalKurus: number;
  items: InvoiceLineItem[];
}

function findElementsByLocalName(root: Document | Element, localName: string): Element[] {
  const out: Element[] = [];
  const all = root.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.localName === localName || el.nodeName.split(':').pop() === localName) {
      out.push(el);
    }
  }
  return out;
}

function getFirstText(root: Document | Element, localName: string): string {
  const els = findElementsByLocalName(root, localName);
  return els[0]?.textContent?.trim() || '';
}

function getChildText(parent: Element | undefined, localName: string): string {
  if (!parent) return '';
  return getFirstText(parent, localName);
}

const UBL_UNIT_MAP: Record<string, string> = {
  C62: 'Adet',
  NIU: 'Adet',
  KGM: 'Kg',
  TNE: 'Ton',
  MTR: 'Metre',
  MTK: 'm²',
  MTQ: 'm³',
  LTR: 'Litre',
  BX: 'Kutu',
  PK: 'Paket',
  SET: 'Takım',
};

export function parseUblTrInvoiceXml(xmlText: string): ParsedXmlInvoice {
  if (typeof DOMParser === 'undefined') {
    throw new Error('XML ayrıştırıcı bu ortamda kullanılamıyor.');
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const parseErr = doc.getElementsByTagName('parsererror');
  if (parseErr.length > 0) {
    throw new Error('Geçersiz XML e-Fatura dosyası.');
  }

  // Root ID (Fatura No), UUID (ETTN), IssueDate, InvoiceTypeCode
  let invoiceNo = '';
  let ettn = '';
  let issueDate = '';
  let rawType = '';

  const rootChildren = Array.from(doc.documentElement.children);
  for (const ch of rootChildren) {
    const ln = ch.localName || ch.nodeName.split(':').pop();
    if (ln === 'ID' && !invoiceNo) invoiceNo = ch.textContent?.trim() || '';
    if (ln === 'UUID' && !ettn) ettn = ch.textContent?.trim() || '';
    if (ln === 'IssueDate' && !issueDate) issueDate = ch.textContent?.trim() || '';
    if (ln === 'InvoiceTypeCode' && !rawType) rawType = ch.textContent?.trim().toUpperCase() || '';
  }

  const supplierEl = findElementsByLocalName(doc, 'AccountingSupplierParty')[0];
  let supplierName = '';
  let supplierTaxNo = '';
  let supplierTaxOffice = '';

  if (supplierEl) {
    supplierName =
      getChildText(findElementsByLocalName(supplierEl, 'PartyName')[0], 'Name') ||
      [
        getChildText(findElementsByLocalName(supplierEl, 'Person')[0], 'FirstName'),
        getChildText(findElementsByLocalName(supplierEl, 'Person')[0], 'FamilyName'),
      ]
        .filter(Boolean)
        .join(' ');

    const partyIds = findElementsByLocalName(supplierEl, 'PartyIdentification');
    for (const pid of partyIds) {
      const idEl = findElementsByLocalName(pid, 'ID')[0];
      const scheme = idEl?.getAttribute('schemeID') || '';
      const val = idEl?.textContent?.trim() || '';
      if (scheme === 'VKN' || scheme === 'TCKN' || (!supplierTaxNo && /^\d{10,11}$/.test(val))) {
        supplierTaxNo = val;
      }
    }

    const taxSchemeEl = findElementsByLocalName(supplierEl, 'TaxScheme')[0];
    supplierTaxOffice = getChildText(taxSchemeEl, 'Name');
  }

  // IBAN & Payment Info
  const paymentMeansEl = findElementsByLocalName(doc, 'PaymentMeans')[0];
  const iban = getChildText(paymentMeansEl, 'ID').replace(/\s+/g, '');
  const paymentNote = getChildText(paymentMeansEl, 'InstructionNote');

  // LegalMonetaryTotal
  const monetaryEl = findElementsByLocalName(doc, 'LegalMonetaryTotal')[0];
  const lineExtTl = parseFloat(getChildText(monetaryEl, 'LineExtensionAmount') || '0') || 0;
  const taxExclTl = parseFloat(getChildText(monetaryEl, 'TaxExclusiveAmount') || '0') || lineExtTl;
  const discountTl = parseFloat(getChildText(monetaryEl, 'AllowanceTotalAmount') || '0') || 0;
  const payableTl = parseFloat(getChildText(monetaryEl, 'PayableAmount') || '0') || 0;

  // TaxTotal & Withholding
  const rootTaxTotal = rootChildren.find(
    (ch) => (ch.localName || ch.nodeName.split(':').pop()) === 'TaxTotal'
  );
  const vatTl = parseFloat(getChildText(rootTaxTotal, 'TaxAmount') || '0') || 0;

  const rootWithholding = rootChildren.find(
    (ch) => (ch.localName || ch.nodeName.split(':').pop()) === 'WithholdingTaxTotal'
  );
  const withholdingTl = parseFloat(getChildText(rootWithholding, 'TaxAmount') || '0') || 0;

  // Line Items
  const lineEls = findElementsByLocalName(doc, 'InvoiceLine');
  const items: InvoiceLineItem[] = lineEls.map((line, idx) => {
    const qtyEl = findElementsByLocalName(line, 'InvoicedQuantity')[0];
    const quantity = parseFloat(qtyEl?.textContent?.trim() || '1') || 1;
    const unitCode = qtyEl?.getAttribute('unitCode') || 'C62';
    const unit = UBL_UNIT_MAP[unitCode] || unitCode || 'Adet';

    const itemEl = findElementsByLocalName(line, 'Item')[0];
    const name = getChildText(itemEl, 'Name') || `Fatura Kalemi ${idx + 1}`;

    const priceEl = findElementsByLocalName(line, 'Price')[0];
    const unitPriceTl = parseFloat(getChildText(priceEl, 'PriceAmount') || '0') || 0;
    const lineNetTl = parseFloat(getChildText(line, 'LineExtensionAmount') || '0') || 0;

    const lineAllowanceEl = findElementsByLocalName(line, 'AllowanceCharge')[0];
    const chargeIndicator = getChildText(lineAllowanceEl, 'ChargeIndicator');
    const lineDiscTl =
      chargeIndicator === 'false'
        ? parseFloat(getChildText(lineAllowanceEl, 'Amount') || '0') || 0
        : 0;

    const lineTaxEl = findElementsByLocalName(line, 'TaxTotal')[0];
    const lineVatTl = parseFloat(getChildText(lineTaxEl, 'TaxAmount') || '0') || 0;
    const lineVatPct =
      parseFloat(getChildText(findElementsByLocalName(lineTaxEl, 'TaxSubtotal')[0], 'Percent') || '20') ||
      20;

    const netKurus = toKurus(lineNetTl || quantity * unitPriceTl - lineDiscTl);
    const vatKurus = toKurus(lineVatTl || (lineNetTl * lineVatPct) / 100);

    return {
      id: `xl-${idx + 1}`,
      name,
      quantity,
      unit,
      unitPriceKurus: toKurus(unitPriceTl),
      discountKurus: toKurus(lineDiscTl),
      vatRate: lineVatPct,
      netKurus,
      vatKurus,
      grossKurus: netKurus + vatKurus,
      confidence: 1,
    };
  });

  const mappedType: ParsedXmlInvoice['invoiceType'] =
    rawType === 'IADE'
      ? 'İADE'
      : rawType === 'TEVKIFAT' || withholdingTl > 0
        ? 'TEVKİFATLI'
        : rawType === 'ISTISNA'
          ? 'İSTİSNA'
          : rawType === 'OZELMATRAH'
            ? 'ÖZEL MATRAH'
            : 'SATIŞ';

  return {
    supplierName,
    supplierTaxNo,
    supplierTaxOffice,
    invoiceNo,
    ettn,
    issueDate,
    invoiceType: mappedType,
    iban,
    paymentInfo: paymentNote || (iban ? `IBAN: ${iban}` : ''),
    subtotalKurus: toKurus(taxExclTl),
    discountTotalKurus: toKurus(discountTl),
    vatTotalKurus: toKurus(vatTl),
    withholdingKurus: toKurus(withholdingTl),
    grandTotalKurus: toKurus(payableTl || taxExclTl + vatTl - withholdingTl),
    items,
  };
}
