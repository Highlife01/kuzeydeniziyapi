import React, { useState } from 'react';
import { DEFAULT_EXPENSE_TAXONOMY } from '../data/expenseCategories';
import {
  deleteErpRecord,
  ERP_ORG_ID,
  reverseInvoiceRecord,
  saveErpRecord,
} from '../services/erpStore';
import {
  ApprovalRequest,
  ErpProject,
  ErpSettings,
  ErpUserAccount,
  ExpenseRecord,
  InvoiceRecord,
  PurchaseOrder,
  PurchaseStatus,
  SupplierCard,
} from '../types/erp';
import { calculateLineKurus, formatKurusTRY, fromKurus, toKurus } from '../utils/money';
import { canUserApproveAmount, getRequiredApprovalLevel } from '../utils/permissions';

interface PurchasingAndInvoicesViewProps {
  mode: 'purchases' | 'invoices';
  projects: ErpProject[];
  suppliers: SupplierCard[];
  purchases: PurchaseOrder[];
  invoices: InvoiceRecord[];
  expenses: ExpenseRecord[];
  currentUser: ErpUserAccount | null;
  settings: ErpSettings;
  canMutate: boolean;
  cloudMode: boolean;
  onOpenInvoiceUpload: () => void;
  onRequestInvoicePayment?: (invoice: InvoiceRecord) => void;
}

const PURCHASE_STATUSES: PurchaseStatus[] = [
  'Talep Oluşturuldu',
  'Teklif Alınıyor',
  'Onay Bekliyor',
  'Onaylandı',
  'Sipariş Verildi',
  'Kısmi Teslim',
  'Teslim Edildi',
  'İptal Edildi',
];

