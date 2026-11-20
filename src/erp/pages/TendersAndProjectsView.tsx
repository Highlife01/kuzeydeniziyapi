import React, { useEffect, useState } from 'react';
import { ProjectDetailCockpit } from '../components/ProjectDetailCockpit';
import {
  convertTenderToProject,
  deleteErpRecord,
  ERP_ORG_ID,
  saveErpRecord,
} from '../services/erpStore';
import { computeProjectFinancials, ErpDatasetSnapshot } from '../services/financeEngine';
import { uploadToErpStorage, validateErpFile } from '../services/storageService';
import {
  DocumentVaultItem,
  ErpProject,
  ErpProjectStatus,
  GanttTask,
  PozSource,
  SiteLogRecord,
  TenderRecord,
  TenderResult,
  TenderType,
  WorkItem,
} from '../types/erp';
import { formatKurusTRY, fromKurus, toKurus } from '../utils/money';

interface TendersAndProjectsViewProps {
  mode: 'projects' | 'tenders';
  dataset: ErpDatasetSnapshot & {
    tenders: TenderRecord[];
    workItems: WorkItem[];
    tasks: GanttTask[];
    siteLogs: SiteLogRecord[];
    documents: DocumentVaultItem[];
  };
  selectedProject: ErpProject | null;
  onSelectProject: (p: ErpProject | null) => void;
  canSeeProfitability: boolean;
  canMutate: boolean;
  actorEmail: string;
  cloudMode: boolean;
  onOpenInvoiceUpload: (projectId: string) => void;
}

const PROJECT_STATUSES: ErpProjectStatus[] = [
  'Hazırlanıyor',
  'İhale Aşamasında',
  'Kazanıldı',
  'Devam Ediyor',
  'Askıda',
  'Geçici Kabul',
  'Kesin Kabul',
  'Tamamlandı',
  'Tasfiye Edildi',
];

