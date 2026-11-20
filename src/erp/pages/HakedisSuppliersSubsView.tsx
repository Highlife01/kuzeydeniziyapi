import React, { useMemo, useState } from 'react';
import { deleteErpRecord, ERP_ORG_ID, saveErpRecord } from '../services/erpStore';
import { calculateProgressPayment } from '../services/financeEngine';
import {
  ErpProject,
  ExpenseRecord,
  InvoiceRecord,
  ProgressPayment,
  ProgressPaymentStatus,
  SubcontractorCard,
  SupplierCard,
  SupplierQuote,
} from '../types/erp';
import { formatKurusTRY, fromKurus, toKurus } from '../utils/money';

interface HakedisSuppliersSubsViewProps {
  mode: 'progressPayments' | 'suppliers' | 'subcontractors';
  projects: ErpProject[];
  progressPayments: ProgressPayment[];
  suppliers: SupplierCard[];
  supplierQuotes: SupplierQuote[];
  subcontractors: SubcontractorCard[];
  invoices: InvoiceRecord[];
  canMutate: boolean;
  actorEmail: string;
  cloudMode: boolean;
}

const HAKEDIS_STATUSES: ProgressPaymentStatus[] = [
  'Taslak',
  'Kuruma Sunuldu',
  'İnceleniyor',
  'Onaylandı',
  'Tahakkuk Etti',
  'Kısmi Ödendi',
  'Ödendi',
];

