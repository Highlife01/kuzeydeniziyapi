import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_EXPENSE_TAXONOMY } from '../data/expenseCategories';
import { confirmAndPostInvoice, ERP_ORG_ID } from '../services/erpStore';
import {
  computeFileSha256,
  findDuplicateInvoice,
  generateEnhancedPreviewBlob,
  ImageTransformOptions,
  runInvoiceOcr,
} from '../services/ocrInvoiceService';
import { uploadToErpStorage, validateErpFile } from '../services/storageService';
import { parseUblTrInvoiceXml } from '../services/xmlInvoiceParser';
import {
  ErpProject,
  InvoiceAllocation,
  InvoiceAttachment,
  InvoiceLineItem,
  InvoiceRecord,
  SupplierCard,
  WarehouseRecord,
} from '../types/erp';
import { allocateKurusByWeights, formatKurusTRY, fromKurus, toKurus } from '../utils/money';

interface InvoiceCaptureModalProps {
  open: boolean;
  onClose: () => void;
  projects: ErpProject[];
  warehouses: WarehouseRecord[];
  suppliers: SupplierCard[];
  existingInvoices: InvoiceRecord[];
  actorEmail: string;
  cloudMode: boolean;
  aiBackendEndpoint?: string;
  defaultProjectId?: string;
  onSuccess: () => void;
}