export const TendersAndProjectsView: React.FC<TendersAndProjectsViewProps> = ({
  mode,
  dataset,
  selectedProject,
  onSelectProject,
  canSeeProfitability,
  canMutate,
  actorEmail,
  cloudMode,
  onOpenInvoiceUpload,
}) => {
  const [editingProj, setEditingProj] = useState<ErpProject | null>(null);
  const [editingTender, setEditingTender] = useState<TenderRecord | null>(null);
  const [editingPoz, setEditingPoz] = useState<WorkItem | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [pozProjectFilter, setPozProjectFilter] = useState(dataset.projects[0]?.id || '');
  const [newPoz, setNewPoz] = useState({
    parentGroup: 'İnşaat İmalatları',
    pozNo: '',
    source: 'ÇŞİDB' as PozSource,
    description: '',
    unit: 'm²',
    contractQty: '1',
    unitPriceTl: '0',
    pursantajPct: '0',
    estMaterialTl: '0',
    estLaborTl: '0',
    estMachineTl: '0',
    actualQty: '0',
    actualCostTl: '0',
  });

  useEffect(() => {
    if (
      dataset.projects.length > 0 &&
      (!pozProjectFilter || !dataset.projects.some((p) => p.id === pozProjectFilter))
    ) {
      setPozProjectFilter(dataset.projects[0].id);
    }
  }, [dataset.projects, pozProjectFilter]);

  if (mode === 'projects' && selectedProject) {
    const liveProject =
      dataset.projects.find((p) => p.id === selectedProject.id) || selectedProject;
    return (
      <ProjectDetailCockpit
        project={liveProject}
        dataset={dataset}
        canSeeProfitability={canSeeProfitability}
        actorEmail={actorEmail}
        cloudMode={cloudMode}
        onBack={() => onSelectProject(null)}
        onOpenInvoiceUpload={onOpenInvoiceUpload}
      />
    );
  }

  const openNewProject = () => {
    const now = new Date().toISOString();
    setEditingProj({
      id: `prj-${Date.now()}`,
      organizationId: ERP_ORG_ID,
      code: `CB-${String(dataset.projects.length + 1).padStart(2, '0')}`,
      title: '',
      shortName: '',
      ikn: '',
      contractingAuthority: '',
      employer: '',
      province: 'Adana',
      district: 'Seyhan',
      location: 'Seyhan / ADANA',
      siteAddress: '',
      tenderDate: '',
      approxCostKurus: 0,
      bidAmountKurus: 0,
      discountRatePct: 0,
      contractAmountKurus: 0,
      approvedIncreaseKurus: 0,
      approvedDecreaseKurus: 0,
      priceDiffKurus: 0,
      estimatedRemainingCostKurus: 0,
      vatRate: 20,
      contractDate: now.slice(0, 10),
      siteDeliveryDate: '',
      startDate: now.slice(0, 10),
      endDate: '',
      extensionDays: 0,
      durationDays: 180,
      siteChief: '',
      projectManager: '',
      performanceBondKurus: 0,
      advanceAmountKurus: 0,
      hasPriceDifference: false,
      physicalProgressPct: 0,
      financialProgressPct: 0,
      status: 'Hazırlanıyor',
      category: 'kamu',
      description: '',
      coverImage: '/images/insaat-taahhut.jpg',
      sitePhotos: ['/images/insaat-taahhut.jpg'],
      publishedOnSite: false,
      warnThresholds: {
        infoPct: 70,
        warningPct: 85,
        criticalPct: 95,
        overrunPct: 100,
        burnDivergencePct: 15,
      },
      createdBy: actorEmail,
      createdAt: now,
      updatedBy: actorEmail,
      updatedAt: now,
    });
  };

  const openNewTender = () => {
    const now = new Date().toISOString();
    setEditingTender({
      id: `tnd-${Date.now()}`,
      organizationId: ERP_ORG_ID,
      ikn: '',
      title: '',
      authority: '',
      province: 'Adana',
      district: 'Seyhan',
      tenderType: 'Birim Fiyatlı',
      tenderDate: now.slice(0, 10),
      approxCostKurus: 0,
      estimatedCostKurus: 0,
      ourBidKurus: 0,
      discountRatePct: 0,
      boundaryValueKurus: 0,
      bidBondKurus: 0,
      validityDays: 90,
      objectionDate: '',
      contractDeadline: '',
      result: 'Hazırlanıyor',
      winnerFirm: '',
      winnerBidKurus: 0,
      competitors: [],
      documentUrls: [],
      notes: '',
      createdBy: actorEmail,
      createdAt: now,
      updatedBy: actorEmail,
      updatedAt: now,
    });
  };

  const handleSavePoz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pozProjectFilter || !newPoz.pozNo.trim()) return;
    const now = new Date().toISOString();
    const wi: WorkItem = {
      id: `wi-${Date.now()}`,
      organizationId: ERP_ORG_ID,
      projectId: pozProjectFilter,
      parentGroup: newPoz.parentGroup,
      pozNo: newPoz.pozNo.trim(),
      source: newPoz.source,
      description: newPoz.description.trim(),
      unit: newPoz.unit,
      contractQty: Number(newPoz.contractQty) || 0,
      contractUnitPriceKurus: toKurus(newPoz.unitPriceTl),
      pursantajPct: Number(newPoz.pursantajPct) || 0,
      estMaterialCostKurus: toKurus(newPoz.estMaterialTl),
      estLaborCostKurus: toKurus(newPoz.estLaborTl),
      estMachineCostKurus: toKurus(newPoz.estMachineTl),
      actualQty: Number(newPoz.actualQty) || 0,
      actualCostKurus: toKurus(newPoz.actualCostTl),
      createdBy: actorEmail,
      createdAt: now,
      updatedBy: actorEmail,
      updatedAt: now,
    };
    await saveErpRecord('workItems', wi, actorEmail, cloudMode, 'CREATE', `Poz eklendi: ${wi.pozNo}`);
    setNewPoz({ ...newPoz, pozNo: '', description: '' });
  };

  const handleImportPursantajCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pozProjectFilter) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/[;,]/).map((c) => c.replace(/^"|"$/g, '').trim());
      if (cols.length < 3) continue;
      const now = new Date().toISOString();
      const wi: WorkItem = {
        id: `wi-csv-${Date.now()}-${i}`,
        organizationId: ERP_ORG_ID,
        projectId: pozProjectFilter,
        parentGroup: cols[0] || 'İnşaat İmalatları',
        pozNo: cols[1] || `POZ-${i}`,
        source: 'ÇŞİDB',
        description: cols[2] || 'İçe Aktarılan İş Kalemi',
        unit: cols[3] || 'Adet',
        contractQty: parseFloat(cols[4] || '1') || 1,
        contractUnitPriceKurus: toKurus(cols[5] || '0'),
        pursantajPct: parseFloat(cols[6] || '0') || 0,
        estMaterialCostKurus: 0,
        estLaborCostKurus: 0,
        estMachineCostKurus: 0,
        actualQty: 0,
        actualCostKurus: 0,
        createdBy: actorEmail,
        createdAt: now,
        updatedBy: actorEmail,
        updatedAt: now,
      };
      await saveErpRecord('workItems', wi, actorEmail, cloudMode);
    }
  };

  if (mode === 'tenders') {
    return (
      <div className="space-y-6">
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Kamu İhale Takip ve Yaklaşık Maliyet Modülü</h2>
            <p className="text-xs text-slate-400">
              İKN, sınır değer, kırım oranı, rakip teklifler ve kazanılan ihaleyi tek tuşla projeye dönüştürme
            </p>
          </div>
          {canMutate && (
            <button
              type="button"
              onClick={openNewTender}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black border border-blue-300"
            >
              + Yeni İhale Kaydı
            </button>
          )}
        </div>

        <div className="grid xl:grid-cols-2 gap-5">
          {dataset.tenders.map((t) => {
            const estProfit = t.ourBidKurus - t.estimatedCostKurus;
            return (
              <div key={t.id} className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="text-xs font-mono font-black text-amber-400">
                      İKN: {t.ikn || 'Belirtilmedi'} &bull; {t.tenderType}
                    </div>
                    <h3 className="text-base font-black text-white mt-0.5">{t.title}</h3>
                    <div className="text-xs text-slate-400">{t.authority} • {t.district}/{t.province}</div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-blue-950 border border-blue-500/40 text-xs font-black text-blue-300">
                    {t.result}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-[#070d1e] text-xs">
                  <div>
                    <div className="text-slate-400">Yaklaşık Maliyet</div>
                    <div className="font-bold text-white">{formatKurusTRY(t.approxCostKurus)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Teklifimiz (Kırım %{t.discountRatePct})</div>
                    <div className="font-black text-blue-300">{formatKurusTRY(t.ourBidKurus)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Tahmini Kâr</div>
                    <div className={`font-black ${estProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatKurusTRY(estProfit)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Geçici Teminat</div>
                    <div className="font-bold text-amber-300">{formatKurusTRY(t.bidBondKurus)}</div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-slate-800 text-xs">
                  <span className="text-slate-400">İhale Tarihi: {t.tenderDate}</span>
                  <div className="flex flex-wrap gap-2">
                    {canMutate && !t.convertedProjectId && (
                      <button
                        type="button"
                        onClick={async () => {
                          setErrorMsg('');
                          try {
                            await convertTenderToProject(t, actorEmail, cloudMode);
                          } catch (err: any) {
                            setErrorMsg(err?.message || 'İhale projeye dönüştürülemedi.');
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black"
                      >
                        Tek Tuşla Projeye Dönüştür
                      </button>
                    )}
                    {t.convertedProjectId && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = dataset.projects.find((p) => p.id === t.convertedProjectId);
                          if (target) onSelectProject(target);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 font-bold"
                      >
                        Projeyi Aç
                      </button>
                    )}
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => setEditingTender(t)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold"
                      >
                        Düzenle
                      </button>
                    )}
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => deleteErpRecord('tenders', t.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Silinemedi.'))}
                        className="px-2.5 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-600 text-red-300 hover:text-white font-bold"
                      >
                        Sil
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {dataset.tenders.length === 0 && (
            <div className="xl:col-span-2 p-10 text-center text-sm text-slate-400 bg-[#0b1329] rounded-2xl border-2 border-slate-700">
              Henüz ihale kaydı oluşturulmadı. &ldquo;+ Yeni İhale Kaydı&rdquo; ile ekleyebilirsiniz.
            </div>
          )}
        </div>

        {/* Tender Modal */}
        {editingTender && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await saveErpRecord('tenders', editingTender, actorEmail, cloudMode, 'UPDATE', `İhale kaydedildi: ${editingTender.ikn}`);
                setEditingTender(null);
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-3xl max-w-2xl w-full p-6 space-y-4 text-xs"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-lg font-black text-white">İhale Dosyası Kartı</h3>
                <button type="button" onClick={() => setEditingTender(null)} className="text-slate-400">
                  <i className="fa-solid fa-xmark text-lg" />
                </button>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <input
                  required
                  placeholder="İhale Kayıt No (İKN)"
                  value={editingTender.ikn}
                  onChange={(e) => setEditingTender({ ...editingTender, ikn: e.target.value })}
                  className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                />
                <input
                  required
                  placeholder="İhale Adı"
                  value={editingTender.title}
                  onChange={(e) => setEditingTender({ ...editingTender, title: e.target.value })}
                  className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <input
                  placeholder="İdare / Kurum"
                  value={editingTender.authority}
                  onChange={(e) => setEditingTender({ ...editingTender, authority: e.target.value })}
                  className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                />
                <select
                  value={editingTender.tenderType}
                  onChange={(e) =>
                    setEditingTender({ ...editingTender, tenderType: e.target.value as TenderType })
                  }
                  className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                >
                  <option value="Birim Fiyatlı">Birim Fiyatlı</option>
                  <option value="Anahtar Teslim Götürü Bedel">Anahtar Teslim Götürü Bedel</option>
                </select>
                <select
                  value={editingTender.result}
                  onChange={(e) =>
                    setEditingTender({ ...editingTender, result: e.target.value as TenderResult })
                  }
                  className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                >
                  <option value="Hazırlanıyor">Hazırlanıyor</option>
                  <option value="Teklif Verildi">Teklif Verildi</option>
                  <option value="Kazanıldı">Kazanıldı</option>
                  <option value="Kaybedildi">Kaybedildi</option>
                  <option value="İptal">İptal</option>
                </select>
              </div>
              <div className="grid sm:grid-cols-4 gap-3">
                <label className="space-y-1">
                  <span className="text-slate-400">Yaklaşık Maliyet (TL)</span>
                  <input
                    type="number"
                    value={fromKurus(editingTender.approxCostKurus)}
                    onChange={(e) =>
                      setEditingTender({
                        ...editingTender,
                        approxCostKurus: toKurus(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">Tahmini Maliyetimiz (TL)</span>
                  <input
                    type="number"
                    value={fromKurus(editingTender.estimatedCostKurus)}
                    onChange={(e) =>
                      setEditingTender({
                        ...editingTender,
                        estimatedCostKurus: toKurus(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">Teklif Fiyatımız (TL)</span>
                  <input
                    type="number"
                    value={fromKurus(editingTender.ourBidKurus)}
                    onChange={(e) => {
                      const bidK = toKurus(e.target.value);
                      const approx = editingTender.approxCostKurus || 0;
                      const disc =
                        approx > 0 ? Number((((approx - bidK) / approx) * 100).toFixed(2)) : 0;
                      setEditingTender({
                        ...editingTender,
                        ourBidKurus: bidK,
                        discountRatePct: disc,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">Geçici Teminat (TL)</span>
                  <input
                    type="number"
                    value={fromKurus(editingTender.bidBondKurus)}
                    onChange={(e) =>
                      setEditingTender({
                        ...editingTender,
                        bidBondKurus: toKurus(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                  />
                </label>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="text-slate-400">İhale Tarihi</span>
                  <input type="date" value={editingTender.tenderDate} onChange={(e) => setEditingTender({ ...editingTender, tenderDate: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">İl / İlçe</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="İl" value={editingTender.province} onChange={(e) => setEditingTender({ ...editingTender, province: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                    <input placeholder="İlçe" value={editingTender.district} onChange={(e) => setEditingTender({ ...editingTender, district: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                  </div>
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">Sınır Değer (TL)</span>
                  <input type="number" value={fromKurus(editingTender.boundaryValueKurus)} onChange={(e) => setEditingTender({ ...editingTender, boundaryValueKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
              </div>
              <div className="grid sm:grid-cols-4 gap-3">
                <label className="space-y-1">
                  <span className="text-slate-400">Geçerlilik (Gün)</span>
                  <input type="number" value={editingTender.validityDays} onChange={(e) => setEditingTender({ ...editingTender, validityDays: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">İtiraz Son Tarihi</span>
                  <input type="date" value={editingTender.objectionDate} onChange={(e) => setEditingTender({ ...editingTender, objectionDate: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">Sözleşme Son Tarihi</span>
                  <input type="date" value={editingTender.contractDeadline} onChange={(e) => setEditingTender({ ...editingTender, contractDeadline: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">Kazanan Firma</span>
                  <input placeholder="Firma Adı" value={editingTender.winnerFirm} onChange={(e) => setEditingTender({ ...editingTender, winnerFirm: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
              </div>
              <textarea
                rows={2}
                placeholder="İhale notları / rakip teklif değerlendirmesi..."
                value={editingTender.notes}
                onChange={(e) => setEditingTender({ ...editingTender, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
              />
              {errorMsg && <div className="text-red-400 font-bold">{errorMsg}</div>}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setEditingTender(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 font-black">Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // MODE === 'projects'
  return (
    <div className="space-y-6">
      <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">Projeler ve Bağımsız Proje Hesapları</h2>
          <p className="text-xs text-slate-400">
            Her projenin 16 sekmeli özel dashboard&apos;una girmek için proje kartına veya &ldquo;Proje Kokpitini Aç&rdquo; butonuna tıklayın.
          </p>
        </div>
        {canMutate && (
          <button
            type="button"
            onClick={openNewProject}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black border border-blue-300"
          >
            + Yeni Proje Kartı Oluştur
          </button>
        )}
      </div>

      {/* Project Cards */}
      <div className="grid xl:grid-cols-2 gap-6">
        {dataset.projects.map((p) => {
          const fin = computeProjectFinancials(p, dataset);
          return (
            <div
              key={p.id}
              className="bg-[#0b1329] border-2 border-slate-700 hover:border-blue-400 rounded-2xl p-6 space-y-4 transition"
            >
              <div className="flex items-start gap-4">
                <img
                  src={p.coverImage}
                  alt={p.shortName}
                  className="w-20 h-20 rounded-xl object-cover border border-slate-600 shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-black text-blue-400">{p.code}</span>
                    {p.ikn && <span className="text-[11px] font-mono text-slate-400">İKN: {p.ikn}</span>}
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-500/40 text-[10px] font-black text-blue-300">
                      {p.status}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-white leading-snug">{p.title}</h3>
                  <div className="text-xs text-slate-400">
                    {p.contractingAuthority || p.employer} &bull; {p.location}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-[#070d1e] border border-slate-800 text-xs">
                <div>
                  <div className="text-slate-400">Güncel Sözleşme</div>
                  <div className="font-black text-white">{formatKurusTRY(fin.currentContractValueKurus)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Gerçekleşen Maliyet</div>
                  <div className="font-black text-rose-400">{formatKurusTRY(fin.totalActualCostKurus)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Hakediş</div>
                  <div className="font-black text-emerald-400">{formatKurusTRY(fin.billedProgressKurus)}</div>
                </div>
                <div>
                  <div className="text-slate-400">{canSeeProfitability ? 'Beklenen Kâr' : 'Fiziki İlerleme'}</div>
                  <div className="font-black text-blue-300">
                    {canSeeProfitability ? formatKurusTRY(fin.expectedFinalProfitKurus) : `%${p.physicalProgressPct}`}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => onSelectProject(p)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black transition"
                >
                  <i className="fa-solid fa-folder-open mr-1.5" />
                  Proje Özel Dashboard&apos;u Aç (16 Sekme)
                </button>

                <div className="flex items-center gap-2">
                  {canMutate && (
                    <button
                      type="button"
                      onClick={() => setEditingProj(p)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white font-bold"
                    >
                      Kartı Düzenle
                    </button>
                  )}
                  {canMutate && (
                    <button
                      type="button"
                      onClick={() => deleteErpRecord('projects', p.id, actorEmail, cloudMode)}
                      className="px-3 py-2 rounded-xl bg-red-950/70 hover:bg-red-600 text-red-300 hover:text-white"
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Section 12: Poz, Metraj ve Pursantaj Manager */}
      <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-white">Poz, Metraj ve Pursantaj Yönetimi</h3>
            <p className="text-xs text-slate-400">
              ÇŞİDB, MSB, DSİ, KGM ve özel pozlar; hiyerarşik iş kalemleri ve CSV pursantaj içe aktarımı
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={pozProjectFilter}
              onChange={(e) => setPozProjectFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
            >
              {dataset.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.shortName}</option>
              ))}
            </select>
            {canMutate && (
              <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 font-bold">
                <i className="fa-solid fa-file-csv mr-1.5 text-emerald-400" />
                Pursantaj CSV Yükle
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleImportPursantajCsv} />
              </label>
            )}
          </div>
        </div>

        {canMutate && (
          <form onSubmit={handleSavePoz} className="grid sm:grid-cols-8 gap-2 text-xs">
            <input
              required
              placeholder="Poz No (15.120.1001)"
              value={newPoz.pozNo}
              onChange={(e) => setNewPoz({ ...newPoz, pozNo: e.target.value })}
              className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
            />
            <select
              value={newPoz.source}
              onChange={(e) => setNewPoz({ ...newPoz, source: e.target.value as PozSource })}
              className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
            >
              <option value="ÇŞİDB">ÇŞİDB</option>
              <option value="MSB">MSB</option>
              <option value="DSİ">DSİ</option>
              <option value="KGM">KGM</option>
              <option value="Özel">Özel</option>
            </select>
            <input
              required
              placeholder="İş Kalemi Açıklaması"
              value={newPoz.description}
              onChange={(e) => setNewPoz({ ...newPoz, description: e.target.value })}
              className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
            />
            <input
              placeholder="Birim (m²)"
              value={newPoz.unit}
              onChange={(e) => setNewPoz({ ...newPoz, unit: e.target.value })}
              className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Sözleşme Miktar"
              value={newPoz.contractQty}
              onChange={(e) => setNewPoz({ ...newPoz, contractQty: e.target.value })}
              className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Birim Fiyat (TL)"
              value={newPoz.unitPriceTl}
              onChange={(e) => setNewPoz({ ...newPoz, unitPriceTl: e.target.value })}
              className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
            />
            <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-black">
              + Poz Ekle
            </button>
          </form>
        )}

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="py-2 px-3">Poz No / Kaynak</th>
                <th className="py-2 px-3">Açıklama</th>
                <th className="py-2 px-3">Sözleşme Metraj</th>
                <th className="py-2 px-3">Birim Fiyat</th>
                <th className="py-2 px-3">Gerçekleşen</th>
                <th className="py-2 px-3">Kalan</th>
                <th className="py-2 px-3">Tamamlanma</th>
                <th className="py-2 px-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {dataset.workItems
                .filter((w) => !pozProjectFilter || w.projectId === pozProjectFilter)
                .map((w) => {
                  const pct =
                    w.contractQty > 0 ? Math.round((w.actualQty / w.contractQty) * 100) : 0;
                  return (
                    <tr key={w.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-300">
                        {w.pozNo} ({w.source})
                      </td>
                      <td className="py-2.5 px-3 text-white">{w.description}</td>
                      <td className="py-2.5 px-3">{w.contractQty} {w.unit}</td>
                      <td className="py-2.5 px-3">{formatKurusTRY(w.contractUnitPriceKurus)}</td>
                      <td className="py-2.5 px-3 text-emerald-400">{w.actualQty} {w.unit}</td>
                      <td className="py-2.5 px-3 text-amber-300">{Math.max(0, w.contractQty - w.actualQty)} {w.unit}</td>
                      <td className="py-2.5 px-3 font-black">%{pct}</td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        {canMutate && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingPoz(w)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-blue-600 font-bold"
                            >
                              İlerleme / Düzenle
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteErpRecord('workItems', w.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Poz silinemedi.'))}
                              className="px-2.5 py-1 rounded-lg bg-red-950/70 hover:bg-red-600 text-red-300 hover:text-white font-bold"
                            >
                              Sil
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {dataset.workItems.filter((w) => !pozProjectFilter || w.projectId === pozProjectFilter).length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    Bu proje için henüz poz / iş kalemi girilmedi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingPoz && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await saveErpRecord('workItems', editingPoz, actorEmail, cloudMode, 'UPDATE', `Poz güncellendi: ${editingPoz.pozNo}`);
              setEditingPoz(null);
            }}
            className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-lg w-full p-6 space-y-3 text-xs"
          >
            <h3 className="text-base font-black text-white">Poz &amp; Gerçekleşen İlerleme Güncelle ({editingPoz.pozNo})</h3>
            <input required value={editingPoz.description} onChange={(e) => setEditingPoz({ ...editingPoz, description: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" placeholder="Açıklama" />
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span>Sözleşme Miktar ({editingPoz.unit})</span>
                <input type="number" step="0.01" value={editingPoz.contractQty} onChange={(e) => setEditingPoz({ ...editingPoz, contractQty: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label>
                <span>Gerçekleşen Miktar ({editingPoz.unit})</span>
                <input type="number" step="0.01" value={editingPoz.actualQty} onChange={(e) => setEditingPoz({ ...editingPoz, actualQty: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label>
                <span>Sözleşme Birim Fiyat (TL)</span>
                <input type="number" step="0.01" value={fromKurus(editingPoz.contractUnitPriceKurus)} onChange={(e) => setEditingPoz({ ...editingPoz, contractUnitPriceKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label>
                <span>Gerçekleşen Maliyet (TL)</span>
                <input type="number" step="0.01" value={fromKurus(editingPoz.actualCostKurus)} onChange={(e) => setEditingPoz({ ...editingPoz, actualCostKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingPoz(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 font-black">Kaydet</button>
            </div>
          </form>
        </div>
      )}

      {/* 27-Field Project Card Modal */}
      {editingProj && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await saveErpRecord(
                'projects',
                {
                  ...editingProj,
                  shortName: editingProj.shortName || editingProj.title.slice(0, 40),
                  location: `${editingProj.district} / ${editingProj.province}`,
                },
                actorEmail,
                cloudMode,
                'UPDATE',
                `Proje kartı güncellendi: ${editingProj.code}`
              );
              setEditingProj(null);
            }}
            className="bg-[#0b1329] border-2 border-slate-600 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white">27 Alanlı Kamu Müteahhitliği Proje Kartı</h3>
              <button type="button" onClick={() => setEditingProj(null)} className="text-slate-400">
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="space-y-1">
                <span>Proje Kodu *</span>
                <input required value={editingProj.code} onChange={(e) => setEditingProj({ ...editingProj, code: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="space-y-1">
                <span>İhale Kayıt No (İKN)</span>
                <input value={editingProj.ikn} onChange={(e) => setEditingProj({ ...editingProj, ikn: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="space-y-1">
                <span>Proje Durumu</span>
                <select value={editingProj.status} onChange={(e) => setEditingProj({ ...editingProj, status: e.target.value as ErpProjectStatus })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span>Proje Adı *</span>
                <input required value={editingProj.title} onChange={(e) => setEditingProj({ ...editingProj, title: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="space-y-1">
                <span>İhaleyi Yapan Kamu Kurumu / İşveren</span>
                <input value={editingProj.contractingAuthority} onChange={(e) => setEditingProj({ ...editingProj, contractingAuthority: e.target.value, employer: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
            </div>

            <div className="grid sm:grid-cols-4 gap-3">
              <label className="space-y-1">
                <span>İl</span>
                <input value={editingProj.province} onChange={(e) => setEditingProj({ ...editingProj, province: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="space-y-1">
                <span>İlçe</span>
                <input value={editingProj.district} onChange={(e) => setEditingProj({ ...editingProj, district: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="sm:col-span-2 space-y-1">
                <span>Şantiye Adresi</span>
                <input value={editingProj.siteAddress} onChange={(e) => setEditingProj({ ...editingProj, siteAddress: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
            </div>

            <div className="grid sm:grid-cols-4 gap-3">
              <label className="space-y-1">
                <span>Sözleşme Bedeli (TL)</span>
                <input type="number" value={fromKurus(editingProj.contractAmountKurus)} onChange={(e) => setEditingProj({ ...editingProj, contractAmountKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="space-y-1">
                <span>Onaylı İş Artışı (TL)</span>
                <input type="number" value={fromKurus(editingProj.approvedIncreaseKurus)} onChange={(e) => setEditingProj({ ...editingProj, approvedIncreaseKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="space-y-1">
                <span>Onaylı Fiyat Farkı (TL)</span>
                <input type="number" value={fromKurus(editingProj.priceDiffKurus)} onChange={(e) => setEditingProj({ ...editingProj, priceDiffKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="space-y-1">
                <span>Kalan Tahmini Maliyet (TL)</span>
                <input type="number" value={fromKurus(editingProj.estimatedRemainingCostKurus)} onChange={(e) => setEditingProj({ ...editingProj, estimatedRemainingCostKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
            </div>

            <div className="grid sm:grid-cols-4 gap-3">
              <label className="space-y-1">
                <span>Şantiye Şefi</span>
                <input value={editingProj.siteChief} onChange={(e) => setEditingProj({ ...editingProj, siteChief: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="space-y-1">
                <span>Proje Sorumlusu</span>
                <input value={editingProj.projectManager} onChange={(e) => setEditingProj({ ...editingProj, projectManager: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="space-y-1">
                <span>Fiziki İlerleme (%)</span>
                <input type="number" min={0} max={100} value={editingProj.physicalProgressPct} onChange={(e) => setEditingProj({ ...editingProj, physicalProgressPct: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="space-y-1">
                <span>KDV Oranı (%)</span>
                <input type="number" value={editingProj.vatRate} onChange={(e) => setEditingProj({ ...editingProj, vatRate: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="space-y-1">
                <span>İşe Başlama Tarihi</span>
                <input type="date" value={editingProj.startDate} onChange={(e) => setEditingProj({ ...editingProj, startDate: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="space-y-1">
                <span>İş Bitiş Tarihi</span>
                <input type="date" value={editingProj.endDate} onChange={(e) => setEditingProj({ ...editingProj, endDate: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="space-y-1">
                <span>Kesin Teminat (TL)</span>
                <input type="number" value={fromKurus(editingProj.performanceBondKurus)} onChange={(e) => setEditingProj({ ...editingProj, performanceBondKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
            </div>

            <div className="grid sm:grid-cols-4 gap-3">
              <label className="space-y-1">
                <span>Sözleşme Tarihi</span>
                <input type="date" value={editingProj.contractDate} onChange={(e) => setEditingProj({ ...editingProj, contractDate: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="space-y-1">
                <span>Yer Teslim Tarihi</span>
                <input type="date" value={editingProj.siteDeliveryDate} onChange={(e) => setEditingProj({ ...editingProj, siteDeliveryDate: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="space-y-1">
                <span>Süre / Süre Uzatımı (Gün)</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <input type="number" placeholder="Süre" value={editingProj.durationDays} onChange={(e) => setEditingProj({ ...editingProj, durationDays: Number(e.target.value) })} className="px-2.5 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                  <input type="number" placeholder="+Uzatım" value={editingProj.extensionDays} onChange={(e) => setEditingProj({ ...editingProj, extensionDays: Number(e.target.value) })} className="px-2.5 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </div>
              </label>
              <label className="space-y-1">
                <span>Avans Tutarı (TL)</span>
                <input type="number" value={fromKurus(editingProj.advanceAmountKurus)} onChange={(e) => setEditingProj({ ...editingProj, advanceAmountKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 items-end">
              <label className="sm:col-span-2 space-y-1">
                <span>Proje Açıklaması</span>
                <input value={editingProj.description} onChange={(e) => setEditingProj({ ...editingProj, description: e.target.value })} placeholder="Proje kapsamı ve teknik özet..." className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label className="cursor-pointer px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-center font-bold">
                Kapak Görseli Yükle
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      validateErpFile(f);
                      const url = await uploadToErpStorage(f, `projects/${editingProj.id}/cover-${Date.now()}-${f.name}`, f.type);
                      setEditingProj({ ...editingProj, coverImage: url, sitePhotos: Array.from(new Set([url, ...(editingProj.sitePhotos || [])])) });
                    } catch (err: any) {
                      setErrorMsg(err?.message || 'Görsel yüklenemedi.');
                    }
                  }}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-5 pt-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editingProj.hasPriceDifference} onChange={(e) => setEditingProj({ ...editingProj, hasPriceDifference: e.target.checked })} />
                <span>Fiyat Farkı Var</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editingProj.publishedOnSite} onChange={(e) => setEditingProj({ ...editingProj, publishedOnSite: e.target.checked })} />
                <span>Kurumsal Web Sitesinde Yayınla</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button type="button" onClick={() => setEditingProj(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
              <button type="submit" className="px-6 py-2 rounded-xl bg-blue-600 font-black">Proje Kartını Kaydet</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
