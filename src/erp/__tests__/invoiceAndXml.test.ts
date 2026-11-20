// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseUblTrInvoiceXml } from '../services/xmlInvoiceParser';
import { extractFieldsFromTurkishInvoiceText, findDuplicateInvoice } from '../services/ocrInvoiceService';
import { InvoiceRecord } from '../types/erp';
import { toKurus } from '../utils/money';

const SAMPLE_UBL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>CBR2026000000042</cbc:ID>
  <cbc:UUID>8d9b8f34-7b1a-4c32-991a-0123456789ab</cbc:UUID>
  <cbc:IssueDate>2026-10-14</cbc:IssueDate>
  <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="VKN">6010491372</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>Toros Yapı Malzemeleri A.Ş.</cbc:Name>
      </cac:PartyName>
      <cac:PartyTaxScheme>
        <cac:TaxScheme>
          <cbc:Name>Ziyapaşa Vergi Dairesi</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:PaymentMeans>
    <cac:PayeeFinancialAccount>
      <cbc:ID>TR330006100519786457841326</cbc:ID>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="TRY">2000.00</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="TRY">10000.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="TRY">10000.00</cbc:TaxExclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="TRY">0.00</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="TRY">12000.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:InvoicedQuantity unitCode="MTK">100</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="TRY">10000.00</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="TRY">2000.00</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:Percent>20</cbc:Percent>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>0.70mm Boyalı Galvaniz Trapez Sac</cbc:Name>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="TRY">100.00</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>
</Invoice>`;

describe('XML UBL-TR Invoice Parser, OCR Heuristic & Duplicate Guard', () => {
  it('parses Turkish e-Fatura UBL-TR XML lines, ETTN, VKN, IBAN and totals in kuruş', () => {
    const parsed = parseUblTrInvoiceXml(SAMPLE_UBL_XML);
    expect(parsed.invoiceNo).toBe('CBR2026000000042');
    expect(parsed.ettn).toBe('8d9b8f34-7b1a-4c32-991a-0123456789ab');
    expect(parsed.issueDate).toBe('2026-10-14');
    expect(parsed.supplierName).toBe('Toros Yapı Malzemeleri A.Ş.');
    expect(parsed.supplierTaxNo).toBe('6010491372');
    expect(parsed.supplierTaxOffice).toBe('Ziyapaşa Vergi Dairesi');
    expect(parsed.iban).toBe('TR330006100519786457841326');
    expect(parsed.subtotalKurus).toBe(toKurus(10_000));
    expect(parsed.vatTotalKurus).toBe(toKurus(2_000));
    expect(parsed.grandTotalKurus).toBe(toKurus(12_000));
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].unit).toBe('m²');
    expect(parsed.items[0].quantity).toBe(100);
  });

  it('extracts supplier, VKN, date, ETTN, IBAN and totals from raw Turkish OCR text', () => {
    const ocrSample = `
      AKDENİZ YANGIN GÜVENLİK SİSTEMLERİ LTD. ŞTİ.
      Vergi Dairesi: Çukurova
      VKN: 1234567890
      Fatura No: AKD2026000000105
      ETTN: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
      Düzenleme Tarihi: 18.10.2026
      Mal Hizmet Toplam: 50.000,00 TL
      Hesaplanan KDV %20: 10.000,00 TL
      Ödenecek Tutar: 60.000,00 TL
      TR12 0006 2000 1234 0006 5432 10
    `;
    const res = extractFieldsFromTurkishInvoiceText(ocrSample, 0.85);
    expect(res.supplierTaxNo).toBe('1234567890');
    expect(res.invoiceNo).toBe('AKD2026000000105');
    expect(res.ettn).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(res.issueDate).toBe('2026-10-18');
    expect(res.subtotalKurus).toBe(toKurus(50_000));
    expect(res.vatTotalKurus).toBe(toKurus(10_000));
    expect(res.grandTotalKurus).toBe(toKurus(60_000));
    expect(res.iban).toBe('TR120006200012340006543210');
    expect(res.lowConfidenceFields).toHaveLength(0);
  });

  it('detects duplicate invoices by ETTN, invoiceNo+VKN, or file SHA-256 hash', () => {
    const existing: InvoiceRecord[] = [
      {
        id: 'inv-existing',
        organizationId: 'kuzeydenizi',
        projectId: 'prj-1',
        supplierId: 'sup-1',
        supplierName: 'Toros A.Ş.',
        supplierTaxNo: '6010491372',
        supplierTaxOffice: 'Seyhan',
        invoiceNo: 'CBR2026000000042',
        waybillNo: '',
        ettn: '8d9b8f34-7b1a-4c32-991a-0123456789ab',
        invoiceType: 'SATIŞ',
        issueDate: '2026-10-14',
        dueDate: '2026-11-14',
        iban: '',
        paymentInfo: '',
        subtotalKurus: 1000000,
        discountTotalKurus: 0,
        vatTotalKurus: 200000,
        withholdingKurus: 0,
        grandTotalKurus: 1200000,
        deductibleVat: true,
        paidKurus: 0,
        remainingDebtKurus: 1200000,
        items: [],
        allocations: [],
        attachments: [],
        sourceMode: 'xml',
        confirmedByUser: true,
        locked: true,
        fileSha256: 'deadbeefsha256',
        notes: '',
        createdBy: 'test',
        createdAt: '',
        updatedBy: 'test',
        updatedAt: '',
      },
    ];

    expect(findDuplicateInvoice({ fileSha256: 'deadbeefsha256' }, existing).duplicate).toBe(true);
    expect(findDuplicateInvoice({ ettn: '8d9b8f34-7b1a-4c32-991a-0123456789ab' }, existing).duplicate).toBe(true);
    expect(
      findDuplicateInvoice({ invoiceNo: 'CBR2026000000042', supplierTaxNo: '6010491372' }, existing).duplicate
    ).toBe(true);
    expect(
      findDuplicateInvoice({ invoiceNo: 'CBR2026000000999', supplierTaxNo: '9999999999' }, existing).duplicate
    ).toBe(false);
  });
});