export const InvoiceCaptureModal: React.FC<InvoiceCaptureModalProps> = ({
  open,
  onClose,
  projects,
  warehouses,
  suppliers,
  existingInvoices,
  actorEmail,
  cloudMode,
  aiBackendEndpoint,
  defaultProjectId,
  onSuccess,
}) => {
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState('');
  const [rotateDeg, setRotateDeg] = useState<0 | 90 | 180 | 270>(0);
  const [enhanceContrast, setEnhanceContrast] = useState(true);
  const [cropTop, setCropTop] = useState(0);
  const [cropBottom, setCropBottom] = useState(100);
  const [cropLeft, setCropLeft] = useState(0);
  const [cropRight, setCropRight] = useState(100);

  const [processing, setProcessing] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [rawOcrText, setRawOcrText] = useState('');
  const [lowConfFields, setLowConfFields] = useState<string[]>([]);
  const [sourceMode, setSourceMode] = useState<InvoiceRecord['sourceMode']>('manual');

  // Extracted / Confirmed invoice fields
  const [supplierName, setSupplierName] = useState('');
  const [supplierTaxNo, setSupplierTaxNo] = useState('');
  const [supplierTaxOffice, setSupplierTaxOffice] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [waybillNo, setWaybillNo] = useState('');
  const [ettn, setEttn] = useState('');
  const [invoiceType, setInvoiceType] = useState<InvoiceRecord['invoiceType']>('SATIŞ');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [iban, setIban] = useState('');
  const [deductibleVat, setDeductibleVat] = useState(true);
  const [subtotalTl, setSubtotalTl] = useState('0');
  const [vatTotalTl, setVatTotalTl] = useState('0');
  const [withholdingTl, setWithholdingTl] = useState('0');
  const [grandTotalTl, setGrandTotalTl] = useState('0');
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [catGroup, setCatGroup] = useState(DEFAULT_EXPENSE_TAXONOMY[0].group);
  const [catSub, setCatSub] = useState(DEFAULT_EXPENSE_TAXONOMY[0].items[0]);
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>([]);
  const [fileSha256, setFileSha256] = useState('');

  // Multi-project expense allocation
  const [allocRows, setAllocRows] = useState<
    { id: string; targetType: 'project' | 'warehouse'; targetId: string; mode: 'amount' | 'percent'; value: number }[]
  >([
    {
      id: 'al-1',
      targetType: 'project',
      targetId: defaultProjectId || projects[0]?.id || 'company_overhead',
      mode: 'percent',
      value: 100,
    },
  ]);

  // Reset modal cleanly every time it opens so previous invoice state never leaks into the next capture
  useEffect(() => {
    if (!open) return;
    setStep('upload');
    setSelectedFile(null);
    setFilePreviewUrl('');
    setRotateDeg(0);
    setEnhanceContrast(true);
    setCropTop(0);
    setCropBottom(100);
    setCropLeft(0);
    setCropRight(100);
    setProcessing(false);
    setUploadPct(0);
    setError('');
    setDuplicateWarning('');
    setRawOcrText('');
    setLowConfFields([]);
    setSourceMode('manual');
    setSupplierName('');
    setSupplierTaxNo('');
    setSupplierTaxOffice('');
    setInvoiceNo('');
    setWaybillNo('');
    setEttn('');
    setInvoiceType('SATIŞ');
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate('');
    setIban('');
    setDeductibleVat(true);
    setSubtotalTl('0');
    setVatTotalTl('0');
    setWithholdingTl('0');
    setGrandTotalTl('0');
    setItems([]);
    setCatGroup(DEFAULT_EXPENSE_TAXONOMY[0].group);
    setCatSub(DEFAULT_EXPENSE_TAXONOMY[0].items[0]);
    setAttachments([]);
    setFileSha256('');
    setAllocRows([
      {
        id: 'al-1',
        targetType: 'project',
        targetId: defaultProjectId || projects[0]?.id || 'company_overhead',
        mode: 'percent',
        value: 100,
      },
    ]);
  }, [open, defaultProjectId]);

  const grandTotalKurus = useMemo(() => toKurus(grandTotalTl), [grandTotalTl]);
  const subtotalKurus = useMemo(() => toKurus(subtotalTl), [subtotalTl]);
  const vatTotalKurus = useMemo(() => toKurus(vatTotalTl), [vatTotalTl]);

  const computedAllocations: InvoiceAllocation[] = useMemo(() => {
    const invoiceId = `inv-draft`;
    if (allocRows.length === 0) return [];
    const hasPercent = allocRows.some((r) => r.mode === 'percent');

    if (hasPercent) {
      const weights = allocRows.map((r) => (r.mode === 'percent' ? r.value : 0));
      const totalPct = weights.reduce((s, w) => s + w, 0);
      const scaleFactor = Math.min(1, totalPct / 100);
      const targetGross = Math.round(grandTotalKurus * scaleFactor);
      const targetNet = Math.round(subtotalKurus * scaleFactor);
      const targetVat = Math.round(vatTotalKurus * scaleFactor);

      const grossParts = allocateKurusByWeights(targetGross, weights);
      const netParts = allocateKurusByWeights(targetNet, weights);
      const vatParts = allocateKurusByWeights(targetVat, weights);

      return allocRows.map((r, idx) => {
        const targetObj =
          r.targetType === 'project'
            ? projects.find((p) => p.id === r.targetId)?.shortName || 'Genel Şirket Gideri'
            : warehouses.find((w) => w.id === r.targetId)?.name || 'Depo';
        return {
          id: r.id,
          invoiceId,
          targetType: r.targetType,
          targetId: r.targetId,
          targetName: targetObj,
          mode: r.mode,
          value: r.value,
          allocatedNetKurus: netParts[idx] || 0,
          allocatedVatKurus: vatParts[idx] || 0,
          allocatedGrossKurus: grossParts[idx] || 0,
        };
      });
    }

    // Explicit TL amounts
    return allocRows.map((r) => {
      const allocGross = toKurus(r.value);
      const ratio = grandTotalKurus > 0 ? allocGross / grandTotalKurus : 0;
      const allocNet = Math.round(subtotalKurus * ratio);
      const allocVat = allocGross - allocNet;
      const targetObj =
        r.targetType === 'project'
          ? projects.find((p) => p.id === r.targetId)?.shortName || 'Genel Şirket Gideri'
          : warehouses.find((w) => w.id === r.targetId)?.name || 'Depo';
      return {
        id: r.id,
        invoiceId,
        targetType: r.targetType,
        targetId: r.targetId,
        targetName: targetObj,
        mode: 'amount',
        value: r.value,
        allocatedNetKurus: allocNet,
        allocatedVatKurus: allocVat,
        allocatedGrossKurus: allocGross,
      };
    });
  }, [allocRows, grandTotalKurus, subtotalKurus, vatTotalKurus, projects, warehouses]);

  const totalAllocatedKurus = computedAllocations.reduce((s, a) => s + a.allocatedGrossKurus, 0);
  const allocationExceeded = totalAllocatedKurus > grandTotalKurus + 1;

  if (!open) return null;

  const handleFilePicked = (file: File | undefined) => {
    if (!file) return;
    setError('');
    setDuplicateWarning('');
    try {
      validateErpFile(file);
    } catch (err: any) {
      setError(err.message);
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setFilePreviewUrl('');
    }
  };

  const handleAnalyzeAndUpload = async () => {
    if (!selectedFile) {
      setStep('review');
      return;
    }
    setProcessing(true);
    setError('');
    setUploadPct(5);

    try {
      const sha = await computeFileSha256(selectedFile);
      setFileSha256(sha);

      const isXml =
        selectedFile.name.toLowerCase().endsWith('.xml') ||
        selectedFile.type.includes('xml');

      let previewBlob: Blob = selectedFile;
      if (selectedFile.type.startsWith('image/')) {
        const opts: ImageTransformOptions = {
          rotateDeg,
          enhanceContrast,
          crop: {
            xPct: cropLeft,
            yPct: cropTop,
            wPct: Math.max(10, cropRight - cropLeft),
            hPct: Math.max(10, cropBottom - cropTop),
          },
        };
        previewBlob = await generateEnhancedPreviewBlob(selectedFile, opts);
      }

      // 1. Parse XML deterministically OR run OCR
      if (isXml) {
        const xmlText = await selectedFile.text();
        const parsed = parseUblTrInvoiceXml(xmlText);
        setSourceMode('xml');
        setSupplierName(parsed.supplierName);
        setSupplierTaxNo(parsed.supplierTaxNo);
        setSupplierTaxOffice(parsed.supplierTaxOffice);
        setInvoiceNo(parsed.invoiceNo);
        setEttn(parsed.ettn);
        setIssueDate(parsed.issueDate || new Date().toISOString().slice(0, 10));
        setInvoiceType(parsed.invoiceType);
        setIban(parsed.iban);
        setSubtotalTl(String(fromKurus(parsed.subtotalKurus)));
        setVatTotalTl(String(fromKurus(parsed.vatTotalKurus)));
        setWithholdingTl(String(fromKurus(parsed.withholdingKurus)));
        setGrandTotalTl(String(fromKurus(parsed.grandTotalKurus)));
        setItems(parsed.items);
        setLowConfFields([]);

        const dup = findDuplicateInvoice(
          {
            invoiceNo: parsed.invoiceNo,
            ettn: parsed.ettn,
            supplierTaxNo: parsed.supplierTaxNo,
            fileSha256: sha,
          },
          existingInvoices
        );
        if (dup.duplicate) setDuplicateWarning(dup.reason);
      } else {
        const ocr = await runInvoiceOcr(previewBlob, aiBackendEndpoint);
        setSourceMode('ocr');
        setRawOcrText(ocr.rawText);
        setLowConfFields(ocr.lowConfidenceFields);
        setSupplierName(ocr.supplierName);
        setSupplierTaxNo(ocr.supplierTaxNo);
        setSupplierTaxOffice(ocr.supplierTaxOffice);
        setInvoiceNo(ocr.invoiceNo);
        setEttn(ocr.ettn);
        if (ocr.issueDate) setIssueDate(ocr.issueDate);
        setInvoiceType(ocr.invoiceType);
        setIban(ocr.iban);
        setSubtotalTl(String(fromKurus(ocr.subtotalKurus)));
        setVatTotalTl(String(fromKurus(ocr.vatTotalKurus)));
        setWithholdingTl(String(fromKurus(ocr.withholdingKurus)));
        setGrandTotalTl(String(fromKurus(ocr.grandTotalKurus)));
        setItems(ocr.items);

        const dup = findDuplicateInvoice(
          {
            invoiceNo: ocr.invoiceNo,
            ettn: ocr.ettn,
            supplierTaxNo: ocr.supplierTaxNo,
            fileSha256: sha,
          },
          existingInvoices
        );
        if (dup.duplicate) setDuplicateWarning(dup.reason);
      }

      // 2. Upload untouched original + enhanced preview to Firebase Storage
      const stamp = Date.now();
      const origUrl = await uploadToErpStorage(
        selectedFile,
        `invoices/originals/${stamp}-${selectedFile.name}`,
        selectedFile.type || 'application/octet-stream',
        (pct) => setUploadPct(Math.round(pct * 0.7))
      );

      let prevUrl = origUrl;
      if (previewBlob !== selectedFile) {
        prevUrl = await uploadToErpStorage(
          previewBlob,
          `invoices/previews/${stamp}-preview.jpg`,
          'image/jpeg',
          (pct) => setUploadPct(70 + Math.round(pct * 0.3))
        );
      } else {
        setUploadPct(100);
      }

      setAttachments([
        {
          id: `att-${stamp}`,
          name: selectedFile.name,
          mimeType: selectedFile.type || 'application/octet-stream',
          originalUrl: origUrl,
          previewUrl: prevUrl,
          sha256: sha,
          version: 1,
          uploadedAt: new Date().toISOString(),
        },
      ]);

      setStep('review');
    } catch (err: any) {
      setError(err?.message || 'Fatura işlenirken hata oluştu.');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (allocationExceeded) {
      setError('Dağıtım toplamı fatura genel toplamını aşamaz.');
      return;
    }

    const dup = findDuplicateInvoice(
      { invoiceNo, ettn, supplierTaxNo, fileSha256 },
      existingInvoices
    );
    if (dup.duplicate) {
      setError(`Mükerrer Fatura Engellendi: ${dup.reason}`);
      return;
    }

    setProcessing(true);
    setError('');
    try {
      const matchedSup = suppliers.find(
        (s) =>
          (supplierTaxNo && s.taxNo === supplierTaxNo) ||
          s.name.toLowerCase() === supplierName.toLowerCase()
      );
      const now = new Date().toISOString();
      const invoiceId = `inv-${Date.now()}`;
      const primaryProj =
        computedAllocations.length === 1 && computedAllocations[0].targetType === 'project'
          ? computedAllocations[0].targetId
          : 'multi';

      const finalItems: InvoiceLineItem[] =
        items.length > 0
          ? items.map((it) => ({ ...it, categoryGroup: catGroup, categorySub: catSub }))
          : [
              {
                id: 'line-1',
                name: `${supplierName} Malzeme / Hizmet`,
                quantity: 1,
                unit: 'Adet',
                unitPriceKurus: subtotalKurus,
                discountKurus: 0,
                vatRate: 20,
                netKurus: subtotalKurus,
                vatKurus: vatTotalKurus,
                grossKurus: grandTotalKurus,
                categoryGroup: catGroup,
                categorySub: catSub,
              },
            ];

      const record: InvoiceRecord = {
        id: invoiceId,
        organizationId: ERP_ORG_ID,
        projectId: primaryProj,
        supplierId: matchedSup?.id || '',
        supplierName: supplierName.trim() || 'Belirtilmedi',
        supplierTaxNo: supplierTaxNo.trim(),
        supplierTaxOffice: supplierTaxOffice.trim(),
        invoiceNo: invoiceNo.trim() || `FTR-${Date.now().toString().slice(-6)}`,
        waybillNo: waybillNo.trim(),
        ettn: ettn.trim(),
        invoiceType,
        issueDate,
        dueDate: dueDate || issueDate,
        iban: iban.trim(),
        paymentInfo: iban ? `IBAN: ${iban}` : '',
        subtotalKurus,
        discountTotalKurus: 0,
        vatTotalKurus,
        withholdingKurus: toKurus(withholdingTl),
        grandTotalKurus,
        deductibleVat,
        paidKurus: 0,
        remainingDebtKurus: grandTotalKurus,
        items: finalItems,
        allocations: computedAllocations.map((a) => ({ ...a, invoiceId })),
        attachments,
        sourceMode,
        lowConfidenceFields: lowConfFields,
        confirmedByUser: true,
        locked: true,
        fileSha256,
        notes: '',
        createdBy: actorEmail,
        createdAt: now,
        updatedBy: actorEmail,
        updatedAt: now,
      };

      await confirmAndPostInvoice(record, actorEmail, cloudMode);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Fatura onaylanırken hata oluştu.');
    } finally {
      setProcessing(false);
    }
  };

  const activeCatGroup = DEFAULT_EXPENSE_TAXONOMY.find((g) => g.group === catGroup);
  const lowCls = (field: string) =>
    lowConfFields.includes(field)
      ? 'border-amber-400 bg-amber-950/30'
      : 'border-slate-600 bg-[#0f172a]';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0b1329] border-2 border-slate-600 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-8 space-y-6 shadow-2xl text-white">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-blue-400">
              AI OCR / XML e-Fatura / Çoklu Proje Dağıtımı
            </div>
            <h3 className="text-xl font-black">
              {step === 'upload'
                ? '1. Adım: Fatura Fotoğrafı Çek veya XML / PDF Yükle'
                : '2. Adım: Okunan Verileri Doğrula ve Projelere Dağıt'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-white"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500 text-xs font-bold text-red-200">
            <i className="fa-solid fa-triangle-exclamation mr-2" />
            {error}
          </div>
        )}
        {duplicateWarning && (
          <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-500 text-xs font-bold text-amber-200">
            <i className="fa-solid fa-copy mr-2" />
            Mükerrer Kayıt Uyarısı: {duplicateWarning}
          </div>
        )}

        {step === 'upload' ? (
          <div className="space-y-5">
            {/* Drag & Drop + Mobile Camera Inputs */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFilePicked(e.dataTransfer.files?.[0]);
              }}
              className="border-2 border-dashed border-blue-500/60 rounded-2xl p-6 sm:p-8 text-center bg-[#070d1e] space-y-4"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-600/20 border border-blue-400/40 text-blue-400 flex items-center justify-center text-2xl">
                <i className="fa-solid fa-camera" />
              </div>
              <div>
                <div className="font-black text-base">
                  Fatura Fotoğrafı, PDF veya XML e-Fatura Dosyasını Buraya Bırakın
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Desteklenenler: JPG, JPEG, PNG, HEIC, WEBP, PDF, XML e-Fatura / e-Arşiv (Orijinal
                  dosya değiştirilmeden arşivlenir)
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <label className="cursor-pointer px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black border border-blue-300 transition inline-flex items-center gap-2">
                  <i className="fa-solid fa-camera" />
                  <span>Kameradan Çek (Mobil)</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFilePicked(e.target.files?.[0])}
                  />
                </label>
                <label className="cursor-pointer px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-600 transition inline-flex items-center gap-2">
                  <i className="fa-solid fa-file-arrow-up" />
                  <span>Dosya Seç (JPG / PDF / XML)</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.heic,.webp,.pdf,.xml,image/*,application/pdf,text/xml"
                    className="hidden"
                    onChange={(e) => handleFilePicked(e.target.files?.[0])}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setStep('review')}
                  className="px-5 py-2.5 rounded-xl bg-[#0b1329] hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700"
                >
                  Belgesiz Manuel Fatura Gir &rarr;
                </button>
              </div>
            </div>

            {/* Image Transform Controls & Preview Copy */}
            {selectedFile && (
              <div className="p-5 rounded-2xl bg-[#070d1e] border border-slate-700 grid md:grid-cols-2 gap-5 items-center">
                <div className="space-y-3">
                  <div className="text-xs font-black text-emerald-400">
                    Seçilen Dosya: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                  </div>
                  {filePreviewUrl && (
                    <div className="space-y-3 text-xs">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setRotateDeg((r) => (((r + 90) % 360) as 0 | 90 | 180 | 270))
                          }
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold"
                        >
                          <i className="fa-solid fa-rotate-right mr-1.5" />
                          Döndür ({rotateDeg}°)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEnhanceContrast((v) => !v)}
                          className={`px-3 py-1.5 rounded-lg font-bold border ${
                            enhanceContrast
                              ? 'bg-blue-600/30 border-blue-400 text-blue-200'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          <i className="fa-solid fa-wand-magic-sparkles mr-1.5" />
                          Ön İzleme İyileştirme: {enhanceContrast ? 'Açık' : 'Kapalı'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                        <label>
                          Üst Kırpma (%{cropTop})
                          <input
                            type="range"
                            min={0}
                            max={45}
                            value={cropTop}
                            onChange={(e) => setCropTop(Number(e.target.value))}
                            className="w-full"
                          />
                        </label>
                        <label>
                          Alt Kırpma (%{cropBottom})
                          <input
                            type="range"
                            min={55}
                            max={100}
                            value={cropBottom}
                            onChange={(e) => setCropBottom(Number(e.target.value))}
                            className="w-full"
                          />
                        </label>
                        <label>
                          Sol Kırpma (%{cropLeft})
                          <input
                            type="range"
                            min={0}
                            max={40}
                            value={cropLeft}
                            onChange={(e) => setCropLeft(Number(e.target.value))}
                            className="w-full"
                          />
                        </label>
                        <label>
                          Sağ Kırpma (%{cropRight})
                          <input
                            type="range"
                            min={60}
                            max={100}
                            value={cropRight}
                            onChange={(e) => setCropRight(Number(e.target.value))}
                            className="w-full"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {filePreviewUrl && (
                  <div className="h-56 rounded-xl overflow-hidden border border-slate-700 bg-black flex items-center justify-center">
                    <img
                      src={filePreviewUrl}
                      alt="Fatura ön izleme"
                      className="max-h-full max-w-full object-contain transition"
                      style={{
                        transform: `rotate(${rotateDeg}deg)`,
                        filter: enhanceContrast ? 'grayscale(100%) contrast(140%)' : 'none',
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {processing && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-blue-300">
                  <span>Belge taranıyor ve Firebase Storage&apos;a yükleniyor...</span>
                  <span>%{uploadPct}</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={processing || !selectedFile}
                onClick={handleAnalyzeAndUpload}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black border border-blue-300"
              >
                {processing ? 'İşleniyor...' : 'OCR / XML Oku ve Yükle'}
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2: Review & Confirm + Multi-Project Allocation */
          <form onSubmit={handleConfirmAndSave} className="space-y-5">
            {lowConfFields.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-950/70 border border-amber-500/60 text-xs text-amber-200">
                <i className="fa-solid fa-eye mr-2" />
                Düşük güven oranına sahip alanlar turuncu çerçeve ile işaretlendi. Kaydetmeden önce
                doğrulayın.
              </div>
            )}

            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Tedarikçi / Firma Adı *</label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-white ${lowCls('supplierName')}`}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Vergi No (VKN/TCKN)</label>
                <input
                  type="text"
                  value={supplierTaxNo}
                  onChange={(e) => setSupplierTaxNo(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-white ${lowCls('supplierTaxNo')}`}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Vergi Dairesi</label>
                <input
                  type="text"
                  value={supplierTaxOffice}
                  onChange={(e) => setSupplierTaxOffice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Fatura No *</label>
                <input
                  type="text"
                  required
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-white ${lowCls('invoiceNo')}`}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">ETTN</label>
                <input
                  type="text"
                  value={ettn}
                  onChange={(e) => setEttn(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Fatura Tarihi</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-white ${lowCls('issueDate')}`}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Vade Tarihi</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Ara Toplam (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={subtotalTl}
                  onChange={(e) => setSubtotalTl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Toplam KDV (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={vatTotalTl}
                  onChange={(e) => setVatTotalTl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Tevkifat (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={withholdingTl}
                  onChange={(e) => setWithholdingTl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Genel Toplam (TL) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={grandTotalTl}
                  onChange={(e) => setGrandTotalTl(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-white font-black ${lowCls('grandTotal')}`}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Ana Gider Grubu</label>
                <select
                  value={catGroup}
                  onChange={(e) => {
                    const g = e.target.value;
                    setCatGroup(g);
                    const found = DEFAULT_EXPENSE_TAXONOMY.find((x) => x.group === g);
                    if (found) setCatSub(found.items[0]);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
                >
                  {DEFAULT_EXPENSE_TAXONOMY.map((g) => (
                    <option key={g.group} value={g.group}>
                      {g.group}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Alt Kategori</label>
                <select
                  value={catSub}
                  onChange={(e) => setCatSub(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
                >
                  {(activeCatGroup?.items || []).map((it) => (
                    <option key={it} value={it}>
                      {it}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">İrsaliye No / IBAN</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="İrsaliye"
                    value={waybillNo}
                    onChange={(e) => setWaybillNo(e.target.value)}
                    className="w-1/2 px-2.5 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
                  />
                  <input
                    type="text"
                    placeholder="TR IBAN"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    className="w-1/2 px-2.5 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={deductibleVat}
                onChange={(e) => setDeductibleVat(e.target.checked)}
              />
              <span>
                İndirilebilir KDV (Proje net maliyetinden ayrı izlenir)
              </span>
            </label>

            {/* Section 9: Multi-Project / Warehouse Invoice Expense Allocation */}
            <div className="p-4 rounded-2xl bg-[#070d1e] border border-slate-700 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-black text-blue-300">
                    Fatura Gider Dağıtımı (Projeler / Merkez Depo)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Tek faturayı tutar veya yüzde bazında birden fazla projeye dağıtın (Toplam aşılamaz).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAllocRows([
                      ...allocRows,
                      {
                        id: `al-${Date.now()}`,
                        targetType: 'project',
                        targetId: projects[0]?.id || 'company_overhead',
                        mode: allocRows[0]?.mode || 'amount',
                        value: 0,
                      },
                    ])
                  }
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold"
                >
                  + Dağıtım Satırı Ekle
                </button>
              </div>

              <div className="space-y-2">
                {allocRows.map((row, idx) => (
                  <div key={row.id} className="grid sm:grid-cols-12 gap-2 items-center text-xs">
                    <select
                      value={row.targetType}
                      onChange={(e) => {
                        const t = e.target.value as 'project' | 'warehouse';
                        const nextId =
                          t === 'project'
                            ? projects[0]?.id || 'company_overhead'
                            : warehouses[0]?.id || 'wh-merkez';
                        setAllocRows(
                          allocRows.map((r, i) =>
                            i === idx ? { ...r, targetType: t, targetId: nextId } : r
                          )
                        );
                      }}
                      className="sm:col-span-2 px-2.5 py-2 rounded-lg bg-[#0f172a] border border-slate-600"
                    >
                      <option value="project">Proje</option>
                      <option value="warehouse">Depo Stok</option>
                    </select>

                    <select
                      value={row.targetId}
                      onChange={(e) =>
                        setAllocRows(
                          allocRows.map((r, i) =>
                            i === idx ? { ...r, targetId: e.target.value } : r
                          )
                        )
                      }
                      className="sm:col-span-4 px-2.5 py-2 rounded-lg bg-[#0f172a] border border-slate-600"
                    >
                      {row.targetType === 'project' ? (
                        <>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.shortName}
                            </option>
                          ))}
                          <option value="company_overhead">Şirket Genel Gideri</option>
                        </>
                      ) : (
                        warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))
                      )}
                    </select>

                    <select
                      value={row.mode}
                      onChange={(e) =>
                        setAllocRows(
                          allocRows.map((r, i) =>
                            i === idx
                              ? { ...r, mode: e.target.value as 'amount' | 'percent' }
                              : r
                          )
                        )
                      }
                      className="sm:col-span-2 px-2.5 py-2 rounded-lg bg-[#0f172a] border border-slate-600"
                    >
                      <option value="percent">Yüzde (%)</option>
                      <option value="amount">Tutar (TL)</option>
                    </select>

                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={row.value}
                      onChange={(e) =>
                        setAllocRows(
                          allocRows.map((r, i) =>
                            i === idx ? { ...r, value: Number(e.target.value) } : r
                          )
                        )
                      }
                      className="sm:col-span-2 px-2.5 py-2 rounded-lg bg-[#0f172a] border border-slate-600"
                    />

                    <div className="sm:col-span-2 flex items-center justify-between gap-2">
                      <span className="font-bold text-emerald-400">
                        {formatKurusTRY(computedAllocations[idx]?.allocatedGrossKurus || 0)}
                      </span>
                      {allocRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setAllocRows(allocRows.filter((_, i) => i !== idx))
                          }
                          className="text-red-400 hover:text-red-300"
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs">
                <span>
                  Dağıtılan Toplam:{' '}
                  <strong className={allocationExceeded ? 'text-red-400' : 'text-emerald-400'}>
                    {formatKurusTRY(totalAllocatedKurus)}
                  </strong>{' '}
                  / Fatura: <strong>{formatKurusTRY(grandTotalKurus)}</strong>
                </span>
                {allocationExceeded && (
                  <span className="text-red-400 font-black">Fatura toplamı aşıldı!</span>
                )}
              </div>
            </div>

            {rawOcrText && (
              <details className="text-xs text-slate-400 bg-[#070d1e] p-3 rounded-xl border border-slate-800">
                <summary className="cursor-pointer font-bold text-slate-300">
                  OCR Ham Metni Göster
                </summary>
                <pre className="mt-2 whitespace-pre-wrap text-[11px]">{rawOcrText}</pre>
              </details>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
              >
                &larr; Geri
              </button>
              <button
                type="submit"
                disabled={processing || allocationExceeded}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black border border-emerald-300"
              >
                {processing ? 'Kaydediliyor...' : 'Onayla ve Muhasebeye İşle'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
