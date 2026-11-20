import React, { useEffect, useState } from 'react';
import { DEFAULT_EXPENSE_TAXONOMY } from '../data/expenseCategories';
import {
  deleteErpRecord,
  ERP_ORG_ID,
  postPaymentWithApproval,
  reverseExpenseRecord,
  saveErpRecord,
} from '../services/erpStore';
import {
  BankAccount,
  CheckNoteRecord,
  CustomExpenseCategory,
  ErpProject,
  ErpSettings,
  ErpUserAccount,
  ExpenseRecord,
  GuaranteeLetter,
  GuaranteeType,
  InvoiceRecord,
  PaymentRecord,
  ProgressPayment,
  SubcontractorCard,
  SupplierCard,
} from '../types/erp';
import { formatKurusTRY, fromKurus, toKurus } from '../utils/money';

export interface PaymentPrefillPayload {
  key: number;
  direction: 'Tahsilat' | 'Ödeme';
  targetType: 'supplier' | 'subcontractor' | 'client_hakedis' | 'other';
  targetId?: string;
  targetName: string;
  projectId?: string;
  invoiceId?: string;
  hakedisId?: string;
  subcontractorId?: string;
  amountKurus: number;
}

interface FinanceBankingViewProps {
  mode: 'expenses' | 'currentAccounts' | 'bankCash' | 'checks' | 'guarantees';
  projects: ErpProject[];
  expenses: ExpenseRecord[];
  customCategories: CustomExpenseCategory[];
  bankAccounts: BankAccount[];
  payments: PaymentRecord[];
  invoices: InvoiceRecord[];
  progressPayments: ProgressPayment[];
  suppliers: SupplierCard[];
  subcontractors: SubcontractorCard[];
  checks: CheckNoteRecord[];
  guarantees: GuaranteeLetter[];
  currentUser: ErpUserAccount | null;
  settings: ErpSettings;
  canMutate: boolean;
  cloudMode: boolean;
  paymentPrefill?: PaymentPrefillPayload | null;
  onClearPaymentPrefill?: () => void;
  onRequestPayment?: (prefill: Omit<PaymentPrefillPayload, 'key'>) => void;
}

