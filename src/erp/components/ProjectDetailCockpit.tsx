import React, { useEffect, useState } from 'react';
import { computeProjectFinancials, ErpDatasetSnapshot } from '../services/financeEngine';
import { deleteErpRecord, ERP_ORG_ID, saveErpRecord } from '../services/erpStore';
import { uploadToErpStorage, validateErpFile } from '../services/storageService';
import {
  DocumentVaultItem,
  EmployeeCard,
  ErpProject,
  GanttTask,
  InvoiceRecord,
  PaymentRecord,
  ProgressPayment,
  ProjectBudget,
  PurchaseOrder,
  SiteLogRecord,
  SubcontractorCard,
  WorkItem,
} from '../types/erp';
import { formatKurusTRY, toKurus } from '../utils/money';

interface ProjectDetailCockpitProps {
  project: ErpProject;
  dataset: ErpDatasetSnapshot & {
    workItems: WorkItem[];
    tasks: GanttTask[];
    siteLogs: SiteLogRecord[];
    documents: DocumentVaultItem[];
  };
  canSeeProfitability: boolean;
  actorEmail: string;
  cloudMode: boolean;
  onBack: () => void;
  onOpenInvoiceUpload: (projectId: string) => void;
}

type ProjectSubTab =
  | 'genel'
  | 'butce'
  | 'satin_alma'
  | 'faturalar'
  | 'irsaliyeler'
  | 'hakedisler'
  | 'taseronlar'
  | 'personeller'
  | 'odemeler'
  | 'is_kalemleri'
  | 'is_programi'
  | 'fotograflar'
  | 'sozlesmeler'
  | 'belgeler'
  | 'santiye_gunlugu'
  | 'karlilik';

const SUB_TABS: { id: ProjectSubTab; label: string }[] = [
  { id: 'genel', label: 'Genel Durum' },
  { id: 'butce', label: 'Bütçe ve Maliyet' },
  { id: 'satin_alma', label: 'Satın Alınan Ürünler' },
  { id: 'faturalar', label: 'Faturalar' },
  { id: 'irsaliyeler', label: 'İrsaliyeler' },
  { id: 'hakedisler', label: 'Hakedişler' },
  { id: 'taseronlar', label: 'Taşeronlar' },
  { id: 'personeller', label: 'Personeller' },
  { id: 'odemeler', label: 'Ödemeler' },
  { id: 'is_kalemleri', label: 'İş Kalemleri (Poz)' },
  { id: 'is_programi', label: 'İş Programı' },
  { id: 'fotograflar', label: 'Fotoğraflar' },
  { id: 'sozlesmeler', label: 'Sözleşmeler' },
  { id: 'belgeler', label: 'Belgeler' },
  { id: 'santiye_gunlugu', label: 'Şantiye Günlüğü' },
  { id: 'karlilik', label: 'Kârlılık Analizi' },
];