export const PurchasingAndInvoicesView: React.FC<PurchasingAndInvoicesViewProps> = ({
  mode,
  projects,
  suppliers,
  purchases,
  invoices,
  expenses,
  currentUser,
  settings,
  canMutate,
  cloudMode,
  onOpenInvoiceUpload,
  onRequestInvoicePayment,
}) => {
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [reversingInv, setReversingInv] = useState<InvoiceRecord | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'open' | 'paid' | 'reversed'>('all');
  const [errorMsg, setErrorMsg] = useState('');

  const actorEmail = currentUser?.email || 'sistem';

  const openNewPurchase = () => {
    const now = new Date().toISOString();
    setEditingPO({
      id: `po-${Date.now()}`,
      organizationId: ERP_ORG_ID,
      projectId: projects[0]?.id || '',
      materialName: '',
      categoryGroup: DEFAULT_EXPENSE_TAXONOMY[0].group,
      categorySub: DEFAULT_EXPENSE_TAXONOMY[0].items[0],
      brand: '',
      model: '',
      specs: '',
      pozNo: '',
      supplierId: suppliers[0]?.id || '',
      supplierName: suppliers[0]?.name || '',
      orderDate: now.slice(0, 10),
      deliveryDate: '',
      quantity: 1,
      unit: 'Adet',
      unitPriceKurus: 0,
      discountRatePct: 0,
      vatRate: 20,
      netTotalKurus: 0,
      vatAmountKurus: 0,
      grossTotalKurus: 0,
      shippingKurus: 0,
      paidKurus: 0,
      remainingDebtKurus: 0,
      paymentMethod: 'Havale / EFT',
      dueDate: '',
      invoiceNo: '',
      waybillNo: '',
      receivedBy: '',
      productPhotoUrl: '',
      invoicePhotoUrl: '',
      waybillPhotoUrl: '',
      status: 'Talep Oluşturuldu',
      approvalStatus: 'Beklemiyor',
      description: '',
      createdBy: actorEmail,
      createdAt: now,
      updatedBy: actorEmail,
      updatedAt: now,
    });
  };

  const recalcPo = (draft: PurchaseOrder): PurchaseOrder => {
    const calc = calculateLineKurus(
      draft.quantity,
      draft.unitPriceKurus,
      draft.discountRatePct,
      draft.vatRate
    );
    const grossTotalKurus = calc.grossTotalKurus + (draft.shippingKurus || 0);
    const remainingDebtKurus = Math.max(0, grossTotalKurus - (draft.paidKurus || 0));
    return {
      ...draft,
      netTotalKurus: calc.netKurus,
      vatAmountKurus: calc.vatKurus,
      grossTotalKurus,
      remainingDebtKurus,
    };
  };

  if (mode === 'purchases') {
    const filteredPo = purchases.filter((p) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        p.materialName.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q) ||
        p.pozNo.toLowerCase().includes(q)
      );
    });

    return (
      <div className="space-y-6">
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Satın Alma ve Malzeme Sipariş Yönetimi</h2>
            <p className="text-xs text-slate-400">
              Poz eşleştirmeli malzeme siparişleri, otomatik iskonto/KDV/toplam ve tutar bazlı onay akışı
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Malzeme, tedarikçi, poz ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-xs text-white"
            />
            {canMutate && (
              <button
                type="button"
                onClick={openNewPurchase}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black border border-blue-300"
              >
                + Yeni Satın Alma Siparişi
              </button>
            )}
          </div>
        </div>

        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#070d1e] border-b border-slate-700 text-slate-400 uppercase">
                <th className="py-3 px-4">Malzeme / Poz</th>
                <th className="py-3 px-4">Proje / Tedarikçi</th>
                <th className="py-3 px-4">Miktar / Birim Fiyat</th>
                <th className="py-3 px-4">KDV Dahil Toplam</th>
                <th className="py-3 px-4">Durum / Onay</th>
                <th className="py-3 px-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredPo.map((po) => (
                <tr key={po.id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <div className="font-black text-white">{po.materialName}</div>
                    <div className="text-slate-400">{po.categorySub} • Poz: {po.pozNo || '—'}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-blue-300 font-bold">
                      {projects.find((p) => p.id === po.projectId)?.shortName || '—'}
                    </div>
                    <div className="text-slate-300">{po.supplierName || '—'}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div>{po.quantity} {po.unit} &times; {formatKurusTRY(po.unitPriceKurus)}</div>
                    <div className="text-slate-500">İskonto: %{po.discountRatePct} | KDV: %{po.vatRate}</div>
                  </td>
                  <td className="py-3 px-4 font-black text-emerald-400">
                    {formatKurusTRY(po.grossTotalKurus)}
                    <div className="text-[10px] text-rose-300 font-normal">
                      Kalan Borç: {formatKurusTRY(po.remainingDebtKurus)}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-600 font-bold">
                      {po.status}
                    </span>
                    <div className="text-[10px] text-amber-300 mt-1">Onay: {po.approvalStatus}</div>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5">
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => setEditingPO(po)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 font-bold"
                      >
                        Düzenle
                      </button>
                    )}
                    {canMutate && po.approvalStatus !== 'Onaylandı' && (
                      <button
                        type="button"
                        onClick={() => deleteErpRecord('purchases', po.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Sipariş silinemedi.'))}
                        className="px-2.5 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-600 text-red-300 hover:text-white font-bold"
                      >
                        Sil
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredPo.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Henüz satın alma kaydı bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {editingPO && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const finalPo = recalcPo(editingPO);
                const needsHigherApproval = !canUserApproveAmount(
                  currentUser,
                  finalPo.grossTotalKurus,
                  settings
                );
                const savedPo: PurchaseOrder = {
                  ...finalPo,
                  approvalStatus: needsHigherApproval ? 'Onay Bekliyor' : 'Onaylandı',
                };
                await saveErpRecord(
                  'purchases',
                  savedPo,
                  actorEmail,
                  cloudMode,
                  'UPDATE',
                  `Satın alma kaydedildi: ${savedPo.materialName}`
                );
                if (needsHigherApproval) {
                  const req = getRequiredApprovalLevel(savedPo.grossTotalKurus, settings);
                  const apr: ApprovalRequest = {
                    id: `apr-po-${savedPo.id}`,
                    organizationId: ERP_ORG_ID,
                    entityType: 'purchase',
                    entityId: savedPo.id,
                    projectId: savedPo.projectId,
                    title: `Satın Alma: ${savedPo.materialName}`,
                    amountKurus: savedPo.grossTotalKurus,
                    requiredRoleLabel: req.requiredRoleLabel,
                    status: 'Onay Bekliyor',
                    requestedBy: actorEmail,
                    createdBy: actorEmail,
                    createdAt: new Date().toISOString(),
                    updatedBy: actorEmail,
                    updatedAt: new Date().toISOString(),
                  };
                  await saveErpRecord('approvals', apr, actorEmail, cloudMode);
                }
                setEditingPO(null);
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-lg font-black text-white">Satın Alma Kaydı</h3>
                <button type="button" onClick={() => setEditingPO(null)} className="text-slate-400">
                  <i className="fa-solid fa-xmark text-lg" />
                </button>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <select
                  value={editingPO.projectId}
                  onChange={(e) => setEditingPO({ ...editingPO, projectId: e.target.value })}
                  className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                >
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
                </select>
                <input
                  required
                  placeholder="Malzeme Adı *"
                  value={editingPO.materialName}
                  onChange={(e) => setEditingPO({ ...editingPO, materialName: e.target.value })}
                  className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                />
              </div>
              <div className="grid sm:grid-cols-4 gap-3">
                <input placeholder="Marka" value={editingPO.brand} onChange={(e) => setEditingPO({ ...editingPO, brand: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <input placeholder="Model" value={editingPO.model} onChange={(e) => setEditingPO({ ...editingPO, model: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <input placeholder="Poz No" value={editingPO.pozNo} onChange={(e) => setEditingPO({ ...editingPO, pozNo: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <select
                  value={editingPO.supplierId || '__custom__'}
                  onChange={(e) => {
                    const sup = suppliers.find((s) => s.id === e.target.value);
                    setEditingPO({
                      ...editingPO,
                      supplierId: sup ? sup.id : '',
                      supplierName: sup ? sup.name : editingPO.supplierName,
                    });
                  }}
                  className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                >
                  <option value="__custom__">Serbest / Manuel Tedarikçi</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <input
                  placeholder="Tedarikçi Adı"
                  value={editingPO.supplierName}
                  onChange={(e) => setEditingPO({ ...editingPO, supplierName: e.target.value })}
                  className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                />
                <select
                  value={editingPO.categoryGroup}
                  onChange={(e) => {
                    const grp = e.target.value;
                    const found = DEFAULT_EXPENSE_TAXONOMY.find((g) => g.group === grp);
                    setEditingPO({ ...editingPO, categoryGroup: grp, categorySub: found?.items[0] || '' });
                  }}
                  className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                >
                  {DEFAULT_EXPENSE_TAXONOMY.map((g) => <option key={g.group} value={g.group}>{g.group}</option>)}
                </select>
                <select
                  value={editingPO.categorySub}
                  onChange={(e) => setEditingPO({ ...editingPO, categorySub: e.target.value })}
                  className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                >
                  {(DEFAULT_EXPENSE_TAXONOMY.find((g) => g.group === editingPO.categoryGroup)?.items || []).map((it) => (
                    <option key={it} value={it}>{it}</option>
                  ))}
                </select>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <label>
                  <span>Sipariş Tarihi</span>
                  <input type="date" value={editingPO.orderDate} onChange={(e) => setEditingPO({ ...editingPO, orderDate: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Vade Tarihi</span>
                  <input type="date" value={editingPO.dueDate} onChange={(e) => setEditingPO({ ...editingPO, dueDate: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Teslim Alan / Açıklama</span>
                  <input placeholder="Not / Teslim alan" value={editingPO.description} onChange={(e) => setEditingPO({ ...editingPO, description: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
              </div>
              <div className="grid sm:grid-cols-5 gap-3">
                <label>
                  <span>Miktar</span>
                  <input type="number" step="0.01" value={editingPO.quantity} onChange={(e) => setEditingPO(recalcPo({ ...editingPO, quantity: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Birim</span>
                  <input value={editingPO.unit} onChange={(e) => setEditingPO({ ...editingPO, unit: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Birim Fiyat (TL)</span>
                  <input type="number" step="0.01" value={fromKurus(editingPO.unitPriceKurus)} onChange={(e) => setEditingPO(recalcPo({ ...editingPO, unitPriceKurus: toKurus(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>İskonto (%)</span>
                  <input type="number" value={editingPO.discountRatePct} onChange={(e) => setEditingPO(recalcPo({ ...editingPO, discountRatePct: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>KDV (%)</span>
                  <input type="number" value={editingPO.vatRate} onChange={(e) => setEditingPO(recalcPo({ ...editingPO, vatRate: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
              </div>
              <div className="grid sm:grid-cols-4 gap-3">
                <label>
                  <span>Nakliye (TL)</span>
                  <input type="number" step="0.01" value={fromKurus(editingPO.shippingKurus)} onChange={(e) => setEditingPO(recalcPo({ ...editingPO, shippingKurus: toKurus(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Fatura No</span>
                  <input value={editingPO.invoiceNo} onChange={(e) => setEditingPO({ ...editingPO, invoiceNo: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>İrsaliye No</span>
                  <input value={editingPO.waybillNo} onChange={(e) => setEditingPO({ ...editingPO, waybillNo: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Durum</span>
                  <select value={editingPO.status} onChange={(e) => setEditingPO({ ...editingPO, status: e.target.value as PurchaseStatus })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                    {PURCHASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <div className="p-3 rounded-xl bg-[#070d1e] flex justify-between font-black">
                <span>KDV Hariç: {formatKurusTRY(editingPO.netTotalKurus)}</span>
                <span>KDV: {formatKurusTRY(editingPO.vatAmountKurus)}</span>
                <span className="text-emerald-400">Genel Toplam: {formatKurusTRY(editingPO.grossTotalKurus)}</span>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setEditingPO(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-6 py-2 rounded-xl bg-blue-600 font-black">Siparişi Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // MODE === 'invoices'
  const filteredInv = invoices.filter((i) => {
    if (projectFilter !== 'all') {
      const matchesProj =
        i.projectId === projectFilter ||
        i.allocations?.some((a) => a.targetType === 'project' && a.targetId === projectFilter);
      if (!matchesProj) return false;
    }
    if (invoiceFilter === 'open' && (i.reversalOfId || i.remainingDebtKurus <= 0)) return false;
    if (invoiceFilter === 'paid' && (i.reversalOfId || i.remainingDebtKurus > 0)) return false;
    if (invoiceFilter === 'reversed' && !i.reversalOfId) return false;

    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      i.invoiceNo.toLowerCase().includes(q) ||
      i.supplierName.toLowerCase().includes(q) ||
      i.ettn.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">Faturalar, İrsaliyeler &amp; AI OCR Merkezi</h2>
          <p className="text-xs text-slate-400">
            Kameradan fatura okuma, XML e-Fatura ayrıştırma, çoklu proje gider dağıtımı ve kesinleşmiş kayıt güvenliği
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white">
            <option value="all">Tüm Projeler</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
          </select>
          <select value={invoiceFilter} onChange={(e) => setInvoiceFilter(e.target.value as any)} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white">
            <option value="all">Tüm Durumlar</option>
            <option value="open">Açık Borçlu</option>
            <option value="paid">Ödenmiş</option>
            <option value="reversed">İptal / Ters Kayıt</option>
          </select>
          <input
            type="text"
            placeholder="Fatura no, ETTN veya tedarikçi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-xs text-white"
          />
          {canMutate && (
            <button
              type="button"
              onClick={onOpenInvoiceUpload}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black border border-blue-300"
            >
              <i className="fa-solid fa-camera mr-1.5" />
              Hızlı Fatura Yükle / OCR / XML
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500 text-xs font-bold text-red-200">
          {errorMsg}
        </div>
      )}

      <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#070d1e] border-b border-slate-700 text-slate-400 uppercase">
              <th className="py-3 px-4">Fatura No / ETTN</th>
              <th className="py-3 px-4">Tedarikçi</th>
              <th className="py-3 px-4">Dağıtım (Projeler/Depo)</th>
              <th className="py-3 px-4">Genel Toplam / KDV</th>
              <th className="py-3 px-4">Kalan Borç</th>
              <th className="py-3 px-4 text-right">Belge / Ters Kayıt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredInv.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-800/40">
                <td className="py-3 px-4">
                  <div className="font-mono font-black text-white">#{inv.invoiceNo}</div>
                  <div className="text-[10px] text-slate-400">
                    {inv.issueDate} &bull; {inv.sourceMode.toUpperCase()}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="font-bold text-white">{inv.supplierName}</div>
                  <div className="text-[10px] text-slate-400">VKN: {inv.supplierTaxNo || '—'}</div>
                </td>
                <td className="py-3 px-4 space-y-1">
                  {inv.allocations?.map((al) => (
                    <div key={al.id} className="text-[11px] text-blue-300">
                      {al.targetName}: <strong>{formatKurusTRY(al.allocatedGrossKurus)}</strong>
                    </div>
                  ))}
                </td>
                <td className="py-3 px-4">
                  <div className="font-black text-white">{formatKurusTRY(inv.grandTotalKurus)}</div>
                  <div className="text-[10px] text-sky-400">
                    KDV: {formatKurusTRY(inv.vatTotalKurus)} ({inv.deductibleVat ? 'İndirilebilir' : 'Maliyete Dahil'})
                  </div>
                </td>
                <td className="py-3 px-4 font-black text-rose-400">
                  {formatKurusTRY(inv.remainingDebtKurus)}
                </td>
                <td className="py-3 px-4 text-right space-x-1.5">
                  {inv.attachments?.[0] && (
                    <a
                      href={inv.attachments[0].previewUrl || inv.attachments[0].originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-blue-300 hover:text-white inline-block"
                      title="Belgeyi Aç"
                    >
                      <i className="fa-solid fa-eye" />
                    </a>
                  )}
                  {canMutate && !inv.reversalOfId && inv.remainingDebtKurus > 0 && onRequestInvoicePayment && (
                    <button
                      type="button"
                      onClick={() => onRequestInvoicePayment(inv)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    >
                      Ödeme Yap
                    </button>
                  )}
                  {canMutate && !inv.reversalOfId && (
                    <button
                      type="button"
                      onClick={() => setReversingInv(inv)}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-600 text-amber-300 hover:text-white font-bold"
                    >
                      İptal / Ters Kayıt
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredInv.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  Kayıtlı fatura bulunmuyor. Kameradan fotoğraf çekerek veya XML yükleyerek başlayın.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reversingInv && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await reverseInvoiceRecord(
                reversingInv,
                expenses,
                actorEmail,
                cloudMode,
                reverseReason || 'Hatalı kayıt düzeltme'
              );
              setReversingInv(null);
              setReverseReason('');
            }}
            className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-md w-full p-6 space-y-4 text-xs"
          >
            <h3 className="text-base font-black text-white">
              Fatura #{reversingInv.invoiceNo} — Ters Kayıt (İptal)
            </h3>
            <p className="text-slate-400">
              Finansal güvenlik politikası gereği kesinleşmiş faturalar doğrudan silinmez; muhasebe
              izi korunarak eksi tutarlı ters kayıt oluşturulur.
            </p>
            <input
              required
              placeholder="İptal / düzeltme nedeni..."
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReversingInv(null)} className="px-4 py-2 rounded-xl bg-slate-800">Vazgeç</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-amber-600 font-black text-white">Ters Kayıt Oluştur</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