export const FinanceBankingView: React.FC<FinanceBankingViewProps> = ({
  mode,
  projects,
  expenses,
  customCategories,
  bankAccounts,
  payments,
  invoices,
  progressPayments,
  subcontractors,
  checks,
  guarantees,
  currentUser,
  settings,
  canMutate,
  cloudMode,
  paymentPrefill,
  onClearPaymentPrefill,
  onRequestPayment,
}) => {
  const actorEmail = currentUser?.email || 'sistem';
  const [newExp, setNewExp] = useState<ExpenseRecord | null>(null);
  const [reversingExp, setReversingExp] = useState<ExpenseRecord | null>(null);
  const [expRevReason, setExpRevReason] = useState('');
  const [expProjFilter, setExpProjFilter] = useState('all');
  const [expSearch, setExpSearch] = useState('');
  const [newBank, setNewBank] = useState<BankAccount | null>(null);
  const [newPay, setNewPay] = useState<PaymentRecord | null>(null);
  const [payNotice, setPayNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [newCheck, setNewCheck] = useState<CheckNoteRecord | null>(null);
  const [newGuar, setNewGuar] = useState<GuaranteeLetter | null>(null);
  const [customCatGroup, setCustomCatGroup] = useState(DEFAULT_EXPENSE_TAXONOMY[0].group);
  const [customCatName, setCustomCatName] = useState('');

  useEffect(() => {
    if (mode !== 'bankCash' || !paymentPrefill) return;
    setPayNotice('');
    setNewPay({
      id: `pay-${Date.now()}`,
      organizationId: ERP_ORG_ID,
      projectId: paymentPrefill.projectId || projects[0]?.id || '',
      direction: paymentPrefill.direction,
      targetType: paymentPrefill.targetType,
      targetId: paymentPrefill.targetId || '',
      targetName: paymentPrefill.targetName,
      invoiceId: paymentPrefill.invoiceId,
      hakedisId: paymentPrefill.hakedisId,
      subcontractorId: paymentPrefill.subcontractorId,
      bankAccountId: bankAccounts[0]?.id || '',
      bankAccountName: bankAccounts[0]?.name || '',
      method: paymentPrefill.hakedisId ? 'Kamu Hakediş' : 'Havale / EFT',
      amountKurus: paymentPrefill.amountKurus,
      date: new Date().toISOString().slice(0, 10),
      locked: false,
      approvalStatus: 'Onaylandı',
      notes: '',
      createdBy: actorEmail,
      createdAt: new Date().toISOString(),
      updatedBy: actorEmail,
      updatedAt: new Date().toISOString(),
    });
    onClearPaymentPrefill?.();
  }, [mode, paymentPrefill, bankAccounts, projects, actorEmail, onClearPaymentPrefill]);

  if (mode === 'expenses') {
    const mergedTaxonomy = DEFAULT_EXPENSE_TAXONOMY.map((g) => ({
      ...g,
      items: [
        ...g.items,
        ...customCategories.filter((c) => c.group === g.group).map((c) => c.name),
      ],
    }));

    const filteredExpenses = expenses.filter((ex) => {
      if (expProjFilter !== 'all' && ex.projectId !== expProjFilter) return false;
      const q = expSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        ex.description.toLowerCase().includes(q) ||
        ex.categorySub.toLowerCase().includes(q) ||
        ex.categoryGroup.toLowerCase().includes(q)
      );
    });

    return (
      <div className="space-y-6">
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Gelir ve Giderler (Tahakkuk Esaslı Defter)</h2>
            <p className="text-xs text-slate-400">
              4 ana grup 70+ alt kategori desteği, indirilebilir KDV ayrımı ve ters kayıt koruması
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select value={expProjFilter} onChange={(e) => setExpProjFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white">
              <option value="all">Tüm Projeler</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
              <option value="company_overhead">Şirket Genel Gideri</option>
            </select>
            <input placeholder="Açıklama / kategori ara..." value={expSearch} onChange={(e) => setExpSearch(e.target.value)} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white" />
            {canMutate && (
              <button
                type="button"
                onClick={() =>
                  setNewExp({
                    id: `exp-${Date.now()}`,
                    organizationId: ERP_ORG_ID,
                    projectId: projects[0]?.id || 'company_overhead',
                    categoryGroup: mergedTaxonomy[0].group,
                    categorySub: mergedTaxonomy[0].items[0],
                    description: '',
                    date: new Date().toISOString().slice(0, 10),
                    netKurus: 0,
                    vatRate: 20,
                    vatKurus: 0,
                    grossKurus: 0,
                    deductibleVat: true,
                    sourceType: 'manual',
                    locked: false,
                    createdBy: actorEmail,
                    createdAt: new Date().toISOString(),
                    updatedBy: actorEmail,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black"
              >
                + Doğrudan Gider Kaydı Ekle
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500 text-xs font-bold text-red-200">
            {errorMsg}
          </div>
        )}

        {/* Custom Category Adder (persisted to Firestore expenseCategories) */}
        {canMutate && (
          <div className="bg-[#0b1329] border border-slate-700 rounded-2xl p-4 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-slate-300">Yeni Alt Gider Kategorisi Ekle:</span>
            <select value={customCatGroup} onChange={(e) => setCustomCatGroup(e.target.value)} className="px-3 py-1.5 rounded-xl bg-[#0f172a] border border-slate-600">
              {DEFAULT_EXPENSE_TAXONOMY.map((g) => <option key={g.group} value={g.group}>{g.group}</option>)}
            </select>
            <input
              type="text"
              placeholder="Kategori adı..."
              value={customCatName}
              onChange={(e) => setCustomCatName(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#0f172a] border border-slate-600"
            />
            <button
              type="button"
              onClick={async () => {
                if (!customCatName.trim()) return;
                const now = new Date().toISOString();
                await saveErpRecord(
                  'expenseCategories',
                  {
                    id: `cat-${Date.now()}`,
                    organizationId: ERP_ORG_ID,
                    group: customCatGroup,
                    name: customCatName.trim(),
                    createdBy: actorEmail,
                    createdAt: now,
                    updatedBy: actorEmail,
                    updatedAt: now,
                  },
                  actorEmail,
                  cloudMode
                );
                setCustomCatName('');
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
            >
              Kaydet
            </button>
          </div>
        )}

        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#070d1e] border-b border-slate-700 text-slate-400 uppercase">
                <th className="py-3 px-4">Tarih</th>
                <th className="py-3 px-4">Proje</th>
                <th className="py-3 px-4">Gider Kategorisi</th>
                <th className="py-3 px-4">Açıklama</th>
                <th className="py-3 px-4">KDV Hariç</th>
                <th className="py-3 px-4">KDV</th>
                <th className="py-3 px-4">Toplam</th>
                <th className="py-3 px-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredExpenses.map((ex) => (
                <tr key={ex.id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4">{ex.date}</td>
                  <td className="py-3 px-4 text-blue-300 font-bold">
                    {projects.find((p) => p.id === ex.projectId)?.shortName || 'Şirket Genel'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-white">{ex.categorySub}</div>
                    <div className="text-[10px] text-slate-400">{ex.categoryGroup}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{ex.description}</td>
                  <td className="py-3 px-4 font-bold">{formatKurusTRY(ex.netKurus)}</td>
                  <td className="py-3 px-4 text-sky-400">{formatKurusTRY(ex.vatKurus)}</td>
                  <td className="py-3 px-4 font-black text-rose-400">{formatKurusTRY(ex.grossKurus)}</td>
                  <td className="py-3 px-4 text-right">
                    {canMutate && !ex.reversalOfId && (
                      ex.locked ? (
                        <button
                          type="button"
                          onClick={() => setReversingExp(ex)}
                          className="px-2.5 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-600 text-amber-300 hover:text-white font-bold"
                        >
                          Ters Kayıt
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => deleteErpRecord('expenses', ex.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Silinemedi.'))}
                          className="px-2.5 py-1 rounded-lg bg-red-950/70 hover:bg-red-600 text-red-300 hover:text-white font-bold"
                        >
                          Sil
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">Kayıtlı gider hareketi bulunmuyor.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {reversingExp && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErrorMsg('');
                try {
                  await reverseExpenseRecord(reversingExp, actorEmail, cloudMode, expRevReason || 'Düzeltme');
                  setReversingExp(null);
                  setExpRevReason('');
                } catch (err: any) {
                  setErrorMsg(err?.message || 'Gider ters kaydı oluşturulamadı.');
                }
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-md w-full p-6 space-y-3 text-xs"
            >
              <h3 className="text-base font-black text-white">Gider Ters Kaydı (İptal)</h3>
              <p className="text-slate-400">{reversingExp.description} ({formatKurusTRY(reversingExp.grossKurus)}) için ters muhasebe kaydı oluşturulacak.</p>
              <input required placeholder="İptal / düzeltme nedeni..." value={expRevReason} onChange={(e) => setExpRevReason(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setReversingExp(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-amber-600 font-black text-white">Ters Kayıt Oluştur</button>
              </div>
            </form>
          </div>
        )}

        {newExp && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErrorMsg('');
                try {
                  const vat = Math.round((newExp.netKurus * newExp.vatRate) / 100);
                  await saveErpRecord(
                    'expenses',
                    { ...newExp, vatKurus: vat, grossKurus: newExp.netKurus + vat, locked: true },
                    actorEmail,
                    cloudMode,
                    'CREATE',
                    `Gider eklendi: ${newExp.categorySub}`
                  );
                  setNewExp(null);
                } catch (err: any) {
                  setErrorMsg(err?.message || 'Gider kaydedilemedi.');
                }
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-lg w-full p-6 space-y-3 text-xs"
            >
              <h3 className="text-base font-black text-white">Doğrudan Gider Kaydı</h3>
              <div className="grid grid-cols-2 gap-3">
                <select value={newExp.projectId} onChange={(e) => setNewExp({ ...newExp, projectId: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
                  <option value="company_overhead">Şirket Genel Gideri</option>
                </select>
                <input type="date" value={newExp.date} onChange={(e) => setNewExp({ ...newExp, date: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newExp.categoryGroup}
                  onChange={(e) => {
                    const g = e.target.value;
                    const found = mergedTaxonomy.find((x) => x.group === g);
                    setNewExp({ ...newExp, categoryGroup: g, categorySub: found?.items[0] || '' });
                  }}
                  className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                >
                  {mergedTaxonomy.map((g) => <option key={g.group} value={g.group}>{g.group}</option>)}
                </select>
                <select value={newExp.categorySub} onChange={(e) => setNewExp({ ...newExp, categorySub: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  {(mergedTaxonomy.find((g) => g.group === newExp.categoryGroup)?.items || []).map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
              <input required placeholder="Açıklama *" value={newExp.description} onChange={(e) => setNewExp({ ...newExp, description: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span>KDV Hariç Tutar (TL)</span>
                  <input type="number" step="0.01" value={fromKurus(newExp.netKurus)} onChange={(e) => setNewExp({ ...newExp, netKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>KDV (%)</span>
                  <input type="number" value={newExp.vatRate} onChange={(e) => setNewExp({ ...newExp, vatRate: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
              </div>
              <label className="flex items-center gap-2 font-bold">
                <input type="checkbox" checked={newExp.deductibleVat} onChange={(e) => setNewExp({ ...newExp, deductibleVat: e.target.checked })} />
                <span>İndirilebilir KDV (Proje net maliyetinden ayrılır)</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNewExp(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 font-black">Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'currentAccounts') {
    const openInvoices = invoices.filter((i) => !i.reversalOfId && i.remainingDebtKurus > 0);
    const openHakedis = progressPayments.filter((h) => h.remainingReceivableKurus > 0);
    return (
      <div className="space-y-6">
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5">
          <h2 className="text-xl font-black text-white">Cari Hesaplar (Alacak &amp; Borç Yaşlandırma)</h2>
          <p className="text-xs text-slate-400">
            Kurum hakediş alacakları, tedarikçi fatura borçları ve taşeron bakiyeleri tek ekranda
          </p>
        </div>
        <div className="grid lg:grid-cols-2 gap-6 text-xs">
          <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 space-y-3">
            <h3 className="font-black text-emerald-400 text-sm">Kurum Hakediş Alacakları ({openHakedis.length})</h3>
            {openHakedis.map((h) => (
              <div key={h.id} className="p-3 bg-[#070d1e] rounded-xl flex flex-wrap justify-between items-center gap-2">
                <span>Hakediş #{h.hakedisNo} ({projects.find((p) => p.id === h.projectId)?.shortName})</span>
                <div className="flex items-center gap-2">
                  <strong className="text-emerald-400">{formatKurusTRY(h.remainingReceivableKurus)}</strong>
                  {canMutate && onRequestPayment && (
                    <button
                      type="button"
                      onClick={() =>
                        onRequestPayment({
                          direction: 'Tahsilat',
                          targetType: 'client_hakedis',
                          targetId: h.projectId,
                          targetName: `${projects.find((p) => p.id === h.projectId)?.shortName || 'Kurum'} Hakediş #${h.hakedisNo}`,
                          projectId: h.projectId,
                          hakedisId: h.id,
                          amountKurus: h.remainingReceivableKurus,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold"
                    >
                      Tahsilat Gir
                    </button>
                  )}
                </div>
              </div>
            ))}
            {openHakedis.length === 0 && <div className="text-slate-400">Bekleyen hakediş alacağı yok.</div>}
          </div>
          <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 space-y-3">
            <h3 className="font-black text-rose-400 text-sm">Tedarikçi &amp; Taşeron Borçları</h3>
            {openInvoices.map((i) => (
              <div key={i.id} className="p-3 bg-[#070d1e] rounded-xl flex flex-wrap justify-between items-center gap-2">
                <span>{i.supplierName} — Fatura #{i.invoiceNo} (Vade: {i.dueDate || '—'})</span>
                <div className="flex items-center gap-2">
                  <strong className="text-rose-400">{formatKurusTRY(i.remainingDebtKurus)}</strong>
                  {canMutate && onRequestPayment && (
                    <button
                      type="button"
                      onClick={() =>
                        onRequestPayment({
                          direction: 'Ödeme',
                          targetType: 'supplier',
                          targetId: i.supplierId,
                          targetName: i.supplierName,
                          projectId: i.projectId,
                          invoiceId: i.id,
                          amountKurus: i.remainingDebtKurus,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold"
                    >
                      Ödeme Yap
                    </button>
                  )}
                </div>
              </div>
            ))}
            {subcontractors.filter((s) => s.remainingDebtKurus > 0).map((s) => (
              <div key={s.id} className="p-3 bg-[#070d1e] rounded-xl flex flex-wrap justify-between items-center gap-2">
                <span>Taşeron: {s.firmName}</span>
                <div className="flex items-center gap-2">
                  <strong className="text-rose-400">{formatKurusTRY(s.remainingDebtKurus)}</strong>
                  {canMutate && onRequestPayment && (
                    <button
                      type="button"
                      onClick={() =>
                        onRequestPayment({
                          direction: 'Ödeme',
                          targetType: 'subcontractor',
                          targetId: s.id,
                          targetName: s.firmName,
                          projectId: s.projectId,
                          subcontractorId: s.id,
                          amountKurus: s.remainingDebtKurus,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold"
                    >
                      Ödeme Yap
                    </button>
                  )}
                </div>
              </div>
            ))}
            {openInvoices.length === 0 && subcontractors.filter((s) => s.remainingDebtKurus > 0).length === 0 && (
              <div className="text-slate-400">Açık cari borç bulunmuyor.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'bankCash') {
    return (
      <div className="space-y-6">
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Banka, Kasa &amp; Kısmi Fatura Ödemeleri</h2>
            <p className="text-xs text-slate-400">
              Nakit akışı ile tahakkuk ayrımı; bir faturaya birden fazla kısmi ödeme (çifte gider oluşmaz)
            </p>
          </div>
          {canMutate && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setNewBank({
                    id: `bnk-${Date.now()}`,
                    organizationId: ERP_ORG_ID,
                    name: '',
                    bankName: '',
                    accountType: 'Banka TL',
                    currency: 'TRY',
                    iban: '',
                    balanceKurus: 0,
                    createdBy: actorEmail,
                    createdAt: new Date().toISOString(),
                    updatedBy: actorEmail,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs font-bold"
              >
                + Banka / Kasa Ekle
              </button>
              <button
                type="button"
                onClick={() => {
                  setPayNotice('');
                  setNewPay({
                    id: `pay-${Date.now()}`,
                    organizationId: ERP_ORG_ID,
                    projectId: projects[0]?.id || '',
                    direction: 'Ödeme',
                    targetType: 'supplier',
                    targetId: '',
                    targetName: '',
                    bankAccountId: bankAccounts[0]?.id || '',
                    bankAccountName: bankAccounts[0]?.name || '',
                    method: 'Havale / EFT',
                    amountKurus: 0,
                    date: new Date().toISOString().slice(0, 10),
                    locked: false,
                    approvalStatus: 'Onaylandı',
                    notes: '',
                    createdBy: actorEmail,
                    createdAt: new Date().toISOString(),
                    updatedBy: actorEmail,
                    updatedAt: new Date().toISOString(),
                  });
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black"
              >
                + Ödeme / Tahsilat Kaydet
              </button>
            </div>
          )}
        </div>

        {payNotice && (
          <div className="p-4 rounded-xl bg-amber-950/80 border border-amber-500 text-xs font-bold text-amber-200">
            {payNotice}
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {bankAccounts.map((b) => (
            <div key={b.id} className="bg-[#0b1329] border border-slate-700 rounded-2xl p-4 text-xs space-y-1">
              <div className="flex justify-between items-start gap-2">
                <div className="font-black text-white text-sm">{b.name}</div>
                {canMutate && (
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={() => setNewBank(b)} className="text-blue-400 font-bold">Düzenle</button>
                    <button
                      type="button"
                      onClick={() => deleteErpRecord('bankAccounts', b.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Hesap silinemedi.'))}
                      className="text-red-400 font-bold"
                    >
                      Sil
                    </button>
                  </div>
                )}
              </div>
              <div className="text-slate-400">{b.bankName ? `${b.bankName} • ` : ''}{b.accountType} ({b.currency})</div>
              {b.iban && <div className="text-[10px] font-mono text-slate-500 truncate">{b.iban}</div>}
              <div className="text-lg font-black text-emerald-400 pt-1">{formatKurusTRY(b.balanceKurus)}</div>
            </div>
          ))}
        </div>
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500 text-xs font-bold text-red-200">
            {errorMsg}
          </div>
        )}

        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#070d1e] border-b border-slate-700 text-slate-400 uppercase">
                <th className="py-3 px-4">Tarih</th>
                <th className="py-3 px-4">Taraf</th>
                <th className="py-3 px-4">Banka / Kasa</th>
                <th className="py-3 px-4">Yöntem</th>
                <th className="py-3 px-4">Tutar</th>
                <th className="py-3 px-4">Onay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 px-4">{p.date}</td>
                  <td className="py-3 px-4 font-bold text-white">{p.targetName}</td>
                  <td className="py-3 px-4">{p.bankAccountName}</td>
                  <td className="py-3 px-4">{p.method}</td>
                  <td className={`py-3 px-4 font-black ${p.direction === 'Tahsilat' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {p.direction === 'Tahsilat' ? '+' : '-'}{formatKurusTRY(p.amountKurus)}
                  </td>
                  <td className="py-3 px-4">{p.approvalStatus}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">Kayıtlı nakit hareketi yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {newBank && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErrorMsg('');
                try {
                  await saveErpRecord('bankAccounts', newBank, actorEmail, cloudMode);
                  setNewBank(null);
                } catch (err: any) {
                  setErrorMsg(err?.message || 'Banka / kasa hesabı kaydedilemedi.');
                }
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-md w-full p-6 space-y-3 text-xs"
            >
              <h3 className="text-base font-black text-white">Banka / Kasa Hesabı</h3>
              <input required placeholder="Hesap Adı (örn. Ziraat Ana Hesap) *" value={newBank.name} onChange={(e) => setNewBank({ ...newBank, name: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Banka Adı" value={newBank.bankName} onChange={(e) => setNewBank({ ...newBank, bankName: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <select value={newBank.accountType} onChange={(e) => setNewBank({ ...newBank, accountType: e.target.value as BankAccount['accountType'] })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  <option value="Banka TL">Banka TL</option>
                  <option value="Banka Döviz">Banka Döviz</option>
                  <option value="TL Kasa">TL Kasa</option>
                  <option value="Kredi Kartı">Kredi Kartı</option>
                </select>
              </div>
              <input placeholder="IBAN" value={newBank.iban} onChange={(e) => setNewBank({ ...newBank, iban: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <label className="block">
                <span>Bakiye (TL)</span>
                <input type="number" step="0.01" value={fromKurus(newBank.balanceKurus)} onChange={(e) => setNewBank({ ...newBank, balanceKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setNewBank(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 font-black">Kaydet</button>
              </div>
            </form>
          </div>
        )}

        {newPay && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErrorMsg('');
                try {
                  const bank = bankAccounts.find((b) => b.id === newPay.bankAccountId);
                  const res = await postPaymentWithApproval(
                    { ...newPay, bankAccountName: bank?.name || 'Merkez Kasa' },
                    currentUser,
                    settings,
                    cloudMode
                  );
                  if (res.queuedForApproval) {
                    setPayNotice(`Tutar yetki limitinizi aştığı için onay kuyruğuna alındı (${res.requiredRoleLabel}).`);
                  }
                  setNewPay(null);
                } catch (err: any) {
                  setErrorMsg(err?.message || 'Ödeme / tahsilat kaydedilemedi.');
                }
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-lg w-full p-6 space-y-3 text-xs"
            >
              <h3 className="text-base font-black text-white">Ödeme / Tahsilat Kaydı</h3>
              <div className="grid grid-cols-2 gap-3">
                <select value={newPay.direction} onChange={(e) => setNewPay({ ...newPay, direction: e.target.value as 'Tahsilat' | 'Ödeme', invoiceId: undefined, hakedisId: undefined, subcontractorId: undefined })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  <option value="Ödeme">Ödeme (Çıkış)</option>
                  <option value="Tahsilat">Tahsilat (Giriş)</option>
                </select>
                <select value={newPay.bankAccountId} onChange={(e) => setNewPay({ ...newPay, bankAccountId: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  <option value="">Banka / Kasa Seçin...</option>
                  {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              {newPay.direction === 'Ödeme' ? (
                <div className="grid sm:grid-cols-2 gap-2">
                  <select
                    value={newPay.invoiceId || ''}
                    onChange={(e) => {
                      const inv = invoices.find((i) => i.id === e.target.value);
                      setNewPay({
                        ...newPay,
                        targetType: inv ? 'supplier' : newPay.targetType,
                        targetId: inv?.supplierId || newPay.targetId,
                        invoiceId: inv?.id || undefined,
                        subcontractorId: undefined,
                        targetName: inv ? inv.supplierName : newPay.targetName,
                        projectId: inv?.projectId || newPay.projectId,
                        amountKurus: inv ? inv.remainingDebtKurus : newPay.amountKurus,
                      });
                    }}
                    className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                  >
                    <option value="">Fatura Bağla (Opsiyonel)</option>
                    {invoices.filter((i) => !i.reversalOfId && i.remainingDebtKurus > 0).map((i) => (
                      <option key={i.id} value={i.id}>
                        #{i.invoiceNo} — {i.supplierName} ({formatKurusTRY(i.remainingDebtKurus)})
                      </option>
                    ))}
                  </select>
                  <select
                    value={newPay.subcontractorId || ''}
                    onChange={(e) => {
                      const sub = subcontractors.find((s) => s.id === e.target.value);
                      setNewPay({
                        ...newPay,
                        targetType: sub ? 'subcontractor' : newPay.targetType,
                        targetId: sub?.id || newPay.targetId,
                        subcontractorId: sub?.id || undefined,
                        invoiceId: undefined,
                        targetName: sub ? sub.firmName : newPay.targetName,
                        projectId: sub?.projectId || newPay.projectId,
                        amountKurus: sub ? sub.remainingDebtKurus : newPay.amountKurus,
                      });
                    }}
                    className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                  >
                    <option value="">Taşeron Bağla (Opsiyonel)</option>
                    {subcontractors.filter((s) => s.remainingDebtKurus > 0).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firmName} ({formatKurusTRY(s.remainingDebtKurus)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <select
                  value={newPay.hakedisId || ''}
                  onChange={(e) => {
                    const hk = progressPayments.find((h) => h.id === e.target.value);
                    const prj = projects.find((p) => p.id === hk?.projectId);
                    setNewPay({
                      ...newPay,
                      targetType: hk ? 'client_hakedis' : 'other',
                      targetId: hk?.projectId || '',
                      hakedisId: hk?.id || undefined,
                      targetName: hk ? `${prj?.shortName || 'Kurum'} Hakediş #${hk.hakedisNo}` : newPay.targetName,
                      projectId: hk?.projectId || newPay.projectId,
                      method: hk ? 'Kamu Hakediş' : newPay.method,
                      amountKurus: hk ? hk.remainingReceivableKurus : newPay.amountKurus,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                >
                  <option value="">Hakediş Bağla (Opsiyonel)</option>
                  {progressPayments.filter((h) => h.remainingReceivableKurus > 0).map((h) => (
                    <option key={h.id} value={h.id}>
                      Hakediş #{h.hakedisNo} ({projects.find((p) => p.id === h.projectId)?.shortName}) — Kalan: {formatKurusTRY(h.remainingReceivableKurus)}
                    </option>
                  ))}
                </select>
              )}
              <input required placeholder="Firma / Kurum / Personel *" value={newPay.targetName} onChange={(e) => setNewPay({ ...newPay, targetName: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <div className="grid grid-cols-3 gap-2">
                <select value={newPay.projectId} onChange={(e) => setNewPay({ ...newPay, projectId: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  <option value="">Şirket Geneli</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
                </select>
                <select value={newPay.method} onChange={(e) => setNewPay({ ...newPay, method: e.target.value as PaymentRecord['method'] })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  <option value="Havale / EFT">Havale / EFT</option>
                  <option value="Nakit">Nakit</option>
                  <option value="Kredi Kartı">Kredi Kartı</option>
                  <option value="Çek">Çek</option>
                  <option value="Senet">Senet</option>
                  <option value="Kamu Hakediş">Kamu Hakediş</option>
                </select>
                <input type="date" value={newPay.date} onChange={(e) => setNewPay({ ...newPay, date: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </div>
              <label className="block">
                <span>Tutar (TL) *</span>
                <input required type="number" step="0.01" value={fromKurus(newPay.amountKurus)} onChange={(e) => setNewPay({ ...newPay, amountKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setNewPay(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 font-black">Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'checks') {
    return (
      <div className="space-y-6">
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-white">Çek ve Senet Portföyü</h2>
            <p className="text-xs text-slate-400">Alınan/verilen çek ve senetlerin vade takibi</p>
          </div>
          {canMutate && (
            <button
              type="button"
              onClick={() =>
                setNewCheck({
                  id: `chk-${Date.now()}`,
                  organizationId: ERP_ORG_ID,
                  kind: 'Çek',
                  direction: 'Verilen',
                  serialNo: '',
                  bankName: '',
                  counterparty: '',
                  projectId: projects[0]?.id || '',
                  amountKurus: 0,
                  issueDate: new Date().toISOString().slice(0, 10),
                  dueDate: '',
                  status: 'Portföyde',
                  createdBy: actorEmail,
                  createdAt: new Date().toISOString(),
                  updatedBy: actorEmail,
                  updatedAt: new Date().toISOString(),
                })
              }
              className="px-4 py-2 rounded-xl bg-blue-600 text-xs font-black"
            >
              + Çek / Senet Ekle
            </button>
          )}
        </div>
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#070d1e] border-b border-slate-700 text-slate-400 uppercase">
                <th className="py-3 px-4">Tür / Seri No</th>
                <th className="py-3 px-4">Taraf</th>
                <th className="py-3 px-4">Vade</th>
                <th className="py-3 px-4">Tutar</th>
                <th className="py-3 px-4">Durum</th>
                <th className="py-3 px-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {checks.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 px-4 font-bold text-white">{c.direction} {c.kind} — {c.serialNo}</td>
                  <td className="py-3 px-4">{c.counterparty} {c.bankName ? `(${c.bankName})` : ''}</td>
                  <td className="py-3 px-4 text-amber-300">{c.dueDate || '—'}</td>
                  <td className="py-3 px-4 font-black">{formatKurusTRY(c.amountKurus)}</td>
                  <td className="py-3 px-4">{c.status}</td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {canMutate && (
                      <>
                        <button type="button" onClick={() => setNewCheck(c)} className="text-blue-400 font-bold">Düzenle</button>
                        <button
                          type="button"
                          onClick={() => deleteErpRecord('checks', c.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Silinemedi.'))}
                          className="text-red-400 font-bold"
                        >
                          Sil
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {checks.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">Kayıtlı çek veya senet bulunmuyor.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {newCheck && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErrorMsg('');
                try {
                  await saveErpRecord('checks', newCheck, actorEmail, cloudMode);
                  setNewCheck(null);
                } catch (err: any) {
                  setErrorMsg(err?.message || 'Çek / senet kaydedilemedi.');
                }
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-md w-full p-6 space-y-3 text-xs"
            >
              <h3 className="text-base font-black text-white">Çek / Senet Kaydı</h3>
              <div className="grid grid-cols-3 gap-2">
                <select value={newCheck.kind} onChange={(e) => setNewCheck({ ...newCheck, kind: e.target.value as 'Çek' | 'Senet' })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  <option value="Çek">Çek</option>
                  <option value="Senet">Senet</option>
                </select>
                <select value={newCheck.direction} onChange={(e) => setNewCheck({ ...newCheck, direction: e.target.value as 'Alınan' | 'Verilen' })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  <option value="Verilen">Verilen</option>
                  <option value="Alınan">Alınan</option>
                </select>
                <select value={newCheck.status} onChange={(e) => setNewCheck({ ...newCheck, status: e.target.value as CheckNoteRecord['status'] })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  <option value="Portföyde">Portföyde</option>
                  <option value="Tahsil Edildi">Tahsil Edildi</option>
                  <option value="Ödendi">Ödendi</option>
                  <option value="Karşılıksız / İade">Karşılıksız / İade</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input required placeholder="Seri No *" value={newCheck.serialNo} onChange={(e) => setNewCheck({ ...newCheck, serialNo: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <input placeholder="Banka Adı" value={newCheck.bankName} onChange={(e) => setNewCheck({ ...newCheck, bankName: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </div>
              <input required placeholder="Cari / Firma *" value={newCheck.counterparty} onChange={(e) => setNewCheck({ ...newCheck, counterparty: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span>Vade Tarihi</span>
                  <input type="date" value={newCheck.dueDate} onChange={(e) => setNewCheck({ ...newCheck, dueDate: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Tutar (TL)</span>
                  <input type="number" step="0.01" placeholder="Tutar (TL)" value={fromKurus(newCheck.amountKurus)} onChange={(e) => setNewCheck({ ...newCheck, amountKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setNewCheck(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 font-black">Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // MODE === 'guarantees'
  return (
    <div className="space-y-6">
      <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-white">Teminat Mektupları Yönetimi (30/15/7/1 Gün Uyarıları)</h2>
          <p className="text-xs text-slate-400">
            Mektup anapara tutarı gider yazılmaz; yalnızca banka komisyon giderleri proje finansman maliyetine işlenir
          </p>
        </div>
        {canMutate && (
          <button
            type="button"
            onClick={() =>
              setNewGuar({
                id: `guar-${Date.now()}`,
                organizationId: ERP_ORG_ID,
                projectId: projects[0]?.id || '',
                type: 'Kesin Teminat',
                bankName: '',
                letterNo: '',
                principalAmountKurus: 0,
                commissionRatePct: 0,
                commissionExpenseKurus: 0,
                startDate: new Date().toISOString().slice(0, 10),
                endDate: '',
                returned: false,
                notes: '',
                createdBy: actorEmail,
                createdAt: new Date().toISOString(),
                updatedBy: actorEmail,
                updatedAt: new Date().toISOString(),
              })
            }
            className="px-4 py-2 rounded-xl bg-blue-600 text-xs font-black"
          >
            + Teminat Mektubu Ekle
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4 text-xs">
        {guarantees.map((g) => (
          <div key={g.id} className="bg-[#0b1329] border border-slate-700 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between">
              <span className="font-black text-white">{g.type} — #{g.letterNo}</span>
              <span className={g.returned ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
                {g.returned ? 'İade Edildi' : `Bitiş: ${g.endDate || 'Süresiz'}`}
              </span>
            </div>
            <div className="text-slate-400">{g.bankName} • {projects.find((p) => p.id === g.projectId)?.shortName || '—'}</div>
            <div className="flex justify-between pt-2 border-t border-slate-800">
              <span>Ana Para (Limit): <strong>{formatKurusTRY(g.principalAmountKurus)}</strong></span>
              <span className="text-rose-400">Komisyon Gideri: <strong>{formatKurusTRY(g.commissionExpenseKurus)}</strong></span>
            </div>
            {canMutate && (
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <div className="flex gap-3">
                  <button type="button" onClick={() => setNewGuar(g)} className="text-blue-400 font-bold">Düzenle</button>
                  <button
                    type="button"
                    onClick={() => saveErpRecord('guarantees', { ...g, returned: !g.returned }, actorEmail, cloudMode)}
                    className="text-emerald-400 font-bold"
                  >
                    {g.returned ? 'Tekrar Aktifleştir' : 'İade Edildi İşaretle'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => deleteErpRecord('guarantees', g.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Silinemedi.'))}
                  className="text-red-400 font-bold"
                >
                  Sil
                </button>
              </div>
            )}
          </div>
        ))}
        {guarantees.length === 0 && (
          <div className="md:col-span-2 p-8 text-center text-slate-400 bg-[#0b1329] rounded-2xl border-2 border-slate-700">
            Kayıtlı teminat mektubu yok.
          </div>
        )}
      </div>

      {newGuar && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErrorMsg('');
              try {
                await saveErpRecord('guarantees', newGuar, actorEmail, cloudMode);
                setNewGuar(null);
              } catch (err: any) {
                setErrorMsg(err?.message || 'Teminat mektubu kaydedilemedi.');
              }
            }}
            className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-lg w-full p-6 space-y-3 text-xs"
          >
            <h3 className="text-base font-black text-white">Teminat Mektubu Kaydı</h3>
            <div className="grid grid-cols-2 gap-3">
              <select value={newGuar.type} onChange={(e) => setNewGuar({ ...newGuar, type: e.target.value as GuaranteeType })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                <option value="Geçici Teminat">Geçici Teminat</option>
                <option value="Kesin Teminat">Kesin Teminat</option>
                <option value="Ek Kesin Teminat">Ek Kesin Teminat</option>
                <option value="Avans Teminatı">Avans Teminatı</option>
              </select>
              <select value={newGuar.projectId} onChange={(e) => setNewGuar({ ...newGuar, projectId: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
              </select>
              <input required placeholder="Banka Adı *" value={newGuar.bankName} onChange={(e) => setNewGuar({ ...newGuar, bankName: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <input required placeholder="Mektup No *" value={newGuar.letterNo} onChange={(e) => setNewGuar({ ...newGuar, letterNo: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <label>
                <span>Teminat Tutarı (TL)</span>
                <input type="number" step="0.01" value={fromKurus(newGuar.principalAmountKurus)} onChange={(e) => setNewGuar({ ...newGuar, principalAmountKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label>
                <span>Komisyon Gideri (TL)</span>
                <input type="number" step="0.01" value={fromKurus(newGuar.commissionExpenseKurus)} onChange={(e) => setNewGuar({ ...newGuar, commissionExpenseKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label>
                <span>Başlangıç Tarihi</span>
                <input type="date" value={newGuar.startDate} onChange={(e) => setNewGuar({ ...newGuar, startDate: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label>
                <span>Bitiş / Vade Tarihi</span>
                <input type="date" value={newGuar.endDate} onChange={(e) => setNewGuar({ ...newGuar, endDate: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
            </div>
            <label className="flex items-center gap-2 font-bold">
              <input type="checkbox" checked={newGuar.returned} onChange={(e) => setNewGuar({ ...newGuar, returned: e.target.checked })} />
              <span>Kurum Tarafından İade Edildi</span>
            </label>
            <input placeholder="Notlar" value={newGuar.notes} onChange={(e) => setNewGuar({ ...newGuar, notes: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setNewGuar(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 font-black">Kaydet</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