export const ProjectDetailCockpit: React.FC<ProjectDetailCockpitProps> = ({
  project,
  dataset,
  canSeeProfitability,
  actorEmail,
  cloudMode,
  onBack,
  onOpenInvoiceUpload,
}) => {
  const [subTab, setSubTab] = useState<ProjectSubTab>('genel');
  const fin = computeProjectFinancials(project, dataset);

  // Strictly isolate records belonging to THIS project only
  const projPurchases: PurchaseOrder[] = dataset.purchases.filter((x) => x.projectId === project.id);
  const projInvoices: InvoiceRecord[] = dataset.invoices.filter(
    (x) =>
      x.projectId === project.id ||
      x.allocations?.some((a) => a.targetType === 'project' && a.targetId === project.id)
  );
  const projWaybills = projInvoices.filter((i) => Boolean(i.waybillNo));
  const projHakedisler: ProgressPayment[] = dataset.progressPayments.filter(
    (x) => x.projectId === project.id
  );
  const projSubs: SubcontractorCard[] = dataset.subcontractors.filter(
    (x) => x.projectId === project.id
  );
  const projEmps: EmployeeCard[] = dataset.employees.filter((x) => x.projectId === project.id);
  const projPayments: PaymentRecord[] = dataset.payments.filter((x) => x.projectId === project.id);
  const projWorkItems: WorkItem[] = dataset.workItems.filter((x) => x.projectId === project.id);
  const projTasks: GanttTask[] = dataset.tasks.filter((x) => x.projectId === project.id);
  const projLogs: SiteLogRecord[] = dataset.siteLogs.filter((x) => x.projectId === project.id);
  const projDocs: DocumentVaultItem[] = dataset.documents.filter((x) => x.projectId === project.id);
  const projContracts = projDocs.filter((d) => d.category === 'Sözleşme');

  const existingBudget = dataset.budgets.find((b) => b.projectId === project.id);
  const [bdgForm, setBdgForm] = useState({
    constructionTl: String((existingBudget?.constructionKurus || 0) / 100),
    mechanicalTl: String((existingBudget?.mechanicalKurus || 0) / 100),
    electricalTl: String((existingBudget?.electricalKurus || 0) / 100),
    laborTl: String((existingBudget?.laborKurus || 0) / 100),
    subcontractorTl: String((existingBudget?.subcontractorKurus || 0) / 100),
    generalTl: String((existingBudget?.generalKurus || 0) / 100),
  });
  const [statusNotice, setStatusNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadingAsset, setUploadingAsset] = useState(false);

  useEffect(() => {
    setBdgForm({
      constructionTl: String((existingBudget?.constructionKurus || 0) / 100),
      mechanicalTl: String((existingBudget?.mechanicalKurus || 0) / 100),
      electricalTl: String((existingBudget?.electricalKurus || 0) / 100),
      laborTl: String((existingBudget?.laborKurus || 0) / 100),
      subcontractorTl: String((existingBudget?.subcontractorKurus || 0) / 100),
      generalTl: String((existingBudget?.generalKurus || 0) / 100),
    });
  }, [project.id, existingBudget]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const c = toKurus(bdgForm.constructionTl);
    const m = toKurus(bdgForm.mechanicalTl);
    const el = toKurus(bdgForm.electricalTl);
    const l = toKurus(bdgForm.laborTl);
    const s = toKurus(bdgForm.subcontractorTl);
    const g = toKurus(bdgForm.generalTl);
    const budgetDoc: ProjectBudget = {
      id: existingBudget?.id || `bdg-${project.id}`,
      organizationId: project.organizationId,
      projectId: project.id,
      constructionKurus: c,
      mechanicalKurus: m,
      electricalKurus: el,
      laborKurus: l,
      subcontractorKurus: s,
      generalKurus: g,
      totalBudgetKurus: c + m + el + l + s + g,
      notes: 'Proje hedef bütçesi',
      createdBy: existingBudget?.createdBy || actorEmail,
      createdAt: existingBudget?.createdAt || new Date().toISOString(),
      updatedBy: actorEmail,
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveErpRecord('budgets', budgetDoc, actorEmail, cloudMode, 'UPDATE', `${project.code} hedef bütçesi güncellendi`);
      setStatusNotice('Proje hedef bütçesi başarıyla kaydedildi.');
      setTimeout(() => setStatusNotice(''), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Bütçe kaydedilemedi.');
    }
  };

  const handleUploadProjectPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg('');
    setUploadingAsset(true);
    try {
      validateErpFile(file);
      const url = await uploadToErpStorage(file, `projects/${project.id}/${Date.now()}-${file.name}`, file.type);
      const nextPhotos = [...(project.sitePhotos || []), url];
      await saveErpRecord('projects', { ...project, sitePhotos: nextPhotos }, actorEmail, cloudMode, 'UPDATE', `${project.code} şantiye fotoğrafı eklendi`);
      setStatusNotice('Şantiye fotoğrafı eklendi.');
      setTimeout(() => setStatusNotice(''), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Fotoğraf yüklenemedi.');
    } finally {
      setUploadingAsset(false);
    }
  };

  const handleRemoveProjectPhoto = async (photoUrl: string) => {
    setErrorMsg('');
    try {
      const nextPhotos = (project.sitePhotos || []).filter((u) => u !== photoUrl);
      const nextCover = project.coverImage === photoUrl ? (nextPhotos[0] || '/images/insaat-taahhut.jpg') : project.coverImage;
      await saveErpRecord('projects', { ...project, coverImage: nextCover, sitePhotos: nextPhotos }, actorEmail, cloudMode);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Fotoğraf kaldırılamadı.');
    }
  };

  const handleUploadProjectDoc = async (
    e: React.ChangeEvent<HTMLInputElement>,
    category: DocumentVaultItem['category']
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg('');
    setUploadingAsset(true);
    try {
      validateErpFile(file);
      const url = await uploadToErpStorage(file, `documents/${project.id}/${Date.now()}-${file.name}`, file.type);
      const now = new Date().toISOString();
      const docItem: DocumentVaultItem = {
        id: `doc-${Date.now()}`,
        organizationId: ERP_ORG_ID,
        projectId: project.id,
        title: file.name,
        category,
        fileName: file.name,
        mimeType: file.type,
        url,
        version: 1,
        sizeBytes: file.size,
        createdBy: actorEmail,
        createdAt: now,
        updatedBy: actorEmail,
        updatedAt: now,
      };
      await saveErpRecord('documents', docItem, actorEmail, cloudMode, 'CREATE', `${project.code} belge yüklendi: ${file.name}`);
      setStatusNotice(`${category} belgesi yüklendi.`);
      setTimeout(() => setStatusNotice(''), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Belge yüklenemedi.');
    } finally {
      setUploadingAsset(false);
    }
  };

  const visibleTabs = canSeeProfitability
    ? SUB_TABS
    : SUB_TABS.filter((t) => t.id !== 'karlilik');

  return (
    <div className="space-y-6">
      {/* Project Header Banner */}
      <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <img
            src={project.coverImage}
            alt={project.shortName}
            className="w-20 h-20 rounded-xl object-cover border border-slate-600 shrink-0"
          />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="text-xs font-black text-blue-400 hover:text-blue-300"
              >
                &larr; Tüm Projeler
              </button>
              <span className="text-slate-600">|</span>
              <span className="text-xs font-mono font-black text-amber-400">{project.code}</span>
              {project.ikn && (
                <span className="text-xs font-mono text-slate-400">İKN: {project.ikn}</span>
              )}
              <span className="px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-500/50 text-blue-300 text-[11px] font-black">
                {project.status}
              </span>
            </div>
            <h2 className="text-xl font-black text-white">{project.title}</h2>
            <div className="text-xs text-slate-400">
              {project.contractingAuthority || project.employer} &bull; {project.location} &bull;
              Şantiye Şefi: {project.siteChief}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenInvoiceUpload(project.id)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black border border-blue-300 transition"
          >
            <i className="fa-solid fa-camera mr-1.5" />
            Bu Projeye Fatura Ekle
          </button>
        </div>
      </div>

      {/* 16 Project Sub-Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-[#070d1e] p-2 rounded-2xl border border-slate-800">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
              subTab === t.id
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500 text-xs font-bold text-red-200">
          {errorMsg}
        </div>
      )}
      {statusNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500 text-xs font-bold text-emerald-200">
          {statusNotice}
        </div>
      )}
      <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-6">
        {subTab === 'genel' && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#070d1e] border border-slate-700">
                <div className="text-xs text-slate-400">Güncel Sözleşme Değeri</div>
                <div className="text-lg font-black text-white mt-1">
                  {formatKurusTRY(fin.currentContractValueKurus)}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#070d1e] border border-slate-700">
                <div className="text-xs text-slate-400">Gerçekleşen Toplam Maliyet</div>
                <div className="text-lg font-black text-rose-400 mt-1">
                  {formatKurusTRY(fin.totalActualCostKurus)}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#070d1e] border border-slate-700">
                <div className="text-xs text-slate-400">Düzenlenen / Tahsil Hakediş</div>
                <div className="text-lg font-black text-emerald-400 mt-1">
                  {formatKurusTRY(fin.billedProgressKurus)}
                </div>
                <div className="text-[11px] text-slate-400">
                  Tahsil: {formatKurusTRY(fin.collectedProgressKurus)}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#070d1e] border border-slate-700">
                <div className="text-xs text-slate-400">Fiziki / Bütçe İlerlemesi</div>
                <div className="text-lg font-black text-blue-300 mt-1">
                  %{project.physicalProgressPct} / %{fin.budgetBurnPct}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-[#070d1e] border border-slate-800 space-y-2">
                <div className="font-black text-blue-300 uppercase">İhale ve Sözleşme Künyesi</div>
                <div>İKN: <strong>{project.ikn || '—'}</strong></div>
                <div>İdare / İşveren: <strong>{project.contractingAuthority || project.employer || '—'}</strong></div>
                <div>Sözleşme Tarihi: <strong>{project.contractDate || '—'}</strong> | Yer Teslim: <strong>{project.siteDeliveryDate || '—'}</strong></div>
                <div>Başlama / Bitiş: <strong>{project.startDate || '—'} / {project.endDate || '—'}</strong> (İlave: {project.extensionDays} gün)</div>
                <div>Fiyat Farkı: <strong>{project.hasPriceDifference ? 'Var' : 'Yok'}</strong> | KDV: <strong>%{project.vatRate}</strong></div>
              </div>
              <div className="p-4 rounded-xl bg-[#070d1e] border border-slate-800 space-y-2">
                <div className="font-black text-amber-300 uppercase">Saha &amp; Teminat Özeti</div>
                <div>Adres: <strong>{project.siteAddress}</strong></div>
                <div>Proje Sorumlusu: <strong>{project.projectManager}</strong></div>
                <div>Şantiye Şefi: <strong>{project.siteChief}</strong></div>
                <div>Kesin Teminat: <strong>{formatKurusTRY(project.performanceBondKurus)}</strong></div>
                <div>Avans: <strong>{formatKurusTRY(project.advanceAmountKurus)}</strong></div>
              </div>
            </div>
          </div>
        )}

        {subTab === 'butce' && (
          <form onSubmit={handleSaveBudget} className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-base">Hedef Bütçe ve Maliyet Kontrolü</h3>
                <p className="text-xs text-slate-400">
                  Mevcut Bütçe Tüketimi: <strong>%{fin.budgetBurnPct}</strong> ({fin.budgetAlertLevel.toUpperCase()})
                </p>
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black text-white"
              >
                Bütçeyi Kaydet
              </button>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 text-xs">
              {[
                { key: 'constructionTl', label: 'İnşaat İşleri Bütçesi (TL)' },
                { key: 'mechanicalTl', label: 'Mekanik / Yangın Bütçesi (TL)' },
                { key: 'electricalTl', label: 'Elektrik İşleri Bütçesi (TL)' },
                { key: 'laborTl', label: 'İşçilik / Personel Bütçesi (TL)' },
                { key: 'subcontractorTl', label: 'Taşeron Bütçesi (TL)' },
                { key: 'generalTl', label: 'Şantiye Genel Gider Bütçesi (TL)' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block font-bold text-slate-300 mb-1">{f.label}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={(bdgForm as any)[f.key]}
                    onChange={(e) => setBdgForm({ ...bdgForm, [f.key]: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
                  />
                </div>
              ))}
            </div>
          </form>
        )}

        {subTab === 'satin_alma' && (
          <div className="space-y-3">
            <h3 className="font-black text-base">Bu Projeye Alınan Malzemeler ({projPurchases.length})</h3>
            {projPurchases.length === 0 ? (
              <div className="text-xs text-slate-400 p-6 bg-[#070d1e] rounded-xl text-center">
                Bu proje için henüz satın alma kaydı yok.
              </div>
            ) : (
              <div className="divide-y divide-slate-800 text-xs">
                {projPurchases.map((p) => (
                  <div key={p.id} className="py-3 flex justify-between">
                    <div>
                      <div className="font-bold text-white">{p.materialName} ({p.quantity} {p.unit})</div>
                      <div className="text-slate-400">{p.supplierName} • Poz: {p.pozNo || '—'}</div>
                    </div>
                    <div className="text-right font-black text-emerald-400">
                      {formatKurusTRY(p.grossTotalKurus)}
                      <div className="text-[10px] text-slate-400">{p.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {subTab === 'faturalar' && (
          <div className="space-y-3">
            <h3 className="font-black text-base">Bu Projeye Bağlı / Dağıtılan Faturalar ({projInvoices.length})</h3>
            {projInvoices.length === 0 ? (
              <div className="text-xs text-slate-400 p-6 bg-[#070d1e] rounded-xl text-center">
                Bu projeye ait fatura henüz bulunmuyor.
              </div>
            ) : (
              <div className="divide-y divide-slate-800 text-xs">
                {projInvoices.map((inv) => (
                  <div key={inv.id} className="py-3 flex justify-between">
                    <div>
                      <div className="font-bold text-white">#{inv.invoiceNo} — {inv.supplierName}</div>
                      <div className="text-slate-400">{inv.issueDate} • Vade: {inv.dueDate || '—'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-white">{formatKurusTRY(inv.grandTotalKurus)}</div>
                      <div className="text-rose-400 text-[11px]">Kalan: {formatKurusTRY(inv.remainingDebtKurus)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {subTab === 'irsaliyeler' && (
          <div className="space-y-3 text-xs">
            <h3 className="font-black text-base">İrsaliyeler ({projWaybills.length})</h3>
            {projWaybills.length === 0 ? (
              <div className="text-slate-400 p-6 bg-[#070d1e] rounded-xl text-center">Kayıtlı irsaliye bulunmuyor.</div>
            ) : (
              projWaybills.map((w) => (
                <div key={w.id} className="p-3 bg-[#070d1e] rounded-xl flex justify-between">
                  <span>İrsaliye #{w.waybillNo} — {w.supplierName}</span>
                  <span>Fatura #{w.invoiceNo}</span>
                </div>
              ))
            )}
          </div>
        )}

        {subTab === 'hakedisler' && (
          <div className="space-y-3 text-xs">
            <h3 className="font-black text-base">Proje Hakedişleri ({projHakedisler.length})</h3>
            {projHakedisler.length === 0 ? (
              <div className="text-slate-400 p-6 bg-[#070d1e] rounded-xl text-center">Hakediş kaydı bulunmuyor.</div>
            ) : (
              projHakedisler.map((h) => (
                <div key={h.id} className="p-3 bg-[#070d1e] rounded-xl flex justify-between">
                  <span>Hakediş #{h.hakedisNo} ({h.period}) — {h.status}</span>
                  <span className="font-black text-emerald-400">Net: {formatKurusTRY(h.netPayableKurus)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {subTab === 'taseronlar' && (
          <div className="space-y-3 text-xs">
            <h3 className="font-black text-base">Taşeronlar ({projSubs.length})</h3>
            {projSubs.length === 0 ? (
              <div className="text-slate-400 p-6 bg-[#070d1e] rounded-xl text-center">Bu projeye atanmış taşeron yok.</div>
            ) : (
              projSubs.map((s) => (
                <div key={s.id} className="p-3 bg-[#070d1e] rounded-xl flex justify-between">
                  <span>{s.firmName} ({s.scopeOfWork})</span>
                  <span className="font-black text-rose-400">Kalan Borç: {formatKurusTRY(s.remainingDebtKurus)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {subTab === 'personeller' && (
          <div className="space-y-3 text-xs">
            <h3 className="font-black text-base">Proje Personeli ({projEmps.length})</h3>
            {projEmps.length === 0 ? (
              <div className="text-slate-400 p-6 bg-[#070d1e] rounded-xl text-center">Bu şantiyeye atanmış personel yok.</div>
            ) : (
              projEmps.map((e) => (
                <div key={e.id} className="p-3 bg-[#070d1e] rounded-xl flex justify-between">
                  <span>{e.fullName} — {e.profession}</span>
                  <span>Günlük: {formatKurusTRY(e.dailyWageKurus)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {subTab === 'odemeler' && (
          <div className="space-y-3 text-xs">
            <h3 className="font-black text-base">Ödeme ve Tahsilatlar ({projPayments.length})</h3>
            {projPayments.length === 0 ? (
              <div className="text-slate-400 p-6 bg-[#070d1e] rounded-xl text-center">Bu proje için henüz ödeme/tahsilat yok.</div>
            ) : (
              projPayments.map((p) => (
                <div key={p.id} className="p-3 bg-[#070d1e] rounded-xl flex justify-between">
                  <span>{p.date} • {p.targetName} ({p.method})</span>
                  <span className={p.direction === 'Tahsilat' ? 'text-emerald-400 font-black' : 'text-rose-400 font-black'}>
                    {p.direction === 'Tahsilat' ? '+' : '-'}{formatKurusTRY(p.amountKurus)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {subTab === 'is_kalemleri' && (
          <div className="space-y-3 text-xs">
            <h3 className="font-black text-base">İş Kalemleri &amp; Pozlar ({projWorkItems.length})</h3>
            {projWorkItems.length === 0 ? (
              <div className="text-slate-400 p-6 bg-[#070d1e] rounded-xl text-center">Tanımlı poz/metraj kalemi yok.</div>
            ) : (
              projWorkItems.map((w) => (
                <div key={w.id} className="p-3 bg-[#070d1e] rounded-xl flex justify-between">
                  <span><strong>{w.pozNo}</strong> ({w.source}) — {w.description}</span>
                  <span>{w.actualQty}/{w.contractQty} {w.unit}</span>
                </div>
              ))
            )}
          </div>
        )}

        {subTab === 'is_programi' && (
          <div className="space-y-3 text-xs">
            <h3 className="font-black text-base">İş Programı Faaliyetleri ({projTasks.length})</h3>
            {projTasks.length === 0 ? (
              <div className="text-slate-400 p-6 bg-[#070d1e] rounded-xl text-center">Planlanmış iş programı faaliyeti yok.</div>
            ) : (
              projTasks.map((t) => (
                <div key={t.id} className="p-3 bg-[#070d1e] rounded-xl flex justify-between">
                  <span>{t.name} ({t.startDate} &rarr; {t.endDate})</span>
                  <span>Plan %{t.plannedPct} / Gerçek %{t.actualPct}</span>
                </div>
              ))
            )}
          </div>
        )}

        {subTab === 'fotograflar' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-black text-base text-white">Proje Kapak &amp; Şantiye Fotoğrafları</h3>
              <label className="cursor-pointer px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black">
                {uploadingAsset ? 'Yükleniyor...' : '+ Şantiye Fotoğrafı Ekle'}
                <input type="file" accept="image/*" className="hidden" onChange={handleUploadProjectPhoto} />
              </label>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {Array.from(new Set([project.coverImage, ...(project.sitePhotos || [])].filter(Boolean))).map((img, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden border border-slate-700">
                  <img
                    src={img}
                    alt={`${project.shortName} ${i + 1}`}
                    className="h-44 w-full object-cover"
                  />
                  <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => saveErpRecord('projects', { ...project, coverImage: img }, actorEmail, cloudMode)}
                      className="px-2.5 py-1 rounded-lg bg-slate-950/85 text-white text-[10px] font-bold"
                    >
                      {project.coverImage === img ? 'Kapak Görseli' : 'Kapak Yap'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveProjectPhoto(img)}
                      className="px-2.5 py-1 rounded-lg bg-red-600/90 text-white text-[10px] font-bold"
                    >
                      Kaldır
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {subTab === 'sozlesmeler' && (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-black text-base text-white">Sözleşmeler ({projContracts.length})</h3>
              <label className="cursor-pointer px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black">
                {uploadingAsset ? 'Yükleniyor...' : '+ Sözleşme Yükle'}
                <input type="file" className="hidden" onChange={(e) => handleUploadProjectDoc(e, 'Sözleşme')} />
              </label>
            </div>
            {projContracts.length === 0 ? (
              <div className="text-slate-400 p-6 bg-[#070d1e] rounded-xl text-center">
                Henüz bu projeye ait sözleşme dosyası yüklenmedi.
              </div>
            ) : (
              projContracts.map((d) => (
                <div key={d.id} className="p-3 bg-[#070d1e] rounded-xl flex justify-between items-center gap-3">
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-300 font-bold hover:underline truncate">
                    {d.title} (v{d.version})
                  </a>
                  <button
                    type="button"
                    onClick={() => deleteErpRecord('documents', d.id, actorEmail, cloudMode)}
                    className="text-red-400 hover:text-red-300 font-bold shrink-0"
                  >
                    Sil
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {subTab === 'belgeler' && (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-black text-base text-white">Proje Belgeleri ({projDocs.length})</h3>
              <label className="cursor-pointer px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black">
                {uploadingAsset ? 'Yükleniyor...' : '+ Belge Yükle'}
                <input type="file" className="hidden" onChange={(e) => handleUploadProjectDoc(e, 'Diğer')} />
              </label>
            </div>
            {projDocs.length === 0 ? (
              <div className="text-slate-400 p-6 bg-[#070d1e] rounded-xl text-center">Bu projeye yüklenmiş belge yok.</div>
            ) : (
              projDocs.map((d) => (
                <div key={d.id} className="p-3 bg-[#070d1e] rounded-xl flex justify-between items-center gap-3">
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-300 font-bold hover:underline truncate">
                    [{d.category}] {d.title}
                  </a>
                  <button
                    type="button"
                    onClick={() => deleteErpRecord('documents', d.id, actorEmail, cloudMode)}
                    className="text-red-400 hover:text-red-300 font-bold shrink-0"
                  >
                    Sil
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {subTab === 'santiye_gunlugu' && (
          <div className="space-y-3 text-xs">
            <h3 className="font-black text-base">Şantiye Günlükleri ({projLogs.length})</h3>
            {projLogs.length === 0 ? (
              <div className="text-slate-400 p-6 bg-[#070d1e] rounded-xl text-center">Günlük rapor bulunmuyor.</div>
            ) : (
              projLogs.map((l) => (
                <div key={l.id} className="p-3 bg-[#070d1e] rounded-xl space-y-1">
                  <div className="font-black text-white">{l.date} • {l.weather} • {l.workerCount} Personel</div>
                  <div className="text-slate-300">{l.worksDone}</div>
                </div>
              ))
            )}
          </div>
        )}

        {subTab === 'karlilik' && canSeeProfitability && (
          <div className="space-y-4">
            <h3 className="font-black text-base">Proje Kârlılık Analizi (Otomatik Hesaplama)</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {[
                ['Güncel Sözleşme Değeri', formatKurusTRY(fin.currentContractValueKurus), 'text-white'],
                ['Malzeme Maliyeti', formatKurusTRY(fin.materialCostKurus), 'text-slate-200'],
                ['İşçilik Maliyeti', formatKurusTRY(fin.laborCostKurus), 'text-slate-200'],
                ['Taşeron Maliyetleri', formatKurusTRY(fin.subcontractorCostKurus), 'text-slate-200'],
                ['Makine & Nakliye Maliyeti', formatKurusTRY(fin.machineCostKurus + fin.transportCostKurus), 'text-slate-200'],
                ['Şantiye + Genel + Finansman', formatKurusTRY(fin.siteOverheadKurus + fin.allocatedCompanyOverheadKurus + fin.financingCostKurus), 'text-slate-200'],
                ['İndirilebilir KDV (Maliyetten Ayrı)', formatKurusTRY(fin.deductibleVatKurus), 'text-sky-400'],
                ['Toplam Gerçekleşen Maliyet', formatKurusTRY(fin.totalActualCostKurus), 'text-rose-400'],
                ['Tahmini Bitiş Maliyeti', formatKurusTRY(fin.estTotalCostAtCompletionKurus), 'text-amber-300'],
                ['Dönemsel Performans (Hakediş - Maliyet)', formatKurusTRY(fin.periodRealizedPerformanceKurus), fin.periodRealizedPerformanceKurus >= 0 ? 'text-emerald-400' : 'text-rose-400'],
                ['Beklenen Nihai Kâr', formatKurusTRY(fin.expectedFinalProfitKurus), fin.expectedFinalProfitKurus >= 0 ? 'text-emerald-400' : 'text-rose-400'],
                ['Beklenen Kâr Marjı', `%${fin.expectedProfitMarginPct}`, 'text-blue-300'],
              ].map(([lbl, val, cls]) => (
                <div key={lbl} className="p-4 rounded-xl bg-[#070d1e] border border-slate-800">
                  <div className="text-slate-400">{lbl}</div>
                  <div className={`text-base font-black mt-1 ${cls}`}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
