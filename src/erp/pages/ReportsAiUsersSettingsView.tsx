import React, { useEffect, useState } from 'react';
import { AiAssistantReply, askErpAssistant } from '../services/aiAssistantEngine';
import { approveOrRejectRequest, deleteErpRecord, ERP_ORG_ID, saveErpRecord } from '../services/erpStore';
import { ErpDatasetSnapshot } from '../services/financeEngine';
import {
  ALL_16_REPORTS,
  buildReportTable,
  exportReportCsv,
  exportReportPrintablePdf,
} from '../services/reportExporter';
import {
  ApprovalRequest,
  AuditLogEntry,
  ErpMenuSectionId,
  ErpRoleId,
  ErpSettings,
  ErpUserAccount,
} from '../types/erp';
import { formatKurusTRY, fromKurus, toKurus } from '../utils/money';
import { canAccessSection, canUserApproveAmount, canViewCompanyProfitability, ERP_ROLES } from '../utils/permissions';
import { isSuperAdminEmail } from '../../core/firebase';
import { addAuthorizedAdmin, removeAuthorizedAdmin } from '../../services/dataService';

interface ReportsAiUsersSettingsViewProps {
  mode: 'reports' | 'aiAssistant' | 'users' | 'settings';
  dataset: ErpDatasetSnapshot;
  users: ErpUserAccount[];
  approvals: ApprovalRequest[];
  auditLogs: AuditLogEntry[];
  settings: ErpSettings;
  currentUser: ErpUserAccount | null;
  canSeeProfitability?: boolean;
  cloudMode: boolean;
  onSaveSettings: (s: ErpSettings) => Promise<void>;
  onConnectCloud?: () => void;
  onOpenInvoiceUpload?: () => void;
  onNavigate: (menu: ErpMenuSectionId) => void;
}

const SAMPLE_AI_PROMPTS = [
  'Adana Adliyesi projesinde toplam ne kadar harcadık?',
  'Pozantı Devlet Hastanesi projesinde kâr marjımız nedir?',
  'Bu ay en çok hangi malzemeye para ödedik?',
  'Hangi tedarikçiye ne kadar borcumuz var?',
  'Bu hafta ne kadar ödeme yapmamız gerekiyor?',
  'Toplam hakediş alacağımız ne kadar?',
  'Hangi projede bütçe aşımı riski var?',
  'Eksik faturaları listele.',
  'Aynı ürün için en uygun tedarikçi hangisi?',
  'Finansal yönetim raporu hazırla.',
];

const renderFormattedAnswer = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-black text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

