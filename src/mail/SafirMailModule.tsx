import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, connectGmailPopup } from './firebase';
import { api, downloadAttachment, fetchAttachmentBlob, uploadAttachment } from './api';
import Mailbox, { AddMailboxInput } from './Mailbox';
import type {
  AdminOverview,
  ArchiveRunResult,
  BulkAction,
  BulkResult,
  ComposeAttachment,
  ConnectionTest,
  Draft,
  FolderRole,
  GlobalSearchResult,
  InboxPreview,
  ListResult,
  MailAccount,
  MailMessage,
  MailboxQuota,
  MailTrackingInfo,
  ScheduledEmail,
  SendPayload,
  SendResult,
  UserSettings,
} from './types';
import { runLiveDomainMailCheck } from '../services/dataService';
import type { MailCheckLog } from '../types';
import './safirmail.css';

interface SafirMailModuleProps {
  cloudMode: boolean;
  actorEmail: string;
  onLogout?: () => void;
  composePrefill?: { key: number; to: string; subject: string; body: string } | null;
  onPrefillConsumed?: () => void;
}

type SessionState = {
  email: string;
  accounts: MailAccount[];
  canAddMailbox: boolean;
  settings?: UserSettings;
};

export const SafirMailModule: React.FC<SafirMailModuleProps> = ({
  cloudMode,
  actorEmail,
  onLogout,
  composePrefill,
  onPrefillConsumed,
}) => {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError] = useState('');
  const [dnsOpen, setDnsOpen] = useState(false);
  const [dnsDomain, setDnsDomain] = useState('kuzeydeniziyapi.com.tr');
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsResult, setDnsResult] = useState<MailCheckLog | null>(null);

  const loadSession = async () => {
    setError('');
    setReady(false);
    try {
      const data = await api<{
        user: { email: string };
        accounts: MailAccount[];
        canAddMailbox?: boolean;
        settings?: UserSettings;
      }>('/api/session', { method: 'POST' });
      setSession({
        email: data.user.email || actorEmail,
        accounts: data.accounts || [],
        canAddMailbox: data.canAddMailbox !== false,
        settings: data.settings,
      });
    } catch (err) {
      setSession(null);
      setError(err instanceof Error ? err.message : 'Mail oturumu yüklenemedi.');
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    setSession(null);
    setError('');
    setDnsResult(null);
    if (!cloudMode) {
      setReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (!fbUser) {
        setSession(null);
        setDnsResult(null);
        setReady(true);
        return;
      }
      void loadSession();
    });
    return () => unsub();
  }, [cloudMode, actorEmail]);

  const handleCheckDns = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dnsDomain.trim() || dnsLoading) return;
    setDnsLoading(true);
    try {
      const res = await runLiveDomainMailCheck(dnsDomain.trim());
      setDnsResult(res);
    } finally {
      setDnsLoading(false);
    }
  };

  const activeTheme = session?.settings?.theme || 'light';

  if (!cloudMode) {
    return (
      <div className="space-y-4">
        <div className="bg-[#0b1329] border-2 border-amber-500/40 rounded-2xl p-6 space-y-3 text-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-300 flex items-center justify-center">
              <i className="fa-solid fa-envelope-open-text" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Kurumsal Mail Yönetimi (SafirMail Motoru)</h2>
              <p className="text-xs text-slate-400">
                Gerçek IMAP / SMTP üzerinden okuma, gönderme, yanıtlama, iletme, ek dosya, arşivleme ve çoklu hesap yönetimi
              </p>
            </div>
          </div>
          <p className="text-sm text-amber-100 leading-relaxed">
            Canlı IMAP/SMTP posta sunucularına bağlanmak ve AES-256-GCM ile şifrelenmiş posta hesaplarınıza erişmek için
            Önizleme Modu&apos;ndan çıkıp yetkili kurumsal/Google hesabınızla (
            <span className="font-mono text-white">info@kuzeydeniziyapi.com.tr</span> veya yetkili süper admin hesabı) giriş yapın.
          </p>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs"
            >
              Giriş Ekranına Dön ve Canlı Hesapla Aç
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0b1329] border border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-200">
        <div className="flex items-center gap-2 font-bold">
          <i className="fa-solid fa-envelopes-bulk text-blue-400" />
          <span>SafirMail Kurumsal Posta İstemcisi (Canlı IMAP / SMTP)</span>
          <span className="text-slate-400 font-normal">• {actorEmail}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDnsOpen((v) => !v)}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 font-semibold text-[11px]"
          >
            <i className="fa-solid fa-shield-halved mr-1 text-emerald-400" />
            {dnsOpen ? 'DNS Kontrolünü Gizle' : 'MX / SPF / DMARC DNS Kontrol'}
          </button>
          <button
            type="button"
            onClick={() => { void loadSession(); }}
            className="px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-blue-200 font-semibold text-[11px]"
          >
            <i className="fa-solid fa-rotate mr-1" />
            Oturumu Yenile
          </button>
        </div>
      </div>

      {dnsOpen && (
        <form onSubmit={handleCheckDns} className="bg-[#0b1329] border border-slate-700 rounded-xl p-4 space-y-3 text-xs text-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={dnsDomain}
              onChange={(e) => setDnsDomain(e.target.value)}
              placeholder="kuzeydeniziyapi.com.tr"
              className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-[#0f172a] border border-slate-600 text-white"
            />
            <button
              type="submit"
              disabled={dnsLoading}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black"
            >
              {dnsLoading ? 'Sorgulanıyor...' : 'Canlı DNS Denetle'}
            </button>
          </div>
          {dnsResult && (
            <div className="grid sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2.5 rounded-lg bg-[#070d1e] border border-slate-800">
                <div className="font-bold text-slate-400">MX Kayıtları</div>
                <div className={dnsResult.mxValid ? 'text-emerald-300 font-bold' : 'text-red-300 font-bold'}>
                  {dnsResult.mxValid ? dnsResult.mxRecords.join(', ') : 'Eksik'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#070d1e] border border-slate-800">
                <div className="font-bold text-slate-400">SPF (TXT)</div>
                <div className={dnsResult.spfValid ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                  {dnsResult.spfValid ? dnsResult.spfRecord : 'Bulunamadı'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#070d1e] border border-slate-800">
                <div className="font-bold text-slate-400">DMARC</div>
                <div className={dnsResult.dmarcValid ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                  {dnsResult.dmarcValid ? dnsResult.dmarcRecord : 'Bulunamadı'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#070d1e] border border-slate-800">
                <div className="font-bold text-slate-400">Sağlık Puanı</div>
                <div className="text-white font-black text-sm">{dnsResult.score}/100</div>
              </div>
            </div>
          )}
        </form>
      )}

      {!ready ? (
        <div className="bg-[#0b1329] border border-slate-700 rounded-2xl p-10 text-center text-sm text-slate-300 font-bold">
          <i className="fa-solid fa-spinner fa-spin mr-2 text-blue-400" />
          SafirMail posta sunucusu oturumu yükleniyor...
        </div>
      ) : error || !session ? (
        <div className="bg-[#0b1329] border border-red-500/40 rounded-2xl p-6 space-y-3 text-sm text-red-200">
          <div className="font-black text-red-300">
            <i className="fa-solid fa-triangle-exclamation mr-2" />
            Mail API Bağlantısı Başlatılamadı
          </div>
          <p className="text-xs text-slate-300">{error || 'Oturum doğrulanamadı.'}</p>
          <button
            type="button"
            onClick={() => { void loadSession(); }}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black text-xs"
          >
            Yeniden Dene
          </button>
        </div>
      ) : (
        <div className="safir-mail-root" data-theme={activeTheme}>
          <Mailbox
            userEmail={session.email}
            accounts={session.accounts}
            canAddAccount={session.canAddMailbox}
            settings={session.settings}
            onLogout={() => { onLogout?.(); }}
            loadList={(accountId, folder, cursor, q, unseen, fresh) => {
              const params = new URLSearchParams({ folder });
              if (cursor) params.set('cursor', String(cursor));
              if (q) params.set('q', q);
              if (unseen) params.set('unseen', '1');
              if (fresh) params.set('fresh', '1');
              return api<ListResult>(`/api/accounts/${accountId}/messages?${params}`);
            }}
            searchAllAccounts={(folder, q, unseen) => {
              const params = new URLSearchParams({ folder, q });
              if (unseen) params.set('unseen', '1');
              return api<GlobalSearchResult>(`/api/messages/search?${params}`);
            }}
            loadScheduled={() =>
              api<{ scheduled: ScheduledEmail[] }>('/api/scheduled').then((d) => d.scheduled || [])
            }
            scheduleMail={(items, scheduledAt) =>
              api<{ ok: boolean; scheduled: ScheduledEmail[] }>('/api/scheduled', {
                method: 'POST',
                body: { items, scheduledAt },
              })
            }
            cancelScheduledMail={(id) =>
              api<{ ok: boolean }>(`/api/scheduled/${encodeURIComponent(id)}`, { method: 'DELETE' })
            }
            sendScheduledNow={(id) =>
              api<{ ok: boolean }>(`/api/scheduled/${encodeURIComponent(id)}/send-now`, {
                method: 'POST',
                body: {},
              })
            }
            loadMessage={(accountId, folder, uid, markSeen) =>
              api<MailMessage>(
                `/api/accounts/${accountId}/messages/${uid}?folder=${folder}${markSeen ? '&markSeen=1' : ''}`
              )
            }
            loadPreview={(accountId, fresh) =>
              api<InboxPreview>(`/api/accounts/${accountId}/preview${fresh ? '?fresh=1' : ''}`)
            }
            sendMail={(accountId, payload: SendPayload) =>
              api<SendResult>(`/api/accounts/${accountId}/send`, { method: 'POST', body: payload })
            }
            setSeen={(accountId, folder: FolderRole, uid, seen) =>
              api(`/api/accounts/${accountId}/messages/${uid}/seen`, {
                method: 'POST',
                body: { folder, seen },
              }).then(() => undefined)
            }
            setFlagged={(accountId, folder: FolderRole, uid, flagged) =>
              api(`/api/accounts/${accountId}/messages/${uid}/flag`, {
                method: 'POST',
                body: { folder, flagged },
              }).then(() => undefined)
            }
            deleteMessage={(accountId, folder: FolderRole, uid) =>
              api<{ ok: boolean; permanent: boolean }>(
                `/api/accounts/${accountId}/messages/${uid}/delete`,
                { method: 'POST', body: { folder } }
              )
            }
            moveMessage={(accountId, folder: FolderRole, uid, destination) =>
              api(`/api/accounts/${accountId}/messages/${uid}/move`, {
                method: 'POST',
                body: { folder, destination },
              }).then(() => undefined)
            }
            loadDrafts={(accountId) =>
              api<{ drafts: Draft[] }>(`/api/drafts?accountId=${accountId}`).then((d) => d.drafts)
            }
            saveDraft={(draft) =>
              api(`/api/drafts/${draft.id}`, { method: 'PUT', body: draft }).then(() => undefined)
            }
            deleteDraft={(id) =>
              api(`/api/drafts/${id}`, { method: 'DELETE' }).then(() => undefined)
            }
            downloadFile={(accountId, folder, uid, index, filename) =>
              downloadAttachment(
                `/api/accounts/${accountId}/messages/${uid}/attachments/${index}?folder=${folder}`,
                filename
              )
            }
            previewFile={(accountId, folder, uid, index) =>
              fetchAttachmentBlob(
                `/api/accounts/${accountId}/messages/${uid}/attachments/${index}?folder=${folder}`
              )
            }
            uploadFile={(accountId, file) =>
              uploadAttachment<ComposeAttachment>(`/api/accounts/${accountId}/attachments`, file)
            }
            removeUpload={(accountId, id) =>
              api(`/api/accounts/${accountId}/attachments/${id}`, { method: 'DELETE' }).then(
                () => undefined
              )
            }
            connectGoogleAccount={async (customDisplayName?: string) => {
              const { email, displayName, oauthAccessToken } = await connectGmailPopup();
              const data = await api<{ account: MailAccount }>('/api/accounts', {
                method: 'POST',
                body: {
                  displayName: customDisplayName?.trim() || displayName,
                  email,
                  oauthAccessToken,
                  preset: 'gmail',
                },
              });
              setSession((current) =>
                current
                  ? {
                      ...current,
                      accounts: [
                        ...current.accounts.filter((item) => item.id !== data.account.id),
                        data.account,
                      ],
                    }
                  : current
              );
              return data.account;
            }}
            addAccount={async (input: AddMailboxInput) => {
              const data = await api<{ account: MailAccount }>('/api/accounts', {
                method: 'POST',
                body: input,
              });
              setSession((current) =>
                current
                  ? {
                      ...current,
                      accounts: [
                        ...current.accounts.filter((item) => item.id !== data.account.id),
                        data.account,
                      ],
                    }
                  : current
              );
              return data.account;
            }}
            renameAccount={async (accountId, displayName) => {
              const data = await api<{ account: MailAccount }>(`/api/accounts/${accountId}`, {
                method: 'PUT',
                body: { displayName },
              });
              setSession((current) =>
                current
                  ? {
                      ...current,
                      accounts: current.accounts.map((item) =>
                        item.id === data.account.id
                          ? { ...item, displayName: data.account.displayName }
                          : item
                      ),
                    }
                  : current
              );
              return data.account;
            }}
            testAccount={(accountId) =>
              api<ConnectionTest>(`/api/accounts/${accountId}/test`, { method: 'POST' })
            }
            removeAccount={async (accountId) => {
              const data = await api<{ ok: boolean; disabled?: boolean }>(
                `/api/accounts/${accountId}`,
                { method: 'DELETE' }
              );
              setSession((current) =>
                current
                  ? {
                      ...current,
                      accounts: current.accounts.filter((item) => item.id !== accountId),
                    }
                  : current
              );
              return data;
            }}
            bulkMessages={(accountId, folder, uids, action: BulkAction, destination) =>
              api<BulkResult>(`/api/accounts/${accountId}/messages/bulk`, {
                method: 'POST',
                body: { folder, uids, action, destination },
              })
            }
            loadQuota={(accountId) => api<MailboxQuota>(`/api/accounts/${accountId}/quota`)}
            runArchive={(accountId, options) =>
              api<ArchiveRunResult>(`/api/accounts/${accountId}/archive/run`, {
                method: 'POST',
                body: options,
              })
            }
            saveSettings={async (patch) => {
              const recentIncluded = 'recent' in patch || 'deletedEmails' in patch;
              const payload = recentIncluded ? patch : { ...patch, omitRecent: true };
              const data = await api<{ settings: UserSettings & { recentOmitted?: boolean } }>(
                '/api/settings',
                { method: 'PUT', body: payload }
              );
              const { recentOmitted, ...cleanSettings } = data.settings;
              let nextSettings: UserSettings = cleanSettings;
              setSession((current) => {
                if (!current) return current;
                if (recentOmitted) {
                  nextSettings = { ...cleanSettings, recent: current.settings?.recent || [] };
                }
                return { ...current, settings: nextSettings };
              });
              return nextSettings;
            }}
            setAccountEnabled={async (accountId, enabled) => {
              const data = await api<{ account: MailAccount }>(`/api/accounts/${accountId}`, {
                method: 'PUT',
                body: { enabled },
              });
              setSession((current) =>
                current
                  ? {
                      ...current,
                      accounts: current.accounts.map((item) =>
                        item.id === data.account.id
                          ? { ...item, enabled: data.account.enabled }
                          : item
                      ),
                    }
                  : current
              );
              return data.account;
            }}
            loadTracking={(accountId) =>
              api<{ tracking: MailTrackingInfo[] }>(`/api/accounts/${accountId}/tracking`).then(
                (d) => d.tracking || []
              )
            }
            loadAdminOverview={() => api<AdminOverview>('/api/admin/overview')}
            inviteUser={(input) =>
              api('/api/admin/invitations', { method: 'POST', body: input }).then(() => undefined)
            }
            setUserAccess={(input) =>
              api('/api/admin/access', { method: 'PUT', body: input }).then(() => undefined)
            }
            composePrefill={composePrefill}
            onPrefillConsumed={onPrefillConsumed}
          />
        </div>
      )}
    </div>
  );
};