export const HakedisSuppliersSubsView: React.FC<HakedisSuppliersSubsViewProps> = ({
  mode,
  projects,
  progressPayments,
  suppliers,
  supplierQuotes,
  subcontractors,
  invoices,
  canMutate,
  actorEmail,
  cloudMode,
}) => {
  const [editingHk, setEditingHk] = useState<ProgressPayment | null>(null);
  const [editingSup, setEditingSup] = useState<SupplierCard | null>(null);
  const [newQuote, setNewQuote] = useState<SupplierQuote | null>(null);
  const [editingSub, setEditingSub] = useState<SubcontractorCard | null>(null);
  const [compareMaterial, setCompareMaterial] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Price comparison & AI spike detection across suppliers
  const priceComparison = useMemo(() => {
    const q = compareMaterial.trim().toLowerCase();
    const list = supplierQuotes.filter((sq) =>
      !q ? true : sq.materialName.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => a.unitPriceKurus - b.unitPriceKurus);
  }, [supplierQuotes, compareMaterial]);

  if (mode === 'progressPayments') {
    const openNewHk = () => {
      const pid = projects[0]?.id || '';
      const prevSum = progressPayments
        .filter((h) => h.projectId === pid)
        .reduce((s, h) => s + h.currentWorkKurus, 0);
      const now = new Date().toISOString();
      setEditingHk({
        id: `hk-${Date.now()}`,
        organizationId: ERP_ORG_ID,
        projectId: pid,
        hakedisNo: progressPayments.filter((h) => h.projectId === pid).length + 1,
        period: now.slice(0, 7),
        issueDate: now.slice(0, 10),
        previousTotalKurus: prevSum,
        currentWorkKurus: 0,
        cumulativeWorkKurus: prevSum,
        grossAmountKurus: 0,
        priceDiffKurus: 0,
        vatRate: 20,
        vatAmountKurus: 0,
        vatWithholdingRate: 0,
        vatWithholdingKurus: 0,
        advanceDeductionRate: 0,
        advanceDeductionKurus: 0,
        retentionRate: 0,
        retentionKurus: 0,
        taxDeductionKurus: 0,
        sgkDeductionKurus: 0,
        penaltyDeductionKurus: 0,
        otherDeductionKurus: 0,
        netPayableKurus: 0,
        collectedKurus: 0,
        remainingReceivableKurus: 0,
        collectionDate: '',
        expectedPaymentDate: '',
        status: 'Taslak',
        locked: false,
        attachments: [],
        notes: '',
        createdBy: actorEmail,
        createdAt: now,
        updatedBy: actorEmail,
        updatedAt: now,
      });
    };

    const recalcHk = (hk: ProgressPayment): ProgressPayment => {
      const calc = calculateProgressPayment(hk);
      return { ...hk, ...calc };
    };

    return (
      <div className="space-y-6">
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Kamu Hakediş Yönetim Sistemi</h2>
            <p className="text-xs text-slate-400">
              Proje ve sözleşmeye göre değiştirilebilir KDV tevkifatı, avans mahsubu, teminat, vergi, SGK ve ceza kesintileri
            </p>
          </div>
          {canMutate && (
            <button
              type="button"
              onClick={openNewHk}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black border border-blue-300"
            >
              + Yeni Hakediş Düzenle
            </button>
          )}
        </div>

        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#070d1e] border-b border-slate-700 text-slate-400 uppercase">
                <th className="py-3 px-4">Hakediş / Dönem</th>
                <th className="py-3 px-4">Proje</th>
                <th className="py-3 px-4">Brüt + Fiyat Farkı</th>
                <th className="py-3 px-4">Kesintiler Toplamı</th>
                <th className="py-3 px-4">Net Ödenecek</th>
                <th className="py-3 px-4">Tahsilat / Kalan</th>
                <th className="py-3 px-4 text-right">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {progressPayments.map((hk) => {
                const totalDed =
                  hk.vatWithholdingKurus +
                  hk.advanceDeductionKurus +
                  hk.retentionKurus +
                  hk.taxDeductionKurus +
                  hk.sgkDeductionKurus +
                  hk.penaltyDeductionKurus +
                  hk.otherDeductionKurus;
                return (
                  <tr key={hk.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-black text-white">#{hk.hakedisNo} ({hk.period})</div>
                      <div className="text-[10px] text-slate-400">{hk.issueDate}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-blue-300">
                      {projects.find((p) => p.id === hk.projectId)?.shortName || '—'}
                    </td>
                    <td className="py-3 px-4">{formatKurusTRY(hk.grossAmountKurus)}</td>
                    <td className="py-3 px-4 text-amber-300">-{formatKurusTRY(totalDed)}</td>
                    <td className="py-3 px-4 font-black text-emerald-400">{formatKurusTRY(hk.netPayableKurus)}</td>
                    <td className="py-3 px-4">
                      <div className="text-emerald-300">Tahsil: {formatKurusTRY(hk.collectedKurus)}</div>
                      <div className="text-rose-300 text-[10px]">Kalan: {formatKurusTRY(hk.remainingReceivableKurus)}</div>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-600 font-bold">
                        {hk.status}
                      </span>
                      {canMutate && (
                        <button
                          type="button"
                          onClick={() => setEditingHk(hk)}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold"
                        >
                          Düzenle
                        </button>
                      )}
                      {canMutate && !hk.locked && hk.status === 'Taslak' && (
                        <button
                          type="button"
                          onClick={() => deleteErpRecord('progressPayments', hk.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Hakediş silinemedi.'))}
                          className="px-2.5 py-1 rounded-lg bg-red-950/70 hover:bg-red-600 text-red-300 hover:text-white font-bold"
                        >
                          Sil
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {progressPayments.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Henüz hakediş kaydı girilmedi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {editingHk && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const finalHk = recalcHk(editingHk);
                await saveErpRecord(
                  'progressPayments',
                  finalHk,
                  actorEmail,
                  cloudMode,
                  'UPDATE',
                  `Hakediş #${finalHk.hakedisNo} kaydedildi.`
                );
                setEditingHk(null);
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-lg font-black text-white">Hakediş Hesaplama ve Kesinti Kartı</h3>
                <button type="button" onClick={() => setEditingHk(null)} className="text-slate-400">
                  <i className="fa-solid fa-xmark text-lg" />
                </button>
              </div>
              <div className="grid sm:grid-cols-4 gap-3">
                <select
                  value={editingHk.projectId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const isNew = !progressPayments.some((h) => h.id === editingHk.id);
                    const prevSum = isNew
                      ? progressPayments.filter((h) => h.projectId === pid).reduce((s, h) => s + h.currentWorkKurus, 0)
                      : editingHk.previousTotalKurus;
                    const nextNo = isNew
                      ? progressPayments.filter((h) => h.projectId === pid).length + 1
                      : editingHk.hakedisNo;
                    setEditingHk(recalcHk({ ...editingHk, projectId: pid, previousTotalKurus: prevSum, hakedisNo: nextNo }));
                  }}
                  className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                >
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
                </select>
                <input
                  type="number"
                  placeholder="Hakediş No"
                  value={editingHk.hakedisNo}
                  onChange={(e) => setEditingHk({ ...editingHk, hakedisNo: Number(e.target.value) })}
                  className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                />
                <select
                  value={editingHk.status}
                  onChange={(e) => setEditingHk({ ...editingHk, status: e.target.value as ProgressPaymentStatus })}
                  className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                >
                  {HAKEDIS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid sm:grid-cols-4 gap-3">
                <label>
                  <span>Dönem (YYYY-AA)</span>
                  <input value={editingHk.period} onChange={(e) => setEditingHk({ ...editingHk, period: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Düzenleme Tarihi</span>
                  <input type="date" value={editingHk.issueDate} onChange={(e) => setEditingHk({ ...editingHk, issueDate: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Beklenen Ödeme</span>
                  <input type="date" value={editingHk.expectedPaymentDate} onChange={(e) => setEditingHk({ ...editingHk, expectedPaymentDate: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Tahsilat Tarihi</span>
                  <input type="date" value={editingHk.collectionDate} onChange={(e) => setEditingHk({ ...editingHk, collectionDate: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <label>
                  <span>Bu Dönem Yapılan İmalat (TL)</span>
                  <input type="number" step="0.01" value={fromKurus(editingHk.currentWorkKurus)} onChange={(e) => setEditingHk(recalcHk({ ...editingHk, currentWorkKurus: toKurus(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Fiyat Farkı (TL)</span>
                  <input type="number" step="0.01" value={fromKurus(editingHk.priceDiffKurus)} onChange={(e) => setEditingHk(recalcHk({ ...editingHk, priceDiffKurus: toKurus(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Tahsil Edilen (TL)</span>
                  <input type="number" step="0.01" value={fromKurus(editingHk.collectedKurus)} onChange={(e) => setEditingHk(recalcHk({ ...editingHk, collectedKurus: toKurus(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
              </div>
              <div className="grid sm:grid-cols-4 gap-3">
                <label>
                  <span>KDV Oranı (%)</span>
                  <input type="number" value={editingHk.vatRate} onChange={(e) => setEditingHk(recalcHk({ ...editingHk, vatRate: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>KDV Tevkifatı (% KDV üzerinden)</span>
                  <input type="number" placeholder="Örn: 40 (4/10)" value={editingHk.vatWithholdingRate} onChange={(e) => setEditingHk(recalcHk({ ...editingHk, vatWithholdingRate: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Avans Mahsup Oranı (%)</span>
                  <input type="number" step="0.1" value={editingHk.advanceDeductionRate} onChange={(e) => setEditingHk(recalcHk({ ...editingHk, advanceDeductionRate: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Teminat Kesinti Oranı (%)</span>
                  <input type="number" step="0.1" value={editingHk.retentionRate} onChange={(e) => setEditingHk(recalcHk({ ...editingHk, retentionRate: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
              </div>
              <div className="grid sm:grid-cols-4 gap-3">
                <label>
                  <span>Vergi / Damga Kesintisi (TL)</span>
                  <input type="number" step="0.01" value={fromKurus(editingHk.taxDeductionKurus)} onChange={(e) => setEditingHk(recalcHk({ ...editingHk, taxDeductionKurus: toKurus(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>SGK Kesintisi (TL)</span>
                  <input type="number" step="0.01" value={fromKurus(editingHk.sgkDeductionKurus)} onChange={(e) => setEditingHk(recalcHk({ ...editingHk, sgkDeductionKurus: toKurus(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Ceza Kesintisi (TL)</span>
                  <input type="number" step="0.01" value={fromKurus(editingHk.penaltyDeductionKurus)} onChange={(e) => setEditingHk(recalcHk({ ...editingHk, penaltyDeductionKurus: toKurus(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Diğer Kesinti (TL)</span>
                  <input type="number" step="0.01" value={fromKurus(editingHk.otherDeductionKurus)} onChange={(e) => setEditingHk(recalcHk({ ...editingHk, otherDeductionKurus: toKurus(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
              </div>
              <div className="p-3 rounded-xl bg-[#070d1e] flex flex-wrap justify-between gap-2 font-black">
                <span>Brüt: {formatKurusTRY(editingHk.grossAmountKurus)}</span>
                <span>KDV: {formatKurusTRY(editingHk.vatAmountKurus)}</span>
                <span className="text-emerald-400">Net Ödenecek: {formatKurusTRY(editingHk.netPayableKurus)}</span>
                <span className="text-rose-400">Kalan Alacak: {formatKurusTRY(editingHk.remainingReceivableKurus)}</span>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setEditingHk(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-6 py-2 rounded-xl bg-blue-600 font-black">Hakedişi Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'suppliers') {
    const openNewSupplier = () => {
      const now = new Date().toISOString();
      setEditingSup({
        id: `sup-${Date.now()}`,
        organizationId: ERP_ORG_ID,
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        taxNo: '',
        taxOffice: '',
        address: '',
        iban: '',
        suppliedProducts: [],
        deliveryPerformanceScore: 100,
        rating: 5,
        notes: '',
        createdBy: actorEmail,
        createdAt: now,
        updatedBy: actorEmail,
        updatedAt: now,
      });
    };

    const openNewQuote = () => {
      const now = new Date().toISOString();
      setNewQuote({
        id: `sq-${Date.now()}`,
        organizationId: ERP_ORG_ID,
        supplierId: suppliers[0]?.id || '',
        supplierName: suppliers[0]?.name || '',
        projectId: projects[0]?.id || '',
        materialName: '',
        unit: 'Ton',
        unitPriceKurus: 0,
        vatRate: 20,
        quoteDate: now.slice(0, 10),
        validUntil: '',
        selected: false,
        createdBy: actorEmail,
        createdAt: now,
        updatedBy: actorEmail,
        updatedAt: now,
      });
    };

    return (
      <div className="space-y-6">
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Tedarikçi Yönetimi &amp; Fiyat Karşılaştırma</h2>
            <p className="text-xs text-slate-400">
              Cari kartlar, VKN/IBAN, fatura/ödeme bakiyesi ve tedarikçiler arası AI birim fiyat analizi
            </p>
          </div>
          {canMutate && (
            <div className="flex gap-2">
              <button type="button" onClick={openNewQuote} className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black">
                + Fiyat Teklifi Gir
              </button>
              <button type="button" onClick={openNewSupplier} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black">
                + Yeni Tedarikçi Kartı
              </button>
            </div>
          )}
        </div>

        {/* Supplier Cards */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {suppliers.map((sup) => {
            const supInvs = invoices.filter(
              (i) => !i.reversalOfId && (i.supplierId === sup.id || i.supplierTaxNo === sup.taxNo)
            );
            const totalInv = supInvs.reduce((s, i) => s + i.grandTotalKurus, 0);
            const totalPaid = supInvs.reduce((s, i) => s + i.paidKurus, 0);
            const remDebt = supInvs.reduce((s, i) => s + i.remainingDebtKurus, 0);
            return (
              <div key={sup.id} className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 space-y-3 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-black text-white">{sup.name}</h3>
                    <div className="text-slate-400">VKN: {sup.taxNo || '—'} • {sup.phone || '—'}</div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 font-black">
                    ★ {sup.rating}/5
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#070d1e]">
                  <div>
                    <div className="text-slate-500">Fatura</div>
                    <div className="font-bold text-white">{formatKurusTRY(totalInv)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Ödenen</div>
                    <div className="font-bold text-emerald-400">{formatKurusTRY(totalPaid)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Kalan Borç</div>
                    <div className="font-black text-rose-400">{formatKurusTRY(remDebt)}</div>
                  </div>
                </div>
                {sup.iban && <div className="text-[11px] font-mono text-slate-400">IBAN: {sup.iban}</div>}
                {canMutate && (
                  <div className="flex items-center justify-between pt-1">
                    <button type="button" onClick={() => setEditingSup(sup)} className="text-blue-400 hover:underline font-bold">
                      Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteErpRecord('suppliers', sup.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Tedarikçi silinemedi.'))}
                      className="text-red-400 hover:text-red-300 font-bold"
                    >
                      Sil
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {suppliers.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 p-8 text-center text-xs text-slate-400 bg-[#0b1329] rounded-2xl border-2 border-slate-700">
              Henüz tedarikçi kartı eklenmedi.
            </div>
          )}
        </div>

        {/* Multi-Supplier Price Comparison Table */}
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <h3 className="text-base font-black text-white">Tedarikçi Fiyat Karşılaştırma &amp; AI Teklif Analizi</h3>
              <p className="text-xs text-slate-400">Aynı malzeme için en avantajlı tedarikçiyi ve fiyat farklarını gösterir</p>
            </div>
            <input
              type="text"
              placeholder="Malzeme adına göre karşılaştır..."
              value={compareMaterial}
              onChange={(e) => setCompareMaterial(e.target.value)}
              className="px-4 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-xs text-white"
            />
          </div>
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="py-2 px-3">Malzeme</th>
                  <th className="py-2 px-3">Tedarikçi</th>
                  <th className="py-2 px-3">Birim Fiyat</th>
                  <th className="py-2 px-3">Tarih</th>
                  <th className="py-2 px-3">Değerlendirme</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {priceComparison.map((sq, idx) => (
                  <tr key={sq.id}>
                    <td className="py-2.5 px-3 font-bold text-white">{sq.materialName}</td>
                    <td className="py-2.5 px-3 text-slate-300">{sq.supplierName}</td>
                    <td className="py-2.5 px-3 font-black text-emerald-400">
                      {formatKurusTRY(sq.unitPriceKurus)} / {sq.unit}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{sq.quoteDate}</td>
                    <td className="py-2.5 px-3 flex flex-wrap items-center justify-between gap-2">
                      {idx === 0 ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-black">
                          En Uygun Teklif
                        </span>
                      ) : (
                        <span className="text-amber-300">
                          +{formatKurusTRY(sq.unitPriceKurus - priceComparison[0].unitPriceKurus)} fark
                        </span>
                      )}
                      {canMutate && (
                        <button
                          type="button"
                          onClick={() => deleteErpRecord('supplierQuotes', sq.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Teklif silinemedi.'))}
                          className="text-red-400 hover:text-red-300 font-bold"
                        >
                          Sil
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {priceComparison.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Fiyat karşılaştırması için teklif kaydı bulunmuyor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modals */}
        {editingSup && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await saveErpRecord('suppliers', editingSup, actorEmail, cloudMode, 'UPDATE', `Tedarikçi: ${editingSup.name}`);
                setEditingSup(null);
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-lg w-full p-6 space-y-3 text-xs"
            >
              <h3 className="text-base font-black text-white">Tedarikçi Cari Kartı</h3>
              <input required placeholder="Firma Adı *" value={editingSup.name} onChange={(e) => setEditingSup({ ...editingSup, name: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Yetkili Kişi" value={editingSup.contactPerson} onChange={(e) => setEditingSup({ ...editingSup, contactPerson: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <input placeholder="Telefon" value={editingSup.phone} onChange={(e) => setEditingSup({ ...editingSup, phone: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <input placeholder="E-Posta" type="email" value={editingSup.email} onChange={(e) => setEditingSup({ ...editingSup, email: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <input placeholder="Vergi Dairesi" value={editingSup.taxOffice} onChange={(e) => setEditingSup({ ...editingSup, taxOffice: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <input placeholder="Vergi No" value={editingSup.taxNo} onChange={(e) => setEditingSup({ ...editingSup, taxNo: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <select value={editingSup.rating} onChange={(e) => setEditingSup({ ...editingSup, rating: Number(e.target.value) })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>★ {r} / 5 Puan</option>)}
                </select>
              </div>
              <input placeholder="IBAN" value={editingSup.iban} onChange={(e) => setEditingSup({ ...editingSup, iban: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <input placeholder="Adres / Not" value={editingSup.address} onChange={(e) => setEditingSup({ ...editingSup, address: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingSup(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 font-black">Kaydet</button>
              </div>
            </form>
          </div>
        )}

        {newQuote && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await saveErpRecord('supplierQuotes', newQuote, actorEmail, cloudMode);
                setNewQuote(null);
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-lg w-full p-6 space-y-3 text-xs"
            >
              <h3 className="text-base font-black text-white">Tedarikçi Fiyat Teklifi</h3>
              <input required placeholder="Malzeme Adı *" value={newQuote.materialName} onChange={(e) => setNewQuote({ ...newQuote, materialName: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <select
                value={newQuote.supplierId || '__custom__'}
                onChange={(e) => {
                  const sup = suppliers.find((s) => s.id === e.target.value);
                  setNewQuote({
                    ...newQuote,
                    supplierId: sup ? sup.id : '',
                    supplierName: sup ? sup.name : newQuote.supplierName,
                  });
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
              >
                <option value="__custom__">Kayıtsız / Manuel Tedarikçi</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input required placeholder="Tedarikçi Firma *" value={newQuote.supplierName} onChange={(e) => setNewQuote({ ...newQuote, supplierName: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <div className="grid grid-cols-2 gap-3">
                <input required type="number" step="0.01" placeholder="Birim Fiyat (TL)" value={fromKurus(newQuote.unitPriceKurus)} onChange={(e) => setNewQuote({ ...newQuote, unitPriceKurus: toKurus(e.target.value) })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <input placeholder="Birim (Ton/Adet/m²)" value={newQuote.unit} onChange={(e) => setNewQuote({ ...newQuote, unit: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNewQuote(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black">Teklifi Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // MODE === 'subcontractors'
  const openNewSub = () => {
    const now = new Date().toISOString();
    setEditingSub({
      id: `sub-${Date.now()}`,
      organizationId: ERP_ORG_ID,
      firmName: '',
      projectId: projects[0]?.id || '',
      scopeOfWork: '',
      contactPerson: '',
      phone: '',
      taxNo: '',
      iban: '',
      contractAmountKurus: 0,
      unitPricesNote: '',
      executedAmountKurus: 0,
      hakedisTotalKurus: 0,
      advanceGivenKurus: 0,
      paidTotalKurus: 0,
      retentionKurus: 0,
      companyMaterialDeductionKurus: 0,
      remainingDebtKurus: 0,
      endDate: '',
      performanceScore: 100,
      createdBy: actorEmail,
      createdAt: now,
      updatedBy: actorEmail,
      updatedAt: now,
    });
  };

  const recalcSub = (s: SubcontractorCard): SubcontractorCard => {
    const remaining = Math.max(
      0,
      (s.hakedisTotalKurus || 0) -
        (s.advanceGivenKurus || 0) -
        (s.paidTotalKurus || 0) -
        (s.retentionKurus || 0) -
        (s.companyMaterialDeductionKurus || 0)
    );
    return { ...s, remainingDebtKurus: remaining };
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-white">Taşeron Sözleşme, Hakediş &amp; Malzeme Mahsubu</h2>
          <p className="text-xs text-slate-400">
            Taşeron hakedişleri, verilen avanslar, teminat kesintileri ve şirket malzemesi kullanım mahsubu
          </p>
        </div>
        {canMutate && (
          <button type="button" onClick={openNewSub} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black">
            + Yeni Taşeron Sözleşmesi
          </button>
        )}
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        {subcontractors.map((sub) => (
          <div key={sub.id} className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 space-y-3 text-xs">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-black text-white">{sub.firmName}</h3>
                <div className="text-blue-300 font-bold">
                  {projects.find((p) => p.id === sub.projectId)?.shortName || '—'} &bull; {sub.scopeOfWork}
                </div>
              </div>
              {canMutate && (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setEditingSub(sub)} className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-blue-600 font-bold">
                    Düzenle / Hakediş
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteErpRecord('subcontractors', sub.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Taşeron silinemedi.'))}
                    className="px-2.5 py-1 rounded-lg bg-red-950/70 hover:bg-red-600 text-red-300 hover:text-white font-bold"
                  >
                    Sil
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-[#070d1e]">
              <div>
                <div className="text-slate-500">Sözleşme</div>
                <div className="font-bold text-white">{formatKurusTRY(sub.contractAmountKurus)}</div>
              </div>
              <div>
                <div className="text-slate-500">Taşeron Hakedişi</div>
                <div className="font-bold text-emerald-400">{formatKurusTRY(sub.hakedisTotalKurus)}</div>
              </div>
              <div>
                <div className="text-slate-500">Malzeme Mahsubu</div>
                <div className="font-bold text-amber-300">{formatKurusTRY(sub.companyMaterialDeductionKurus)}</div>
              </div>
              <div>
                <div className="text-slate-500">Kalan Borç</div>
                <div className="font-black text-rose-400">{formatKurusTRY(sub.remainingDebtKurus)}</div>
              </div>
            </div>
          </div>
        ))}
        {subcontractors.length === 0 && (
          <div className="xl:col-span-2 p-8 text-center text-xs text-slate-400 bg-[#0b1329] rounded-2xl border-2 border-slate-700">
            Henüz taşeron sözleşmesi eklenmedi.
          </div>
        )}
      </div>

      {editingSub && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const finalSub = recalcSub(editingSub);
              await saveErpRecord('subcontractors', finalSub, actorEmail, cloudMode, 'UPDATE', `Taşeron: ${finalSub.firmName}`);
              if (finalSub.hakedisTotalKurus > 0) {
                const subExp: ExpenseRecord = {
                  id: `exp-sub-${finalSub.id}`,
                  organizationId: ERP_ORG_ID,
                  projectId: finalSub.projectId,
                  categoryGroup: 'Genel Giderler',
                  categorySub: 'Taşeron',
                  description: `Taşeron Hakedişi: ${finalSub.firmName} (${finalSub.scopeOfWork})`,
                  date: new Date().toISOString().slice(0, 10),
                  netKurus: finalSub.hakedisTotalKurus,
                  vatRate: 0,
                  vatKurus: 0,
                  grossKurus: finalSub.hakedisTotalKurus,
                  deductibleVat: false,
                  sourceType: 'subcontractor',
                  sourceId: finalSub.id,
                  locked: false,
                  createdBy: actorEmail,
                  createdAt: new Date().toISOString(),
                  updatedBy: actorEmail,
                  updatedAt: new Date().toISOString(),
                };
                await saveErpRecord('expenses', subExp, actorEmail, cloudMode);
              }
              setEditingSub(null);
            }}
            className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-2xl w-full p-6 space-y-3 text-xs"
          >
            <h3 className="text-base font-black">Taşeron Sözleşme ve Hesap Kartı</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <input required placeholder="Taşeron Firma *" value={editingSub.firmName} onChange={(e) => setEditingSub({ ...editingSub, firmName: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <select value={editingSub.projectId} onChange={(e) => setEditingSub({ ...editingSub, projectId: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
              </select>
            </div>
            <input placeholder="Sorumlu Olduğu İş Kalemi" value={editingSub.scopeOfWork} onChange={(e) => setEditingSub({ ...editingSub, scopeOfWork: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
            <div className="grid sm:grid-cols-4 gap-3">
              <input placeholder="Yetkili Kişi" value={editingSub.contactPerson} onChange={(e) => setEditingSub({ ...editingSub, contactPerson: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <input placeholder="Telefon" value={editingSub.phone} onChange={(e) => setEditingSub({ ...editingSub, phone: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <input placeholder="Vergi No" value={editingSub.taxNo} onChange={(e) => setEditingSub({ ...editingSub, taxNo: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <input placeholder="IBAN" value={editingSub.iban} onChange={(e) => setEditingSub({ ...editingSub, iban: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
            </div>
            {errorMsg && <div className="text-red-400 font-bold">{errorMsg}</div>}
            <div className="grid sm:grid-cols-3 gap-3">
              <label>
                <span>Sözleşme Bedeli (TL)</span>
                <input type="number" step="0.01" value={fromKurus(editingSub.contractAmountKurus)} onChange={(e) => setEditingSub(recalcSub({ ...editingSub, contractAmountKurus: toKurus(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label>
                <span>Taşeron Hakedişi (TL)</span>
                <input type="number" step="0.01" value={fromKurus(editingSub.hakedisTotalKurus)} onChange={(e) => setEditingSub(recalcSub({ ...editingSub, hakedisTotalKurus: toKurus(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label>
                <span>Şirket Malzemesi Mahsubu (TL)</span>
                <input type="number" step="0.01" value={fromKurus(editingSub.companyMaterialDeductionKurus)} onChange={(e) => setEditingSub(recalcSub({ ...editingSub, companyMaterialDeductionKurus: toKurus(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label>
                <span>Verilen Avans (TL)</span>
                <input type="number" step="0.01" value={fromKurus(editingSub.advanceGivenKurus)} onChange={(e) => setEditingSub(recalcSub({ ...editingSub, advanceGivenKurus: toKurus(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label>
                <span>Teminat Kesintisi (TL)</span>
                <input type="number" step="0.01" value={fromKurus(editingSub.retentionKurus)} onChange={(e) => setEditingSub(recalcSub({ ...editingSub, retentionKurus: toKurus(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label>
                <span>Yapılan Ödeme (TL)</span>
                <input type="number" step="0.01" value={fromKurus(editingSub.paidTotalKurus)} onChange={(e) => setEditingSub(recalcSub({ ...editingSub, paidTotalKurus: toKurus(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
            </div>
            <div className="p-3 rounded-xl bg-[#070d1e] font-black text-rose-400">
              Hesaplanan Kalan Taşeron Borcu: {formatKurusTRY(editingSub.remainingDebtKurus)}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingSub(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 font-black">Kaydet</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