export const ReportsAiUsersSettingsView: React.FC<ReportsAiUsersSettingsViewProps> = ({
  mode,
  dataset,
  users,
  approvals,
  auditLogs,
  settings,
  currentUser,
  canSeeProfitability,
  cloudMode,
  onSaveSettings,
  onConnectCloud,
  onOpenInvoiceUpload,
  onNavigate,
}) => {
  const actorEmail = currentUser?.email || 'sistem';
  const effectiveCanSeeProfitability = canSeeProfitability ?? canViewCompanyProfitability(currentUser);
  const [selectedReportId, setSelectedReportId] = useState(ALL_16_REPORTS[0].id);
  const [reportProjectId, setReportProjectId] = useState('all');

  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<{ q: string; r: AiAssistantReply }[]>([]);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<ErpRoleId>('santiye_sefi');
  const [newUserProjects, setNewUserProjects] = useState<string[]>([]);

  const [settingsForm, setSettingsForm] = useState<ErpSettings>(settings);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  if (mode === 'reports') {
    const visibleReports = ALL_16_REPORTS.filter((r) => {
      if (r.id === 'proj_pnl' || r.id === 'proj_income_expense' || r.id === 'budget_comparison') {
        return effectiveCanSeeProfitability;
      }
      if (r.id === 'bank_cash' || r.id === 'cashflow_forecast' || r.id === 'aging_report' || r.id === 'vat_report') {
        return effectiveCanSeeProfitability && canAccessSection(currentUser, 'bankCash');
      }
      if (r.id === 'hr_cost') return canAccessSection(currentUser, 'hr');
      if (r.id === 'progress_payments') return canAccessSection(currentUser, 'progressPayments');
      if (r.id === 'guarantees') return canAccessSection(currentUser, 'guarantees');
      if (r.id === 'supplier_ledger') {
        return canAccessSection(currentUser, 'suppliers') || canAccessSection(currentUser, 'currentAccounts');
      }
      if (r.id === 'subcontractor_ledger') {
        return canAccessSection(currentUser, 'subcontractors') || canAccessSection(currentUser, 'currentAccounts');
      }
      return true;
    });
    const activeReport = visibleReports.find((r) => r.id === selectedReportId) || visibleReports[0] || ALL_16_REPORTS[0];
    const table = buildReportTable(activeReport.id, dataset, reportProjectId);
    const projectLabel =
      reportProjectId === 'all'
        ? 'Tüm Projeler'
        : dataset.projects.find((p) => p.id === reportProjectId)?.title || 'Proje';

    return (
      <div className="space-y-6">
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Kurumsal Raporlar &amp; Excel / PDF Dışa Aktarım ({visibleReports.length} Rapor)</h2>
            <p className="text-xs text-slate-400">
              Kuzey Deniz kurumsal anteti ile yalnızca yetkili olunan verilerden rapor oluşturma
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <select
              value={reportProjectId}
              onChange={(e) => setReportProjectId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
            >
              <option value="all">Tüm Yetkili Projeler</option>
              {dataset.projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
            </select>
            <button
              type="button"
              onClick={() => exportReportCsv(activeReport.title, table.headers, table.rows)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black"
            >
              <i className="fa-solid fa-file-excel mr-1.5" />
              Excel (CSV) İndir
            </button>
            <button
              type="button"
              onClick={() =>
                exportReportPrintablePdf(activeReport.title, projectLabel, table.headers, table.rows)
              }
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black"
            >
              <i className="fa-solid fa-file-pdf mr-1.5" />
              Kurumsal PDF Oluştur
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-3 space-y-1 max-h-[600px] overflow-y-auto">
            {visibleReports.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedReportId(r.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs transition ${
                  activeReport.id === r.id
                    ? 'bg-blue-600 text-white font-black'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div>{r.title}</div>
                <div className="text-[10px] opacity-75">{r.description}</div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 overflow-x-auto text-xs space-y-4">
            <div className="font-black text-base text-white">{activeReport.title}</div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#070d1e] border-b border-slate-700 text-slate-300">
                  {table.headers.map((h) => (
                    <th key={h} className="py-2.5 px-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {table.rows.map((row, idx) => (
                  <tr key={idx}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2.5 px-3 text-slate-200">{cell}</td>
                    ))}
                  </tr>
                ))}
                {table.rows.length === 0 && (
                  <tr>
                    <td colSpan={table.headers.length} className="py-8 text-center text-slate-400">
                      Bu rapor için henüz veri bulunmuyor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'aiAssistant') {
    const allowedPrompts = effectiveCanSeeProfitability
      ? SAMPLE_AI_PROMPTS
      : SAMPLE_AI_PROMPTS.filter((p) => !/(kâr|marj|ödeme|alacağımız|finansal yönetim)/i.test(p));

    const submitAi = async (questionText: string) => {
      if (!questionText.trim()) return;
      setErrorMsg('');
      if (
        !effectiveCanSeeProfitability &&
        /(k[âa]r|marj|banka|kasa|nakit|maa[şs]|teminat)/i.test(questionText)
      ) {
        setAiHistory((prev) => [
          {
            q: questionText,
            r: {
              answer: 'Yetki Sınırı: Mevcut kullanıcı rolü şirket kârlılığı, banka/kasa bakiyeleri ve personel maaş verilerini sorgulayamaz.',
              citations: [],
              usedBackendAi: false,
              readOnlyWarning: 'Veri izolasyonu nedeniyle yalnızca yetkili proje/modül kayıtlarına erişebilirsiniz.',
            },
          },
          ...prev,
        ]);
        setAiQuestion('');
        return;
      }
      setAiLoading(true);
      try {
        const reply = await askErpAssistant(
          questionText,
          dataset,
          settings.aiBackendEndpoint
        );
        const scopedReply: AiAssistantReply = {
          ...reply,
          citations: reply.citations.filter((c) =>
            canAccessSection(currentUser, c.targetMenu as ErpMenuSectionId)
          ),
        };
        setAiHistory((prev) => [{ q: questionText, r: scopedReply }, ...prev]);
        setAiQuestion('');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Asistan yanıt veremedi.');
      } finally {
        setAiLoading(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-400 text-blue-300 flex items-center justify-center">
              <i className="fa-solid fa-robot" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Yapay Zekâ Finans ve Proje Asistanı</h2>
              <p className="text-xs text-slate-400">
                Yalnızca gerçek veritabanı kayıtlarına dayalı salt-okunur sorgulama (otomatik ödeme veya silme yapmaz)
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitAi(aiQuestion);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              placeholder="Örn: Adana Adliyesi projesinde toplam ne kadar harcadık?"
              className="flex-1 px-4 py-3 rounded-xl bg-[#0f172a] border border-slate-600 text-sm text-white"
            />
            <button
              type="submit"
              disabled={aiLoading}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-black text-xs text-white"
            >
              {aiLoading ? 'Analiz Ediliyor...' : 'Sor'}
            </button>
          </form>

          <div className="flex flex-wrap gap-2 pt-1">
            {allowedPrompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => submitAi(p)}
                className="px-3 py-1.5 rounded-lg bg-[#070d1e] hover:bg-slate-800 border border-slate-700 text-[11px] font-semibold text-blue-300 transition"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {aiHistory.map((item, idx) => (
            <div key={idx} className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 space-y-3 text-xs">
              <div className="font-black text-amber-300">Soru: {item.q}</div>
              <div className="text-sm text-slate-100 whitespace-pre-line leading-relaxed bg-[#070d1e] p-4 rounded-xl border border-slate-800">
                {renderFormattedAnswer(item.r.answer)}
              </div>
              {item.r.citations.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-400">Dayanak Belgeler ve Kayıtlar:</div>
                  <div className="flex flex-wrap gap-2">
                    {item.r.citations.map((c, ci) => (
                      <button
                        key={ci}
                        type="button"
                        onClick={() => onNavigate(c.targetMenu as ErpMenuSectionId)}
                        className="px-3 py-1.5 rounded-lg bg-blue-950/60 border border-blue-500/40 text-blue-200 hover:bg-blue-600 transition text-left"
                      >
                        <strong>{c.label}</strong>: {c.detail}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-[11px] text-slate-500">
                <i className="fa-solid fa-shield-halved mr-1" />
                {item.r.readOnlyWarning}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'users') {
    const pendingApprovals = approvals.filter((a) => a.status === 'Onay Bekliyor');

    const handleDecideApproval = async (apr: ApprovalRequest, approved: boolean) => {
      setErrorMsg('');
      try {
        await approveOrRejectRequest(apr, approved, currentUser, settings, cloudMode);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Onay işlemi başarısız oldu.');
      }
    };

    const handleEditUser = (u: ErpUserAccount) => {
      setNewUserEmail(u.email);
      setNewUserName(u.fullName);
      setNewUserRole(u.roleId);
      setNewUserProjects(u.assignedProjectIds || []);
    };

    const handleToggleUserActive = async (u: ErpUserAccount) => {
      if (isSuperAdminEmail(u.email)) return;
      await saveErpRecord(
        'users',
        { ...u, active: !u.active },
        actorEmail,
        cloudMode,
        'UPDATE',
        `Kullanıcı durumu değişti: ${u.email} (${!u.active ? 'Aktif' : 'Pasif'})`
      );
    };

    const handleDeleteUser = async (u: ErpUserAccount) => {
      if (isSuperAdminEmail(u.email)) return;
      setErrorMsg('');
      try {
        await deleteErpRecord('users', u.id, actorEmail, cloudMode);
        if (cloudMode) {
          await removeAuthorizedAdmin(u.email).catch(() => {});
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Kullanıcı silinemedi.');
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5">
          <h2 className="text-xl font-black text-white">Kullanıcılar, 10 Rol Bazlı Yetki &amp; Onay Mekanizması</h2>
          <p className="text-xs text-slate-400">
            Şantiye Şefi ve Saha Personeli yalnızca atanan projeleri görür; finansal onaylar tutar eşiğine göre yönlendirilir
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500 text-xs font-bold text-red-200">
            {errorMsg}
          </div>
        )}

        {/* Approval Queue */}
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 space-y-3 text-xs">
          <h3 className="font-black text-amber-300 text-sm">
            Onay Bekleyen İşlemler ({pendingApprovals.length})
          </h3>
          {pendingApprovals.map((apr) => {
            const canApprove = canUserApproveAmount(currentUser, apr.amountKurus, settings);
            return (
              <div key={apr.id} className="p-3.5 rounded-xl bg-[#070d1e] border border-slate-800 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <div className="font-black text-white">{apr.title} — {formatKurusTRY(apr.amountKurus)}</div>
                  <div className="text-slate-400">Talep: {apr.requestedBy} • Gereken Yetki: {apr.requiredRoleLabel}</div>
                </div>
                {canApprove ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleDecideApproval(apr, true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-black">Onayla</button>
                    <button type="button" onClick={() => handleDecideApproval(apr, false)} className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-black">Reddet</button>
                  </div>
                ) : (
                  <span className="text-amber-400 font-bold">Üst Yetki Bekleniyor</span>
                )}
              </div>
            );
          })}
          {pendingApprovals.length === 0 && (
            <div className="text-slate-400">Onay bekleyen işlem bulunmuyor.</div>
          )}
        </div>

        {/* Add / Manage Users */}
        <div className="grid lg:grid-cols-12 gap-6 text-xs">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const clean = newUserEmail.trim().toLowerCase();
              if (!clean) return;
              const userDoc: ErpUserAccount = {
                id: clean,
                organizationId: ERP_ORG_ID,
                email: clean,
                fullName: newUserName.trim() || clean,
                roleId: newUserRole,
                assignedProjectIds: newUserProjects,
                active: true,
                createdBy: actorEmail,
                createdAt: new Date().toISOString(),
                updatedBy: actorEmail,
                updatedAt: new Date().toISOString(),
              };
              await saveErpRecord('users', userDoc, actorEmail, cloudMode, 'CREATE', `Kullanıcı yetkilendirildi: ${clean} (${newUserRole})`);
              if (cloudMode) {
                await addAuthorizedAdmin(clean).catch(() => {});
              }
              setNewUserEmail('');
              setNewUserName('');
            }}
            className="lg:col-span-5 bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 space-y-3"
          >
            <h3 className="font-black text-sm text-white">Kullanıcı Yetkilendir</h3>
            <input required type="email" placeholder="E-Posta Adresi *" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
            <input placeholder="Ad Soyad" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
            <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as ErpRoleId)} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
              {Object.values(ERP_ROLES).map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            {!ERP_ROLES[newUserRole].allProjects && (
              <div className="space-y-1 p-3 rounded-xl bg-[#070d1e] border border-slate-800">
                <div className="font-bold text-slate-300">Atanacak Yetkili Projeler:</div>
                {dataset.projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newUserProjects.includes(p.id)}
                      onChange={(e) =>
                        setNewUserProjects(
                          e.target.checked
                            ? [...newUserProjects, p.id]
                            : newUserProjects.filter((id) => id !== p.id)
                        )
                      }
                    />
                    <span>{p.shortName}</span>
                  </label>
                ))}
              </div>
            )}
            <button type="submit" className="w-full py-2.5 rounded-xl bg-blue-600 font-black text-white">
              Kullanıcı Yetkisini Kaydet
            </button>
          </form>

          <div className="lg:col-span-7 bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 space-y-3">
            <h3 className="font-black text-sm text-white">Kayıtlı Kullanıcılar &amp; İşlem Geçmişi (Audit Log)</h3>
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="p-3 rounded-xl bg-[#070d1e] border border-slate-800 flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <div className="font-black text-white">{u.fullName} ({u.email})</div>
                    <div className="text-slate-400">Rol: {ERP_ROLES[u.roleId]?.label || u.roleId}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isSuperAdminEmail(u.email) ? (
                      <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-500/40 text-amber-300 font-black">
                        Süper Admin
                      </span>
                    ) : (
                      <>
                        <button type="button" onClick={() => handleEditUser(u)} className="text-blue-400 font-bold">
                          Düzenle
                        </button>
                        <button type="button" onClick={() => handleToggleUserActive(u)} className="text-amber-300 font-bold">
                          {u.active ? 'Pasifleştir' : 'Aktifleştir'}
                        </button>
                        <button type="button" onClick={() => handleDeleteUser(u)} className="text-red-400 font-bold">
                          Sil
                        </button>
                      </>
                    )}
                    <span className={`px-2 py-0.5 rounded font-bold ${u.active ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                      {u.active ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-slate-800 space-y-1.5 max-h-56 overflow-y-auto">
              <div className="font-bold text-slate-400">Son Güvenlik ve Denetim Kayıtları:</div>
              {auditLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="text-[11px] text-slate-300">
                  <span className="text-slate-500">{log.timestamp.slice(0, 19).replace('T', ' ')}</span> &bull;{' '}
                  <strong>{log.actorEmail}</strong> [{log.action}] — {log.summary}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MODE === 'settings'
  const quickEntryLinks: { label: string; desc: string; icon: string; action: () => void }[] = [
    {
      label: 'Projeler & Sözleşme Bedelleri',
      desc: `${dataset.projects.length} kayıtlı proje — sözleşme bedeli ve bütçe girişi`,
      icon: 'fa-diagram-project',
      action: () => onNavigate('projects'),
    },
    {
      label: 'Banka ve Kasa Hesapları',
      desc: `${dataset.bankAccounts.length} hesap — gerçek banka/kasa bakiyesi ve tahsilat/ödeme`,
      icon: 'fa-building-columns',
      action: () => onNavigate('bankCash'),
    },
    {
      label: 'Fatura / Fiş Yükle (OCR / XML)',
      desc: `${dataset.invoices.length} fatura — kamera, PDF veya e-Fatura XML girişi`,
      icon: 'fa-file-invoice',
      action: () => (onOpenInvoiceUpload ? onOpenInvoiceUpload() : onNavigate('invoices')),
    },
    {
      label: 'Gelir ve Gider Kayıtları',
      desc: `${dataset.expenses.length} gider — doğrudan proje/genel gider girişi`,
      icon: 'fa-receipt',
      action: () => onNavigate('expenses'),
    },
    {
      label: 'Hakedişler',
      desc: `${dataset.progressPayments.length} hakediş — resmi kesinti ve tahsilat takibi`,
      icon: 'fa-file-signature',
      action: () => onNavigate('progressPayments'),
    },
    {
      label: 'Tedarikçi & Taşeronlar',
      desc: `${dataset.subcontractors.length} taşeron — cari hesap ve teklif girişi`,
      icon: 'fa-truck-field',
      action: () => onNavigate('suppliers'),
    },
    {
      label: 'Personel ve Puantaj',
      desc: `${dataset.employees.length} personel, ${dataset.timesheets.length} puantaj kaydı`,
      icon: 'fa-user-clock',
      action: () => onNavigate('hr'),
    },
    {
      label: 'Depo ve Stok',
      desc: `${dataset.stockItems.length} stok kalemi — depo giriş, transfer ve sarf`,
      icon: 'fa-boxes-stacked',
      action: () => onNavigate('warehouse'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Live Data Entry & Cloud Status */}
      <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-6 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">Canlı Veri Girişi &amp; Veritabanı Durumu</h2>
            <p className="text-slate-400">
              Tüm sahte/örnek tutarlar temizlenmiştir. Girdiğiniz veriler doğrudan izole <span className="font-mono text-blue-300">kuzeydenizi-db</span> Firestore veritabanına kaydedilir.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-xl font-black border ${
                cloudMode
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                  : 'bg-amber-950/80 border-amber-500/60 text-amber-300'
              }`}
            >
              <i className={`fa-solid ${cloudMode ? 'fa-cloud-arrow-up' : 'fa-eye'} mr-1.5`} />
              {cloudMode ? 'Canlı Bulut Veri Girişi Aktif' : 'Önizleme Modu (Yerel)'}
            </span>
            {!cloudMode && onConnectCloud && (
              <button
                type="button"
                onClick={onConnectCloud}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black"
              >
                Canlı Buluta Bağlan
              </button>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickEntryLinks.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className="p-3.5 rounded-xl bg-[#070d1e] hover:bg-slate-800 border border-slate-800 hover:border-blue-500/60 text-left space-y-1 transition"
            >
              <div className="font-black text-white flex items-center gap-2">
                <i className={`fa-solid ${item.icon} text-blue-400`} />
                <span>{item.label}</span>
              </div>
              <div className="text-[11px] text-slate-400">{item.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Company & Approval Settings Form */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErrorMsg('');
          setSavingSettings(true);
          try {
            await onSaveSettings(settingsForm);
            setSettingsSaved(true);
            setTimeout(() => setSettingsSaved(false), 3000);
          } catch (err: any) {
            setErrorMsg(err?.message || 'Ayarlar kaydedilemedi. Yetkinizi veya internet bağlantınızı kontrol edin.');
          } finally {
            setSavingSettings(false);
          }
        }}
        className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-6 space-y-4 text-xs max-w-3xl"
      >
        <h2 className="text-xl font-black text-white">ERP Sistem &amp; Onay Limit Ayarları</h2>
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500 text-xs font-bold text-red-200">
            {errorMsg}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span>Resmi Ticaret Unvanı</span>
            <input value={settingsForm.companyName} onChange={(e) => setSettingsForm({ ...settingsForm, companyName: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
          </label>
          <label className="space-y-1">
            <span>Vergi Dairesi</span>
            <input value={settingsForm.taxOffice} onChange={(e) => setSettingsForm({ ...settingsForm, taxOffice: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
          </label>
          <label className="space-y-1">
            <span>Vergi Kimlik Numarası (VKN)</span>
            <input value={settingsForm.taxNumber} onChange={(e) => setSettingsForm({ ...settingsForm, taxNumber: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
          </label>
          <label className="space-y-1">
            <span>Kurumsal Telefon</span>
            <input value={settingsForm.phone} onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
          </label>
          <label className="space-y-1">
            <span>Kurumsal E-Posta</span>
            <input type="email" value={settingsForm.email} onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
          </label>
          <label className="space-y-1">
            <span>Onay Eşiği 1 — Proje Sorumlusu Üst Limiti (TL)</span>
            <input type="number" min={0} step="0.01" value={fromKurus(settingsForm.approvalLimitLevel1Kurus)} onChange={(e) => setSettingsForm({ ...settingsForm, approvalLimitLevel1Kurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span>Onay Eşiği 2 — Proje Müdürü Üst Limiti (TL)</span>
            <input type="number" min={0} step="0.01" value={fromKurus(settingsForm.approvalLimitLevel2Kurus)} onChange={(e) => setSettingsForm({ ...settingsForm, approvalLimitLevel2Kurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
          </label>
        </div>
        <label className="block space-y-1">
          <span>Merkez Adres</span>
          <input value={settingsForm.address} onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
        </label>
        <label className="block space-y-1">
          <span>Güvenli Backend AI / OCR Endpoint (Opsiyonel Cloud Function URL)</span>
          <input type="url" placeholder="https://europe-west1-finansarena-bdae9.cloudfunctions.net/..." value={settingsForm.aiBackendEndpoint} onChange={(e) => setSettingsForm({ ...settingsForm, aiBackendEndpoint: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
        </label>
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={savingSettings} className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 font-black text-white">
            {savingSettings ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
          </button>
          {settingsSaved && <span className="text-emerald-400 font-bold">Firestore&apos;a kaydedildi!</span>}
        </div>
      </form>
    </div>
  );
};
