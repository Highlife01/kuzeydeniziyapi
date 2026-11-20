import React, { useState } from 'react';
import { deleteErpRecord, ERP_ORG_ID, saveErpRecord } from '../services/erpStore';
import { uploadToErpStorage, validateErpFile } from '../services/storageService';
import {
  DocumentVaultItem,
  ErpProject,
  GanttTask,
  SiteLogRecord,
} from '../types/erp';

interface ScheduleSiteLogsDocsViewProps {
  mode: 'schedule' | 'siteLogs' | 'documents';
  projects: ErpProject[];
  tasks: GanttTask[];
  siteLogs: SiteLogRecord[];
  documents: DocumentVaultItem[];
  canMutate: boolean;
  actorEmail: string;
  cloudMode: boolean;
}

export const ScheduleSiteLogsDocsView: React.FC<ScheduleSiteLogsDocsViewProps> = ({
  mode,
  projects,
  tasks,
  siteLogs,
  documents,
  canMutate,
  actorEmail,
  cloudMode,
}) => {
  const [projFilter, setProjFilter] = useState('all');
  const [newTask, setNewTask] = useState<GanttTask | null>(null);
  const [newLog, setNewLog] = useState<SiteLogRecord | null>(null);
  const [docSearch, setDocSearch] = useState('');
  const [docCat, setDocCat] = useState('all');
  const [docProjFilter, setDocProjFilter] = useState('all');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const escapeHtml = (s: string) =>
    String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  if (mode === 'schedule') {
    const visibleTasks = tasks.filter(
      (t) => projFilter === 'all' || t.projectId === projFilter
    );

    return (
      <div className="space-y-6">
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-white">İş Programı ve Gantt Şeması</h2>
            <p className="text-xs text-slate-400">
              Faaliyet tarihleri, planlanan vs gerçekleşen ilerleme, bağımlılıklar ve kritik yol
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <select
              value={projFilter}
              onChange={(e) => setProjFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
            >
              <option value="all">Tüm Projeler</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
            </select>
            {canMutate && (
              <button
                type="button"
                onClick={() =>
                  setNewTask({
                    id: `tsk-${Date.now()}`,
                    organizationId: ERP_ORG_ID,
                    projectId: projects[0]?.id || '',
                    name: '',
                    responsible: '',
                    startDate: new Date().toISOString().slice(0, 10),
                    endDate: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10),
                    plannedPct: 0,
                    actualPct: 0,
                    isCriticalPath: false,
                    createdBy: actorEmail,
                    createdAt: new Date().toISOString(),
                    updatedBy: actorEmail,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="px-4 py-2 rounded-xl bg-blue-600 font-black text-white"
              >
                + Faaliyet Ekle
              </button>
            )}
          </div>
        </div>

        {/* Visual Gantt Timeline */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500 text-xs font-bold text-red-200">
            {errorMsg}
          </div>
        )}
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 space-y-3 text-xs">
          {visibleTasks.map((t) => {
            const delayPct = Math.max(0, t.plannedPct - t.actualPct);
            return (
              <div key={t.id} className="p-4 rounded-xl bg-[#070d1e] border border-slate-800 space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <span className="font-black text-white text-sm">{t.name}</span>
                    {t.isCriticalPath && (
                      <span className="ml-2 px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/40 text-[10px] font-black">
                        KRİTİK YOL
                      </span>
                    )}
                    <div className="text-slate-400">
                      {projects.find((p) => p.id === t.projectId)?.shortName} • Sorumlu: {t.responsible || '—'} • {t.startDate} &rarr; {t.endDate}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div>Plan: <strong>%{t.plannedPct}</strong> | Gerçek: <strong className="text-emerald-400">%{t.actualPct}</strong></div>
                    {delayPct > 0 && <div className="text-amber-400">Sapma: -%{delayPct}</div>}
                    {canMutate && (
                      <div className="flex justify-end gap-2 pt-0.5">
                        <button type="button" onClick={() => setNewTask(t)} className="text-blue-400 font-bold">
                          Düzenle / İlerleme
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteErpRecord('projectTasks', t.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Silinemedi.'))}
                          className="text-red-400 font-bold"
                        >
                          Sil
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-3 rounded-full bg-slate-800 overflow-hidden relative">
                  <div className="absolute inset-y-0 left-0 bg-slate-600/60 rounded-full" style={{ width: `${t.plannedPct}%` }} />
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${t.isCriticalPath ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${t.actualPct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {visibleTasks.length === 0 && (
            <div className="p-8 text-center text-slate-400">Henüz iş programı faaliyeti eklenmedi.</div>
          )}
        </div>

        {newTask && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await saveErpRecord('projectTasks', newTask, actorEmail, cloudMode);
                setNewTask(null);
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-lg w-full p-6 space-y-3 text-xs"
            >
              <h3 className="text-base font-black text-white">İş Programı Faaliyeti</h3>
              <select value={newTask.projectId} onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
              </select>
              <input required placeholder="Faaliyet Adı *" value={newTask.name} onChange={(e) => setNewTask({ ...newTask, name: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <input placeholder="Sorumlu Kişi / Ekip" value={newTask.responsible} onChange={(e) => setNewTask({ ...newTask, responsible: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={newTask.startDate} onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <input type="date" value={newTask.endDate} onChange={(e) => setNewTask({ ...newTask, endDate: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <label>
                  <span>Planlanan %</span>
                  <input type="number" min={0} max={100} value={newTask.plannedPct} onChange={(e) => setNewTask({ ...newTask, plannedPct: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Gerçekleşen %</span>
                  <input type="number" min={0} max={100} value={newTask.actualPct} onChange={(e) => setNewTask({ ...newTask, actualPct: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newTask.isCriticalPath} onChange={(e) => setNewTask({ ...newTask, isCriticalPath: e.target.checked })} />
                <span>Kritik Yol Faaliyeti</span>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setNewTask(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 font-black">Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'siteLogs') {
    const printLogPdf = (l: SiteLogRecord) => {
      const prj = projects.find((p) => p.id === l.projectId);
      const win = window.open('', '_blank', 'width=900,height=700');
      if (!win) return;
      win.document.write(`<!doctype html><html lang="tr"><head><meta charset="UTF-8"><title>Şantiye Günlüğü ${escapeHtml(l.date)}</title></head>
      <body style="font-family:sans-serif;padding:32px;color:#0f172a;">
        <h2>KUZEY DENİZİ İNŞAAT — ŞANTİYE GÜNLÜK RAPORU</h2>
        <p><strong>Proje:</strong> ${escapeHtml(prj?.title || '—')} | <strong>Tarih:</strong> ${escapeHtml(l.date)} | <strong>Hava:</strong> ${escapeHtml(l.weather)} | <strong>Personel:</strong> ${l.workerCount}</p><hr/>
        <p><strong>Yapılan İmalatlar:</strong><br/>${escapeHtml(l.worksDone)}</p>
        <p><strong>Gelen Malzemeler:</strong> ${escapeHtml(l.materialsArrived || '—')}</p>
        <p><strong>Kullanılan Ekipmanlar:</strong> ${escapeHtml(l.equipmentUsed || '—')}</p>
        <p><strong>İSG &amp; Sorunlar:</strong> ${escapeHtml(l.issues || 'Yok')} / ${escapeHtml(l.hseIncidents || 'Olay yok')}</p>
        <p><strong>Ertesi Gün Planı:</strong> ${escapeHtml(l.tomorrowPlan || '—')}</p>
        <script>window.onload=function(){window.print();}</script>
      </body></html>`);
      win.document.close();
    };

    const uploadSitePhoto = async (
      e: React.ChangeEvent<HTMLInputElement>,
      slot: 'beforePhotos' | 'afterPhotos' | 'dailyPhotos'
    ) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !newLog) return;
      setErrorMsg('');
      setUploadingDoc(true);
      try {
        validateErpFile(file);
        const url = await uploadToErpStorage(file, `sitelogs/${newLog.projectId || 'genel'}/${Date.now()}-${file.name}`, file.type);
        setNewLog({ ...newLog, [slot]: [...(newLog[slot] || []), url] });
      } catch (err: any) {
        setErrorMsg(err?.message || 'Şantiye fotoğrafı yüklenemedi.');
      } finally {
        setUploadingDoc(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Şantiye Günlüğü &amp; Öncesi/Sonrası Fotoğraflar</h2>
            <p className="text-xs text-slate-400">Hava durumu, personel sayısı, yapılan imalatlar, İSG ve PDF günlük rapor çıktısı</p>
          </div>
          {canMutate && (
            <button
              type="button"
              onClick={() =>
                setNewLog({
                  id: `log-${Date.now()}`,
                  organizationId: ERP_ORG_ID,
                  projectId: projects[0]?.id || '',
                  date: new Date().toISOString().slice(0, 10),
                  weather: 'Açık / Güneşli',
                  workerCount: 0,
                  subcontractorsNote: '',
                  worksDone: '',
                  materialsArrived: '',
                  equipmentUsed: '',
                  issues: '',
                  hseIncidents: 'İSG olayı yaşanmadı',
                  clientInstructions: '',
                  delayReasons: '',
                  tomorrowPlan: '',
                  beforePhotos: [],
                  afterPhotos: [],
                  dailyPhotos: [],
                  createdBy: actorEmail,
                  createdAt: new Date().toISOString(),
                  updatedBy: actorEmail,
                  updatedAt: new Date().toISOString(),
                })
              }
              className="px-4 py-2 rounded-xl bg-blue-600 text-xs font-black text-white"
            >
              + Günlük Rapor Oluştur
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500 text-xs font-bold text-red-200">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          {siteLogs.map((l) => {
            const allPhotos = [...(l.beforePhotos || []), ...(l.afterPhotos || []), ...(l.dailyPhotos || [])];
            return (
              <div key={l.id} className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 space-y-3 text-xs">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div className="font-black text-white text-sm">
                    {l.date} &bull; {projects.find((p) => p.id === l.projectId)?.shortName}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => printLogPdf(l)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 font-bold"
                    >
                      <i className="fa-solid fa-file-pdf mr-1" />
                      PDF Yazdır
                    </button>
                    {canMutate && (
                      <>
                        <button type="button" onClick={() => setNewLog(l)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 font-bold">
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteErpRecord('siteLogs', l.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Silinemedi.'))}
                          className="px-3 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-600 text-red-300 hover:text-white font-bold"
                        >
                          Sil
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-slate-400">
                  Hava: {l.weather} • Personel: {l.workerCount} • Ekipman: {l.equipmentUsed || '—'} • İSG: {l.hseIncidents}
                </div>
                <div className="p-3 bg-[#070d1e] rounded-xl text-slate-200 whitespace-pre-line">{l.worksDone}</div>
                {allPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {allPhotos.map((u, idx) => (
                      <a key={idx} href={u} target="_blank" rel="noreferrer">
                        <img src={u} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-600" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {siteLogs.length === 0 && (
            <div className="p-10 text-center text-xs text-slate-400 bg-[#0b1329] rounded-2xl border-2 border-slate-700">
              Henüz şantiye günlük raporu girilmedi.
            </div>
          )}
        </div>

        {newLog && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await saveErpRecord('siteLogs', newLog, actorEmail, cloudMode);
                setNewLog(null);
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-2xl w-full p-6 space-y-3 text-xs"
            >
              <h3 className="text-base font-black text-white">Şantiye Günlük Raporu</h3>
              <div className="grid sm:grid-cols-4 gap-3">
                <select value={newLog.projectId} onChange={(e) => setNewLog({ ...newLog, projectId: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
                </select>
                <input type="date" value={newLog.date} onChange={(e) => setNewLog({ ...newLog, date: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <select value={newLog.weather} onChange={(e) => setNewLog({ ...newLog, weather: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  <option value="Açık / Güneşli">Açık / Güneşli</option>
                  <option value="Parçalı Bulutlu">Parçalı Bulutlu</option>
                  <option value="Yağmurlu">Yağmurlu</option>
                  <option value="Rüzgarlı">Rüzgarlı</option>
                  <option value="Soğuk / Karlı">Soğuk / Karlı</option>
                </select>
                <input type="number" placeholder="Çalışan Sayısı" value={newLog.workerCount} onChange={(e) => setNewLog({ ...newLog, workerCount: Number(e.target.value) })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </div>
              <textarea required rows={3} placeholder="Bugün yapılan imalatlar *" value={newLog.worksDone} onChange={(e) => setNewLog({ ...newLog, worksDone: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <div className="grid sm:grid-cols-2 gap-3">
                <input placeholder="Gelen Malzemeler" value={newLog.materialsArrived} onChange={(e) => setNewLog({ ...newLog, materialsArrived: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <input placeholder="Kullanılan Ekipmanlar" value={newLog.equipmentUsed} onChange={(e) => setNewLog({ ...newLog, equipmentUsed: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <input placeholder="İSG / Saha Sorunları" value={newLog.hseIncidents} onChange={(e) => setNewLog({ ...newLog, hseIncidents: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <input placeholder="Ertesi Gün Planı" value={newLog.tomorrowPlan} onChange={(e) => setNewLog({ ...newLog, tomorrowPlan: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 font-bold">
                  {uploadingDoc ? 'Yükleniyor...' : '+ Öncesi Fotoğrafı'} ({newLog.beforePhotos?.length || 0})
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadSitePhoto(e, 'beforePhotos')} />
                </label>
                <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 font-bold">
                  {uploadingDoc ? 'Yükleniyor...' : '+ Sonrası Fotoğrafı'} ({newLog.afterPhotos?.length || 0})
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadSitePhoto(e, 'afterPhotos')} />
                </label>
                <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 font-bold">
                  {uploadingDoc ? 'Yükleniyor...' : '+ Günlük Fotoğraf'} ({newLog.dailyPhotos?.length || 0})
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadSitePhoto(e, 'dailyPhotos')} />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setNewLog(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 font-black">Raporu Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // MODE === 'documents'
  const filteredDocs = documents.filter((d) => {
    if (docCat !== 'all' && d.category !== docCat) return false;
    if (docProjFilter !== 'all' && d.projectId !== docProjFilter) return false;
    const q = docSearch.trim().toLowerCase();
    if (!q) return true;
    return d.title.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q);
  });

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg('');
    setUploadingDoc(true);
    try {
      validateErpFile(file);
      const targetProjId = docProjFilter !== 'all' ? docProjFilter : (projects[0]?.id || '');
      const url = await uploadToErpStorage(file, `documents/${targetProjId || 'genel'}/${Date.now()}-${file.name}`, file.type);
      const docItem: DocumentVaultItem = {
        id: `doc-${Date.now()}`,
        organizationId: ERP_ORG_ID,
        projectId: targetProjId,
        title: file.name,
        category: docCat === 'all' ? 'Diğer' : (docCat as DocumentVaultItem['category']),
        fileName: file.name,
        mimeType: file.type,
        url,
        version: 1,
        sizeBytes: file.size,
        createdBy: actorEmail,
        createdAt: new Date().toISOString(),
        updatedBy: actorEmail,
        updatedAt: new Date().toISOString(),
      };
      await saveErpRecord('documents', docItem, actorEmail, cloudMode);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Belge yüklenemedi.');
    } finally {
      setUploadingDoc(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-white">Belgeler, Sözleşmeler &amp; Arşiv Kasası</h2>
          <p className="text-xs text-slate-400">Belge arama, kategorilendirme, versiyon takibi ve güvenli Storage indirme</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <input placeholder="Belge ara..." value={docSearch} onChange={(e) => setDocSearch(e.target.value)} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
          <select value={docProjFilter} onChange={(e) => setDocProjFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
            <option value="all">Tüm Projeler</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
          </select>
          <select value={docCat} onChange={(e) => setDocCat(e.target.value)} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
            <option value="all">Tüm Kategoriler</option>
            <option value="Sözleşme">Sözleşme</option>
            <option value="Fatura">Fatura</option>
            <option value="İrsaliye">İrsaliye</option>
            <option value="Hakediş">Hakediş</option>
            <option value="Teminat">Teminat</option>
            <option value="SGK/İSG">SGK/İSG</option>
            <option value="İhale">İhale</option>
            <option value="Fotoğraf">Fotoğraf</option>
            <option value="Diğer">Diğer</option>
          </select>
          {canMutate && (
            <label className="cursor-pointer px-4 py-2 rounded-xl bg-blue-600 font-black text-white">
              {uploadingDoc ? 'Yükleniyor...' : '+ Belge Yükle'}
              <input type="file" className="hidden" onChange={handleUploadDoc} />
            </label>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500 text-xs font-bold text-red-200">
          {errorMsg}
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 text-xs">
        {filteredDocs.map((d) => (
          <div key={d.id} className="bg-[#0b1329] border border-slate-700 rounded-2xl p-4 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black text-blue-400 uppercase">{d.category} • v{d.version}</div>
              <div className="font-bold text-white truncate">{d.title}</div>
              <div className="text-slate-500">{d.createdAt.slice(0, 10)} • {projects.find((p) => p.id === d.projectId)?.shortName || 'Genel'}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <a href={d.url} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 font-bold">
                Aç / İndir
              </a>
              {canMutate && (
                <button
                  type="button"
                  onClick={() => deleteErpRecord('documents', d.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Silinemedi.'))}
                  className="px-2.5 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-600 text-red-300 hover:text-white font-bold"
                >
                  Sil
                </button>
              )}
            </div>
          </div>
        ))}
        {filteredDocs.length === 0 && (
          <div className="md:col-span-3 p-10 text-center text-slate-400 bg-[#0b1329] rounded-2xl border-2 border-slate-700">
            Arşivde eşleşen belge bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
};
