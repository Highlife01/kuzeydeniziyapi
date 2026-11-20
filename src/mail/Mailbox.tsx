import { type CSSProperties, FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { AdminOverview, ArchiveRunOptions, ArchiveRunResult, BulkAction, BulkResult, ComposeAttachment, ConnectionTest, ContactItem, Draft, FolderRole, GlobalSearchResult, InboxPreview, ListResult, MailAccount, MailMessage, MailboxQuota, MailTrackingInfo, SendPayload, SendResult, UserSettings } from './types';
import { AUTO_SAVE_MS, REFRESH_GAP_MS, autoFormatRecipientChange, composeFingerprint, emailKey, extractRecipientTokens, folderEmptyCopy, folderTitle as folderLabel, formatRecipientInput, forwardFields, isComposeBlank, isMailFolder, parseRecipientToken, parseRecipientTokens, quotedHtml, replyAllFields, replyFields, visibleComposeText, withSignature } from './compose';
import { fileKind, fileSize, formatFull, formatWhen, hasRemoteImages, htmlToText, initials, mailDocument, textToHtml } from './format';
import Icon, { accountColor, mailColor, tint } from './Icon';
import AttachmentThumb, { isThumbnailable } from './AttachmentThumb';
import Overview, { type PreviewState } from './Overview';
import { createMailListCache } from './mailListCache';
import { idbClearAll, idbGetList, idbGetMessage, idbSaveList, idbSaveMessage, idbUpdateList } from './offlineStore';
import { evaluateRules } from './rulesEngine';
import RichEditor from './RichEditor';
import SettingsPanel from './SettingsPanel';
const ContactsPanel = lazy(() => import('./ContactsPanel'));
import UndoSendBanner, { type UndoSendItem } from './UndoSendBanner';
import CalendarInviteCard from './CalendarInviteCard';
const TemplateSelectorModal = lazy(() => import('./TemplateSelectorModal'));
const NewFolderModal = lazy(() => import('./NewFolderModal'));
const ScheduledEmailsModal = lazy(() => import('./ScheduledEmailsModal'));
import { api, downloadAttachment } from './api';
import type { ScheduledEmail } from './types';

export type AddMailboxInput = {
  displayName: string;
  email: string;
  password: string;
  preset: 'domain' | 'kurumsal' | 'gmail' | 'yandex' | 'custom';
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
};

type Props = {
  userEmail: string;
  accounts: MailAccount[];
  onLogout: () => void;
  loadList: (accountId: string, folder: FolderRole, cursor: number | null, q: string, unseen: boolean, fresh?: boolean) => Promise<ListResult>;
  searchAllAccounts?: (folder: FolderRole, q: string, unseen: boolean) => Promise<GlobalSearchResult>;
  loadMessage: (accountId: string, folder: FolderRole, uid: number, markSeen?: boolean) => Promise<MailMessage>;
  loadPreview?: (accountId: string, fresh?: boolean) => Promise<InboxPreview>;
  sendMail: (accountId: string, payload: SendPayload) => Promise<SendResult>;
  loadScheduled?: () => Promise<ScheduledEmail[]>;
  scheduleMail?: (items: { accountId: string; payload: SendPayload }[], scheduledAt: number) => Promise<{ ok: boolean; scheduled: ScheduledEmail[] }>;
  cancelScheduledMail?: (id: string) => Promise<{ ok: boolean }>;
  sendScheduledNow?: (id: string) => Promise<{ ok: boolean }>;
  setSeen: (accountId: string, folder: FolderRole, uid: number, seen: boolean) => Promise<void>;
  setFlagged: (accountId: string, folder: FolderRole, uid: number, flagged: boolean) => Promise<void>;
  deleteMessage: (accountId: string, folder: FolderRole, uid: number) => Promise<{ ok?: boolean; permanent?: boolean }>;
  moveMessage: (accountId: string, folder: FolderRole, uid: number, destination: FolderRole) => Promise<void>;
  loadDrafts: (accountId: string) => Promise<Draft[]>;
  saveDraft: (draft: Draft) => Promise<void>;
  deleteDraft: (id: string) => Promise<void>;
  downloadFile: (accountId: string, folder: FolderRole, uid: number, index: number, filename: string) => Promise<void>;
  previewFile?: (accountId: string, folder: FolderRole, uid: number, index: number) => Promise<Blob>;
  uploadFile: (accountId: string, file: File) => Promise<ComposeAttachment>;
  removeUpload: (accountId: string, id: string) => Promise<void>;
  addAccount: (input: AddMailboxInput) => Promise<MailAccount>;
  connectGoogleAccount?: (displayName?: string) => Promise<MailAccount>;
  renameAccount: (accountId: string, displayName: string) => Promise<MailAccount>;
  testAccount?: (accountId: string) => Promise<ConnectionTest>;
  removeAccount?: (accountId: string) => Promise<{ ok?: boolean; disabled?: boolean }>;
  bulkMessages?: (accountId: string, folder: FolderRole, uids: number[], action: BulkAction, destination?: FolderRole) => Promise<BulkResult>;
  settings?: UserSettings;
  saveSettings?: (patch: Partial<UserSettings>) => Promise<UserSettings | void>;
  setAccountEnabled?: (accountId: string, enabled: boolean) => Promise<MailAccount>;
  loadTracking?: (accountId: string) => Promise<MailTrackingInfo[]>;
  loadAdminOverview?: () => Promise<AdminOverview>;
  inviteUser?: (input: { email: string; accountIds: string[]; permissions: { read: boolean; send: boolean; manage: boolean } }) => Promise<void>;
  setUserAccess?: (input: { uid: string; accountId: string; permissions: { read: boolean; send: boolean; manage: boolean } | null }) => Promise<void>;
  canAddAccount?: boolean;
  loadQuota?: (accountId: string) => Promise<MailboxQuota>;
  runArchive?: (accountId: string, options: ArchiveRunOptions) => Promise<ArchiveRunResult>;
  composePrefill?: { key: number; to: string; subject: string; body: string } | null;
  onPrefillConsumed?: () => void;
};

const emptySettings = (): UserSettings => ({
  theme: 'light', defaultAccountId: '', accountOrder: [], signatures: {}, templates: [], recent: [],
});

type ComposeState = {
  draftId: string;
  mode: 'new' | 'reply' | 'forward';
  uid?: number;
  replyFolder?: FolderRole;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  showExtra: boolean;
  attachments: ComposeAttachment[];
};

const emptyCompose = (): ComposeState => ({
  draftId: crypto.randomUUID(),
  mode: 'new',
  to: '',
  cc: '',
  bcc: '',
  subject: '',
  body: '',
  showExtra: false,
  attachments: [],
});

type UndoMove = {
  items: ListResult['messages'];
  from: FolderRole;
  to: FolderRole;
  unseenLost: number;
};

const POLL_MS = 60000;
const PREVIEW_GAP_MS = 45000;
const PREVIEW_WORKERS = 3;

const MOVE_TARGETS: { role: FolderRole; label: string }[] = [
  { role: 'inbox', label: 'Gelen Kutusu' },
  { role: 'archive', label: 'Arşiv' },
  { role: 'spam', label: 'Spam' },
  { role: 'trash', label: 'Çöp Kutusu' },
];

function asListItem(item: ListResult['messages'][number] | MailMessage): ListResult['messages'][number] {
  return {
    uid: item.uid, subject: item.subject, from: item.from, fromEmail: item.fromEmail,
    to: item.to, toEmail: item.toEmail, date: item.date, seen: item.seen, flagged: item.flagged,
    hasAttachments: item.hasAttachments,
    ...(item.authResults ? { authResults: item.authResults } : {}),
  };
}

function describeAuthResults(auth?: MailMessage['authResults'], folderRole?: FolderRole) {
  if (!auth || folderRole === 'sent') return null;
  const spfOk = Boolean(auth.spfPass);
  const dmarcOk = Boolean(auth.dmarcPass);
  const dkimOk = Boolean(auth.dkimPass);
  const spfFail = auth.spf === 'fail' || auth.spf === 'softfail';
  const dmarcFail = auth.dmarc === 'fail';
  const dkimFail = auth.dkim === 'fail';
  const missingBoth = !spfOk && !dmarcOk;
  const missingDmarc = spfOk && !dmarcOk;
  const missingSpf = !spfOk && dmarcOk;
  const hasIssue = !spfOk || !dmarcOk;
  const isDanger = spfFail || dmarcFail;

  let badge = '';
  if (missingBoth) badge = isDanger ? '❌ SPF & DMARC Hatalı' : '⚠️ SPF & DMARC Yok';
  else if (missingDmarc) badge = dmarcFail ? '❌ DMARC Hatalı' : '⚠️ DMARC Yok';
  else if (missingSpf) badge = spfFail ? '❌ SPF Hatalı' : '⚠️ SPF Yok';

  let headline = '🛡️ SPF ve DMARC Doğrulandı';
  if (missingBoth) {
    headline = isDanger
      ? '🚨 SPF ve DMARC başarısız — kimlik doğrulama uyarısı!'
      : '⚠️ Bu iletide SPF ve DMARC yok — gönderen kimliği tam doğrulanamadı';
  } else if (missingDmarc) {
    headline = dmarcFail
      ? '🚨 DMARC başarısız (SPF geçti)'
      : '⚠️ Bu iletide DMARC yok (SPF geçti)';
  } else if (missingSpf) {
    headline = spfFail
      ? '🚨 SPF başarısız (DMARC geçti)'
      : '⚠️ Bu iletide SPF yok (DMARC geçti)';
  }

  return {
    spfOk,
    dmarcOk,
    dkimOk,
    spfFail,
    dmarcFail,
    dkimFail,
    hasIssue,
    isDanger,
    badge,
    headline,
    spfLabel: spfOk ? 'SPF ✓' : spfFail ? `SPF ✕ (${auth.spf})` : 'SPF Yok',
    dmarcLabel: dmarcOk ? 'DMARC ✓' : dmarcFail ? `DMARC ✕ (${auth.dmarc})` : 'DMARC Yok',
    dkimLabel: dkimOk ? 'DKIM ✓' : dkimFail ? 'DKIM ✕' : 'DKIM Yok',
  };
}

function toDraft(compose: ComposeState, accountId: string): Draft {
  return {
    id: compose.draftId, accountId,
    to: compose.to, cc: compose.cc, bcc: compose.bcc,
    subject: compose.subject, body: compose.body,
    attachments: compose.attachments.filter((file) => !String(file.id || '').startsWith('pending-')),
    replyUid: compose.uid || null,
    replyFolder: compose.mode === 'reply' || compose.mode === 'forward' ? compose.replyFolder || 'inbox' : null,
    mode: compose.mode,
  };
}

function rejectedCompose(compose: ComposeState, rejected: string[], accepted: string[]): ComposeState {
  const address = (value: string) => {
    const email = (value.match(/<([^<>]+)>$/)?.[1] || value).trim();
    const separator = email.lastIndexOf('@');
    const local = email.slice(0, separator);
    const domain = email.slice(separator + 1);
    let normalized = domain.toLowerCase();
    try { normalized = new URL(`https://${domain}`).hostname; } catch { /* preserve an unexpected server address safely */ }
    return `${local}@${normalized}`;
  };
  const delivered = new Set(accepted.map(address));
  const remaining = new Map(rejected.filter((value) => !delivered.has(address(value))).map((value) => [address(value), value]));
  const keep = (value: string) => extractRecipientTokens(value).flatMap((entry) => {
    const key = address(entry.trim());
    const recipient = remaining.get(key);
    if (!recipient) return [];
    remaining.delete(key);
    return [recipient];
  }).join(', ');
  const to = keep(compose.to);
  const cc = keep(compose.cc);
  const bcc = [keep(compose.bcc), ...remaining.values()].filter(Boolean).join(', ');
  return { ...compose, to, cc, bcc, showExtra: Boolean(cc || bcc) };
}

function fromDraft(draft: Draft): ComposeState {
  const sourced = Boolean(draft.replyUid && isMailFolder(draft.replyFolder));
  const mode = draft.mode === 'forward' && sourced ? 'forward' : sourced ? 'reply' : 'new';
  return {
    draftId: draft.id,
    mode,
    uid: sourced ? draft.replyUid || undefined : undefined,
    replyFolder: sourced ? draft.replyFolder || undefined : undefined,
    to: draft.to,
    cc: draft.cc,
    bcc: draft.bcc,
    subject: draft.subject,
    body: draft.body,
    showExtra: Boolean(draft.cc || draft.bcc),
    attachments: draft.attachments || [],
  };
}

function ComposeRecipientChips({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const allTokens = extractRecipientTokens(value);
  const tokens = allTokens.filter((t) => t.includes('@'));
  if (tokens.length === 0) return null;
  return (
    <div className="compose-recipient-summary" aria-label={`${label} alıcıları`}>
      <div className="compose-recipient-summary-header">
        <strong>{label} ({tokens.length}):</strong>
        <button
          type="button"
          className="text-btn danger"
          style={{ fontSize: 11, padding: '1px 6px' }}
          onClick={() => onChange('')}
          disabled={disabled}
          title="Tüm alıcıları temizle"
        >
          Tümünü Temizle
        </button>
      </div>
      <div className="compose-recipient-chips">
        {tokens.map((token, idx) => {
          const parsed = parseRecipientToken(token);
          return (
            <span key={idx} className="compose-recipient-chip" title={token}>
              <span className="chip-text">
                {parsed.name ? <strong>{parsed.name} </strong> : null}
                &lt;{parsed.email || token}&gt;
              </span>
              <button
                type="button"
                className="chip-remove"
                onClick={() => {
                  const remaining = tokens.filter((_, i) => i !== idx);
                  onChange(remaining.join(', '));
                }}
                disabled={disabled}
                title={`${parsed.email || token} adresini kaldır`}
                aria-label={`${parsed.email || token} kaldır`}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function Mailbox(props: Props) {
  const [accounts, setAccounts] = useState(props.accounts);
  const [settings, setSettings] = useState(props.settings || emptySettings());
  const [accountId, setAccountId] = useState(props.settings?.defaultAccountId && props.accounts.some((item) => item.id === props.settings?.defaultAccountId) ? props.settings.defaultAccountId : (props.accounts[0]?.id || ''));
  const [folder, setFolder] = useState<FolderRole>('inbox');
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [items, setItems] = useState<ListResult['messages']>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [unseen, setUnseen] = useState<number | null>(null);
  const [listError, setListError] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [message, setMessage] = useState<MailMessage | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [notice, setNotice] = useState('');
  const [undo, setUndo] = useState<UndoMove | null>(null);
  const [folderCounts, setFolderCounts] = useState<Partial<Record<FolderRole, number | null>>>({});
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const canAdd = props.canAddAccount !== false;
  const [showAdd, setShowAdd] = useState(canAdd && props.accounts.length === 0);
  const [imagesFor, setImagesFor] = useState<number | null>(null);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addPreset, setAddPreset] = useState<'domain' | 'kurumsal' | 'gmail' | 'yandex' | 'custom'>('domain');
  const [customImapHost, setCustomImapHost] = useState('');
  const [customImapPort, setCustomImapPort] = useState('993');
  const [customSmtpHost, setCustomSmtpHost] = useState('');
  const [customSmtpPort, setCustomSmtpPort] = useState('465');
  const [addError, setAddError] = useState('');
  const [renameId, setRenameId] = useState('');
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showContactsPage, setShowContactsPage] = useState(false);
  const [accountsWidth, setAccountsWidth] = useState<number | null>(() => {
    try {
      const saved = Number(localStorage.getItem('safirmail_accounts_w'));
      return Number.isFinite(saved) && saved >= 180 && saved <= 440 ? saved : null;
    } catch { return null; }
  });
  const [listWidth, setListWidth] = useState<number | null>(() => {
    try {
      const saved = Number(localStorage.getItem('safirmail_list_w'));
      return Number.isFinite(saved) && saved >= 260 && saved <= 1100 ? saved : null;
    } catch { return null; }
  });
  const [resizingPane, setResizingPane] = useState<'accounts' | 'list' | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [home, setHome] = useState(Boolean(props.loadPreview) && props.accounts.length > 1);
  const [panel, setPanel] = useState<'accounts' | 'list' | 'read' | 'home'>(props.accounts.length === 0 ? 'accounts' : Boolean(props.loadPreview) && props.accounts.length > 1 ? 'home' : 'list');
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({});
  const [previewing, setPreviewing] = useState(false);
  const [previewAt, setPreviewAt] = useState<number | null>(null);
  const [revalidating, setRevalidating] = useState(false);
  const [tick, setTick] = useState(0);
  const [arrived, setArrived] = useState<{ ids: string[]; at: number } | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [pickedContacts, setPickedContacts] = useState<string[]>([]);
  const [bulkPasteInput, setBulkPasteInput] = useState('');
  const [activeRecipientField, setActiveRecipientField] = useState<'to' | 'cc' | 'bcc' | null>(null);
  const [pickerGroupFilter, setPickerGroupFilter] = useState<string>('all');
  const pickerInteractingRef = useRef(false);
  const [showMultiSenders, setShowMultiSenders] = useState(false);
  const [multiSenders, setMultiSenders] = useState<string[]>([]);
  const [quickReplyText, setQuickReplyText] = useState('');
  const [contactGroupFilter, setContactGroupFilter] = useState<string>('all');
  const [assignGroupName, setAssignGroupName] = useState<string>('Müşteriler');
  const [previewModal, setPreviewModal] = useState<{ filename: string; contentType: string; url: string; text?: string; index: number } | null>(null);
  const [labelFilter, setLabelFilter] = useState<string>('');
  const [trackRead, setTrackRead] = useState<boolean>(false);
  const [trackingList, setTrackingList] = useState<MailTrackingInfo[]>([]);
  const [customLabels, setCustomLabels] = useState<Record<string, string[]>>(() => props.settings?.customLabels || {});
  const [quota, setQuota] = useState<MailboxQuota | null>(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveMode, setArchiveMode] = useState<'days' | 'size' | 'count'>('days');
  const [archiveResult, setArchiveResult] = useState<ArchiveRunResult | null>(null);
  const [archiveError, setArchiveError] = useState('');
  const [undoSendItem, setUndoSendItem] = useState<UndoSendItem | null>(null);
  const [pinnedMap, setPinnedMap] = useState<Record<string, number[]>>(() => props.settings?.pinned || {});
  const pinnedUids = accountId ? (pinnedMap[accountId] || []) : [];
  const [snoozedAll, setSnoozedAll] = useState<Record<string, Record<string, number>>>(() => props.settings?.snoozed || {});
  const snoozedMap = useMemo(() => {
    const raw = accountId ? (snoozedAll[accountId] || {}) : {};
    const now = Date.now();
    const active: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      const ts = Number(v);
      if (Number.isFinite(ts) && ts > now) active[k] = ts;
    }
    return active;
  }, [accountId, snoozedAll, tick]);
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>(() => props.scheduleMail ? [] : (props.settings?.scheduledEmails || []));
  const [showScheduledModal, setShowScheduledModal] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [globalSearchMeta, setGlobalSearchMeta] = useState<{ scanned: number; matched: number } | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const customFoldersCacheRef = useRef<Record<string, string[]>>({});
  const lastFaviconTotalRef = useRef<number | null>(null);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [attachmentsOnly, setAttachmentsOnly] = useState(false);
  const [unauthOnly, setUnauthOnly] = useState(false);
  const [schedulePickerOpen, setSchedulePickerOpen] = useState(false);
  const [recipientsExpanded, setRecipientsExpanded] = useState(true);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);
  const [customScheduleDate, setCustomScheduleDate] = useState('');
  const [activeCustomView, setActiveCustomView] = useState<'snoozed' | null>(null);
  const migratedScheduledRef = useRef(false);

  const pinnedSet = useMemo(() => new Set(pinnedUids), [pinnedUids]);
  const trackingMap = useMemo(() => new Map(trackingList.map((t) => [t.subject, t])), [trackingList]);

  const unauthCount = useMemo(() => {
    if (folder === 'sent') return 0;
    let count = 0;
    for (const item of items) {
      if (folder === 'inbox' && snoozedMap[item.uid]) continue;
      const auth = describeAuthResults(item.authResults, item.folder || folder);
      if (auth?.hasIssue) count += 1;
    }
    return count;
  }, [items, folder, snoozedMap]);

  const displayList = useMemo(() => {
    const filtered = items.filter((item) => {
      if (activeCustomView === 'snoozed') {
        return Boolean(snoozedMap[item.uid]);
      }
      if (folder === 'inbox' && snoozedMap[item.uid]) {
        return false;
      }
      if (flaggedOnly && !item.flagged) return false;
      if (attachmentsOnly && !item.hasAttachments) return false;
      if (unauthOnly) {
        const auth = describeAuthResults(item.authResults, item.folder || folder);
        if (!auth?.hasIssue) return false;
      }
      if (!labelFilter) return true;
      const matched = (settings.rules || []).length ? evaluateRules(item, settings.rules || []) : { labels: [] };
      const manual = customLabels[`${accountId}:${folder}:${item.uid}`] || [];
      return matched.labels.includes(labelFilter) || (item.labels || []).includes(labelFilter) || manual.includes(labelFilter);
    });

    if (folder === 'inbox' && !query && activeCustomView === null && pinnedSet.size > 0) {
      const pinned: typeof items = [];
      const unpinned: typeof items = [];
      for (const i of filtered) {
        if (pinnedSet.has(i.uid)) pinned.push(i);
        else unpinned.push(i);
      }
      return [...pinned, ...unpinned];
    }
    return filtered;
  }, [items, activeCustomView, snoozedMap, folder, flaggedOnly, attachmentsOnly, unauthOnly, labelFilter, settings.rules, customLabels, accountId, query, pinnedSet]);

  useEffect(() => {
    if (props.settings?.customLabels) setCustomLabels(props.settings.customLabels);
    if (props.settings?.pinned) setPinnedMap(props.settings.pinned);
    if (props.settings?.snoozed) setSnoozedAll(props.settings.snoozed);
    if (!props.scheduleMail && props.settings?.scheduledEmails) {
      setScheduledEmails(props.settings.scheduledEmails);
    }
  }, [props.settings?.customLabels, props.settings?.pinned, props.settings?.snoozed, props.settings?.scheduledEmails, props.scheduleMail]);

  useEffect(() => {
    if (!props.loadScheduled) return;
    let active = true;
    const syncScheduled = async () => {
      try {
        if (!migratedScheduledRef.current && props.scheduleMail && props.settings?.scheduledEmails?.length) {
          migratedScheduledRef.current = true;
          const futureItems = props.settings.scheduledEmails.filter((item) => item.scheduledAt > Date.now() + 15000);
          for (const legacy of futureItems) {
            try {
              await props.scheduleMail([{ accountId: legacy.accountId, payload: legacy.payload }], legacy.scheduledAt);
            } catch { /* ignore individual migration errors */ }
          }
          void props.saveSettings?.({ scheduledEmails: [] }).catch(() => undefined);
        }
        const list = await props.loadScheduled!();
        if (active && mounted.current) setScheduledEmails(list);
      } catch { /* ignore background sync errors */ }
    };
    void syncScheduled();
    return () => { active = false; };
  }, [props.loadScheduled, tick]);

  const loadCustomFolders = async (force = false) => {
    if (!accountId || home) return;
    const acc = accounts.find((item) => item.id === accountId);
    if (!acc || acc.enabled === false) return;
    if (!force && customFoldersCacheRef.current[accountId]) {
      setCustomFolders(customFoldersCacheRef.current[accountId]);
      return;
    }
    try {
      const res = await api<{ folders: Array<{ path: string; name: string; specialUse?: string }> }>(`/api/accounts/${accountId}/folders`);
      if (res && Array.isArray(res.folders)) {
        const standard = ['inbox', 'sent', 'trash', 'spam', 'archive', 'drafts', 'junk', 'gelen kutusu', 'gönderilenler', 'çöp kutusu'];
        const custom = [...new Set(
          res.folders
            .filter((f) => !f.specialUse && !standard.includes((f.name || '').toLowerCase()) && !standard.includes((f.path || '').toLowerCase()))
            .map((f) => f.name || f.path)
        )];
        customFoldersCacheRef.current[accountId] = custom;
        setCustomFolders(custom);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!home) void loadCustomFolders();
  }, [accountId, home]);

  useEffect(() => {
    if (props.scheduleMail) return undefined;
    const timer = setInterval(() => {
      const now = Date.now();
      setScheduledEmails((currentList) => {
        const due = currentList.filter((item) => item.scheduledAt <= now);
        if (due.length === 0) return currentList;

        const remaining = currentList.filter((item) => item.scheduledAt > now);
        void persistSettings({ scheduledEmails: remaining });

        for (const item of due) {
          void props.sendMail(item.accountId, item.payload)
            .then(() => showToast(`Zamanlanmış ileti gönderildi: "${item.subject}"`))
            .catch((err) => showToast(`Zamanlanmış ileti gönderilemedi: "${item.subject}" - ${err instanceof Error ? err.message : 'Hata'}`));
        }
        return remaining;
      });
    }, 10000);
    return () => clearInterval(timer);
  }, [props.sendMail, props.scheduleMail]);

  useEffect(() => {
    setAttachmentsExpanded(false);
  }, [message?.uid, accountId, folder]);

  const togglePin = (uid: number) => {
    if (!accountId) return;
    const prev = pinnedMap;
    const curList = prev[accountId] || [];
    const nextList = curList.includes(uid) ? curList.filter((id) => id !== uid) : [uid, ...curList];
    const next = { ...prev, [accountId]: nextList };
    if (nextList.length === 0) delete next[accountId];
    setPinnedMap(next);
    void persistSettings({ pinned: next }).catch((err) => {
      setPinnedMap(prev);
      showToast(err instanceof Error ? err.message : 'Sabitleme kaydedilemedi.');
    });
  };

  const snoozeMessage = (uid: number, wakeTime: number) => {
    if (!accountId) return;
    const prev = snoozedAll;
    const now = Date.now();
    const curAcc: Record<string, number> = {};
    for (const [k, v] of Object.entries(prev[accountId] || {})) {
      if (Number(v) > now) curAcc[k] = Number(v);
    }
    curAcc[String(uid)] = wakeTime;
    const next = { ...prev, [accountId]: curAcc };
    setSnoozedAll(next);
    void persistSettings({ snoozed: next }).catch((err) => {
      setSnoozedAll(prev);
      showToast(err instanceof Error ? err.message : 'Erteleme kaydedilemedi.');
    });
    showToast(`İleti ${new Date(wakeTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} zamanına kadar ertelendi.`);
    if (message && message.uid === uid) {
      setMessage(null);
    }
  };

  const unsnoozeMessage = (uid: number) => {
    if (!accountId) return;
    const prev = snoozedAll;
    const now = Date.now();
    const curAcc: Record<string, number> = {};
    for (const [k, v] of Object.entries(prev[accountId] || {})) {
      if (k !== String(uid) && Number(v) > now) curAcc[k] = Number(v);
    }
    const next = { ...prev };
    if (Object.keys(curAcc).length > 0) {
      next[accountId] = curAcc;
    } else {
      delete next[accountId];
    }
    setSnoozedAll(next);
    if (activeCustomView === 'snoozed' && Object.keys(curAcc).length === 0) {
      setActiveCustomView(null);
    }
    void persistSettings({ snoozed: next }).catch((err) => {
      setSnoozedAll(prev);
      showToast(err instanceof Error ? err.message : 'Erteleme kaldırılamadı.');
    });
    showToast('Erteleme kaldırıldı, ileti gelen kutusuna döndü.');
  };

  function cleanupRemovedInboxMeta(accId: string, uids: number[]) {
    if (!accId || !uids.length) return;
    const removedSet = new Set(uids.map((u) => String(u)));
    const nextPatch: Partial<UserSettings> = {};
    const curSnoozedAcc = snoozedAll[accId];
    if (curSnoozedAcc && Object.keys(curSnoozedAcc).some((k) => removedSet.has(k))) {
      const cleanedAcc: Record<string, number> = {};
      for (const [k, v] of Object.entries(curSnoozedAcc)) {
        if (!removedSet.has(k)) cleanedAcc[k] = v;
      }
      const nextSnoozed = { ...snoozedAll };
      if (Object.keys(cleanedAcc).length > 0) nextSnoozed[accId] = cleanedAcc;
      else delete nextSnoozed[accId];
      setSnoozedAll(nextSnoozed);
      nextPatch.snoozed = nextSnoozed;
    }
    const curPinnedAcc = pinnedMap[accId];
    if (curPinnedAcc && curPinnedAcc.some((u) => removedSet.has(String(u)))) {
      const cleanedPinned = curPinnedAcc.filter((u) => !removedSet.has(String(u)));
      const nextPinned = { ...pinnedMap };
      if (cleanedPinned.length > 0) nextPinned[accId] = cleanedPinned;
      else delete nextPinned[accId];
      setPinnedMap(nextPinned);
      nextPatch.pinned = nextPinned;
    }
    if (Object.keys(nextPatch).length > 0) {
      void persistSettings(nextPatch).catch(() => undefined);
    }
  }

  const handleCreateCustomFolder = async (folderName: string) => {
    if (!accountId || !folderName.trim()) return;
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; path: string; name: string }>(`/api/accounts/${accountId}/folders`, {
        method: 'POST',
        body: { name: folderName.trim() },
      });
      if (res.ok) {
        showToast(`"${res.name}" klasörü oluşturuldu.`);
        setShowNewFolderModal(false);
        await loadCustomFolders(true);
        openFolder(res.name as FolderRole);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Klasör oluşturulamadı.');
    } finally {
      setBusy(false);
    }
  };

  const isExternalRecipient = (emailAddr: string) => {
    if (!account?.email) return false;
    const senderDomain = account.email.split('@')[1]?.toLowerCase();
    const recipientDomain = (emailAddr.match(/<([^<>]+)>$/)?.[1] || emailAddr).split('@')[1]?.toLowerCase();
    if (!senderDomain || !recipientDomain) return false;
    return senderDomain !== recipientDomain;
  };
  const touchRowRef = useRef<{ uid: number; startX: number; startY: number } | null>(null);

  function toggleMessageLabel(uid: number, labelId: string) {
    const key = `${accountId}:${folder}:${uid}`;
    const prev = customLabels;
    const existing = prev[key] || [];
    const nextList = existing.includes(labelId) ? existing.filter((id) => id !== labelId) : [...existing, labelId];
    const next = { ...prev };
    if (nextList.length > 0) next[key] = nextList;
    else delete next[key];
    setCustomLabels(next);
    void persistSettings({ customLabels: next }).catch((err) => {
      setCustomLabels(prev);
      showToast(err instanceof Error ? err.message : 'Etiket kaydedilemedi.');
    });
  }
  const pullListRef = useRef<{ startY: number; armed: boolean } | null>(null);
  const previewBusy = useRef(false);
  const lastPreview = useRef(0);
  const knownTop = useRef<Record<string, number>>({});
  const previewVersion = useRef<Record<string, number>>({});
  const pendingOpen = useRef<number | null>(null);
  const [listCache] = useState(() => createMailListCache(REFRESH_GAP_MS));
  const viewVersion = useRef(0);
  const readerVersion = useRef(0);
  const seenVersion = useRef(0);
  const draftsVersion = useRef(0);
  const paginationView = useRef<number | null>(null);
  const refreshView = useRef<number | null>(null);
  const operation = useRef(false);
  const mounted = useRef(true);
  const lastSaved = useRef(composeFingerprint(emptyCompose()));
  const lastRefresh = useRef(Date.now());
  const toastTimer = useRef(0);
  const composeRef = useRef<ComposeState | null>(null);
  const dirtyRef = useRef(false);
  const renderVersion = viewVersion.current;

  const account = accounts.find((item) => item.id === accountId) || accounts[0] || null;
  const ownEmailsRef = useRef<Set<string>>(new Set());
  ownEmailsRef.current = new Set(accounts.map((a) => a.email.trim().toLowerCase()));
  const seenMsgUidsRef = useRef<Set<string>>(new Set());
  const localSeenOverridesRef = useRef<Map<string, { seen: boolean; at: number }>>(new Map());
  const localRemovedRef = useRef<Map<string, number>>(new Map());
  const notifiedUidsRef = useRef<Set<string>>(new Set());

  function recordLocalSeen(accId: string, role: FolderRole, uids: number[], seen: boolean) {
    const now = Date.now();
    for (const uid of uids) {
      localSeenOverridesRef.current.set(`${accId}:${role}:${uid}`, { seen, at: now });
      if (seen && role === 'inbox') {
        notifiedUidsRef.current.add(`${accId}:${uid}`);
      }
    }
  }

  function recordLocalRemoved(accId: string, role: FolderRole, uids: number[]) {
    const now = Date.now();
    for (const uid of uids) {
      localRemovedRef.current.set(`${accId}:${role}:${uid}`, now);
      if (role === 'inbox') {
        notifiedUidsRef.current.add(`${accId}:${uid}`);
      }
    }
  }

  function clearLocalRemoved(accId: string, role: FolderRole, uids: number[]) {
    for (const uid of uids) {
      localRemovedRef.current.delete(`${accId}:${role}:${uid}`);
    }
  }

  function reconcileListWithLocalState(accId: string, role: FolderRole, raw: ListResult, filterUnseen = false): ListResult {
    const now = Date.now();
    let unseenDelta = 0;
    let mutated = false;
    const nextMessages: ListResult['messages'] = [];
    for (const msg of raw.messages || []) {
      const key = `${accId}:${role}:${msg.uid}`;
      const removedAt = localRemovedRef.current.get(key);
      if (removedAt != null) {
        if (now - removedAt < 60000) {
          mutated = true;
          if (!msg.seen) unseenDelta -= 1;
          continue;
        }
        localRemovedRef.current.delete(key);
      }
      const ov = localSeenOverridesRef.current.get(key);
      if (ov != null) {
        if (now - ov.at < 90000) {
          if (msg.seen !== ov.seen) {
            mutated = true;
            unseenDelta += ov.seen ? -1 : 1;
            if (filterUnseen && ov.seen) continue;
            nextMessages.push({ ...msg, seen: ov.seen });
            continue;
          }
          if (filterUnseen && ov.seen) {
            mutated = true;
            continue;
          }
        } else {
          localSeenOverridesRef.current.delete(key);
        }
      }
      nextMessages.push(msg);
    }
    if (!mutated) return raw;
    const adjust = (val: number | null | undefined) => (val == null ? val : Math.max(0, val + unseenDelta));
    return {
      ...raw,
      messages: nextMessages,
      unseen: role === 'inbox' ? (adjust(raw.unseen) ?? null) : raw.unseen,
      folderUnseen: adjust(raw.folderUnseen),
      inboxUnseen: role === 'inbox' ? adjust(raw.inboxUnseen) : raw.inboxUnseen,
      total: Math.max(0, (raw.total || 0) - ((raw.messages?.length || 0) - nextMessages.length)),
    };
  }

  function reconcilePreviewWithLocalState(accId: string, raw: InboxPreview): InboxPreview {
    const now = Date.now();
    let unseenDelta = 0;
    let mutated = false;
    const nextMessages: InboxPreview['messages'] = [];
    for (const msg of raw.messages || []) {
      const key = `${accId}:inbox:${msg.uid}`;
      const removedAt = localRemovedRef.current.get(key);
      if (removedAt != null) {
        if (now - removedAt < 60000) {
          mutated = true;
          if (!msg.seen) unseenDelta -= 1;
          continue;
        }
        localRemovedRef.current.delete(key);
      }
      const ov = localSeenOverridesRef.current.get(key);
      if (ov != null) {
        if (now - ov.at < 90000) {
          if (msg.seen !== ov.seen) {
            mutated = true;
            unseenDelta += ov.seen ? -1 : 1;
            nextMessages.push({ ...msg, seen: ov.seen });
            continue;
          }
        } else {
          localSeenOverridesRef.current.delete(key);
        }
      }
      nextMessages.push(msg);
    }
    if (!mutated) return raw;
    return {
      ...raw,
      messages: nextMessages,
      unseen: raw.unseen == null ? null : Math.max(0, raw.unseen + unseenDelta),
      total: Math.max(0, (raw.total || 0) - ((raw.messages?.length || 0) - nextMessages.length)),
    };
  }

  function syncPreviewMutation(accId: string, role: FolderRole, uids: number[], action: { seen?: boolean; remove?: boolean; unseenDelta: number }) {
    if (role !== 'inbox' || !uids.length) return;
    const uidSet = new Set(uids);
    setPreviews((current) => {
      const prev = current[accId];
      if (!prev || !prev.data) return current;
      const nextMsgs = action.remove
        ? prev.data.messages.filter((m) => !uidSet.has(m.uid))
        : (action.seen !== undefined
          ? prev.data.messages.map((m) => (uidSet.has(m.uid) ? { ...m, seen: action.seen! } : m))
          : prev.data.messages);
      const nextUnseen = prev.data.unseen == null ? null : Math.max(0, prev.data.unseen + action.unseenDelta);
      const nextFresh = (action.remove || action.seen === true)
        ? prev.fresh.filter((u) => !uidSet.has(u))
        : prev.fresh;
      return {
        ...current,
        [accId]: {
          ...prev,
          fresh: nextFresh,
          data: {
            ...prev.data,
            unseen: nextUnseen,
            messages: nextMsgs,
          },
        },
      };
    });
  }

  function syncIdbListMutation(accId: string, role: FolderRole, uids: number[], action: { seen?: boolean; remove?: boolean; unseenDelta: number }) {
    if (typeof indexedDB === 'undefined' || !uids.length) return;
    const uidSet = new Set(uids);
    void idbUpdateList(accId, role, (cur) => {
      const nextMessages = action.remove
        ? cur.messages.filter((m) => !uidSet.has(m.uid))
        : (action.seen !== undefined
          ? cur.messages.map((m) => (uidSet.has(m.uid) ? { ...m, seen: action.seen! } : m))
          : cur.messages);
      const adj = (v: number | null | undefined) => (v == null ? v : Math.max(0, v + action.unseenDelta));
      return {
        ...cur,
        messages: nextMessages,
        unseen: role === 'inbox' ? (adj(cur.unseen) ?? null) : cur.unseen,
        folderUnseen: adj(cur.folderUnseen),
        inboxUnseen: role === 'inbox' ? adj(cur.inboxUnseen) : cur.inboxUnseen,
      };
    });
  }

  function mergeContactsIntoState(entries: { email: string; name?: string; sent?: boolean }[]) {
    if (!entries.length) return;
    const normalized: { key: string; email: string; name: string; sent: boolean }[] = [];
    for (const entry of entries) {
      const raw = String(entry.email || '').trim();
      const email = (raw.match(/<([^<>]+)>$/)?.[1] || raw).trim();
      if (!email || !email.includes('@') || /[\s\r\n<>]/.test(email)) continue;
      const key = email.toLowerCase();
      if (ownEmailsRef.current.has(key)) continue;
      const cleanName = String(entry.name || '').replace(/[\r\n"<>]/g, ' ').trim();
      normalized.push({ key, email, name: cleanName, sent: Boolean(entry.sent) });
    }
    if (!normalized.length) return;
    const targetKeys = new Set(normalized.map((entry) => entry.key));
    setSettings((current) => {
      const recent = current.recent || [];
      const indexByKey = new Map<string, number>();
      for (let i = 0; i < recent.length; i++) {
        const lower = recent[i]?.email?.toLowerCase();
        if (lower && targetKeys.has(lower)) indexByKey.set(lower, i);
      }
      let nextList: UserSettings['recent'] | null = null;
      const now = Date.now();
      for (const entry of normalized) {
        const idx = indexByKey.get(entry.key);
        const currentList = nextList || recent;
        const prev = idx != null ? currentList[idx] : undefined;
        const hasUsefulName = Boolean(entry.name && entry.name.toLowerCase() !== entry.key);
        if (prev && !entry.sent && (!hasUsefulName || prev.name)) continue;
        if (!nextList) nextList = recent.slice();
        const updated: UserSettings['recent'][number] = {
          email: prev?.email || entry.email,
          name: hasUsefulName ? entry.name : (prev?.name || ''),
          sentCount: (prev?.sentCount || 0) + (entry.sent ? 1 : 0),
          receivedCount: (prev?.receivedCount || 0) + (entry.sent ? 0 : 1),
          lastAt: Math.max(prev?.lastAt || 0, now),
          ...(prev?.group ? { group: prev.group } : {}),
          ...(prev?.phone ? { phone: prev.phone } : {}),
          ...(prev?.company ? { company: prev.company } : {}),
          ...(prev?.notes ? { notes: prev.notes } : {}),
        };
        if (idx != null) {
          nextList[idx] = updated;
        } else {
          indexByKey.set(entry.key, nextList.length);
          nextList.push(updated);
        }
      }
      if (!nextList) return current;
      const sorted = nextList
        .sort((a, b) => ((b.sentCount || 0) - (a.sentCount || 0)) || (((b.sentCount || 0) + (b.receivedCount || 0)) - ((a.sentCount || 0) + (a.receivedCount || 0))) || ((b.lastAt || 0) - (a.lastAt || 0)))
        .slice(0, 25000);
      return { ...current, recent: sorted };
    });
  }

  useEffect(() => {
    if (!items.length) return;
    const isSent = folder === 'sent';
    const entries: { email: string; name?: string; sent?: boolean }[] = [];
    for (const item of items) {
      const tag = `${account?.id || ''}:${folder}:${item.uid}`;
      if (seenMsgUidsRef.current.has(tag)) continue;
      seenMsgUidsRef.current.add(tag);
      if (item.fromEmail) entries.push({ email: item.fromEmail, name: item.from, sent: false });
      if (item.toEmail) entries.push({ email: item.toEmail, name: item.to, sent: isSent });
      for (const addr of item.toEmails || []) entries.push({ email: addr, sent: isSent });
      for (const addr of item.ccEmails || []) entries.push({ email: addr, sent: isSent });
    }
    if (entries.length) mergeContactsIntoState(entries);
  }, [items, folder, account?.id]);

  useEffect(() => {
    if (!message) return;
    const isSent = folder === 'sent';
    const entries: { email: string; name?: string; sent?: boolean }[] = [];
    if (message.fromEmail) entries.push({ email: message.fromEmail, name: message.from, sent: false });
    for (const addr of message.toEmails || []) entries.push({ email: addr, sent: isSent });
    for (const addr of message.ccEmails || []) entries.push({ email: addr, sent: isSent });
    if (entries.length) mergeContactsIntoState(entries);
  }, [message, folder]);

  useEffect(() => {
    const entries: { email: string; name?: string; sent?: boolean }[] = [];
    for (const [accId, state] of Object.entries(previews)) {
      for (const msg of state?.data?.messages || []) {
        const tag = `prev:${accId}:${msg.uid}`;
        if (seenMsgUidsRef.current.has(tag)) continue;
        seenMsgUidsRef.current.add(tag);
        if (msg.fromEmail) entries.push({ email: msg.fromEmail, name: msg.from, sent: false });
      }
    }
    if (entries.length) mergeContactsIntoState(entries);
  }, [previews]);

  useEffect(() => {
    setAccounts(props.accounts);
  }, [props.accounts]);

  useEffect(() => {
    if (props.settings) setSettings(props.settings);
  }, [props.settings]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    if (!accountId && accounts[0]) setAccountId(accounts[0].id);
  }, [accountId, accounts]);
  composeRef.current = compose;
  const dirty = Boolean(compose && composeFingerprint(compose) !== lastSaved.current);
  dirtyRef.current = dirty;

  function confirmLeave() {
    if (!dirtyRef.current) return true;
    return window.confirm('Kaydedilmemiş ileti var. Çıkmak istiyor musunuz?');
  }

  function showToast(text: string, nextUndo: UndoMove | null = null) {
    setNotice(text);
    setUndo(nextUndo);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      if (!mounted.current) return;
      setNotice('');
      setUndo(null);
    }, nextUndo ? 8000 : 4500);
  }

  function bumpUnseen(role: FolderRole, delta: number) {
    if (!delta) return;
    if (role === 'inbox') setUnseen((current) => (current == null ? current : Math.max(0, current + delta)));
    setFolderCounts((current) => {
      const value = role === 'inbox' ? (current.inbox ?? null) : (current[role] ?? null);
      if (value == null && role !== 'inbox') return current;
      const base = role === 'inbox' ? (value ?? 0) : value;
      if (base == null) return current;
      return { ...current, [role]: Math.max(0, base + delta) };
    });
  }

  function folderBadge(role: FolderRole) {
    const value = role === 'inbox' ? unseen : folderCounts[role];
    return value ? <em className="count" data-count={String(value)} aria-label={`${value} okunmamış`} /> : null;
  }

  function rememberSaved(next: ComposeState) {
    lastSaved.current = composeFingerprint(next);
    setDraftStatus('saved');
  }

  function signatureFor(mode: ComposeState['mode']) {
    const row = account ? settings.signatures[account.id] : null;
    if (!row) return '';
    return mode === 'new' ? row.new : (row.reply || row.new);
  }

  function beginCompose(next: ComposeState, saved = false) {
    readerVersion.current += 1;
    setMessageLoading(false);
    const signed = saved ? next : { ...next, body: withSignature(next.body, signatureFor(next.mode)) };
    setCompose(signed);
    lastSaved.current = saved ? composeFingerprint(signed) : composeFingerprint(emptyCompose());
    setDraftStatus(saved ? 'saved' : 'idle');
    setShowMultiSenders(false);
    setMultiSenders(account ? [account.id] : []);
    setActiveRecipientField(null);
    setPickerGroupFilter('all');
    setHome(false);
    setMessage(null);
    setShowDrafts(false);
    setShowAdd(false);
    setShowSettings(false);
    setShowContactsPage(false);
    setNotice('');
    setUndo(null);
    setPanel('read');
  }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; window.clearTimeout(toastTimer.current); viewVersion.current += 1; readerVersion.current += 1; draftsVersion.current += 1; };
  }, []);

  const consumedPrefillKeyRef = useRef<number>(0);
  useEffect(() => {
    if (!props.composePrefill || consumedPrefillKeyRef.current === props.composePrefill.key) return;
    if (!account && accounts.length === 0) return;
    consumedPrefillKeyRef.current = props.composePrefill.key;
    beginCompose({
      ...emptyCompose(),
      to: props.composePrefill.to,
      subject: props.composePrefill.subject,
      body: textToHtml(props.composePrefill.body),
    });
    props.onPrefillConsumed?.();
  }, [props.composePrefill, account, accounts.length]);

  function clearView() {
    viewVersion.current += 1;
    readerVersion.current += 1;
    setItems([]);
    setNextCursor(null);
    setMessage(null);
    setMessageLoading(false);
    setListError('');
    setShowDrafts(false);
    setSelected([]);
  }

  function currentView(version: number) {
    return mounted.current && version === viewVersion.current;
  }

  const isGlobalSearchActive = Boolean(globalSearch && draftQuery.length >= 2 && props.searchAllAccounts);

  useEffect(() => {
    const version = ++viewVersion.current;
    readerVersion.current += 1;
    setItems([]);
    setNextCursor(null);
    setMessage(null);
    setMessageLoading(false);
    setRevalidating(false);
    setRefreshing(false);

    if (!home && isGlobalSearchActive && props.searchAllAccounts) {
      let cancel = false;
      setListLoading(true);
      setListError('');
      setGlobalSearchMeta(null);
      props.searchAllAccounts(folder, draftQuery, unseenOnly)
        .then((res) => {
          if (cancel || !currentView(version)) return;
          setItems(res.messages || []);
          setNextCursor(null);
          setGlobalSearchMeta({ scanned: res.scannedAccounts, matched: res.matchedAccounts });
          setSelected([]);
          lastRefresh.current = Date.now();
          setRefreshedAt(lastRefresh.current);
        })
        .catch((err: Error) => {
          if (!cancel && currentView(version)) setListError(err.message);
        })
        .finally(() => {
          if (!cancel && currentView(version)) {
            setRevalidating(false);
            setListLoading(false);
          }
        });
      return () => { cancel = true; };
    }

    setGlobalSearchMeta(null);
    if (home || !account || account.enabled === false) {
      setListLoading(false);
      if (account && account.enabled === false) setListError('Bu hesap pasif. Ayarlardan etkinleştirin.');
      return undefined;
    }
    let cancel = false;
    const key = { accountId: account.id, folder, cursor: null, q: draftQuery, unseen: unseenOnly };
    const revision = listCache.revision(account.id);
    const memo = listCache.peek(key);
    const fresh = memo && Date.now() - memo.at < REFRESH_GAP_MS;
    const apply = (raw: ListResult) => {
      const data = reconcileListWithLocalState(account.id, folder, raw, unseenOnly);
      const inbox = data.inboxUnseen ?? data.unseen;
      setItems(data.messages);
      setNextCursor(data.nextCursor);
      if (inbox != null || folder === 'inbox') setUnseen(inbox);
      setFolderCounts((current) => ({
        ...current,
        ...(inbox != null || folder === 'inbox' ? { inbox } : {}),
        [folder]: data.folderUnseen ?? (folder === 'inbox' ? inbox : current[folder]),
      }));
      updateInboxPreview(data);
    };
    if (memo) {
      apply(memo.data);
      setListLoading(false);
      setRevalidating(!fresh);
      setRefreshedAt(memo.at);
      lastRefresh.current = memo.at;
    } else {
      setListLoading(true);
      if (!draftQuery && !unseenOnly && typeof indexedDB !== 'undefined') {
        void idbGetList(account.id, folder).then((cached) => {
          if (!cancel && currentView(version) && revision === listCache.revision(account.id) && cached && !listCache.peek(key)) {
            apply(cached);
          }
        });
      }
    }
    setListError('');
    listCache.load(key, () => props.loadList(account.id, folder, null, draftQuery, unseenOnly))
      .then((raw) => {
        if (cancel || !currentView(version) || revision !== listCache.revision(account.id)) return;
        const data = reconcileListWithLocalState(account.id, folder, raw, unseenOnly);
        apply(data);
        if (!draftQuery && !unseenOnly && typeof indexedDB !== 'undefined') {
          void idbSaveList(account.id, folder, data);
        }
        setSelected([]);
        lastRefresh.current = listCache.peek(key)?.at || Date.now();
        setRefreshedAt(lastRefresh.current);
      })
      .catch((err: Error) => { if (!cancel && currentView(version) && revision === listCache.revision(account.id) && !memo) setListError(err.message); })
      .finally(() => {
        if (!cancel && currentView(version)) {
          setRevalidating(false);
          setListLoading(false);
        }
      });
    return () => { cancel = true; };
  }, [isGlobalSearchActive ? '__GLOBAL__' : accountId, folder, draftQuery, unseenOnly, isGlobalSearchActive ? true : account?.enabled, home, isGlobalSearchActive]);

  useEffect(() => {
    if (home || !account || account.enabled === false || folder !== 'sent' || !props.loadTracking) {
      setTrackingList([]);
      return;
    }
    let cancel = false;
    props.loadTracking(account.id)
      .then((rows) => { if (!cancel && mounted.current) setTrackingList(rows || []); })
      .catch(() => { if (!cancel && mounted.current) setTrackingList([]); });
    return () => { cancel = true; };
  }, [account?.id, account?.enabled, folder, home]);

  useEffect(() => {
    const version = ++draftsVersion.current;
    setDrafts([]);
    if (home || !account || account.enabled === false) return;
    props.loadDrafts(account.id)
      .then((rows) => { if (mounted.current && version === draftsVersion.current) setDrafts(rows); })
      .catch(() => { if (mounted.current && version === draftsVersion.current) setDrafts([]); });
    return () => { if (version === draftsVersion.current) draftsVersion.current += 1; };
  }, [account?.id, account?.enabled, home]);

  useEffect(() => {
    if (!compose || !account || busy || operation.current) return;
    if (isComposeBlank(compose) || composeFingerprint(compose) === lastSaved.current) return;
    const timer = window.setTimeout(() => { void persistDraft(true); }, AUTO_SAVE_MS);
    return () => window.clearTimeout(timer);
  }, [compose, account?.id, busy]);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, []);

  useEffect(() => {
    let lastPollTime = Date.now();
    const visible = () => !document.visibilityState || document.visibilityState === 'visible';
    const onVisible = (force = false) => {
      const now = Date.now();
      if (visible() && (force || now - lastPollTime >= 30000)) {
        lastPollTime = now;
        setTick((value) => value + 1);
      }
    };
    const timer = window.setInterval(() => onVisible(true), POLL_MS);
    const handleEvent = () => onVisible(false);
    document.addEventListener('visibilitychange', handleEvent);
    window.addEventListener('focus', handleEvent);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleEvent);
      window.removeEventListener('focus', handleEvent);
    };
  }, []);

  useEffect(() => {
    if (!tick) return;
    void loadPreviews(false);
    if (!home) void refreshList(false);
  }, [tick]);

  const accountKey = accounts.map((item) => `${item.id}:${item.enabled === false ? 0 : 1}`).join(',');
  useEffect(() => {
    void loadPreviews(true);
  }, [accountKey]);

  useEffect(() => {
    if (!arrived || home || !account || !arrived.ids.includes(account.id)) return;
    if (folder === 'inbox' && !draftQuery && !unseenOnly && !showDrafts) void refreshList(true);
  }, [arrived]);

  useEffect(() => {
    if (home || !accountId || !props.loadQuota) {
      setQuota(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      props.loadQuota!(accountId)
        .then((q) => { if (active && mounted.current) setQuota(q); })
        .catch(() => { if (active && mounted.current) setQuota(null); });
    }, 1800);
    return () => { active = false; window.clearTimeout(timer); };
  }, [accountId, home]);

  async function handleRunArchive() {
    if (!props.runArchive || !account || archiving) return;
    setArchiving(true);
    setArchiveError('');
    setArchiveResult(null);
    try {
      const options: ArchiveRunOptions = {
        role: folder === 'archive' ? 'inbox' : folder,
      };
      if (archiveMode === 'days') options.olderThanDays = 30;
      else if (archiveMode === 'size') options.minSizeBytes = 2 * 1024 * 1024;
      else if (archiveMode === 'count') options.limit = 50;

      const res = await props.runArchive(account.id, options);
      setArchiveResult(res);
      showToast(`${res.archivedCount} ileti Firebase'e arşivlendi, ${fileSize(res.freedBytes)} yer açıldı.`);
      if (props.loadQuota) {
        props.loadQuota(account.id).then(setQuota).catch(() => undefined);
      }
      listCache.invalidate(account.id);
      void refreshList(true);
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Arşivleme sırasında hata oluştu.');
    } finally {
      setArchiving(false);
    }
  }

  useEffect(() => {
    const total = accounts.reduce((sum, item) => sum + (previews[item.id]?.data?.unseen || 0), 0);
    if (lastFaviconTotalRef.current === total) return;
    lastFaviconTotalRef.current = total;
    document.title = total ? `(${total}) Safir Mail` : 'Safir Mail';
    const nav = navigator as Navigator & { setAppBadge?: (count?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (total > 0 && typeof nav.setAppBadge === 'function') {
      nav.setAppBadge(total).catch(() => undefined);
    } else if (total === 0 && typeof nav.clearAppBadge === 'function') {
      nav.clearAppBadge().catch(() => undefined);
    }
    try {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
      if (link && typeof document.createElement === 'function') {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
        if (ctx) {
          ctx.fillStyle = '#0f2942';
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(4, 4, 56, 56, 14) : ctx.rect(4, 4, 56, 56);
          ctx.fill();
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 30px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('S', 32, 34);
          if (total > 0) {
            const label = total > 99 ? '99+' : String(total);
            ctx.fillStyle = '#dc2626';
            ctx.beginPath();
            ctx.arc(48, 16, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(label, 48, 17);
          }
          link.href = canvas.toDataURL('image/png');
        }
      }
    } catch { /* ignore canvas errors in headless tests */ }
  }, [previews, accounts]);

  function notifyIncomingMail(title: string, body: string) {
    try {
      if (settings.sound !== 'off') {
        const AudioCtx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
          || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const now = ctx.currentTime;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.type = 'sine';
          osc2.type = 'triangle';
          osc1.frequency.setValueAtTime(587.33, now);
          osc1.frequency.setValueAtTime(880, now + 0.11);
          osc2.frequency.setValueAtTime(1174.66, now + 0.11);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.start(now);
          osc2.start(now + 0.11);
          osc1.stop(now + 0.38);
          osc2.stop(now + 0.38);
        }
      }
    } catch { /* ignore audio errors */ }
    try {
      if ('Notification' in window && window.Notification?.permission === 'granted') {
        new window.Notification(title, { body, icon: '/icon-192.png', tag: 'safirmail-incoming' });
      }
    } catch { /* ignore notification errors */ }
  }

  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> } | null>(null);
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      if ('prompt' in event) setInstallPrompt(event as unknown as { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> });
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  async function installPwa() {
    if (!installPrompt) return;
    try { await installPrompt.prompt(); await installPrompt.userChoice; } catch { /* ignore */ }
    setInstallPrompt(null);
  }

  useEffect(() => {
    if (compose || showSettings || showContactsPage || showAdd || showDrafts) setHome(false);
  }, [compose, showSettings, showContactsPage, showAdd, showDrafts]);

  useEffect(() => {
    const uid = pendingOpen.current;
    if (!uid || home || listLoading || !account || renderVersion !== viewVersion.current) return;
    pendingOpen.current = null;
    void openMessage(uid);
  }, [listLoading, items, accountId, folder, home]);

  async function loadPreviews(force: boolean) {
    const load = props.loadPreview;
    if (!load || previewBusy.current) return;
    if (!force && Date.now() - lastPreview.current < PREVIEW_GAP_MS) return;
    const listCoversInbox = !home && folder === 'inbox' && !draftQuery && !unseenOnly;
    const targets = accounts.filter((item) => item.enabled !== false && !(listCoversInbox && item.id === account?.id));
    if (!targets.length) return;
    previewBusy.current = true;
    lastPreview.current = Date.now();
    setPreviewing(true);
    const arrivals: { id: string; name: string; count: number }[] = [];
    let next = 0;
    const worker = async () => {
      while (next < targets.length) {
        const item = targets[next];
        next += 1;
        const request = (previewVersion.current[item.id] || 0) + 1;
        previewVersion.current[item.id] = request;
        try {
          const rawData = await load(item.id, force);
          if (!mounted.current) return;
          if (request !== previewVersion.current[item.id]) continue;
          const data = reconcilePreviewWithLocalState(item.id, rawData);
          const hasBefore = Object.prototype.hasOwnProperty.call(knownTop.current, item.id);
          const before = knownTop.current[item.id] || 0;
          const maxMsgUid = data.messages.reduce((max, row) => Math.max(max, row.uid || 0), 0);
          const topUid = Math.max(data.lastUid || 0, maxMsgUid);
          if (!hasBefore) {
            for (const row of data.messages) {
              notifiedUidsRef.current.add(`${item.id}:${row.uid}`);
            }
          }
          knownTop.current[item.id] = Math.max(before, topUid);
          const fresh = (hasBefore && before > 0)
            ? data.messages
              .filter((row) => row.uid > before && !row.seen && !notifiedUidsRef.current.has(`${item.id}:${row.uid}`))
              .map((row) => row.uid)
            : [];
          for (const uid of fresh) {
            notifiedUidsRef.current.add(`${item.id}:${uid}`);
          }
          if (fresh.length) arrivals.push({ id: item.id, name: item.displayName || item.email, count: fresh.length });
          setPreviews((current) => ({
            ...current,
            [item.id]: { data, error: '', fresh: [...new Set([...(current[item.id]?.fresh || []), ...fresh])] },
          }));
        } catch (err) {
          if (!mounted.current) return;
          if (request !== previewVersion.current[item.id]) continue;
          const text = err instanceof Error ? err.message : 'Bağlantı hatası';
          setPreviews((current) => ({ ...current, [item.id]: { ...current[item.id], fresh: current[item.id]?.fresh || [], error: text } }));
        }
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(PREVIEW_WORKERS, targets.length) }, worker));
    } finally {
      previewBusy.current = false;
      if (mounted.current) {
        setPreviewing(false);
        setPreviewAt(Date.now());
      }
    }
    if (!mounted.current || !arrivals.length) return;
    const count = arrivals.reduce((sum, item) => sum + item.count, 0);
    const summaryText = `${count} yeni ileti · ${arrivals.map((item) => item.name).join(', ')}`;
    showToast(summaryText);
    notifyIncomingMail('Safir Mail — Yeni İleti', summaryText);
    setArrived({ ids: arrivals.map((item) => item.id), at: Date.now() });
  }

  function updateInboxPreview(data: ListResult) {
    if (!props.loadPreview || !account || folder !== 'inbox' || draftQuery || unseenOnly) return;
    const id = account.id;
    previewVersion.current[id] = (previewVersion.current[id] || 0) + 1;
    const hasBefore = Object.prototype.hasOwnProperty.call(knownTop.current, id);
    const before = knownTop.current[id] || 0;
    const lastUid = data.messages.reduce((max, row) => Math.max(max, row.uid || 0), 0);
    if (!hasBefore) {
      for (const row of data.messages) {
        notifiedUidsRef.current.add(`${id}:${row.uid}`);
      }
    }
    knownTop.current[id] = Math.max(before, lastUid);
    const fresh = (hasBefore && before > 0)
      ? data.messages
        .filter((row) => row.uid > before && !row.seen && !notifiedUidsRef.current.has(`${id}:${row.uid}`))
        .map((row) => row.uid)
      : [];
    for (const uid of fresh) {
      notifiedUidsRef.current.add(`${id}:${uid}`);
    }
    const preview: InboxPreview = {
      unseen: data.inboxUnseen ?? data.unseen,
      total: data.total,
      lastUid,
      messages: data.messages.slice(0, 4),
    };
    setPreviews((current) => ({
      ...current,
      [id]: { data: preview, error: '', fresh: [...new Set([...(current[id]?.fresh || []), ...fresh])] },
    }));
    setPreviewAt(Date.now());
    if (fresh.length) {
      const summaryText = `${fresh.length} yeni ileti · ${account.displayName || account.email}`;
      showToast(summaryText);
      notifyIncomingMail('Safir Mail — Yeni İleti', summaryText);
    }
  }

  function clearFresh(id: string) {
    setPreviews((current) => (current[id]?.fresh.length ? { ...current, [id]: { ...current[id], fresh: [] } } : current));
  }

  function goHome() {
    if (operation.current || !props.loadPreview) return;
    if (compose && !confirmLeave()) return;
    setCompose(null);
    setShowSettings(false);
    setShowContactsPage(false);
    setShowAdd(false);
    setShowDrafts(false);
    setHome(true);
    setPanel('home');
    void loadPreviews(false);
  }

  function openFromHome(id: string, uid?: number) {
    if (operation.current) return;
    clearFresh(id);
    if (id !== accountId) {
      pendingOpen.current = uid || null;
      if (!chooseAccount(id)) pendingOpen.current = null;
      return;
    }
    pendingOpen.current = uid || null;
    setQuery('');
    setDraftQuery('');
    setUnseenOnly(false);
    setShowDrafts(false);
    setHome(false);
    setPanel('list');
    if (folder !== 'inbox') chooseFolder('inbox');
  }

  function refreshAll() {
    void loadPreviews(true);
    if (!home) void refreshList(true);
  }

  async function refreshList(force = false) {
    if (home || !account || account.enabled === false || operation.current || listLoading || refreshView.current === viewVersion.current) return;
    if (!force && Date.now() - lastRefresh.current < REFRESH_GAP_MS) return;
    const version = viewVersion.current;
    const revision = listCache.revision(account.id);
    const key = { accountId: account.id, folder, cursor: null, q: draftQuery, unseen: unseenOnly };
    refreshView.current = version;
    setRefreshing(true);
    try {
      const rawData = await listCache.load(key, () => props.loadList(account.id, folder, null, draftQuery, unseenOnly, force), force);
      if (!currentView(version) || revision !== listCache.revision(account.id)) return;
      const data = reconcileListWithLocalState(account.id, folder, rawData, unseenOnly);
      const inbox = data.inboxUnseen ?? data.unseen;
      setItems(data.messages);
      setNextCursor(data.nextCursor);
      if (inbox != null || folder === 'inbox') setUnseen(inbox);
      setFolderCounts((current) => ({
        ...current,
        ...(inbox != null || folder === 'inbox' ? { inbox } : {}),
        [folder]: data.folderUnseen ?? (folder === 'inbox' ? inbox : current[folder]),
      }));
      updateInboxPreview(data);
      if (!draftQuery && !unseenOnly && typeof indexedDB !== 'undefined') {
        void idbSaveList(account.id, folder, data);
      }
      setListError('');
      lastRefresh.current = Date.now();
      setRefreshedAt(lastRefresh.current);
    } catch (err) {
      if (currentView(version)) setListError(err instanceof Error ? err.message : 'Bağlantı hatası');
    } finally {
      if (refreshView.current === version) refreshView.current = null;
      if (currentView(version)) setRefreshing(false);
    }
  }

  function chooseAccount(id: string) {
    if (operation.current) return false;
    if (globalSearch) setGlobalSearch(false);
    if (id === accountId) {
      if (home) {
        clearFresh(id);
        setHome(false);
        setPanel('list');
        return true;
      }
      return false;
    }
    if (!confirmLeave()) return false;
    clearFresh(id);
    setHome(false);
    setRenameId('');
    setActiveCustomView(null);
    setUnauthOnly(false);
    clearView();
    draftsVersion.current += 1;
    setDrafts([]);
    setAccountId(id);
    setFolder('inbox');
    setMessage(null);
    setCompose(null);
    setShowDrafts(false);
    setShowAdd(false);
    setShowSettings(false);
    setShowContactsPage(false);
    setPanel('list');
    return true;
  }

  function chooseFolder(next: FolderRole) {
    if (operation.current || next === folder) return;
    setUnauthOnly(false);
    clearView();
    setFolder(next);
  }

  function startCompose() {
    if (!account || operation.current) return;
    if (compose && !confirmLeave()) return;
    beginCompose(emptyCompose(), true);
  }

  async function openMessage(uid: number, explicitAccountId?: string) {
    const targetAccId = explicitAccountId || account?.id || '';
    if (!targetAccId || operation.current || listLoading || renderVersion !== viewVersion.current) return;
    if (compose && !confirmLeave()) return;
    if (explicitAccountId && explicitAccountId !== accountId) {
      setAccountId(explicitAccountId);
    }
    const version = viewVersion.current;
    const request = ++readerVersion.current;
    const listed = items.find((item) => item.uid === uid && (!explicitAccountId || !item.accountId || item.accountId === explicitAccountId));
    const previewListed = !listed && folder === 'inbox'
      ? previews[targetAccId]?.data?.messages.find((item) => item.uid === uid)
      : undefined;
    const wasSeen = listed ? listed.seen !== false : (previewListed ? previewListed.seen !== false : true);
    setPanel('read');
    setCompose(null);
    setShowDrafts(false);
    setShowAdd(false);
    setShowSettings(false);
    setShowContactsPage(false);

    // Optimistically mark unread message as read in 0ms so row & counters update immediately
    if (!wasSeen) {
      recordLocalSeen(targetAccId, folder, [uid], true);
      listCache.invalidate(targetAccId);
      setItems((current) => current.map((item) => (
        item.uid === uid && (!explicitAccountId || !item.accountId || item.accountId === explicitAccountId)
          ? { ...item, seen: true }
          : item
      )));
      if (!explicitAccountId || explicitAccountId === accountId) {
        bumpUnseen(folder, -1);
      }
      syncPreviewMutation(targetAccId, folder, [uid], { seen: true, unseenDelta: -1 });
      syncIdbListMutation(targetAccId, folder, [uid], { seen: true, unseenDelta: -1 });
    } else if (folder === 'inbox') {
      notifiedUidsRef.current.add(`${targetAccId}:${uid}`);
      syncPreviewMutation(targetAccId, folder, [uid], { unseenDelta: 0, seen: true });
    }

    // Stale-While-Revalidate: check IndexedDB immediately so previously opened emails display instantly (0ms)
    let hasCached = false;
    if (typeof indexedDB !== 'undefined') {
      try {
        const cachedMsg = await idbGetMessage(targetAccId, folder, uid);
        if (cachedMsg && currentView(version) && request === readerVersion.current) {
          setMessage({ ...cachedMsg, seen: true });
          setMessageLoading(false);
          hasCached = true;
        }
      } catch { /* IDB read fallback */ }
    }
    if (!hasCached) {
      setMessageLoading(true);
      setMessage(null);
    }

    try {
      const rawData = await props.loadMessage(targetAccId, folder, uid, !wasSeen);
      const data = { ...rawData, seen: true };
      recordLocalSeen(targetAccId, folder, [uid], true);
      if (typeof indexedDB !== 'undefined') void idbSaveMessage(targetAccId, folder, uid, data);
      if (!listed || !wasSeen) listCache.invalidate(targetAccId);
      if (!currentView(version) || request !== readerVersion.current) return;
      setMessage(data);
      if ((wasSeen && !listed) || (data.authResults && !listed?.authResults)) {
        setItems((current) => current.map((item) => (
          item.uid === uid && (!explicitAccountId || !item.accountId || item.accountId === explicitAccountId)
            ? { ...item, seen: true, ...(data.authResults ? { authResults: data.authResults } : {}) }
            : item
        )));
      }
    } catch (err) {
      if (hasCached) return;
      if (typeof indexedDB !== 'undefined') {
        const cachedMsg = await idbGetMessage(targetAccId, folder, uid);
        if (cachedMsg && currentView(version) && request === readerVersion.current) {
          setMessage(cachedMsg);
          return;
        }
      }
      if (!wasSeen) {
        localSeenOverridesRef.current.delete(`${targetAccId}:${folder}:${uid}`);
        if (currentView(version)) {
          setItems((current) => current.map((item) => (
            item.uid === uid && (!explicitAccountId || !item.accountId || item.accountId === explicitAccountId)
              ? { ...item, seen: false }
              : item
          )));
          if (!explicitAccountId || explicitAccountId === accountId) {
            bumpUnseen(folder, 1);
          }
        }
        syncPreviewMutation(targetAccId, folder, [uid], { seen: false, unseenDelta: 1 });
        syncIdbListMutation(targetAccId, folder, [uid], { seen: false, unseenDelta: 1 });
      }
      if (currentView(version) && request === readerVersion.current) setNotice(err instanceof Error ? err.message : 'Bağlantı hatası');
    } finally {
      if (currentView(version) && request === readerVersion.current) setMessageLoading(false);
    }
  }

  async function older() {
    if (!account || !nextCursor || listLoading || operation.current || renderVersion !== viewVersion.current || paginationView.current === viewVersion.current) return;
    const version = viewVersion.current;
    const revision = listCache.revision(account.id);
    const key = { accountId: account.id, folder, cursor: nextCursor, q: draftQuery, unseen: unseenOnly };
    paginationView.current = version;
    setListLoading(true);
    try {
      const data = await listCache.load(key, () => props.loadList(account.id, folder, nextCursor, draftQuery, unseenOnly));
      if (!currentView(version) || revision !== listCache.revision(account.id)) return;
      setItems((current) => [...current, ...data.messages]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      if (currentView(version)) setListError(err instanceof Error ? err.message : 'Bağlantı hatası');
    } finally {
      if (paginationView.current === version) paginationView.current = null;
      if (currentView(version)) setListLoading(false);
    }
  }

  function startReply() {
    if (!message || !account || operation.current) return;
    beginCompose({ ...emptyCompose(), mode: 'reply', uid: message.uid, replyFolder: folder, ...replyFields(message, account.email), body: quotedHtml(message, 'reply') });
  }

  function startReplyAll() {
    if (!message || !account || operation.current) return;
    beginCompose({ ...emptyCompose(), mode: 'reply', uid: message.uid, replyFolder: folder, ...replyAllFields(message, account.email), body: quotedHtml(message, 'reply') });
  }

  function startForward() {
    if (!message || !account || operation.current) return;
    const targetFolder = message.folder || folder;
    const targetAccountId = message.accountId || account.id;
    beginCompose({ ...emptyCompose(), mode: 'forward', uid: message.uid, replyFolder: targetFolder, ...forwardFields(message, targetFolder, targetAccountId) });
  }

  async function sendQuickReply() {
    if (!message || !account || operation.current || !quickReplyText.trim()) return;
    const fields = replyFields(message, account.email);
    if (!fields.to.trim()) {
      showToast('Yanıtlanacak alıcı adresi bulunamadı.');
      return;
    }
    const sig = signatureFor('reply');
    const quoted = quotedHtml(message, 'reply');
    const safeHtml = typeof textToHtml === 'function' ? textToHtml(quickReplyText.trim()) : quickReplyText.trim();
    const htmlWithSig = withSignature(`<p>${safeHtml}</p>${quoted}`, sig);
    operation.current = true;
    setBusy(true);
    try {
      const result = await props.sendMail(account.id, {
        mode: 'reply',
        sendId: crypto.randomUUID(),
        folder,
        uid: message.uid,
        to: fields.to,
        cc: fields.cc,
        bcc: '',
        subject: fields.subject,
        body: htmlToText(htmlWithSig),
        htmlBody: htmlWithSig,
        attachments: [],
      });
      listCache.invalidate(account.id);
      if (result.ok) {
        setQuickReplyText('');
        showToast('Hızlı yanıt gönderildi.');
      } else {
        showToast('Yanıt kısmen gönderildi veya reddedildi.');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Hızlı yanıt gönderilemedi.');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function openQuickReplyInEditor() {
    if (!message || !account || operation.current) return;
    const safeHtml = typeof textToHtml === 'function' ? textToHtml(quickReplyText.trim()) : quickReplyText.trim();
    const prefix = quickReplyText.trim() ? `<p>${safeHtml}</p>` : '';
    setQuickReplyText('');
    beginCompose({
      ...emptyCompose(),
      mode: 'reply',
      uid: message.uid,
      replyFolder: folder,
      ...replyFields(message, account.email),
      body: `${prefix}${quotedHtml(message, 'reply')}`,
    });
  }

  function canPreviewAttachment(contentType: string, filename: string) {
    const lower = `${contentType} ${filename}`.toLowerCase();
    return lower.includes('pdf') || lower.includes('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|pdf|txt|csv|log|json|xml|md)$/i.test(filename);
  }

  async function openAttachmentPreview(file: { index: number; filename: string; contentType: string; size: number }) {
    if (!account || !message || operation.current) return;
    if (!props.previewFile) {
      void props.downloadFile(account.id, folder, message.uid, file.index, file.filename);
      return;
    }
    setBusy(true);
    try {
      const blob = await props.previewFile(account.id, folder, message.uid, file.index);
      const isText = /^text\//i.test(file.contentType) || /\.(txt|csv|log|json|xml|md)$/i.test(file.filename);
      const text = isText ? await blob.text() : undefined;
      const url = URL.createObjectURL(blob);
      setPreviewModal({ filename: file.filename, contentType: file.contentType, url, text, index: file.index });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Ek önizlenemedi.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function closePreviewModal() {
    if (previewModal?.url) {
      try { URL.revokeObjectURL(previewModal.url); } catch { /* ignore */ }
    }
    setPreviewModal(null);
  }

  async function removeMessage() {
    if (!account || !message || compose || showDrafts || operation.current) return;
    if (folder === 'archive') {
      showToast('Firebase arşivindeki iletiler veri kaybını önlemek için silinemez.');
      return;
    }
    const prompt = folder === 'trash' ? 'İleti kalıcı olarak silinsin mi?' : 'İleti çöp kutusuna taşınsın mı?';
    if (!window.confirm(prompt)) return;
    operation.current = true;
    const version = viewVersion.current;
    const uid = message.uid;
    const snapshot = asListItem(message);
    const wasSeen = message.seen;
    setBusy(true);
    setNotice('');
    setUndo(null);
    try {
      const result = await props.deleteMessage(account.id, folder, uid);
      recordLocalRemoved(account.id, folder, [uid]);
      listCache.invalidate(account.id);
      const delta = wasSeen ? 0 : -1;
      syncPreviewMutation(account.id, folder, [uid], { remove: true, unseenDelta: delta });
      syncIdbListMutation(account.id, folder, [uid], { remove: true, unseenDelta: delta });
      if (props.loadQuota) {
        props.loadQuota(account.id).then((q) => { if (mounted.current) setQuota(q); }).catch(() => undefined);
      }
      if (!currentView(version)) return;
      setItems((current) => current.filter((item) => item.uid !== uid));
      setMessage(null);
      if (folder === 'inbox') cleanupRemovedInboxMeta(account.id, [uid]);
      bumpUnseen(folder, delta);
      showToast(
        result?.permanent ? 'İleti kalıcı olarak silindi.' : 'İleti çöp kutusuna taşındı.',
        result?.permanent ? null : { items: [snapshot], from: 'trash', to: folder, unseenLost: wasSeen ? 0 : 1 },
      );
      setPanel('list');
    } catch (err) {
      if (currentView(version)) showToast(err instanceof Error ? err.message : 'Bağlantı hatası');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function onSend(event: FormEvent) {
    const activeSenders = accounts.filter((a) => a.enabled !== false && multiSenders.includes(a.id));
    if (showMultiSenders || activeSenders.length > 1) {
      event.preventDefault();
      if (!account || !compose || operation.current) return;
      if (![compose.to, compose.cc, compose.bcc].some((value) => value.trim()) || !visibleComposeText(compose.body)) {
        showToast('Alıcı ve ileti metni zorunludur.');
        return;
      }
      if (activeSenders.length === 0) {
        showToast('Lütfen gönderim yapılacak en az bir hesap seçin.');
        return;
      }
      if (activeSenders.length > 1 || activeSenders[0].id !== account.id) {
        operation.current = true;
        const version = viewVersion.current;
        draftsVersion.current += 1;
        setBusy(true);
        setNotice('');
        let okCount = 0;
        const failedNames: string[] = [];
        const primarySig = signatureFor(compose.mode);
        try {
          for (let idx = 0; idx < activeSenders.length; idx += 1) {
            const sender = activeSenders[idx];
            const senderSigRow = settings.signatures[sender.id];
            const senderSig = senderSigRow ? (compose.mode === 'new' ? senderSigRow.new : (senderSigRow.reply || senderSigRow.new)) : '';
            let senderHtml = compose.body;
            if (primarySig && sender.id !== account.id && senderHtml.endsWith(primarySig)) {
              senderHtml = senderHtml.slice(0, senderHtml.length - primarySig.length) + senderSig;
            }
            try {
              const res = await props.sendMail(sender.id, {
                mode: 'new',
                folder: 'inbox',
                to: formatRecipientInput(compose.to),
                cc: formatRecipientInput(compose.cc),
                bcc: formatRecipientInput(compose.bcc),
                subject: compose.subject,
                body: htmlToText(senderHtml) || visibleComposeText(senderHtml),
                htmlBody: senderHtml,
                attachments: compose.attachments.filter((file) => !String(file.id || '').startsWith('pending-')),
                ...(account.id !== sender.id ? { attachmentAccountId: account.id } : {}),
                ...(trackRead ? { track: true } : {}),
                ...(idx < activeSenders.length - 1 ? { keepAttachments: true } : {}),
              });
              if (res.ok && res.accepted.length) {
                okCount += 1;
                listCache.invalidate(sender.id);
                mergeContactsIntoState(res.accepted.map((addr) => ({ email: addr, sent: true })));
              } else {
                failedNames.push(sender.email);
              }
            } catch (err) {
              const reason = err instanceof Error && err.message ? `${sender.email} (${err.message})` : sender.email;
              failedNames.push(reason);
            }
          }
          if (okCount > 0) {
            try { await props.deleteDraft(compose.draftId); } catch { /* ignore */ }
            if (!currentView(version)) return;
            setDrafts((current) => current.filter((item) => item.id !== compose.draftId));
            setCompose(null);
            setShowMultiSenders(false);
            setMultiSenders([]);
            setShowContacts(false);
            showToast(failedNames.length
              ? `${okCount}/${activeSenders.length} hesaptan gönderildi (Hata: ${failedNames.join(', ')}).`
              : `Toplu gönderim tamamlandı: ${okCount} farklı hesaptan başarıyla gönderildi.`);
          } else if (currentView(version)) {
            showToast(failedNames.length
              ? `Seçilen hesaplardan gönderim yapılamadı: ${failedNames.join(', ')}`
              : 'Seçilen hesaplardan gönderim yapılamadı.');
          }
        } finally {
          operation.current = false;
          if (mounted.current) setBusy(false);
        }
        return;
      }
    }
    event.preventDefault();
    if (!account || !compose || operation.current) return;
    if (![compose.to, compose.cc, compose.bcc].some((value) => value.trim()) || !visibleComposeText(compose.body)) {
      showToast('Alıcı ve ileti metni zorunludur.');
      return;
    }
    const sendPayload: SendPayload = {
      mode: compose.mode,
      folder: compose.mode === 'reply' || compose.mode === 'forward' ? compose.replyFolder || 'inbox' : folder,
      uid: compose.uid,
      to: formatRecipientInput(compose.to),
      cc: formatRecipientInput(compose.cc),
      bcc: formatRecipientInput(compose.bcc),
      subject: compose.subject,
      body: htmlToText(compose.body) || visibleComposeText(compose.body),
      htmlBody: compose.body,
      attachments: compose.attachments.filter((file) => !String(file.id || '').startsWith('pending-')),
      ...(trackRead ? { track: true } : {}),
    };

    const undoDelay = Number(settings.undoSendSeconds || 0);
    if (undoDelay > 0) {
      const curCompose = compose;
      const timeoutId = window.setTimeout(() => {
        void executeActualSend(sendPayload, account.id, curCompose);
        setUndoSendItem(null);
      }, undoDelay * 1000);

      const restoredCompose: ComposeState = { ...curCompose };

      setUndoSendItem({
        id: crypto.randomUUID(),
        recipient: formatRecipientInput(compose.to),
        subject: compose.subject || '(Konusuz)',
        totalSeconds: undoDelay,
        onUndo: () => {
          window.clearTimeout(timeoutId);
          setUndoSendItem(null);
          setCompose(restoredCompose);
          setPanel('read');
          showToast('Gönderim geri alındı.');
        },
        onSendNow: () => {
          window.clearTimeout(timeoutId);
          setUndoSendItem(null);
          void executeActualSend(sendPayload, account.id, curCompose);
        },
      });
      setCompose(null);
      showToast(`İleti gönderiliyor… (${undoDelay} sn içinde geri alabilirsiniz)`);
      return;
    }

    await executeActualSend(sendPayload, account.id, compose);
  }

  async function executeActualSend(
    payload: SendPayload,
    targetAccountId: string,
    curCompose?: ComposeState,
  ) {
    operation.current = true;
    const version = viewVersion.current;
    draftsVersion.current += 1;
    setBusy(true);
    setNotice('');
    try {
      const result = await props.sendMail(targetAccountId, payload);
      if (result.accepted.length) {
        listCache.invalidate(targetAccountId);
        mergeContactsIntoState(result.accepted.map((addr) => ({ email: addr, sent: true })));
      }
      if (result.rejected.length) {
        if (curCompose) {
          const retry = rejectedCompose(curCompose, result.rejected, result.accepted);
          const draft = toDraft(retry, targetAccountId);
          let persisted = true;
          try { await props.saveDraft(draft); } catch { persisted = false; }
          if (!currentView(version)) return;
          setCompose(retry);
          rememberSaved(retry);
          setDrafts((current) => [draft, ...current.filter((item) => item.id !== draft.id)]);
          showToast(`${result.accepted.length} alıcı için gönderim kabul edildi; şu alıcılar reddedildi: ${result.rejected.join(', ')}. Yalnız reddedilen alıcılar yeniden gönderim için bırakıldı.${result.stored ? '' : ' Gönderilenler klasörüne yazılamadı.'}${persisted ? '' : ' Kalan taslak sunucuya kaydedilemedi. Sayfayı kapatmadan Taslağı kaydet düğmesini kullanın; sunucudaki eski taslak kabul edilen alıcıları hâlâ içerebilir.'}`);
        } else {
          showToast(`${result.accepted.length} alıcı kabul edildi; reddedilenler: ${result.rejected.join(', ')}.`);
        }
        return;
      }
      if (!result.ok || !result.accepted.length) throw new Error('Gönderim onaylanamadı. Alıcıları kontrol edin.');
      if (curCompose?.draftId) {
        try { await props.deleteDraft(curCompose.draftId); } catch { /* ignore draft delete error after send */ }
        setDrafts((current) => current.filter((item) => item.id !== curCompose.draftId));
      }
      if (currentView(version)) {
        showToast(`${result.stored ? 'İleti gönderildi.' : 'İleti gönderildi. Gönderilenler klasörüne yazılamadı.'}`);
        setCompose(null);
      }
    } catch (err) {
      if (currentView(version)) showToast(err instanceof Error ? err.message : 'Bağlantı hatası');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const handleScheduleSend = async (scheduledTimestamp: number) => {
    if (!account || !compose || operation.current) return;
    if (![compose.to, compose.cc, compose.bcc].some((value) => value.trim()) || !visibleComposeText(compose.body)) {
      showToast('Alıcı ve ileti metni zorunludur.');
      return;
    }
    const activeSenders = accounts.filter((a) => a.enabled !== false && multiSenders.includes(a.id));
    const targetAccounts = (showMultiSenders || activeSenders.length > 1) && activeSenders.length > 0 ? activeSenders : [account];
    const itemsToSchedule = targetAccounts.map((sender, idx) => ({
      accountId: sender.id,
      payload: {
        mode: (targetAccounts.length > 1 ? 'new' : compose.mode) as SendPayload['mode'],
        folder: targetAccounts.length > 1 ? 'inbox' : (compose.mode === 'reply' || compose.mode === 'forward' ? compose.replyFolder || 'inbox' : folder),
        uid: targetAccounts.length > 1 ? undefined : compose.uid,
        to: formatRecipientInput(compose.to),
        cc: formatRecipientInput(compose.cc),
        bcc: formatRecipientInput(compose.bcc),
        subject: compose.subject,
        body: htmlToText(compose.body) || visibleComposeText(compose.body),
        htmlBody: compose.body,
        attachments: compose.attachments.filter((file) => !String(file.id || '').startsWith('pending-')),
        ...(account.id !== sender.id ? { attachmentAccountId: account.id } : {}),
        ...(trackRead ? { track: true } : {}),
        ...(idx < targetAccounts.length - 1 ? { keepAttachments: true } : {}),
      } satisfies SendPayload,
    }));

    if (props.scheduleMail) {
      operation.current = true;
      setBusy(true);
      try {
        const res = await props.scheduleMail(itemsToSchedule, scheduledTimestamp);
        setScheduledEmails((cur) => {
          const addedIds = new Set((res.scheduled || []).map((x) => x.id));
          return [...cur.filter((x) => !addedIds.has(x.id)), ...(res.scheduled || [])].sort((a, b) => a.scheduledAt - b.scheduledAt);
        });
        if (compose.draftId) {
          try { await props.deleteDraft(compose.draftId); } catch { /* ignore */ }
          setDrafts((current) => current.filter((item) => item.id !== compose.draftId));
        }
        setCompose(null);
        setShowMultiSenders(false);
        setMultiSenders([]);
        setSchedulePickerOpen(false);
        showToast(`☁️ Sunucu kuyruğuna zamanlandı (${targetAccounts.length} hesap — tarayıcı kapalıyken de gönderilir): ${new Date(scheduledTimestamp).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'İleti sunucu kuyruğuna eklenemedi.');
      } finally {
        operation.current = false;
        if (mounted.current) setBusy(false);
      }
      return;
    }

    const newItems: ScheduledEmail[] = itemsToSchedule.map((entry) => ({
      id: crypto.randomUUID(),
      accountId: entry.accountId,
      payload: entry.payload,
      scheduledAt: scheduledTimestamp,
      createdAt: Date.now(),
      targetEmail: formatRecipientInput(compose.to),
      subject: compose.subject || '(Konusuz)',
    }));
    const nextList = [...scheduledEmails, ...newItems];
    setScheduledEmails(nextList);
    void persistSettings({ scheduledEmails: nextList });
    if (compose.draftId) {
      try { await props.deleteDraft(compose.draftId); } catch {}
      setDrafts((current) => current.filter((item) => item.id !== compose.draftId));
    }
    setCompose(null);
    setShowMultiSenders(false);
    setMultiSenders([]);
    setSchedulePickerOpen(false);
    showToast(`İleti zamanlandı (${targetAccounts.length} hesap): ${new Date(scheduledTimestamp).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`);
  };

  const handleSendScheduledNow = async (id: string) => {
    const item = scheduledEmails.find((s) => s.id === id);
    if (!item) return;
    if (props.sendScheduledNow) {
      setBusy(true);
      try {
        await props.sendScheduledNow(id);
        setScheduledEmails((cur) => cur.filter((s) => s.id !== id));
        listCache.invalidate(item.accountId);
        showToast(`Zamanlanmış ileti hemen gönderildi: "${item.subject}"`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Zamanlanmış ileti gönderilemedi.');
      } finally {
        if (mounted.current) setBusy(false);
      }
      return;
    }
    const remaining = scheduledEmails.filter((s) => s.id !== id);
    setScheduledEmails(remaining);
    void persistSettings({ scheduledEmails: remaining });
    await executeActualSend(item.payload, item.accountId);
  };

  const handleCancelScheduled = (id: string) => {
    if (props.cancelScheduledMail) {
      setScheduledEmails((cur) => cur.filter((s) => s.id !== id));
      void props.cancelScheduledMail(id)
        .then(() => showToast('Zamanlanmış ileti sunucu kuyruğundan iptal edildi.'))
        .catch((err) => showToast(err instanceof Error ? err.message : 'Zamanlama iptal edilemedi.'));
      return;
    }
    const remaining = scheduledEmails.filter((s) => s.id !== id);
    setScheduledEmails(remaining);
    void persistSettings({ scheduledEmails: remaining });
    showToast('Zamanlanmış ileti iptal edildi.');
  };

  async function persistDraft(silent: boolean) {
    const current = composeRef.current;
    if (!account || !current) return false;
    if (silent && (operation.current || composeFingerprint(current) === lastSaved.current)) return true;
    if (!silent) {
      if (operation.current) return false;
      operation.current = true;
      draftsVersion.current += 1;
      setBusy(true);
    } else {
      setDraftStatus('saving');
    }
    const version = viewVersion.current;
    const snapshot = current;
    try {
      const draft = toDraft(snapshot, account.id);
      await props.saveDraft(draft);
      if (!currentView(version)) return false;
      if (composeRef.current && composeRef.current.draftId === snapshot.draftId && composeFingerprint(composeRef.current) === composeFingerprint(snapshot)) {
        rememberSaved(snapshot);
      }
      setDrafts((rows) => [draft, ...rows.filter((item) => item.id !== draft.id)]);
      if (!silent) showToast('Taslak kaydedildi.');
      return true;
    } catch (err) {
      if (currentView(version)) {
        setDraftStatus('error');
        if (!silent) showToast(err instanceof Error ? err.message : 'Bağlantı hatası');
      }
      return false;
    } finally {
      if (!silent) {
        operation.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  }

  async function onSaveDraft() {
    await persistDraft(false);
  }

  async function setItemSeen(uid: number, next: boolean) {
    const current = items.find((item) => item.uid === uid) || (message?.uid === uid ? message : null);
    if (!account || !current || current.seen === next || operation.current) return;
    const version = viewVersion.current;
    const request = readerVersion.current;
    const seenRequest = ++seenVersion.current;
    try {
      await props.setSeen(account.id, folder, uid, next);
      recordLocalSeen(account.id, folder, [uid], next);
      listCache.invalidate(account.id);
      const delta = current.seen === next ? 0 : (next ? -1 : 1);
      syncPreviewMutation(account.id, folder, [uid], { seen: next, unseenDelta: delta });
      syncIdbListMutation(account.id, folder, [uid], { seen: next, unseenDelta: delta });
      if (!currentView(version) || request !== readerVersion.current || seenRequest !== seenVersion.current) return;
      setMessage((open) => open?.uid === uid ? { ...open, seen: next } : open);
      setItems((rows) => rows.map((item) => (item.uid === uid ? { ...item, seen: next } : item)));
      bumpUnseen(folder, delta);
    } catch (err) {
      if (currentView(version) && request === readerVersion.current) showToast(err instanceof Error ? err.message : 'Bağlantı hatası');
    }
  }

  async function toggleSeen() {
    if (!message) return;
    await setItemSeen(message.uid, !message.seen);
  }

  async function toggleFlagged(target?: { uid: number; flagged: boolean }) {
    const current = target || message;
    if (!account || !current || operation.current) return;
    const version = viewVersion.current;
    const next = !current.flagged;
    try {
      await props.setFlagged(account.id, folder, current.uid, next);
      listCache.invalidate(account.id);
      if (!currentView(version)) return;
      setMessage((open) => (open?.uid === current.uid ? { ...open, flagged: next } : open));
      setItems((rows) => rows.map((item) => (item.uid === current.uid ? { ...item, flagged: next } : item)));
    } catch (err) {
      if (currentView(version)) showToast(err instanceof Error ? err.message : 'Bağlantı hatası');
    }
  }

  async function relocate(destination: FolderRole, done: string) {
    if (!account || !message || compose || showDrafts || operation.current) return;
    operation.current = true;
    const version = viewVersion.current;
    const uid = message.uid;
    const snapshot = asListItem(message);
    const wasSeen = message.seen;
    setBusy(true);
    setNotice('');
    setUndo(null);
    try {
      await props.moveMessage(account.id, folder, uid, destination);
      recordLocalRemoved(account.id, folder, [uid]);
      listCache.invalidate(account.id);
      const delta = wasSeen ? 0 : -1;
      syncPreviewMutation(account.id, folder, [uid], { remove: true, unseenDelta: delta });
      syncIdbListMutation(account.id, folder, [uid], { remove: true, unseenDelta: delta });
      if (!currentView(version)) return;
      setItems((current) => current.filter((item) => item.uid !== uid));
      setMessage(null);
      if (folder === 'inbox') cleanupRemovedInboxMeta(account.id, [uid]);
      bumpUnseen(folder, delta);
      showToast(done, { items: [snapshot], from: destination, to: folder, unseenLost: wasSeen ? 0 : 1 });
      setPanel('list');
    } catch (err) {
      if (currentView(version)) showToast(err instanceof Error ? err.message : 'Bağlantı hatası');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
    if (operation.current) return;
    if (query.trim() !== draftQuery) clearView();
    setDraftQuery(query.trim());
    if (home) { setHome(false); setPanel('list'); }
  }

  async function removeDraft(id: string) {
    if (operation.current) return;
    operation.current = true;
    const version = viewVersion.current;
    draftsVersion.current += 1;
    setBusy(true);
    try {
      await props.deleteDraft(id);
      if (currentView(version)) {
        setDrafts((current) => current.filter((item) => item.id !== id));
        if (composeRef.current?.draftId === id) {
          setCompose(null);
          lastSaved.current = composeFingerprint(emptyCompose());
        }
      }
    } catch (err) {
      if (currentView(version)) setNotice(err instanceof Error ? err.message : 'Taslak silinemedi.');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function onPickFiles(event: FormEvent<HTMLInputElement>) {
    const el = event.currentTarget;
    const picked = Array.from(el.files || []);
    el.value = '';
    await uploadFiles(picked);
  }

  async function uploadFiles(files: File[]) {



    if (!account || !compose || operation.current || !files.length) return;
    operation.current = true;
    setBusy(true);
    const version = viewVersion.current;
    const draftId = compose.draftId;
    const uploadAccountId = account.id;
    const uploadIsCurrent = () => currentView(version) && composeRef.current?.draftId === draftId;
    const pending = files.map((file) => ({
      id: `pending-${file.name}-${file.size}-${file.lastModified}`,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
    }));
    setCompose((current) => current ? { ...current, attachments: [...current.attachments, ...pending] } : current);
    setDraftStatus('saving');
    const uploaded: ComposeAttachment[] = [];
    let keepUploads = false;
    try {
      for (const file of files) {
        uploaded.push(await props.uploadFile(uploadAccountId, file));
      }
      if (!uploadIsCurrent()) return;
      setCompose((current) => {
        if (!current || current.draftId !== draftId) return current;
        const pendingIds = new Set(pending.flatMap((item) => item.id ? [item.id] : []));
        return { ...current, attachments: [...current.attachments.filter((item) => !item.id || !pendingIds.has(item.id)), ...uploaded] };
      });
      keepUploads = true;
      showToast(uploaded.length === 1 ? `${uploaded[0].filename} eklendi.` : `${uploaded.length} ek eklendi.`);
    } catch (err) {
      if (uploadIsCurrent()) {
        setCompose((current) => {
          if (!current || current.draftId !== draftId) return current;
          const pendingIds = new Set(pending.flatMap((item) => item.id ? [item.id] : []));
          return { ...current, attachments: current.attachments.filter((item) => !item.id || !pendingIds.has(item.id)) };
        });
        showToast(err instanceof Error ? err.message : 'Ek yüklenemedi');
        setDraftStatus('error');
      }
    } finally {
      if (!keepUploads) {
        for (const file of uploaded) {
          try { await props.removeUpload(uploadAccountId, file.id || ''); } catch { /* yarıda kalan ek */ }
        }
      }
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function onRemoveFile(id: string) {
    if (!account || !compose || operation.current) return;
    if (id.startsWith('pending-')) {
      setCompose((current) => current ? { ...current, attachments: current.attachments.filter((file) => file.id !== id) } : current);
      return;
    }
    try {
      await props.removeUpload(account.id, id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Ek silinemedi');
      return;
    }
    setCompose((current) => current ? { ...current, attachments: current.attachments.filter((file) => file.id !== id) } : current);
  }

  function startAddAccount() {
    if (!canAdd || operation.current) return;
    if (compose && !confirmLeave()) return;
    readerVersion.current += 1;
    setMessageLoading(false);
    setMessage(null);
    setCompose(null);
    setShowDrafts(false);
    setShowSettings(false);
    setShowContactsPage(false);
    setRenameId('');
    setShowAdd(true);
    setAddError('');
    setHome(false);
    setPanel('read');
  }

  function startRename(item: MailAccount) {
    if (operation.current) return;
    setShowAdd(false);
    setRenameId(item.id);
    setRenameName(item.displayName);
    setRenameError('');
  }

  async function onRenameAccount(event: FormEvent) {
    event.preventDefault();
    if (!renameId || operation.current) return;
    const name = renameName.trim();
    if (!name) {
      setRenameError('Görünen ad boş olamaz.');
      return;
    }
    operation.current = true;
    setBusy(true);
    setRenameError('');
    try {
      const updated = await props.renameAccount(renameId, name);
      setAccounts((current) => current.map((item) => (item.id === updated.id ? { ...item, displayName: updated.displayName } : item)));
      setRenameId('');
      setNotice(`Hesap adı “${updated.displayName}” olarak kaydedildi.`);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Ad kaydedilemedi.');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function canManageAccount(item: MailAccount) {
    return item.permissions?.manage === true || item.id.startsWith('mbox-');
  }

  function toggleSelect(uid: number) {
    setSelected((current) => current.includes(uid) ? current.filter((item) => item !== uid) : [...current, uid]);
  }

  function toggleSelectAll() {
    setSelected((current) => current.length === displayList.length ? [] : displayList.map((item) => item.uid));
  }

  function goBack() {
    if (showHelp) { setShowHelp(false); return; }
    if (compose) {
      if (!confirmLeave()) return;
      setCompose(null);
      setDraftStatus('idle');
      setPanel('list');
      return;
    }
    if (showSettings) { setShowSettings(false); setPanel('list'); return; }
    if (showContactsPage) { setShowContactsPage(false); setPanel('list'); return; }
    if (showAdd) { setShowAdd(false); setPanel(accounts.length ? 'list' : 'accounts'); return; }
    if (showDrafts) { setShowDrafts(false); setPanel('list'); return; }
    if (panel === 'read' || message) {
      setMessage(null);
      setMessageLoading(false);
      setPanel('list');
      return;
    }
    setPanel('accounts');
  }

  async function onTestAccount(item: MailAccount) {
    if (!props.testAccount || operation.current) return;
    operation.current = true;
    setBusy(true);
    setNotice('');
    try {
      const result = await props.testAccount(item.id);
      const imap = result.imap.ok ? 'IMAP bağlantısı başarılı' : `IMAP: ${result.imap.error || 'bağlantı hatası'}`;
      const smtp = result.smtp.ok ? 'SMTP bağlantısı başarılı' : `SMTP: ${result.smtp.error || 'bağlantı hatası'}`;
      setNotice(result.ok ? `${item.email} hesabı doğrulandı. ${imap}. ${smtp}.` : `${item.email} bağlantı testi: ${imap} · ${smtp}`);
      setAccounts((rows) => rows.map((row) => row.id === item.id ? {
        ...row,
        lastOkAt: result.ok ? new Date().toISOString() : row.lastOkAt,
        lastError: result.ok ? '' : [result.imap.ok ? '' : result.imap.error, result.smtp.ok ? '' : result.smtp.error].filter(Boolean).join(' · '),
      } : row));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Bağlantı testi başarısız.');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function onRemoveAccount(item: MailAccount) {
    if (!props.removeAccount || operation.current) return;
    if (!window.confirm(`${item.email} hesabı listeden kaldırılsın mı?`)) return;
    operation.current = true;
    setBusy(true);
    setNotice('');
    try {
      const result = await props.removeAccount(item.id);
      listCache.invalidate(item.id);
      const remaining = accounts.filter((row) => row.id !== item.id);
      setAccounts(remaining);
      setRenameId('');
      if (item.id === accountId) {
        clearView();
        setAccountId(remaining[0]?.id || '');
        setFolder('inbox');
        setCompose(null);
        setPanel(remaining.length ? 'list' : 'accounts');
      }
      setNotice(result?.disabled ? `${item.email} kapatıldı ve listeden kaldırıldı.` : `${item.email} listeden kaldırıldı.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Hesap kaldırılamadı.');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function applyBulk(action: BulkAction, destination?: FolderRole, prompt?: string, uidsArg?: number[]) {
    if (!account || !props.bulkMessages || operation.current) return;
    const uids = action === 'empty' ? items.map((item) => item.uid) : (uidsArg || selected);
    if (action !== 'empty' && !uids.length) return;
    if (prompt && !window.confirm(prompt)) return;
    operation.current = true;
    const version = viewVersion.current;
    const chosen = new Set(uids);
    const removed = items.filter((item) => chosen.has(item.uid));
    const unseenLost = removed.filter((item) => !item.seen).length;
    setBusy(true);
    setNotice('');
    setUndo(null);
    try {
      const result = await props.bulkMessages(account.id, folder, uids, action, destination);
      listCache.invalidate(account.id);
      if (props.loadQuota && (action === 'delete' || action === 'empty' || action === 'move')) {
        props.loadQuota(account.id).then((q) => { if (mounted.current) setQuota(q); }).catch(() => undefined);
      }
      if (!currentView(version)) return;
      if (action === 'seen' || action === 'unseen') {
        const seen = action === 'seen';
        const delta = seen ? -unseenLost : removed.filter((item) => item.seen).length;
        recordLocalSeen(account.id, folder, uids, seen);
        syncPreviewMutation(account.id, folder, uids, { seen, unseenDelta: delta });
        syncIdbListMutation(account.id, folder, uids, { seen, unseenDelta: delta });
        setItems((rows) => rows.map((item) => chosen.has(item.uid) ? { ...item, seen } : item));
        setMessage((open) => open && chosen.has(open.uid) ? { ...open, seen } : open);
        bumpUnseen(folder, delta);
      } else if (action === 'star' || action === 'unstar') {
        const flagged = action === 'star';
        setItems((rows) => rows.map((item) => chosen.has(item.uid) ? { ...item, flagged } : item));
        setMessage((open) => open && chosen.has(open.uid) ? { ...open, flagged } : open);
      } else {
        recordLocalRemoved(account.id, folder, uids);
        syncPreviewMutation(account.id, folder, uids, { remove: true, unseenDelta: -unseenLost });
        syncIdbListMutation(account.id, folder, uids, { remove: true, unseenDelta: -unseenLost });
        setItems((rows) => action === 'empty' ? [] : rows.filter((item) => !chosen.has(item.uid)));
        setMessage((open) => open && chosen.has(open.uid) ? null : open);
        if (folder === 'inbox') cleanupRemovedInboxMeta(account.id, uids);
        bumpUnseen(folder, -unseenLost);
        if (action === 'empty' || (message && chosen.has(message.uid))) setPanel('list');
      }
      setSelected([]);
      const movedTo = action === 'delete' ? 'trash' : destination;
      const canUndo = Boolean(movedTo && movedTo !== folder && action !== 'empty' && action !== 'seen' && action !== 'unseen' && action !== 'star' && action !== 'unstar' && !result?.permanent);
      const undoState = canUndo ? { items: removed, from: movedTo as FolderRole, to: folder, unseenLost } : null;
      if (action === 'empty') {
        showToast(result?.truncated ? 'İlk 1000 ileti silindi. Klasörü yeniden boşaltın.' : 'Klasör boşaltıldı.');
      } else if (action === 'delete') {
        showToast(result?.permanent ? 'Seçilen iletiler kalıcı olarak silindi.' : `${uids.length} ileti çöp kutusuna taşındı.`, undoState);
      } else if (action === 'move' && destination === 'archive') showToast(`${uids.length} ileti arşivlendi.`, undoState);
      else if (action === 'move' && destination === 'spam') showToast(`${uids.length} ileti spam olarak işaretlendi.`, undoState);
      else if (action === 'move' && destination === 'inbox') showToast('Seçilen iletiler gelen kutusuna alındı.', undoState);
      else if (action === 'move' && destination === 'trash') showToast(`${uids.length} ileti çöp kutusuna taşındı.`, undoState);
      else if (action === 'seen') showToast('Seçilen iletiler okundu yapıldı.');
      else if (action === 'unseen') showToast('Seçilen iletiler okunmadı yapıldı.');
      else if (action === 'star') showToast('Seçilen iletiler yıldızlandı.');
      else showToast('Seçim güncellendi.');
    } catch (err) {
      if (currentView(version)) showToast(err instanceof Error ? err.message : 'Bağlantı hatası');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function undoLast() {
    if (!account || !undo || operation.current) return;
    const snapshot = undo;
    operation.current = true;
    const version = viewVersion.current;
    setBusy(true);
    try {
      const uids = snapshot.items.map((item) => item.uid);
      if (props.bulkMessages) await props.bulkMessages(account.id, snapshot.from, uids, 'move', snapshot.to);
      else {
        for (const uid of uids) await props.moveMessage(account.id, snapshot.from, uid, snapshot.to);
      }
      clearLocalRemoved(account.id, snapshot.to, uids);
      listCache.invalidate(account.id);
      if (!currentView(version)) return;
      if (folder === snapshot.to) {
        setItems((rows) => {
          const have = new Set(rows.map((item) => item.uid));
          return [...snapshot.items.filter((item) => !have.has(item.uid)), ...rows];
        });
      }
      bumpUnseen(snapshot.to, snapshot.unseenLost);
      showToast('İşlem geri alındı.');
    } catch (err) {
      if (currentView(version)) showToast(err instanceof Error ? err.message : 'Geri alma başarısız.');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function actOnRow(item: ListResult['messages'][number], kind: 'seen' | 'archive' | 'delete' | 'star') {
    if (operation.current || busy) return;
    if (kind === 'star') { void toggleFlagged(item); return; }
    if (kind === 'seen') { void setItemSeen(item.uid, !item.seen); return; }
    if (kind === 'archive') {
      if (props.bulkMessages) { void applyBulk('move', 'archive', undefined, [item.uid]); return; }
      return;
    }
    if (kind === 'delete') {
      if (folder === 'trash') {
        if (!window.confirm('İleti kalıcı olarak silinsin mi?')) return;
      }
      if (props.bulkMessages) { void applyBulk('delete', undefined, undefined, [item.uid]); return; }
    }
  }

  function openNeighbor(dir: 1 | -1) {
    if (!displayList.length || operation.current) return;
    const index = message ? displayList.findIndex((item) => item.uid === message.uid && (!item.accountId || item.accountId === (message.accountId || accountId))) : -1;
    const next = index < 0 ? (dir === 1 ? 0 : displayList.length - 1) : index + dir;
    if (next < 0 || next >= displayList.length) return;
    const target = displayList[next];
    void openMessage(target.uid, target.accountId);
  }

  async function onAddAccount(event: FormEvent) {
    event.preventDefault();
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setAddError('');
    try {
      const created = await props.addAccount({
        displayName: addName.trim(),
        email: addEmail.trim(),
        password: addPassword,
        preset: addPreset,
        ...(addPreset === 'custom'
          ? {
              imapHost: customImapHost.trim(),
              imapPort: Number(customImapPort) || 993,
              smtpHost: (customSmtpHost || customImapHost).trim(),
              smtpPort: Number(customSmtpPort) || 465,
            }
          : {}),
      });
      listCache.invalidate(created.id);
      setAddPassword('');
      setAddName('');
      setAddEmail('');
      setCustomImapHost('');
      setCustomSmtpHost('');
      setShowAdd(false);
      setNotice(`${created.email} eklendi.`);
      setAccounts((current) => [...current.filter((item) => item.id !== created.id), created]);
      if (created.id !== accountId) {
        clearView();
        setAccountId(created.id);
        setFolder('inbox');
        setPanel('list');
      }
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Hesap eklenemedi.');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function onConnectGoogle() {
    if (!props.connectGoogleAccount || operation.current) return;
    operation.current = true;
    setBusy(true);
    setAddError('');
    try {
      const created = await props.connectGoogleAccount(addName.trim() || undefined);
      listCache.invalidate(created.id);
      setAddPassword('');
      setAddName('');
      setAddEmail('');
      setShowAdd(false);
      setNotice(`${created.email} Google ile bağlandı.`);
      setAccounts((current) => [...current.filter((item) => item.id !== created.id), created]);
      if (created.id !== accountId) {
        clearView();
        setAccountId(created.id);
        setFolder('inbox');
        setPanel('list');
      }
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Google ile bağlantı kurulamadı.');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function persistSettings(patch: Partial<UserSettings>) {
    if (!props.saveSettings) {
      setSettings((current) => ({ ...current, ...patch, signatures: patch.signatures || current.signatures }));
      return;
    }
    const next = await props.saveSettings(patch);
    if (next) setSettings(next);
    else setSettings((current) => ({ ...current, ...patch, signatures: patch.signatures || current.signatures, templates: patch.templates || current.templates }));
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    if (!props.setAccountEnabled || operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      const updated = await props.setAccountEnabled(id, enabled);
      listCache.invalidate(id);
      setAccounts((rows) => rows.map((row) => row.id === updated.id ? { ...row, ...updated } : row));
      setNotice(enabled ? 'Hesap etkinleştirildi.' : 'Hesap pasifleştirildi.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Hesap güncellenemedi.');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function moveAccount(id: string, dir: -1 | 1) {
    const ids = accounts.map((item) => item.id);
    const index = ids.indexOf(id);
    const next = index + dir;
    if (index < 0 || next < 0 || next >= ids.length) return;
    const order = [...ids];
    [order[index], order[next]] = [order[next], order[index]];
    setAccounts(order.map((item) => accounts.find((row) => row.id === item)!).filter(Boolean));
    void persistSettings({ accountOrder: order });
  }

  function changeComposeAccount(nextId: string) {
    if (operation.current || busy || !compose || !nextId || nextId === accountId) return;
    const target = accounts.find((item) => item.id === nextId && item.enabled !== false);
    if (!target) return;
    const oldSig = signatureFor(compose.mode);
    const nextRow = settings.signatures[nextId];
    const nextSig = nextRow ? (compose.mode === 'new' ? nextRow.new : (nextRow.reply || nextRow.new)) : '';
    let nextBody = compose.body;
    if (oldSig && nextBody.endsWith(oldSig)) {
      nextBody = nextBody.slice(0, nextBody.length - oldSig.length) + nextSig;
    } else if (!visibleComposeText(nextBody) && nextSig) {
      nextBody = withSignature('', nextSig);
    }
    // Kaynak iletiden gelen ekler (İlet) hangi hesaptan okunacağını taşır; böylece
    // gönderen değişse de korunur. Sunucuda önceki hesaba yüklenmiş ekler ise
    // yeni hesapta bulunamayacağı için eskisi gibi kaldırılır.
    const sourceAccountId = account?.id;
    const nextAttachments = compose.attachments
      .filter((item) => !item.id)
      .map((item) => (item.source && !item.source.accountId && sourceAccountId
        ? { ...item, source: { ...item.source, accountId: sourceAccountId } }
        : item));
    const dropped = compose.attachments.length - nextAttachments.length;
    // Yanıt, önceki hesaptaki iletiye bağlıdır; yeni hesapta yeni ileti olarak gider.
    const keepThread = compose.mode === 'forward';
    setAccountId(nextId);
    setCompose({
      ...compose,
      mode: keepThread ? compose.mode : 'new',
      uid: keepThread ? compose.uid : undefined,
      replyFolder: keepThread ? compose.replyFolder : undefined,
      body: nextBody,
      attachments: nextAttachments,
    });
    showToast(dropped > 0 ? `Gönderen ${target.email} olarak değiştirildi (önceki hesaba yüklenen ekleri yeniden ekleyin).` : `Gönderen hesap: ${target.displayName} (${target.email})`);
  }

  const allRecipientCandidates = useMemo(() => {
    const seen = new Set<string>();
    const out: ContactItem[] = [];
    for (const item of settings.recent) {
      const key = emailKey(item.email);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    for (const acc of accounts) {
      if (acc.enabled === false) continue;
      const key = emailKey(acc.email);
      if (!key || seen.has(key) || key === emailKey(account?.email || '')) continue;
      seen.add(key);
      out.push({
        email: acc.email,
        name: acc.displayName || '',
        group: 'Hesaplarım',
        sentCount: 0,
        receivedCount: 0,
        lastAt: 0,
      });
    }
    return out;
  }, [settings.recent, accounts, account?.email]);

  function toggleRecipientInField(email: string, fieldName: 'to' | 'cc' | 'bcc' = 'to', keepTrailingSeparator = false) {
    if (!compose || busy || !email) return;
    const targetKey = emailKey(email);
    const rawVal = compose[fieldName] || '';
    const allTokens = extractRecipientTokens(rawVal);
    const completeTokens = allTokens.filter((token, idx) => {
      const parsed = parseRecipientToken(token).email;
      const isCompleteEmail = /^[^\s@,;<>]+@[^\s@,;<>]+\.[a-zA-Z]{2,}$/.test(parsed);
      if (isCompleteEmail) return true;
      if (idx === allTokens.length - 1 && !/[,;\s]$/.test(rawVal)) return false;
      return token.includes('@');
    });
    const exists = completeTokens.some((part) => emailKey(part) === targetKey);
    const nextTokens = exists
      ? completeTokens.filter((part) => emailKey(part) !== targetKey)
      : [...completeTokens, email];
    const nextValue = nextTokens.length
      ? (keepTrailingSeparator ? `${nextTokens.join(', ')}, ` : nextTokens.join(', '))
      : '';
    setCompose({
      ...compose,
      [fieldName]: nextValue,
      showExtra: fieldName !== 'to' ? true : compose.showExtra,
    });
  }

  function addMultipleRecipientsToField(emails: string[], fieldName: 'to' | 'cc' | 'bcc' = 'to', keepTrailingSeparator = false) {
    if (!compose || busy || !emails.length) return;
    const rawVal = compose[fieldName] || '';
    const allTokens = extractRecipientTokens(rawVal);
    const completeTokens = allTokens.filter((token, idx) => {
      const parsed = parseRecipientToken(token).email;
      const isCompleteEmail = /^[^\s@,;<>]+@[^\s@,;<>]+\.[a-zA-Z]{2,}$/.test(parsed);
      if (isCompleteEmail) return true;
      if (idx === allTokens.length - 1 && !/[,;\s]$/.test(rawVal)) return false;
      return token.includes('@');
    });
    const have = new Set(completeTokens.map((p) => emailKey(p)));
    const merged = [...completeTokens];
    for (const addr of emails) {
      const key = emailKey(addr);
      if (key && !have.has(key)) {
        have.add(key);
        merged.push(addr);
      }
    }
    const nextValue = merged.length
      ? (keepTrailingSeparator ? `${merged.join(', ')}, ` : merged.join(', '))
      : '';
    setCompose({
      ...compose,
      [fieldName]: nextValue,
      showExtra: fieldName !== 'to' ? true : compose.showExtra,
    });
  }

  function appendRecipient(email: string, fieldName: 'to' | 'cc' | 'bcc' = 'to') {
    toggleRecipientInField(email, fieldName, false);
  }

  function handleRecipientChange(fieldName: 'to' | 'cc' | 'bcc', nextValue: string) {
    if (!compose) return;
    const prevValue = compose[fieldName];
    let formatted = autoFormatRecipientChange(nextValue, prevValue);
    if (prevValue.trim().length > 0 && nextValue.length - prevValue.length > 1 && !formatted.endsWith(', ')) {
      const tokens = extractRecipientTokens(formatted);
      const lastToken = tokens[tokens.length - 1] || '';
      if (lastToken && settings.recent.some((r) => r.email.toLowerCase() === lastToken.toLowerCase())) {
        formatted = `${tokens.join(', ')}, `;
      }
    }
    setCompose({ ...compose, [fieldName]: formatted });
  }

  function handleRecipientBlur(fieldName: 'to' | 'cc' | 'bcc') {
    if (pickerInteractingRef.current) {
      pickerInteractingRef.current = false;
      return;
    }
    setCompose((cur) => {
      if (!cur) return cur;
      const formatted = formatRecipientInput(cur[fieldName]);
      return formatted === cur[fieldName] ? cur : { ...cur, [fieldName]: formatted };
    });
    setActiveRecipientField((cur) => (cur === fieldName ? null : cur));
  }

  function handleRecipientKeyDown(fieldName: 'to' | 'cc' | 'bcc', e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; preventDefault: () => void }) {
    if (!compose || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') {
      setActiveRecipientField(null);
      return;
    }
    if (e.key === 'Enter' || e.key === ';') {
      const val = compose[fieldName];
      if (/(?:[^\s@,;<>]+@[^\s@,;<>]+\.[a-zA-Z]{2,}|<[^\s@,;<>]+@[^\s@,;<>]+\.[a-zA-Z]{2,}>)\s*$/.test(val)) {
        e.preventDefault();
        setCompose({ ...compose, [fieldName]: formatRecipientInput(val, true) });
        return;
      }
      if (activeRecipientField === fieldName) {
        const lastSep = Math.max(val.lastIndexOf(','), val.lastIndexOf(';'));
        const tail = (lastSep >= 0 ? val.slice(lastSep + 1) : val).trim().toLowerCase();
        if (tail.length >= 1) {
          const selectedKeys = new Set(extractRecipientTokens(val).filter((t) => t.includes('@')).map((t) => emailKey(t)));
          const match = allRecipientCandidates.find((c) => (
            !selectedKeys.has(emailKey(c.email))
            && (c.email.toLowerCase().includes(tail) || (c.name || '').toLowerCase().includes(tail))
          ));
          if (match) {
            e.preventDefault();
            toggleRecipientInField(match.email, fieldName, true);
          }
        }
      }
    }
  }

  function renderRecipientPickerDropdown(fieldName: 'to' | 'cc' | 'bcc') {
    if (!compose || activeRecipientField !== fieldName || allRecipientCandidates.length === 0) return null;
    const fieldLabel = fieldName === 'to' ? 'Kime' : fieldName === 'cc' ? 'Cc' : 'Bcc';
    const rawVal = compose[fieldName] || '';
    const currentTokens = extractRecipientTokens(rawVal).filter((t) => t.includes('@'));
    const selectedKeys = new Set(currentTokens.map((t) => emailKey(t)));
    const lastSep = Math.max(rawVal.lastIndexOf(','), rawVal.lastIndexOf(';'));
    const tail = (lastSep >= 0 ? rawVal.slice(lastSep + 1) : rawVal).trim();
    const tailEmail = parseRecipientToken(tail).email;
    const isTailAlreadySelectedEmail = Boolean(
      tailEmail
      && /^[^\s@,;<>]+@[^\s@,;<>]+\.[a-zA-Z]{2,}$/.test(tailEmail)
      && selectedKeys.has(emailKey(tailEmail)),
    );
    const inlineQuery = isTailAlreadySelectedEmail ? '' : tail.toLowerCase();
    const candidateGroups = [...new Set(allRecipientCandidates.map((c) => c.group || '').filter(Boolean))];
    const filteredCandidates = allRecipientCandidates.filter((item) => {
      if (pickerGroupFilter !== 'all' && (item.group || '') !== pickerGroupFilter) return false;
      if (!inlineQuery) return true;
      return (
        item.email.toLowerCase().includes(inlineQuery)
        || (item.name || '').toLowerCase().includes(inlineQuery)
        || (item.company || '').toLowerCase().includes(inlineQuery)
        || (item.group || '').toLowerCase().includes(inlineQuery)
      );
    });

    return (
      <div
        className="recipient-picker-dropdown"
        role="listbox"
        aria-multiselectable="true"
        aria-label={`${fieldLabel} çoklu alıcı seçici`}
        onMouseDown={(e) => {
          pickerInteractingRef.current = true;
          e.preventDefault();
        }}
        onTouchStart={() => {
          pickerInteractingRef.current = true;
        }}
        onClick={() => {
          pickerInteractingRef.current = false;
        }}
      >
        <div className="recipient-picker-header">
          <div className="recipient-picker-title">
            <strong>{fieldLabel} Çoklu Alıcı Seçici</strong>
            <span className="recipient-picker-hint">
              Birden fazla e-posta eklemek için tıklayın (Liste kapanmaz · {selectedKeys.size} seçili)
            </span>
          </div>
          <div className="recipient-picker-actions">
            {filteredCandidates.length > 0 ? (
              <button
                type="button"
                className="chip-btn"
                disabled={busy}
                onClick={() => addMultipleRecipientsToField(filteredCandidates.map((c) => c.email), fieldName, true)}
              >
                Tümünü Ekle ({filteredCandidates.length})
              </button>
            ) : null}
            {filteredCandidates.length > 10 ? (
              <button
                type="button"
                className="chip-btn"
                disabled={busy}
                onClick={() => addMultipleRecipientsToField(filteredCandidates.slice(0, 10).map((c) => c.email), fieldName, true)}
              >
                İlk 10 Ekle
              </button>
            ) : null}
            {selectedKeys.size > 0 ? (
              <button
                type="button"
                className="chip-btn"
                disabled={busy}
                onClick={() => setCompose({ ...compose, [fieldName]: '' })}
              >
                Alıcıları Temizle
              </button>
            ) : null}
            <button
              type="button"
              className="chip-btn on"
              disabled={busy}
              onClick={() => {
                pickerInteractingRef.current = false;
                setCompose((cur) => (cur ? { ...cur, [fieldName]: formatRecipientInput(cur[fieldName]) } : cur));
                setActiveRecipientField(null);
              }}
            >
              Seçimi Tamamla ✓
            </button>
          </div>
        </div>
        {candidateGroups.length > 0 ? (
          <div className="recipient-picker-groups">
            <button
              type="button"
              className={pickerGroupFilter === 'all' ? 'chip-btn on' : 'chip-btn'}
              onClick={() => setPickerGroupFilter('all')}
            >
              Tümü ({allRecipientCandidates.length})
            </button>
            {candidateGroups.map((g) => (
              <button
                key={g}
                type="button"
                className={pickerGroupFilter === g ? 'chip-btn on' : 'chip-btn'}
                onClick={() => setPickerGroupFilter(g)}
              >
                {g} ({allRecipientCandidates.filter((c) => c.group === g).length})
              </button>
            ))}
          </div>
        ) : null}
        {filteredCandidates.length === 0 ? (
          <p className="recipient-picker-empty">
            &ldquo;{inlineQuery}&rdquo; aramasına uygun kayıtlı kişi bulunamadı. Adresi doğrudan yazıp boşluk veya Enter tuşuna basabilirsiniz.
          </p>
        ) : (
          <div className="recipient-picker-grid">
            {filteredCandidates.slice(0, 200).map((item) => {
              const isSelected = selectedKeys.has(emailKey(item.email));
              return (
                <button
                  key={item.email}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={isSelected ? 'recipient-picker-item selected' : 'recipient-picker-item'}
                  disabled={busy}
                  onClick={() => toggleRecipientInField(item.email, fieldName, true)}
                >
                  <span className={isSelected ? 'picker-check on' : 'picker-check'} aria-hidden="true">
                    {isSelected ? '✓' : '+'}
                  </span>
                  <span className="picker-item-body">
                    <strong className="picker-item-name">{item.name || item.email}</strong>
                    {item.name ? <small className="picker-item-email">{item.email}</small> : null}
                  </span>
                  {item.group ? <em className="freq-badge group-badge">{item.group}</em> : null}
                  {item.sentCount ? <em className="freq-badge">×{item.sentCount}</em> : null}
                  <span className={isSelected ? 'picker-status-tag on' : 'picker-status-tag'}>
                    {isSelected ? 'Eklendi' : 'Ekle'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function handleRecipientPaste(fieldName: 'to' | 'cc' | 'bcc', e: { clipboardData?: { getData: (type: string) => string } | null; currentTarget: HTMLInputElement; preventDefault: () => void }) {
    if (!compose) return;
    const pasted = e.clipboardData?.getData('text') || '';
    if (!pasted) return;
    const curVal = compose[fieldName];
    if (/[\r\n\t;,]|\s+/.test(pasted) || (pasted.match(/@/g) || []).length > 1 || (pasted.includes('@') && curVal.includes('@'))) {
      e.preventDefault();
      const input = e.currentTarget;
      const start = input.selectionStart ?? curVal.length;
      const end = input.selectionEnd ?? curVal.length;
      const combined = `${curVal.slice(0, start)} ${pasted} ${curVal.slice(end)}`;
      setCompose({ ...compose, [fieldName]: formatRecipientInput(combined, true) });
    }
  }

  function insertQuickPhrase(snippet: string) {
    if (!compose || busy) return;
    const current = compose.body || '';
    const prefix = visibleComposeText(current) ? '<p>' : '<p>Merhaba,</p><p>';
    setCompose({ ...compose, body: `${prefix}${snippet}</p>${current}` });
  }

  function startComposeFromAccount(targetId: string, toEmail = '') {
    if (operation.current || busy) return;
    const target = accounts.find((item) => item.id === targetId && item.enabled !== false) || account;
    if (!target) return;
    if (compose && !confirmLeave()) return;
    if (target.id !== accountId) {
      clearFresh(target.id);
      clearView();
      draftsVersion.current += 1;
      setDrafts([]);
      setAccountId(target.id);
      setFolder('inbox');
    }
    const sigRow = settings.signatures[target.id];
    const sig = sigRow ? sigRow.new : '';
    readerVersion.current += 1;
    setMessageLoading(false);
    const next: ComposeState = { ...emptyCompose(), to: toEmail, body: withSignature('', sig) };
    setCompose(next);
    lastSaved.current = composeFingerprint(next);
    setDraftStatus('saved');
    setMessage(null);
    setShowDrafts(false);
    setShowAdd(false);
    setShowSettings(false);
    setShowContactsPage(false);
    setHome(false);
    setNotice('');
    setUndo(null);
    setPanel('read');
  }

  function copyAddress(email: string) {
    if (!email) return;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(email).then(() => showToast(`${email} kopyalandı.`)).catch(() => showToast(email));
    } else {
      showToast(email);
    }
  }

  function insertTemplate(id: string) {
    const template = settings.templates.find((item) => item.id === id);
    if (!compose || !template) return;
    setCompose({ ...compose, body: `${compose.body || ''}${template.body}` });
  }

  const latest = useRef({
    startCompose, startReply, startReplyAll, startForward, removeMessage, send: onSend, goBack,
    archive: () => { if (selected.length && props.bulkMessages) void applyBulk('move', 'archive'); else void relocate('archive', 'İleti arşivlendi.'); },
    seen: () => { if (selected.length && props.bulkMessages) void applyBulk('seen'); else if (message) void setItemSeen(message.uid, true); },
    unseen: () => { if (selected.length && props.bulkMessages) void applyBulk('unseen'); else if (message) void setItemSeen(message.uid, false); },
    next: () => openNeighbor(1),
    prev: () => openNeighbor(-1),
    help: () => setShowHelp((value) => !value),
  });
  latest.current = {
    startCompose, startReply, startReplyAll, startForward, removeMessage, send: onSend, goBack,
    archive: () => { if (selected.length && props.bulkMessages) void applyBulk('move', 'archive'); else void relocate('archive', 'İleti arşivlendi.'); },
    seen: () => { if (selected.length && props.bulkMessages) void applyBulk('seen'); else if (message) void setItemSeen(message.uid, true); },
    unseen: () => { if (selected.length && props.bulkMessages) void applyBulk('unseen'); else if (message) void setItemSeen(message.uid, false); },
    next: () => openNeighbor(1),
    prev: () => openNeighbor(-1),
    help: () => setShowHelp((value) => !value),
  };
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && composeRef.current) {
        event.preventDefault();
        const form = document.querySelector('form.compose:not(.add-form)') as HTMLFormElement | null;
        form?.requestSubmit();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && target.closest && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if (key === '?' || (event.shiftKey && event.key === '/')) { event.preventDefault(); latest.current.help(); }
      else if (key === 'n' || key === 'c') { event.preventDefault(); latest.current.startCompose(); }
      else if (key === 'r') { event.preventDefault(); event.shiftKey ? latest.current.startReplyAll() : latest.current.startReply(); }
      else if (key === 'f') { event.preventDefault(); latest.current.startForward(); }
      else if (key === 'e') { event.preventDefault(); latest.current.archive(); }
      else if (key === 'i' && event.shiftKey) { event.preventDefault(); latest.current.seen(); }
      else if (key === 'u' && event.shiftKey) { event.preventDefault(); latest.current.unseen(); }
      else if (key === 'j') { event.preventDefault(); latest.current.next(); }
      else if (key === 'k') { event.preventDefault(); latest.current.prev(); }
      else if (key === 'delete') { event.preventDefault(); void latest.current.removeMessage(); }
      else if (key === 'escape') { event.preventDefault(); latest.current.goBack(); }
      else if (key === '/') { event.preventDefault(); document.getElementById('q')?.focus(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const folderTitle = activeCustomView === 'snoozed' ? 'Ertelenenler' : folderLabel(folder, showDrafts);
  const emptyCopy = folderEmptyCopy(folder, draftQuery);
  const openSettings = () => { if (operation.current) return; if (compose && !confirmLeave()) return; setShowAdd(false); setShowDrafts(false); setShowContactsPage(false); setShowSettings(true); setCompose(null); setPanel('read'); };
  const openContactsPage = () => { if (operation.current) return; if (compose && !confirmLeave()) return; setShowAdd(false); setShowDrafts(false); setShowSettings(false); setShowContactsPage(true); setCompose(null); setPanel('read'); };
  const openDrafts = () => { if (operation.current) return; if (compose && !confirmLeave()) return; readerVersion.current += 1; setMessageLoading(false); setCompose(null); setShowAdd(false); setShowSettings(false); setShowContactsPage(false); setActiveCustomView(null); setShowDrafts(true); setPanel('read'); };
  const openFolder = (next: FolderRole) => { if (operation.current) return; setActiveCustomView(null); chooseFolder(next); setShowDrafts(false); setShowSettings(false); setShowContactsPage(false); setHome(false); setPanel('list'); };
  const openSnoozed = () => {
    if (operation.current) return;
    if (activeCustomView === 'snoozed') {
      setActiveCustomView(null);
      setShowDrafts(false);
      setPanel('list');
      return;
    }
    if (folder !== 'inbox') chooseFolder('inbox');
    setActiveCustomView('snoozed');
    setShowDrafts(false);
    setShowSettings(false);
    setShowContactsPage(false);
    setHome(false);
    setPanel('list');
  };

  const resizeCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { resizeCleanupRef.current?.(); }, []);

  const persistPaneWidth = (pane: 'accounts' | 'list', value: number | null) => {
    const key = pane === 'accounts' ? 'safirmail_accounts_w' : 'safirmail_list_w';
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    } catch { /* ignore storage errors */ }
  };

  const clampPaneWidth = (pane: 'accounts' | 'list', raw: number) => {
    const wsRect = workspaceRef.current?.getBoundingClientRect();
    const wsWidth = wsRect && wsRect.width > 0 ? wsRect.width : (window.innerWidth || 1280);
    if (pane === 'accounts') {
      return Math.round(Math.min(440, Math.max(180, raw)));
    }
    const curAccW = accountsWidth ?? (wsWidth <= 1180 ? 230 : 262);
    const maxList = Math.max(380, Math.min(1100, wsWidth - curAccW - 260));
    return Math.round(Math.min(maxList, Math.max(260, raw)));
  };

  const applyPaneWidth = (pane: 'accounts' | 'list', value: number | null) => {
    const next = value == null ? null : clampPaneWidth(pane, value);
    if (pane === 'accounts') setAccountsWidth(next);
    else setListWidth(next);
    persistPaneWidth(pane, next);
  };

  const startPaneResize = (pane: 'accounts' | 'list', startX: number) => {
    resizeCleanupRef.current?.();
    const targetEl = workspaceRef.current?.querySelector(pane === 'accounts' ? '.accounts' : '.list') as HTMLElement | null;
    const measured = targetEl?.getBoundingClientRect().width || 0;
    const baseWidth = measured > 0
      ? measured
      : (pane === 'accounts' ? (accountsWidth ?? 262) : (listWidth ?? 380));
    setResizingPane(pane);

    const onMove = (ev: MouseEvent) => {
      applyPaneWidth(pane, baseWidth + (ev.clientX - startX));
    };
    const cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', cleanup);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', cleanup);
      resizeCleanupRef.current = null;
      if (mounted.current) setResizingPane(null);
    };
    resizeCleanupRef.current = cleanup;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', cleanup);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', cleanup);
  };

  const toggleListExpand = () => {
    const wsRect = workspaceRef.current?.getBoundingClientRect();
    const wsWidth = wsRect && wsRect.width > 0 ? wsRect.width : (window.innerWidth || 1280);
    const isExpanded = Boolean(listWidth && listWidth >= 480);
    if (isExpanded) {
      applyPaneWidth('list', null);
    } else {
      applyPaneWidth('list', Math.max(580, Math.round(wsWidth * 0.52)));
    }
  };
  const homeUnseen = accounts.reduce((sum, item) => sum + (previews[item.id]?.data?.unseen || 0), 0);
  const homeFresh = accounts.some((item) => (previews[item.id]?.fresh.length || 0) > 0);
  let listUnreadCounter = 0;
  const accountUnseen = (item: MailAccount) => (item.id === accountId && unseen != null ? unseen : previews[item.id]?.data?.unseen ?? null);
  const activeSnoozedCount = Object.keys(snoozedMap).length;
  const allSelected = displayList.length > 0 && selected.length === displayList.length;
  const syncLabel = refreshedAt ? ` · ${new Date(refreshedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : '';

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="menu-btn icon-btn" onClick={() => setPanel('accounts')} aria-label="Klasörler"><Icon name="menu" /><span className="sr">Hesaplar</span></button>
        <div className="brand"><span className="gem gem-sm" aria-hidden="true" /> Safir Mail</div>
        <form className="search" onSubmit={onSearch} role="search">
          <label className="sr" htmlFor="q">Ara</label>
          <Icon name="search" size={16} />
          <input id="q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={globalSearch ? 'Tüm posta hesaplarında aynı anda ara…' : 'Posta, gönderen veya konu ara…'} disabled={busy} inputMode="search" title="from: to: subject: has:attachment is:unread is:starred after:YYYY-AA-GG" />
          {(query || draftQuery) ? (
            <button
              type="button"
              className="icon-btn search-clear-btn"
              aria-label="Aramayı temizle"
              title="Aramayı temizle"
              disabled={busy}
              onClick={() => {
                setQuery('');
                if (draftQuery) {
                  clearView();
                  setDraftQuery('');
                }
              }}
            >
              ✕
            </button>
          ) : null}
          {props.searchAllAccounts && accounts.length > 1 ? (
            <button
              type="button"
              className={globalSearch ? 'chip-btn on' : 'chip-btn'}
              style={{ flexShrink: 0, fontSize: 11, padding: '3px 8px' }}
              disabled={busy}
              onClick={() => {
                const next = !globalSearch;
                setGlobalSearch(next);
                if (query.trim().length >= 2) {
                  clearView();
                  setDraftQuery(query.trim());
                  if (home) { setHome(false); setPanel('list'); }
                }
              }}
              title="Tüm yetkili posta hesaplarında paralel ara"
            >
              {globalSearch ? `🌐 Tüm Hesaplar (${accounts.filter((a) => a.enabled !== false).length})` : '📥 Bu Hesap'}
            </button>
          ) : null}
        </form>
        <div className="who">
          <span className="avatar sm" style={{ background: tint(props.userEmail) }} aria-hidden="true">{initials('', props.userEmail)}</span>
          <span className="who-mail">{props.userEmail}</span>
          {canAdd ? (
            <button
              type="button"
              className="primary slim top-add-btn"
              onClick={startAddAccount}
              disabled={busy}
              title="Yeni e-posta hesabı ekle"
            >
              <Icon name="add" size={14} /> <span>Hesap Ekle</span>
            </button>
          ) : null}
          <button type="button" className={previewing || refreshing || revalidating ? 'text-btn top-refresh spin' : 'text-btn top-refresh'} onClick={refreshAll} disabled={busy} title="Postaları yenile">
            <Icon name="refresh" size={16} /><span className="top-refresh-label">Yenile</span>
          </button>
          <button type="button" className="icon-btn top-theme-btn" title={settings.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'} aria-label={settings.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'} onClick={() => { void persistSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' }); }} disabled={busy}>{settings.theme === 'dark' ? '☀️' : '🌙'}</button>
          {scheduledEmails.length > 0 ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => setShowScheduledModal(true)}
              title="Zamanlanmış iletileri görüntüle"
            >
              ⏱️ Zamanlanan ({scheduledEmails.length})
            </button>
          ) : null}
          <button type="button" className="text-btn" onClick={openContactsPage} disabled={busy}>Kişilerim ({settings.recent.length})</button>
          <button type="button" className="text-btn" onClick={openSettings} disabled={busy}>Ayarlar</button>
          <button type="button" className="text-btn" title="Oturumu kapat" onClick={() => { if (confirmLeave()) { void idbClearAll(); props.onLogout(); } }} disabled={busy}>Çıkış</button>
        </div>
      </header>
      <div
        ref={workspaceRef}
        className="workspace"
        data-panel={panel}
        data-home={home ? 'true' : undefined}
        data-resizing={resizingPane ? 'true' : undefined}
        style={{
          ...(accountsWidth ? { '--accounts-w': `${accountsWidth}px` } : {}),
          ...(listWidth ? { '--list-w': `${listWidth}px` } : {}),
        } as CSSProperties}
      >
        <nav className="accounts" aria-label="Hesaplar ve klasörler">
          <div className="nav-head">
            <button type="button" className="primary new-mail" onClick={startCompose} disabled={!account || account.enabled === false || busy} title="Yeni ileti (N veya C)"><Icon name="compose" />Yeni ileti</button>
          </div>
          {props.loadPreview && accounts.length > 0 ? (
            <button type="button" className={home ? 'folder all-inboxes on' : 'folder all-inboxes'} onClick={goHome} disabled={busy}>
              <Icon name="inbox" /><span>Tüm gelen kutuları</span>
              {homeUnseen ? <em className={homeFresh ? "count fresh" : "count"} data-count={String(homeUnseen)} aria-label={`${homeUnseen} okunmamış`} /> : null}
            </button>
          ) : null}
          <h2 className="nav-title">Hesaplar</h2>
          {canAdd ? <button type="button" className="primary slim" onClick={startAddAccount} disabled={busy}><Icon name="add" />Yeni e-posta hesabı ekle</button> : null}
          {accounts.length === 0 ? (
            <div className="empty-state nav-empty">
              <Icon name="mail" size={36} />
              <p>Başlamak için ilk posta hesabınızı ekleyin.</p>
              <small>{canAdd ? 'Natro adresinizi ekledikten sonra iletiler burada görünür.' : 'Size atanmış posta hesabı yok. Yöneticinizden erişim isteyin.'}</small>
              {canAdd ? <button type="button" className="primary slim" onClick={startAddAccount} disabled={busy}>Hesap ekle</button> : null}
            </div>
          ) : null}
          {accounts.map((item, accIdx) => {
            const accColor = accountColor(accIdx, item.email);
            return (
            <div key={item.id} className={item.id === accountId ? 'account-group open' : 'account-group'} style={{ '--acc-accent': accColor } as CSSProperties}>
              {renameId === item.id ? (
                <form className="rename-form" onSubmit={onRenameAccount}>
                  <label>Görünen ad
                    <input value={renameName} onChange={(e) => setRenameName(e.target.value)} maxLength={80} required autoComplete="off" disabled={busy} />
                  </label>
                  {renameError ? <p className="alert" role="alert">{renameError}</p> : null}
                  <div className="rename-actions">
                    <button className="primary" type="submit" disabled={busy}>Adı kaydet</button>
                    <button type="button" className="text-btn" onClick={() => { setRenameId(''); setRenameError(''); }} disabled={busy}>Vazgeç</button>
                  </div>
                </form>
              ) : (
                <div className="account-line">
                <button type="button" className={item.id === accountId ? 'account on' : 'account'} onClick={() => chooseAccount(item.id)} disabled={busy} title={item.email}>
                  <span className="avatar-badge-wrap"><span className="avatar" style={{ background: accColor }}>{initials(item.displayName, item.email)}</span>{accountUnseen(item) ? <em className={previews[item.id]?.fresh.length ? "avatar-count fresh" : "avatar-count"} data-count={String(accountUnseen(item))} aria-hidden="true" /> : null}</span>
                  <span className="account-copy">
                    <strong>{item.displayName}{item.enabled === false ? ' · Pasif' : ''}</strong>
                    <small>{item.email}{item.lastOkAt ? ` · ${new Date(item.lastOkAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}</small>
                  </span>
                  {accountUnseen(item) ? <em className={previews[item.id]?.fresh.length ? 'count fresh' : 'count'} data-count={String(accountUnseen(item))} aria-label={`${accountUnseen(item)} okunmamış`} /> : null}
                </button>
                <span className="account-sort">
                  <button type="button" className="icon-btn" aria-label="Yukarı" disabled={busy} onClick={() => moveAccount(item.id, -1)}>↑</button>
                  <button type="button" className="icon-btn" aria-label="Aşağı" disabled={busy} onClick={() => moveAccount(item.id, 1)}>↓</button>
                </span>
                </div>
              )}
              {item.id === accountId && !home ? (
                <div className="folders" role="group" aria-label={`${item.displayName} klasörleri`}>
                  <button type="button" className={folder === 'inbox' && !showDrafts && activeCustomView === null ? 'folder on' : 'folder'} onClick={() => openFolder('inbox')} disabled={busy}>
                    <Icon name="inbox" /><span>Gelen Kutusu</span>{folderBadge('inbox')}
                  </button>
                  <button type="button" className={folder === 'sent' && !showDrafts && activeCustomView === null ? 'folder on' : 'folder'} onClick={() => openFolder('sent')} disabled={busy}>
                    <Icon name="sent" /><span>Gönderilen</span>{folderBadge('sent')}
                  </button>
                  <button type="button" className={folder === 'archive' && !showDrafts && activeCustomView === null ? 'folder on' : 'folder'} onClick={() => openFolder('archive')} disabled={busy}>
                    <Icon name="archive" /><span>Arşiv</span>{folderBadge('archive')}
                  </button>
                  <button type="button" className={folder === 'spam' && !showDrafts && activeCustomView === null ? 'folder on' : 'folder'} onClick={() => openFolder('spam')} disabled={busy}>
                    <Icon name="spam" /><span>Spam</span>{folderBadge('spam')}
                  </button>
                  <button type="button" className={folder === 'trash' && !showDrafts && activeCustomView === null ? 'folder on' : 'folder'} onClick={() => openFolder('trash')} disabled={busy}>
                    <Icon name="trash" /><span>Çöp Kutusu</span>{folderBadge('trash')}
                  </button>
                  <button type="button" className={showDrafts ? 'folder on' : 'folder'} onClick={openDrafts} disabled={busy}>
                    <Icon name="drafts" /><span>Taslaklar</span>{drafts.length ? <em className="count" data-count={String(drafts.length)} aria-label={`${drafts.length} taslak`} /> : null}
                  </button>
                  <button type="button" className={activeCustomView === 'snoozed' ? 'folder on' : 'folder'} onClick={openSnoozed} disabled={busy}>
                    <Icon name="clock" /><span>Ertelenenler</span>{activeSnoozedCount ? <em className="count" data-count={String(activeSnoozedCount)} /> : null}
                  </button>
                  <button type="button" className="folder" onClick={() => setShowScheduledModal(true)} disabled={busy}>
                    <Icon name="clock" /><span>Zamanlananlar</span>{scheduledEmails.length ? <em className="count" data-count={String(scheduledEmails.length)} /> : null}
                  </button>
                  <div className="custom-folders-section" style={{ marginTop: 12, borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                      <span>ÖZEL KLASÖRLER</span>
                      <button type="button" className="icon-btn" onClick={() => setShowNewFolderModal(true)} title="Yeni Klasör Oluştur" style={{ fontSize: 14 }}>+</button>
                    </div>
                    {customFolders.map((fld) => (
                      <button key={fld} type="button" className={folder === fld && !showDrafts && activeCustomView === null ? 'folder on' : 'folder'} onClick={() => { setActiveCustomView(null); openFolder(fld as FolderRole); }} disabled={busy}>
                        <Icon name="archive" /><span>{fld}</span>
                      </button>
                    ))}
                  </div>
                  {quota && item.id === accountId ? (
                    <div className="account-quota-box">
                      <div className="quota-row">
                        <span className="quota-label">Natro Kotası</span>
                        <span className={`quota-val ${quota.percent >= 85 ? 'danger' : quota.percent >= 70 ? 'warn' : ''}`}>
                          %{quota.percent}
                        </span>
                      </div>
                      <div className="quota-bar-mini">
                        <div
                          className={`quota-bar-fill ${quota.percent >= 85 ? 'danger' : quota.percent >= 70 ? 'warn' : ''}`}
                          style={{ width: `${Math.min(100, quota.percent)}%` }}
                        />
                      </div>
                      <div className="quota-sub-row">
                        <small>{fileSize(quota.usageBytes)} / {fileSize(quota.limitBytes)}</small>
                        <button
                          type="button"
                          className="quota-clean-link"
                          onClick={() => { setArchiveResult(null); setArchiveError(''); setShowQuotaModal(true); }}
                          disabled={busy}
                          title="Eski mailleri Firebase'e aktararak sunucuda yer aç"
                        >
                          Kotayı Rahatlat
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {renameId === item.id ? null : (
                    <>
                      <button type="button" className="text-btn rename-account" onClick={() => startRename(item)} disabled={busy}>
                        <Icon name="edit" />Adı düzenle
                      </button>
                      {props.testAccount ? (
                        <button type="button" className="text-btn rename-account" onClick={() => { void onTestAccount(item); }} disabled={busy}>
                          Bağlantıyı test et
                        </button>
                      ) : null}
                      {props.removeAccount && canManageAccount(item) ? (
                        <button type="button" className="text-btn rename-account danger" onClick={() => { void onRemoveAccount(item); }} disabled={busy}>
                          Hesabı kaldır
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
            );
          })}
          {canAdd ? <button type="button" className="text-btn add-account" onClick={startAddAccount} disabled={busy}><Icon name="add" />Hesap ekle</button> : null}
          <button type="button" className={showContactsPage ? 'folder on' : 'text-btn add-account'} onClick={openContactsPage} disabled={busy}><Icon name="mail" />Kişilerim · Rehber ({settings.recent.length})</button>
          <button type="button" className="text-btn add-account" onClick={openSettings} disabled={busy}>Ayarlar</button>
          <button type="button" className="text-btn add-account mobile-logout-btn danger" onClick={() => { if (confirmLeave()) { void idbClearAll(); props.onLogout(); } }} disabled={busy}>Oturumu kapat ({props.userEmail})</button>
          {installPrompt ? <button type="button" className="primary slim pwa-install-btn" onClick={() => { void installPwa(); }} disabled={busy}>📲 Uygulamayı telefona kur</button> : null}
          <p className="shortcuts">Kısayollar: <kbd>C</kbd> yeni · <kbd>J</kbd>/<kbd>K</kbd> ileti · <kbd>?</kbd> yardım</p>
        </nav>
        <div
          className={resizingPane === 'accounts' ? 'pane-resizer active' : 'pane-resizer'}
          role="separator"
          aria-orientation="vertical"
          aria-label="Hesaplar bölmesi genişliğini ayarla"
          title="Sürükleyerek genişlet · Çift tıkla: varsayılan"
          tabIndex={0}
          onMouseDown={(e) => { e.preventDefault(); startPaneResize('accounts', e.clientX); }}
          onDoubleClick={() => applyPaneWidth('accounts', null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') applyPaneWidth('accounts', (accountsWidth ?? 262) + 24);
            else if (e.key === 'ArrowLeft') applyPaneWidth('accounts', (accountsWidth ?? 262) - 24);
          }}
        />
        {home ? (
          <Overview
            accounts={accounts}
            previews={previews}
            refreshing={previewing}
            refreshedAt={previewAt}
            busy={busy}
            onRefresh={() => { void loadPreviews(true); }}
            onOpenAccount={openFromHome}
            onShowAccounts={() => setPanel('accounts')}
            onComposeAccount={(id) => startComposeFromAccount(id)}
            onAddAccount={canAdd ? startAddAccount : undefined}
          />
        ) : null}
        <section
          className="list"
          aria-label="İleti listesi"
          onTouchStart={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop <= 2 && e.touches[0]) {
              pullListRef.current = { startY: e.touches[0].clientY, armed: false };
            } else {
              pullListRef.current = null;
            }
          }}
          onTouchMove={(e) => {
            if (!pullListRef.current || !e.touches[0]) return;
            const dy = e.touches[0].clientY - pullListRef.current.startY;
            if (dy > 85) pullListRef.current.armed = true;
          }}
          onTouchEnd={() => {
            if (pullListRef.current?.armed && !busy && !listLoading && !refreshing) {
              void refreshList(true);
            }
            pullListRef.current = null;
          }}
        >
          <div className="list-head">
            <div className="list-title">
              <button type="button" className="back-btn icon-btn" onClick={() => setPanel('accounts')} aria-label="Klasörler"><Icon name="back" /><span className="sr">Hesaplar</span></button>
              <div>
                <h2>{isGlobalSearchActive ? `🌐 Küresel Arama (${items.length})` : folderTitle}</h2>
                {isGlobalSearchActive ? (
                  <small>
                    {globalSearchMeta
                      ? `${globalSearchMeta.scanned} hesap tarandı · ${globalSearchMeta.matched} hesapta eşleşme`
                      : 'Tüm yetkili hesaplar taranıyor…'}
                  </small>
                ) : account ? <small>{account.email}{syncLabel}</small> : null}
              </div>
              <div className="list-title-actions">
                <button
                  type="button"
                  className={listWidth && listWidth >= 480 ? 'cmd list-expand-btn on' : 'cmd list-expand-btn'}
                  title={listWidth && listWidth >= 480 ? 'Gelen kutusu genişliğini normale döndür' : 'Gelen kutusunu genişlet'}
                  aria-label={listWidth && listWidth >= 480 ? 'Gelen kutusu genişliğini normale döndür' : 'Gelen kutusunu genişlet'}
                  onClick={toggleListExpand}
                >
                  {listWidth && listWidth >= 480 ? '⤡' : '⤢'}
                </button>
                <button type="button" className={refreshing || revalidating ? 'cmd list-refresh spin' : 'cmd list-refresh'} title="Gelen iletileri yenile" onClick={() => { void refreshList(true); }} disabled={busy || listLoading || refreshing}>
                  <Icon name="refresh" size={16} />{refreshing ? 'Yenileniyor…' : 'Yenile'}
                </button>
              </div>
            </div>
            {account ? (
              <div className="mobile-folder-strip" role="navigation" aria-label="Hızlı klasör geçişi">
                <button type="button" className={folder === 'inbox' && !showDrafts && activeCustomView === null ? 'm-folder-pill on' : 'm-folder-pill'} data-label="Gelen Kutusu" aria-label="Gelen Kutusu klasörü" onClick={() => openFolder('inbox')} disabled={busy}>
                  <Icon name="inbox" size={14} />{folderBadge('inbox')}
                </button>
                <button type="button" className={folder === 'sent' && !showDrafts && activeCustomView === null ? 'm-folder-pill on' : 'm-folder-pill'} data-label="Gönderilen" aria-label="Gönderilen klasörü" onClick={() => openFolder('sent')} disabled={busy}>
                  <Icon name="sent" size={14} />{folderBadge('sent')}
                </button>
                <button type="button" className={folder === 'archive' && !showDrafts && activeCustomView === null ? 'm-folder-pill on' : 'm-folder-pill'} data-label="Arşiv" aria-label="Arşiv klasörü" onClick={() => openFolder('archive')} disabled={busy}>
                  <Icon name="archive" size={14} />{folderBadge('archive')}
                </button>
                <button type="button" className={folder === 'spam' && !showDrafts && activeCustomView === null ? 'm-folder-pill on' : 'm-folder-pill'} data-label="Spam" aria-label="Spam klasörü" onClick={() => openFolder('spam')} disabled={busy}>
                  <Icon name="spam" size={14} />{folderBadge('spam')}
                </button>
                <button type="button" className={folder === 'trash' && !showDrafts && activeCustomView === null ? 'm-folder-pill on' : 'm-folder-pill'} data-label="Çöp Kutusu" aria-label="Çöp Kutusu klasörü" onClick={() => openFolder('trash')} disabled={busy}>
                  <Icon name="trash" size={14} />{folderBadge('trash')}
                </button>
                <button type="button" className={showDrafts ? 'm-folder-pill on' : 'm-folder-pill'} data-label="Taslaklar" aria-label="Taslaklar klasörü" onClick={openDrafts} disabled={busy}>
                  <Icon name="drafts" size={14} />{drafts.length ? <em className="count" data-count={String(drafts.length)} aria-hidden="true" /> : null}
                </button>
                {activeSnoozedCount > 0 || activeCustomView === 'snoozed' ? (
                  <button type="button" className={activeCustomView === 'snoozed' ? 'm-folder-pill on' : 'm-folder-pill'} data-label="Ertelenenler" aria-label="Ertelenenler" onClick={openSnoozed} disabled={busy}>
                    <Icon name="clock" size={14} />{activeSnoozedCount ? <em className="count" data-count={String(activeSnoozedCount)} aria-hidden="true" /> : null}
                  </button>
                ) : null}
              </div>
            ) : null}
            {selected.length > 0 && props.bulkMessages ? (
              <div className="bulk-bar" role="toolbar" aria-label="Toplu işlemler">
                <span className="bulk-count">{selected.length} ileti seçildi</span>
                <button type="button" className="cmd" onClick={() => { void applyBulk('seen'); }} disabled={busy}>Okundu yap</button>
                <button type="button" className="cmd" onClick={() => { void applyBulk('unseen'); }} disabled={busy}>Okunmadı yap</button>
                <button type="button" className="cmd" onClick={() => { void applyBulk('star'); }} disabled={busy}>Yıldızla</button>
                {folder === 'trash' || folder === 'archive' ? (
                  <button type="button" className="cmd" onClick={() => { void applyBulk('move', 'inbox'); }} disabled={busy}>Geri al</button>
                ) : folder === 'spam' ? (
                  <button type="button" className="cmd" onClick={() => { void applyBulk('move', 'inbox'); }} disabled={busy}>Spam değil</button>
                ) : (
                  <button type="button" className="cmd" onClick={() => { void applyBulk('move', 'archive'); }} disabled={busy}>Arşivle</button>
                )}
                <label className="bulk-move">
                  <span className="sr">Klasöre taşı</span>
                  <select
                    aria-label="Klasöre taşı"
                    disabled={busy}
                    defaultValue=""
                    onChange={(event) => {
                      const dest = event.target.value as FolderRole | '';
                      event.target.value = '';
                      if (dest) void applyBulk('move', dest);
                    }}
                  >
                    <option value="">Taşı</option>
                    {MOVE_TARGETS.filter((item) => item.role !== folder && (folder !== 'archive' || item.role === 'inbox')).map((item) => (
                      <option key={item.role} value={item.role}>{item.label}</option>
                    ))}
                  </select>
                </label>
                {folder === 'archive' ? null : (
                  <button type="button" className="cmd danger" onClick={() => { void applyBulk('delete', undefined, folder === 'trash' ? 'Seçilen iletiler kalıcı silinsin mi?' : undefined); }} disabled={busy}>Sil</button>
                )}
                <button type="button" className="text-btn" onClick={() => setSelected([])} disabled={busy}>Vazgeç</button>
              </div>
            ) : (
              <div className="pivots" role="tablist">
                {props.bulkMessages && items.length > 0 ? (
                  <label className="choice select-all">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={busy} aria-label="Tümünü seç" />
                  </label>
                ) : null}
                <button
                  type="button"
                  role="tab"
                  aria-selected={!unseenOnly && !flaggedOnly && !attachmentsOnly && !unauthOnly}
                  className={!unseenOnly && !flaggedOnly && !attachmentsOnly && !unauthOnly ? 'pivot on' : 'pivot'}
                  onClick={() => {
                    if (operation.current) return;
                    if (unseenOnly) {
                      clearView();
                      setUnseenOnly(false);
                    }
                    setFlaggedOnly(false);
                    setAttachmentsOnly(false);
                    setUnauthOnly(false);
                  }}
                  disabled={busy}
                >
                  Tümü
                </button>
                <button type="button" role="tab" aria-selected={unseenOnly} className={unseenOnly ? 'pivot on' : 'pivot'} onClick={() => { if (operation.current) return; clearView(); setUnseenOnly((v) => !v); }} disabled={busy}>Okunmamış</button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={flaggedOnly}
                  className={flaggedOnly ? 'pivot on' : 'pivot'}
                  onClick={() => setFlaggedOnly((v) => !v)}
                  disabled={busy}
                  title="Yalnızca yıldızlı iletileri filtrele"
                >
                  ⭐ Yıldızlı
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={attachmentsOnly}
                  className={attachmentsOnly ? 'pivot on' : 'pivot'}
                  onClick={() => setAttachmentsOnly((v) => !v)}
                  disabled={busy}
                  title="Yalnızca dosya eki olan iletileri filtrele"
                >
                  📎 Ekli
                </button>
                {folder !== 'sent' ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={unauthOnly}
                    className={unauthOnly ? 'pivot on' : 'pivot'}
                    onClick={() => setUnauthOnly((v) => !v)}
                    disabled={busy}
                    title="DMARC veya SPF doğrulaması olmayan / başarısız iletileri listele"
                  >
                    ⚠️ DMARC/SPF Yok{unauthCount > 0 ? ` (${unauthCount})` : ''}
                  </button>
                ) : null}
                {(settings.labels || []).length > 0 && ((settings.rules || []).length > 0 || Object.keys(customLabels).length > 0) ? (
                  <select
                    aria-label="Etiket filtresi"
                    className="label-filter-select"
                    value={labelFilter}
                    onChange={(e) => setLabelFilter(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Tüm etiketler</option>
                    {(settings.labels || []).map((lbl) => (
                      <option key={lbl.id} value={lbl.id}>{lbl.name}</option>
                    ))}
                  </select>
                ) : null}
                {props.bulkMessages && !isGlobalSearchActive && items.some((i) => !i.seen) ? (
                  <button
                    type="button"
                    className="text-btn mark-all-read-btn"
                    onClick={() => {
                      const unreadUids = items.filter((i) => !i.seen).map((i) => i.uid);
                      if (unreadUids.length) void applyBulk('seen', undefined, undefined, unreadUids);
                    }}
                    disabled={busy}
                    title="Listedeki okunmamış iletileri tek tıkla okundu olarak işaretle"
                  >
                    ✓ Tümünü okundu yap
                  </button>
                ) : null}
                {(folder === 'trash' || folder === 'spam') && props.bulkMessages && items.length > 0 ? (
                  <button type="button" className="text-btn danger" onClick={() => { void applyBulk('empty', undefined, folder === 'trash' ? 'Çöp kutusu boşaltılsın mı? İletiler kalıcı silinir.' : 'Spam klasörü boşaltılsın mı?'); }} disabled={busy}>
                    {folder === 'trash' ? 'Çöpü boşalt' : 'Spamı boşalt'}
                  </button>
                ) : null}
                {draftQuery ? (
                  <button
                    type="button"
                    className="query-chip"
                    title="Arama filtresini kaldır"
                    disabled={busy}
                    onClick={() => {
                      setQuery('');
                      clearView();
                      setDraftQuery('');
                    }}
                  >
                    “{draftQuery}” <span aria-hidden="true">✕</span>
                  </button>
                ) : null}
              </div>
            )}
          </div>
          {listError ? (
            <div className="alert" role="alert">
              <p>{listError}</p>
              <p className="alert-hint">Bağlantınızı kontrol edip tekrar deneyin.</p>
              <button type="button" className="cmd" onClick={() => { void refreshList(true); }} disabled={busy || refreshing}>Tekrar dene</button>
            </div>
          ) : null}
          {listLoading && items.length === 0 ? (
            <div className="skel-list" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="skel-row">
                  <span className="skel-avatar" />
                  <span className="skel-lines"><i /><i /></span>
                </div>
              ))}
            </div>
          ) : null}
          {!account && !listLoading ? (
            <div className="empty-state">
              <Icon name="mail" size={40} />
              <p>Başlamak için ilk posta hesabınızı ekleyin.</p>
              <small>Hesap eklendikten sonra yeni iletiler burada görünecek.</small>
              {canAdd ? <button type="button" className="primary slim" onClick={startAddAccount} disabled={busy}>Hesap ekle</button> : null}
            </div>
          ) : null}
          {account && !listLoading && items.length === 0 && !listError ? (
            <div className="empty-state">
              <Icon name="mail" size={40} />
              <p>{emptyCopy.title}</p>
              {emptyCopy.hint ? <small>{emptyCopy.hint}</small> : null}
              {emptyCopy.action === 'clear' ? (
                <button type="button" className="text-btn" onClick={() => { setQuery(''); setDraftQuery(''); }}>Arama filtrelerini temizle</button>
              ) : null}
            </div>
          ) : null}
          {account && !listLoading && items.length > 0 && displayList.length === 0 && !listError ? (
            <div className="empty-state">
              <Icon name={activeCustomView === 'snoozed' ? 'clock' : 'mail'} size={40} />
              <p>{activeCustomView === 'snoozed' ? 'Aktif ertelenmiş ileti yok.' : 'Seçili hızlı filtreye uygun ileti bulunamadı.'}</p>
              {activeCustomView === 'snoozed' ? (
                <button type="button" className="text-btn" onClick={() => setActiveCustomView(null)}>Gelen kutusuna dön</button>
              ) : (
                <button type="button" className="text-btn" onClick={() => { setFlaggedOnly(false); setAttachmentsOnly(false); setUnauthOnly(false); setLabelFilter(''); setUnseenOnly(false); }}>Filtreyi temizle</button>
              )}
            </div>
          ) : null}
          {displayList.map((item, rowIdx) => {
            const rowColor = mailColor(rowIdx, 0);
            const isPinned = pinnedSet.has(item.uid);
            const isSnoozed = Boolean(snoozedMap[item.uid]);
            const matchedRules = (settings.rules || []).length ? evaluateRules(item, settings.rules || []) : { labels: [] };
            const manual = customLabels[`${accountId}:${folder}:${item.uid}`] || [];
            const itemLabelIds = [...new Set([...(item.labels || []), ...matchedRules.labels, ...manual])];
            const itemLabels = (settings.labels || []).filter((l) => itemLabelIds.includes(l.id));
            const tr = folder === 'sent' && trackingMap.size > 0
              ? trackingMap.get(item.subject)
              : undefined;
            const tracked = tr && tr.openCount > 0 ? tr : undefined;
              const rowKey = item.accountId ? `${item.accountId}:${item.uid}` : String(item.uid);
              const isSelectedMessage = message?.uid === item.uid && (!item.accountId || item.accountId === accountId);
              const itemAuth = describeAuthResults(item.authResults, item.folder || folder);
              return (
              <div
                key={rowKey}
                className={isSelectedMessage ? 'row-wrap on' : 'row-wrap'}
                style={{ '--row-accent': rowColor } as CSSProperties}
                onTouchStart={(e) => {
                  if (e.touches[0]) touchRowRef.current = { uid: item.uid, startX: e.touches[0].clientX, startY: e.touches[0].clientY };
                }}
                onTouchEnd={(e) => {
                  const start = touchRowRef.current;
                  touchRowRef.current = null;
                  if (!start || start.uid !== item.uid || !e.changedTouches[0] || busy) return;
                  const dx = e.changedTouches[0].clientX - start.startX;
                  const dy = Math.abs(e.changedTouches[0].clientY - start.startY);
                  if (Math.abs(dx) < 80 || dy > 45) return;
                  if (dx > 80) {
                    void actOnRow(item, 'seen');
                  } else if (dx < -80 && folder !== 'trash' && folder !== 'spam' && folder !== 'archive') {
                    void actOnRow(item, 'archive');
                  }
                }}
              >
                {props.bulkMessages && !isGlobalSearchActive ? (
                  <label className="row-check">
                    <span className="sr">{item.subject} seç</span>
                    <input type="checkbox" checked={selected.includes(item.uid)} disabled={busy} onChange={() => toggleSelect(item.uid)} />
                  </label>
                ) : null}
                <button type="button" className={item.flagged ? 'star on' : 'star'} title={item.flagged ? 'Yıldızı kaldır' : 'Yıldızla'} disabled={busy || isGlobalSearchActive} onClick={() => { void toggleFlagged(item); }}>
                  <Icon name={item.flagged ? 'starfill' : 'star'} size={16} />
                </button>
                <button type="button" className={isSelectedMessage ? 'row on' : item.seen ? 'row' : 'row unread'} onClick={() => { void openMessage(item.uid, item.accountId); }} disabled={busy}>
                  <span className="avatar-badge-wrap"><span className="avatar" style={{ background: rowColor }}>{initials(item.from, item.fromEmail)}</span>{!item.seen ? <em className="avatar-count" data-count={String(++listUnreadCounter)} aria-hidden="true" /> : null}</span>
                  <span className="row-copy">
                    <span className="row-top"><strong title={folder === 'sent' ? `Kime: ${item.to || item.from}` : item.from}>{folder === 'sent' ? `Kime: ${item.from}` : item.from}</strong><time>{formatWhen(item.date)}</time></span>
                    <span className="subject">
                      {isGlobalSearchActive && (item.accountDisplayName || item.accountEmail) ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 8,
                            background: 'rgba(37,99,235,0.12)',
                            color: '#1d4ed8',
                            marginRight: 6,
                          }}
                          title={item.accountEmail || ''}
                        >
                          {item.accountDisplayName || item.accountEmail}
                        </span>
                      ) : null}
                      {isPinned ? <span className="pin-badge" title="Başa sabitlendi">📌</span> : null}
                      {isSnoozed ? <span className="snooze-badge" title="Ertelendi">⏰</span> : null}
                      {itemAuth?.hasIssue ? (
                        <span className={itemAuth.isDanger ? 'list-auth-badge danger' : 'list-auth-badge'} title={itemAuth.headline}>
                          {itemAuth.badge}
                        </span>
                      ) : null}
                      {item.hasAttachments ? <Icon name="attach" size={14} /> : null}
                      {itemLabels.map((lbl) => (
                        <em key={lbl.id} className="mail-label-chip" data-label={lbl.name} style={{ '--lbl-color': lbl.color } as React.CSSProperties} aria-hidden="true" />
                      ))}
                      {tracked ? (
                        <em className="track-badge" data-track={`Okundu ×${tracked.openCount}`} title={tracked.lastOpenedAt ? `Son okunma: ${new Date(tracked.lastOpenedAt).toLocaleString('tr-TR')}` : 'Alıcı tarafından açıldı'} aria-hidden="true" />
                      ) : null}
                      {item.subject}
                    </span>
                  </span>
                </button>
                <div className="row-actions">
                  <button type="button" className={isPinned ? 'icon-btn pin-btn on' : 'icon-btn pin-btn'} aria-label={isPinned ? 'Sabitlemeyi kaldır' : 'Başa sabitle'} title={isPinned ? 'Sabitlemeyi kaldır' : 'Başa sabitle'} disabled={busy} onClick={(event) => { event.stopPropagation(); togglePin(item.uid); }}>
                    <span style={{ fontSize: 13 }}>📌</span>
                  </button>
                  <button type="button" className={isSnoozed ? 'icon-btn snooze-btn on' : 'icon-btn snooze-btn'} aria-label={isSnoozed ? 'Ertelemeyi kaldır' : 'Ertele'} title={isSnoozed ? 'Ertelemeyi kaldır (Gelen kutusuna al)' : 'Ertele (Yarın 09:00)'} disabled={busy} onClick={(event) => {
                    event.stopPropagation();
                    if (isSnoozed) {
                      unsnoozeMessage(item.uid);
                    } else {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      d.setHours(9, 0, 0, 0);
                      snoozeMessage(item.uid, d.getTime());
                    }
                  }}>
                    <span style={{ fontSize: 13 }}>⏰</span>
                  </button>
                  <button type="button" className="icon-btn" aria-label={item.seen ? 'Okunmadı yap' : 'Okundu yap'} title={item.seen ? 'Okunmadı yap' : 'Okundu yap'} disabled={busy} onClick={(event) => { event.stopPropagation(); void actOnRow(item, 'seen'); }}>
                    <Icon name={item.seen ? 'unread' : 'read'} size={16} />
                  </button>
                  {folder === 'trash' || folder === 'spam' || folder === 'archive' ? null : (
                    <button type="button" className="icon-btn" aria-label="Arşivle" title="Arşivle" disabled={busy} onClick={(event) => { event.stopPropagation(); void actOnRow(item, 'archive'); }}>
                      <Icon name="archive" size={16} />
                    </button>
                  )}
                  {folder === 'archive' ? null : (
                    <button type="button" className="icon-btn" aria-label="Sil" title="Sil" disabled={busy} onClick={(event) => { event.stopPropagation(); void actOnRow(item, 'delete'); }}>
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          {nextCursor ? <button type="button" className="more" onClick={older} disabled={listLoading || busy}>{listLoading ? 'Yükleniyor…' : 'Daha eski'}</button> : null}
        </section>
        {!home ? (
          <div
            className={resizingPane === 'list' ? 'pane-resizer active' : 'pane-resizer'}
            role="separator"
            aria-orientation="vertical"
            aria-label="Gelen kutusu genişliğini ayarla"
            title="Sürükleyerek Gelen Kutusunu büyüt · Çift tıkla: varsayılan"
            tabIndex={0}
            onMouseDown={(e) => { e.preventDefault(); startPaneResize('list', e.clientX); }}
            onDoubleClick={() => applyPaneWidth('list', null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') applyPaneWidth('list', (listWidth ?? 390) + 32);
              else if (e.key === 'ArrowLeft') applyPaneWidth('list', (listWidth ?? 390) - 32);
            }}
          />
        ) : null}
        <section className="reader" aria-label="Okuma bölmesi">
          <button type="button" className="back-btn" onClick={goBack} aria-label="Geri"><Icon name="back" size={16} />{compose ? 'Listeye dön' : showAdd || showDrafts || showSettings || showContactsPage ? 'Kapat' : 'Geri'}</button>
          {showContactsPage && !showSettings ? (
            <Suspense fallback={<div className="empty-state"><p>Kişilerim yükleniyor…</p></div>}>
              <ContactsPanel
                contacts={settings.recent}
                busy={busy}
                onClose={() => setShowContactsPage(false)}
                onSaveContacts={async (nextContacts, deletedEmails) => {
                  await persistSettings({ recent: nextContacts, replaceRecent: true, ...(deletedEmails?.length ? { deletedEmails } : {}) });
                }}
                onComposeTo={(emails) => {
                  setShowContactsPage(false);
                  startComposeFromAccount(account?.id || accountId, emails.join(', '));
                }}
                onNotify={(msg) => showToast(msg)}
              />
            </Suspense>
          ) : null}
          {showSettings ? (
            <SettingsPanel
              accounts={accounts}
              accountId={accountId}
              settings={settings}
              busy={busy}
              onClose={() => setShowSettings(false)}
              onAddAccount={canAdd ? startAddAccount : undefined}
              onSave={persistSettings}
              onToggleEnabled={props.setAccountEnabled ? toggleEnabled : undefined}
              onTest={props.testAccount ? (id) => onTestAccount(accounts.find((item) => item.id === id) || accounts[0]) : undefined}
              onLoadAdminOverview={canAdd ? props.loadAdminOverview : undefined}
              onInviteUser={canAdd ? props.inviteUser : undefined}
              onSetUserAccess={canAdd ? props.setUserAccess : undefined}
            />
          ) : null}

          {showDrafts && !showSettings && !showContactsPage ? (
            <div className="drafts">
              <h2>Taslaklar</h2>
              {drafts.length === 0 ? (
                <div className="empty-state">
                  <Icon name="drafts" size={40} />
                  <p>Kayıtlı taslak yok.</p>
                  <small>Yazmaya başladığınız iletiler otomatik kaydedilir.</small>
                  <button type="button" className="primary slim" onClick={startCompose} disabled={busy}>Yeni ileti</button>
                </div>
              ) : null}
              {drafts.map((draft) => (
                <div key={draft.id} className="draft">
                  <button type="button" onClick={() => {
                    if (operation.current) return;
                    beginCompose(fromDraft(draft), true);
                  }} disabled={busy}>
                    <strong>{draft.subject || '(Konu yok)'}</strong>
                    <small>{draft.to || 'Alıcı yok'}</small>
                  </button>
                  <button type="button" className="text-btn danger" onClick={() => removeDraft(draft.id)} disabled={busy}>Sil</button>
                </div>
              ))}
            </div>
          ) : null}
          {!showDrafts && !showSettings && !showContactsPage && messageLoading ? <div className="reading-skel"><div className="skel" /><div className="skel tall" /></div> : null}
          {!showDrafts && !showSettings && !showContactsPage && message && !compose ? (
            <article className="message">
              <div className="command-bar" role="toolbar" aria-label="İleti komutları">
                <button type="button" className="cmd" onClick={startReply} disabled={busy} title="Yanıtla (R)"><Icon name="reply" />Yanıtla</button>
                <button type="button" className="cmd" onClick={startReplyAll} disabled={busy} title="Tümünü yanıtla (Shift+R)"><Icon name="replyall" />Tümünü yanıtla</button>
                <button type="button" className="cmd" onClick={startForward} disabled={busy} title="İlet (F)"><Icon name="forward" />İlet</button>
                <button type="button" className="cmd" onClick={() => window.print()} disabled={busy} title="Yazdır veya PDF olarak kaydet"><span style={{ fontSize: 13 }}>🖨️</span>Yazdır / PDF</button>
                <button type="button" className="cmd" onClick={() => {
                  if (account && message) {
                    showToast(`${message.subject || 'posta'}.eml indiriliyor...`);
                    downloadAttachment(`/api/accounts/${account.id}/messages/${message.uid}/raw?folder=${folder}`, `${message.subject || 'posta'}.eml`)
                      .catch((err: Error) => showToast(err.message));
                  }
                }} disabled={busy} title="Orijinal .EML dosyasını indir"><span style={{ fontSize: 13 }}>📄</span>.EML İndir</button>
                <button type="button" className={pinnedUids.includes(message.uid) ? 'cmd on' : 'cmd'} onClick={() => togglePin(message.uid)} disabled={busy} title={pinnedUids.includes(message.uid) ? 'Sabitlemeyi kaldır' : 'Başa sabitle'}><span style={{ fontSize: 13 }}>📌</span>{pinnedUids.includes(message.uid) ? 'Sabitlendi' : 'Sabitle'}</button>
                <button type="button" className={snoozedMap[message.uid] ? 'cmd on' : 'cmd'} onClick={() => {
                  if (snoozedMap[message.uid]) {
                    unsnoozeMessage(message.uid);
                  } else {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    d.setHours(9, 0, 0, 0);
                    snoozeMessage(message.uid, d.getTime());
                  }
                }} disabled={busy} title={snoozedMap[message.uid] ? 'Ertelemeyi kaldır (Gelen kutusuna al)' : "Yarın 09:00'a ertele"}><span style={{ fontSize: 13 }}>⏰</span>{snoozedMap[message.uid] ? 'Ertelemeyi kaldır' : 'Ertele'}</button>
                <button type="button" className="cmd" onClick={() => { void toggleFlagged(); }} disabled={busy}><Icon name={message.flagged ? 'starfill' : 'star'} />{message.flagged ? 'Yıldızı kaldır' : 'Yıldız'}</button>
                <button type="button" className="cmd" onClick={toggleSeen} disabled={busy}><Icon name={message.seen ? 'unread' : 'read'} />{message.seen ? 'Okunmadı yap' : 'Okundu yap'}</button>
                {folder === 'trash' || folder === 'archive' ? (
                  <button type="button" className="cmd" onClick={() => { void relocate('inbox', 'İleti gelen kutusuna alındı.'); }} disabled={busy}><Icon name="inbox" />Geri al</button>
                ) : folder === 'spam' ? (
                  <button type="button" className="cmd" onClick={() => { void relocate('inbox', 'İleti spam değil olarak işaretlendi.'); }} disabled={busy}><Icon name="inbox" />Spam değil</button>
                ) : (
                  <>
                    <button type="button" className="cmd" onClick={() => { void relocate('archive', 'İleti arşivlendi.'); }} disabled={busy}><Icon name="archive" />Arşivle</button>
                    <button type="button" className="cmd" onClick={() => { void relocate('spam', 'İleti spam klasörüne taşındı.'); }} disabled={busy}><Icon name="spam" />Spam</button>
                  </>
                )}
                {folder === 'archive' ? null : (
                  <button type="button" className="cmd danger" onClick={() => { void removeMessage(); }} disabled={busy} title="Sil (Del)"><Icon name="trash" />Sil</button>
                )}
                {(() => {
                  const currentMsgIndex = displayList.findIndex((item) => item.uid === message.uid && (!item.accountId || item.accountId === (message.accountId || accountId)));
                  if (displayList.length <= 1 || currentMsgIndex < 0) return null;
                  const hasPrevMsg = currentMsgIndex > 0;
                  const hasNextMsg = currentMsgIndex < displayList.length - 1;
                  return (
                    <span className="msg-nav-group" role="group" aria-label="İleti gezinme">
                      <span className="msg-nav-pos" aria-label="İleti sırası">{currentMsgIndex + 1} / {displayList.length}</span>
                      <button
                        type="button"
                        className="cmd msg-nav-btn"
                        onClick={() => openNeighbor(-1)}
                        disabled={busy || !hasPrevMsg}
                        title="Önceki ileti (K)"
                        aria-label="Önceki ileti"
                      >
                        ◀ Önceki
                      </button>
                      <button
                        type="button"
                        className="cmd msg-nav-btn"
                        onClick={() => openNeighbor(1)}
                        disabled={busy || !hasNextMsg}
                        title="Sonraki ileti (J)"
                        aria-label="Sonraki ileti"
                      >
                        Sonraki ▶
                      </button>
                    </span>
                  );
                })()}
              </div>
              <header className="letter-head">
                <h2>{message.subject}</h2>
                <div className="sender">
                  <span className="avatar lg" style={{ background: tint(message.fromEmail || message.from) }}>{initials(message.from, message.fromEmail)}</span>
                  <div className="sender-copy">
                    <p className="sender-line">
                      <strong>{message.from}</strong>
                      {message.fromEmail && message.fromEmail !== message.from ? <span className="sender-email">&lt;{message.fromEmail}&gt;</span> : null}
                      {message.fromEmail ? (
                        <span className="sender-tools">
                          <button type="button" className="chip-btn" onClick={() => copyAddress(message.fromEmail)} title="Gönderen e-posta adresini kopyala">Kopyala</button>
                          <button type="button" className="chip-btn" onClick={() => startComposeFromAccount(account?.id || accountId, message.fromEmail)} disabled={busy} title="Bu kişiye yeni ileti yaz">Mesaj yaz</button>
                        </span>
                      ) : null}
                    </p>
                    {(() => {
                      const toRecipients = parseRecipientTokens(message.to, message.toEmails);
                      const ccRecipients = parseRecipientTokens(message.cc, message.ccEmails);
                      const bccRecipients = parseRecipientTokens(message.bcc || '', message.bccEmails);
                      const totalRecipients = toRecipients.length + ccRecipients.length + bccRecipients.length;

                      if (!recipientsExpanded && (totalRecipients > 1 || ccRecipients.length > 0 || bccRecipients.length > 0)) {
                        return (
                          <div className="recipient-compact-row">
                            <span className="meta">
                              <strong>Kime:</strong>{' '}
                              {toRecipients[0] ? (toRecipients[0].name ? `${toRecipients[0].name} <${toRecipients[0].email}>` : toRecipients[0].email) : (message.to || '—')}
                              {totalRecipients > 1 ? (
                                <span className="recipient-more-count"> (+{totalRecipients - 1} alıcı daha)</span>
                              ) : null}
                            </span>
                            <button
                              type="button"
                              className="recipient-toggle-btn"
                              onClick={() => setRecipientsExpanded(true)}
                              title="Tüm alıcıları göster"
                            >
                              Ayrıntılar ▼
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div className="recipient-details-box" aria-label="Alıcı ayrıntıları">
                          <div className="recipient-details-header">
                            <div className="recipient-rows">
                              <div className="recipient-row">
                                <span className="recipient-label">Kime:</span>
                                <div className="recipient-chips">
                                  {toRecipients.length > 0 ? (
                                    toRecipients.map((r, i) => (
                                      <span key={`to-${i}-${r.email || r.raw}`} className="recipient-chip" title={r.raw || r.email}>
                                        {r.name && r.name !== r.email ? (
                                          <strong className="recipient-chip-name">{r.name}</strong>
                                        ) : null}
                                        <span className="recipient-chip-email">{r.email ? `<${r.email}>` : r.raw}</span>
                                        {r.email ? (
                                          <span className="recipient-chip-actions">
                                            <button
                                              type="button"
                                              className="recipient-mini-action"
                                              onClick={() => copyAddress(r.email)}
                                              title={`${r.email} adresini kopyala`}
                                            >
                                              Kopyala
                                            </button>
                                            <button
                                              type="button"
                                              className="recipient-mini-action"
                                              onClick={() => startComposeFromAccount(account?.id || accountId, r.email)}
                                              disabled={busy}
                                              title="Bu kişiye yeni ileti yaz"
                                            >
                                              Yaz
                                            </button>
                                          </span>
                                        ) : null}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="recipient-chip-empty">{message.to || '—'}</span>
                                  )}
                                </div>
                              </div>

                              {ccRecipients.length > 0 ? (
                                <div className="recipient-row">
                                  <span className="recipient-label">Cc:</span>
                                  <div className="recipient-chips">
                                    {ccRecipients.map((r, i) => (
                                      <span key={`cc-${i}-${r.email || r.raw}`} className="recipient-chip" title={r.raw || r.email}>
                                        {r.name && r.name !== r.email ? (
                                          <strong className="recipient-chip-name">{r.name}</strong>
                                        ) : null}
                                        <span className="recipient-chip-email">{r.email ? `<${r.email}>` : r.raw}</span>
                                        {r.email ? (
                                          <span className="recipient-chip-actions">
                                            <button
                                              type="button"
                                              className="recipient-mini-action"
                                              onClick={() => copyAddress(r.email)}
                                              title={`${r.email} adresini kopyala`}
                                            >
                                              Kopyala
                                            </button>
                                            <button
                                              type="button"
                                              className="recipient-mini-action"
                                              onClick={() => startComposeFromAccount(account?.id || accountId, r.email)}
                                              disabled={busy}
                                              title="Bu kişiye yeni ileti yaz"
                                            >
                                              Yaz
                                            </button>
                                          </span>
                                        ) : null}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {bccRecipients.length > 0 ? (
                                <div className="recipient-row">
                                  <span className="recipient-label">Bcc:</span>
                                  <div className="recipient-chips">
                                    {bccRecipients.map((r, i) => (
                                      <span key={`bcc-${i}-${r.email || r.raw}`} className="recipient-chip" title={r.raw || r.email}>
                                        {r.name && r.name !== r.email ? (
                                          <strong className="recipient-chip-name">{r.name}</strong>
                                        ) : null}
                                        <span className="recipient-chip-email">{r.email ? `<${r.email}>` : r.raw}</span>
                                        {r.email ? (
                                          <span className="recipient-chip-actions">
                                            <button
                                              type="button"
                                              className="recipient-mini-action"
                                              onClick={() => copyAddress(r.email)}
                                              title={`${r.email} adresini kopyala`}
                                            >
                                              Kopyala
                                            </button>
                                            <button
                                              type="button"
                                              className="recipient-mini-action"
                                              onClick={() => startComposeFromAccount(account?.id || accountId, r.email)}
                                              disabled={busy}
                                              title="Bu kişiye yeni ileti yaz"
                                            >
                                              Yaz
                                            </button>
                                          </span>
                                        ) : null}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            {totalRecipients > 1 || ccRecipients.length > 0 || bccRecipients.length > 0 ? (
                              <button
                                type="button"
                                className="recipient-toggle-btn"
                                onClick={() => setRecipientsExpanded(false)}
                                title="Alıcı ayrıntılarını daralt"
                              >
                                Daralt ▲
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })()}
                    {(() => {
                      if (folder === 'sent') return null;
                      const authInfo = describeAuthResults(message.authResults, folder);
                      if (!authInfo) {
                        return (
                          <div className="auth-status-row">
                            <span className="trust-badge warning" title="Gönderici sunucu SPF / DMARC doğrulama başlığı bulunamadı">
                              ⚠️ Doğrulanmamış Gönderici (SPF &amp; DMARC Yok)
                            </span>
                          </div>
                        );
                      }
                      const badgeTone = !authInfo.hasIssue ? 'verified' : authInfo.isDanger ? 'danger' : 'warning';
                      return (
                        <div className="auth-status-row" aria-label="Gönderen e-posta güvenlik doğrulaması">
                          <span className={`trust-badge ${badgeTone}`} title={authInfo.headline}>
                            {authInfo.headline}
                          </span>
                          <span className={`auth-pill ${authInfo.spfOk ? 'ok' : authInfo.spfFail ? 'fail' : 'warn'}`}>
                            {authInfo.spfLabel}
                          </span>
                          <span className={`auth-pill ${authInfo.dmarcOk ? 'ok' : authInfo.dmarcFail ? 'fail' : 'warn'}`}>
                            {authInfo.dmarcLabel}
                          </span>
                          <span className={`auth-pill ${authInfo.dkimOk ? 'ok' : authInfo.dkimFail ? 'fail' : 'warn'}`}>
                            {authInfo.dkimLabel}
                          </span>
                        </div>
                      );
                    })()}
                    {(() => {
                      const matched = (settings.rules || []).length ? evaluateRules(message, settings.rules || []) : { labels: [] };
                      const allLblIds = [...new Set([...(message.labels || []), ...matched.labels])];
                      const activeLabels = (settings.labels || []).filter((l) => allLblIds.includes(l.id));
                      const sentTrack = folder === 'sent' && trackingMap.size > 0
                        ? trackingMap.get(message.subject)
                        : undefined;
                      return (
                        <>
                          {activeLabels.length > 0 ? (
                            <div className="message-labels" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                              {activeLabels.map((lbl) => (
                                <span
                                  key={lbl.id}
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: '2px 8px',
                                    borderRadius: 12,
                                    background: `${lbl.color}22`,
                                    color: lbl.color,
                                    border: `1px solid ${lbl.color}66`,
                                  }}
                                >
                                  🏷️ {lbl.name}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {folder === 'sent' ? (
                            <div
                              className="delivery-analytics-card"
                              style={{
                                marginTop: 8,
                                padding: '6px 12px',
                                background: sentTrack && sentTrack.openCount > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(2, 132, 199, 0.08)',
                                borderRadius: 6,
                                border: `1px solid ${sentTrack && sentTrack.openCount > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(2, 132, 199, 0.2)'}`,
                                fontSize: 12,
                                color: sentTrack && sentTrack.openCount > 0 ? '#059669' : '#0369a1',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <span style={{ fontWeight: 700 }}>
                                {sentTrack && sentTrack.openCount > 0 ? '✓✓ Alıcı Tarafından Okundu' : '✓✓ İletildi & Teslim Edildi'}
                              </span>
                              {sentTrack && sentTrack.openCount > 0 ? (
                                <span>(Toplam {sentTrack.openCount} kez açıldı · İlk: {sentTrack.firstOpenedAt ? new Date(sentTrack.firstOpenedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''})</span>
                              ) : (
                                <span>· Takip pikseli aktif</span>
                              )}
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                  <time className="meta when">{formatFull(message.date)}</time>
                </div>
                {(settings.labels || []).length > 0 ? (
                  <div className="message-labels-bar" aria-label="İleti etiketleri">
                    <span className="quick-label">Etiketler:</span>
                    {(settings.labels || []).map((lbl) => {
                      const active = (customLabels[`${accountId}:${folder}:${message.uid}`] || []).includes(lbl.id);
                      return (
                        <button
                          key={lbl.id}
                          type="button"
                          className={active ? 'chip-btn on' : 'chip-btn'}
                          style={active ? { borderColor: lbl.color, color: lbl.color } : undefined}
                          onClick={() => toggleMessageLabel(message.uid, lbl.id)}
                        >
                          {active ? `✓ ${lbl.name}` : `+ ${lbl.name}`}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </header>
              {message.unsubscribe ? (
                <div className="unsubscribe-banner" style={{ margin: '8px 0', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 6, border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Bu ileti bir dağıtım listesinden veya bültenden geldi.</span>
                  <a
                    href={message.unsubscribe.url || message.unsubscribe.mailto || message.unsubscribe.raw}
                    target={message.unsubscribe.url ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="unsubscribe-link"
                    style={{ fontWeight: 600, color: 'var(--danger-color, #ef4444)', textDecoration: 'underline' }}
                  >
                    Abonelikten Çık
                  </a>
                </div>
              ) : null}
              {message.calendarEvent ? (
                <CalendarInviteCard event={message.calendarEvent} />
              ) : null}
              {message.attachments.length > 0 ? (
                <div className={attachmentsExpanded ? 'attachments-section expanded' : 'attachments-section'}>
                  <div className="attachments-bar">
                    <span className="attachments-summary">
                      <Icon name="attach" size={15} />
                      <strong>{message.attachments.length} ek dosya</strong>
                      <small>({fileSize(message.attachments.reduce((sum, f) => sum + (f.size || 0), 0))})</small>
                    </span>
                    <div className="attachments-bar-actions">
                      {message.attachments.length > 3 ? (
                        <button
                          type="button"
                          className="text-btn"
                          onClick={() => setAttachmentsExpanded((prev) => !prev)}
                          title={attachmentsExpanded ? 'Ek listesini daralt' : 'Tüm ek dosyaları genişlet'}
                        >
                          {attachmentsExpanded ? 'Daralt' : 'Tümünü göster'}
                        </button>
                      ) : null}
                      {message.attachments.length > 1 ? (
                        <button
                          type="button"
                          className="cmd slim"
                          disabled={busy}
                          title="Tüm ek dosyaları sırayla indir"
                          onClick={() => {
                            if (!account || operation.current) return;
                            const version = viewVersion.current;
                            const request = readerVersion.current;
                            showToast(`${message.attachments.length} ek dosya indiriliyor...`);
                            void (async () => {
                              for (const file of message.attachments) {
                                if (!currentView(version) || request !== readerVersion.current) break;
                                try {
                                  await props.downloadFile(account.id, folder, message.uid, file.index, file.filename);
                                } catch (err) {
                                  if (currentView(version) && request === readerVersion.current) {
                                    showToast(err instanceof Error ? err.message : 'Dosya indirilemedi.');
                                  }
                                  break;
                                }
                              }
                            })();
                          }}
                        >
                          Tümünü İndir ({message.attachments.length})
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <ul className="files">
                    {message.attachments.map((file) => (
                      <li key={`${account?.id}:${message.uid}:${file.index}`} className="file-card">
                        {account && props.previewFile && isThumbnailable(file.contentType, file.filename, file.size) ? (
                          <AttachmentThumb
                            load={() => props.previewFile!(account.id, folder, message.uid, file.index)}
                            filename={file.filename}
                            fallback={fileKind(file.contentType, file.filename)}
                            disabled={busy}
                            onOpen={() => { void openAttachmentPreview(file); }}
                          />
                        ) : (
                          <span className="file-kind">{fileKind(file.contentType, file.filename)}</span>
                        )}
                        <span className="file-copy">
                          <strong>{file.filename}</strong>
                          <small>{fileKind(file.contentType, file.filename)} · {fileSize(file.size)}</small>
                        </span>
                        {props.previewFile && canPreviewAttachment(file.contentType, file.filename) ? (
                          <button type="button" className="text-btn" disabled={busy} title="Uygulama içinde önizle" onClick={() => { void openAttachmentPreview(file); }}>Önizle</button>
                        ) : null}
                        <button type="button" className="text-btn" disabled={busy} title="İndir" onClick={() => {
                          if (!account || operation.current) return;
                          const version = viewVersion.current;
                          const request = readerVersion.current;
                          showToast(`${file.filename} indiriliyor...`);
                          props.downloadFile(account.id, folder, message.uid, file.index, file.filename)
                            .catch((err: Error) => { if (currentView(version) && request === readerVersion.current) showToast(err.message); });
                        }}>İndir</button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {hasRemoteImages(message.html) && imagesFor !== message.uid ? (
                <p className="info-bar images-blocked">
                  <Icon name="image" size={16} />
                  Gizliliğiniz için bu iletideki uzak resimler engellendi.{' '}
                  <button type="button" className="text-btn" onClick={() => setImagesFor(message.uid)}>Resimleri göster</button>
                </p>
              ) : null}
              <iframe className="letter" title="İleti" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={mailDocument(message.html, { remoteImages: imagesFor === message.uid })} />
              <div className="quick-reply-box" aria-label="Hızlı yanıt">
                <div className="quick-reply-chips">
                  <button type="button" className="chip-btn" disabled={busy} onClick={() => setQuickReplyText('Merhaba, iletiniz alındı. Teşekkür eder, iyi çalışmalar dilerim.')}>+ Alındı, teşekkürler</button>
                  <button type="button" className="chip-btn" disabled={busy} onClick={() => setQuickReplyText('Merhaba, ilgili evrak ve bilgiler incelenmiş olup tarafımızca onaylanmıştır.')}>+ İncelendi &amp; onaylandı</button>
                  <button type="button" className="chip-btn" disabled={busy} onClick={() => setQuickReplyText('Merhaba, konuyla ilgili en kısa sürede tarafınıza dönüş yapılacaktır.')}>+ Dönüş yapılacak</button>
                </div>
                <div className="quick-reply-row">
                  <textarea
                    rows={2}
                    placeholder={`${message.from || message.fromEmail} kişisine anında hızlı yanıt yaz…`}
                    value={quickReplyText}
                    onChange={(e) => setQuickReplyText(e.target.value)}
                    disabled={busy}
                  />
                  <div className="quick-reply-actions">
                    <button type="button" className="primary slim" disabled={busy || !quickReplyText.trim()} onClick={() => { void sendQuickReply(); }}>
                      <Icon name="send" size={14} /> Hızlı Gönder
                    </button>
                    <button type="button" className="text-btn" disabled={busy} onClick={openQuickReplyInEditor}>
                      Tam editörde aç
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ) : null}
          {!showAdd && !showDrafts && !showSettings && !showContactsPage && !message && !compose && !messageLoading ? (
            <div className="empty-state reading-empty"><Icon name="mail" size={56} /><p>Okumak için bir ileti seçin.</p><small>Yeni ileti için <kbd>N</kbd> tuşuna basın.</small></div>
          ) : null}
          {compose && !showSettings && !showContactsPage ? (
            <form
              className="compose card"
              onSubmit={onSend}
              onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); }}
              onDrop={(e) => {
                if (!e.dataTransfer?.files?.length) return;
                e.preventDefault();
                void uploadFiles(Array.from(e.dataTransfer.files));
              }}
            >
              <div className="compose-bar">
                <button className="primary" type="submit" disabled={busy}><Icon name="send" />{busy ? 'Gönderiliyor…' : 'Gönder'}</button>
                <button
                  type="button"
                  className="cmd schedule-btn"
                  disabled={busy}
                  onClick={() => setSchedulePickerOpen((v) => !v)}
                  title="İleri bir tarihte gönder"
                >
                  ⏱️ Zamanla
                </button>
                <button
                  type="button"
                  className="cmd template-btn"
                  disabled={busy}
                  onClick={() => setShowTemplateModal(true)}
                  title="Hazır Şablonlar"
                >
                  📝 Şablonlar
                </button>
                <label className="text-btn file-btn">Ek ekle
                  <input type="file" multiple disabled={busy} onChange={onPickFiles} />
                </label>
                <button type="button" className="text-btn" onClick={onSaveDraft} disabled={busy}>Taslağı kaydet</button>
                <label className="choice track-toggle" title="Alıcı e-postayı açtığında Gönderilenler klasöründe okundu sayısını gösterir">
                  <input type="checkbox" checked={trackRead} onChange={(e) => setTrackRead(e.target.checked)} disabled={busy} />
                  <span>Okundu takibi</span>
                </label>
                <span className="save-state" role="status">
                  {draftStatus === 'saving' ? 'Kaydediliyor…' : draftStatus === 'error' ? 'Kaydedilemedi' : draftStatus === 'saved' && !dirty ? 'Kaydedildi' : dirty ? 'Kaydedilmedi' : ''}
                </span>
                <button type="button" className="text-btn discard" onClick={() => { if (!operation.current && confirmLeave()) { setCompose(null); setDraftStatus('idle'); } }} disabled={busy}>Vazgeç</button>
              </div>
              {schedulePickerOpen ? (
                <div className="schedule-picker-box card" style={{ padding: 12, margin: '8px 0', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>⏱️ İleri Tarihte Gönder</h4>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <button
                      type="button"
                      className="chip-btn"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        d.setHours(9, 0, 0, 0);
                        void handleScheduleSend(d.getTime());
                      }}
                    >
                      Yarın 09:00
                    </button>
                    <button
                      type="button"
                      className="chip-btn"
                      onClick={() => {
                        const d = new Date();
                        const day = d.getDay();
                        const daysUntilMonday = ((8 - day) % 7) || 7;
                        d.setDate(d.getDate() + daysUntilMonday);
                        d.setHours(9, 0, 0, 0);
                        void handleScheduleSend(d.getTime());
                      }}
                    >
                      Pazartesi 09:00
                    </button>
                    <button
                      type="button"
                      className="chip-btn"
                      onClick={() => {
                        const d = new Date();
                        d.setHours(d.getHours() + 2);
                        void handleScheduleSend(d.getTime());
                      }}
                    >
                      2 Saat Sonra
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="datetime-local"
                      value={customScheduleDate}
                      onChange={(e) => setCustomScheduleDate(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border-color)' }}
                    />
                    <button
                      type="button"
                      className="primary slim"
                      disabled={!customScheduleDate}
                      onClick={() => {
                        const ts = new Date(customScheduleDate).getTime();
                        if (ts > Date.now()) {
                          void handleScheduleSend(ts);
                        } else {
                          showToast('Lütfen ileri bir tarih ve saat seçin.');
                        }
                      }}
                    >
                      Bu Zamana Zamanla
                    </button>
                    <button type="button" className="text-btn" onClick={() => setSchedulePickerOpen(false)}>Kapat</button>
                  </div>
                </div>
              ) : null}
              <h2>{compose.mode === 'reply' ? 'Yanıt' : compose.mode === 'forward' ? 'İlet' : 'Yeni ileti'}</h2>
              <div className="field-row">
                <label className="field">Kimden
                  <select
                    aria-label="Gönderen hesap"
                    value={account?.id || accountId}
                    disabled={busy || accounts.filter((item) => item.enabled !== false).length <= 1}
                    onChange={(e) => changeComposeAccount(e.target.value)}
                  >
                    {accounts.filter((item) => item.enabled !== false || item.id === account?.id).map((item) => (
                      <option key={item.id} value={item.id}>{item.displayName} &lt;{item.email}&gt;</option>
                    ))}
                  </select>
                </label>
                {accounts.filter((item) => item.enabled !== false).length > 1 ? (
                  <button
                    type="button"
                    className="text-btn"
                    disabled={busy}
                    onClick={() => {
                      const enabledIds = accounts.filter((a) => a.enabled !== false).map((a) => a.id);
                      const currentActive = enabledIds.filter((id) => multiSenders.includes(id));
                      if (!showMultiSenders) {
                        setShowMultiSenders(true);
                        if (currentActive.length <= 1) {
                          setMultiSenders(enabledIds);
                        }
                      } else {
                        setShowMultiSenders(false);
                      }
                    }}
                  >
                    {(() => {
                      const activeCount = accounts.filter((a) => a.enabled !== false && multiSenders.includes(a.id)).length;
                      return (showMultiSenders || activeCount > 1) ? `Çoklu gönderen (${activeCount})` : 'Çoklu hesaptan gönder';
                    })()}
                  </button>
                ) : null}
              </div>
              {showMultiSenders ? (
                <div className="bulk-picker" aria-label="Çoklu gönderen hesap seçimi">
                  <div className="bulk-picker-bar">
                    <strong>Gönderilecek Hesapları Seçin ({multiSenders.length} seçili)</strong>
                    <div className="bulk-picker-actions">
                      <button type="button" className="chip-btn" disabled={busy} onClick={() => setMultiSenders(accounts.filter((a) => a.enabled !== false).slice(0, 16).map((a) => a.id))}>16 Hesap Seç</button>
                      <button type="button" className="chip-btn" disabled={busy} onClick={() => setMultiSenders(accounts.filter((a) => a.enabled !== false).slice(0, 20).map((a) => a.id))}>20 Hesap Seç</button>
                      <button type="button" className="chip-btn" disabled={busy} onClick={() => setMultiSenders(accounts.filter((a) => a.enabled !== false).map((a) => a.id))}>Tüm Hesapları Seç ({accounts.filter((a) => a.enabled !== false).length})</button>
                      <button type="button" className="chip-btn" disabled={busy} onClick={() => { setMultiSenders(account ? [account.id] : []); setShowMultiSenders(false); }}>Tek Hesaba Dön</button>
                    </div>
                  </div>
                  <div className="bulk-picker-grid">
                    {accounts.filter((item) => item.enabled !== false).map((item) => (
                      <label key={item.id} className="choice bulk-choice">
                        <input
                          type="checkbox"
                          checked={multiSenders.includes(item.id)}
                          disabled={busy}
                          onChange={() => setMultiSenders((cur) => cur.includes(item.id) ? cur.filter((id) => id !== item.id) : [...cur, item.id])}
                        />
                        <span><strong>{item.displayName}</strong> <small>{item.email}</small></span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="field-row">
                <label className="field">Kime
                  {extractRecipientTokens(compose.to).some(isExternalRecipient) ? (
                    <span className="external-tag" style={{ marginLeft: 6, fontSize: 11, padding: '2px 6px', background: 'rgba(234, 179, 8, 0.15)', color: '#b45309', borderRadius: 4, fontWeight: 600 }} title="Alıcılar arasında şirket/kurum alan adınızın dışındaki harici adresler bulunmaktadır">
                      🌐 Harici Alıcı
                    </span>
                  ) : null}
                  <input
                    value={compose.to}
                    onFocus={() => setActiveRecipientField('to')}
                    onClick={() => setActiveRecipientField('to')}
                    onChange={(e) => handleRecipientChange('to', e.target.value)}
                    onBlur={() => handleRecipientBlur('to')}
                    onKeyDown={(e) => handleRecipientKeyDown('to', e)}
                    onPaste={(e) => handleRecipientPaste('to', e)}
                    placeholder="Çoklu alıcı seçmek için tıklayın veya adresleri boşluk, Enter, yapıştır ile girin…"
                    disabled={busy}
                  />
                </label>
                <button type="button" className="text-btn" onClick={() => setShowContacts((v) => !v)} disabled={busy}>
                  Kişi rehberi / Toplu seç ({settings.recent.length})
                </button>
                <button type="button" className="text-btn" onClick={() => setCompose({ ...compose, showExtra: !compose.showExtra })} disabled={busy}>Cc / Bcc</button>
              </div>
              <ComposeRecipientChips
                label="Kime Alıcıları"
                value={compose.to}
                onChange={(val) => setCompose({ ...compose, to: val })}
                disabled={busy}
              />
              {renderRecipientPickerDropdown('to')}
              {showContacts ? (() => {
                const q = contactSearch.trim().toLowerCase();
                const groupCounts = new Map<string, number>();
                const dynamicGroups = new Set<string>(['Müşteriler', 'Tedarikçiler', 'Muhasebe', 'Bayiler', 'VIP']);
                for (const c of settings.recent) {
                  if (c.group) {
                    dynamicGroups.add(c.group);
                    groupCounts.set(c.group, (groupCounts.get(c.group) || 0) + 1);
                  }
                }
                const allGroups = [...dynamicGroups];
                const pickedSet = new Set(pickedContacts);
                const filtered = settings.recent.filter((item) => {
                  if (contactGroupFilter !== 'all' && (item.group || '') !== contactGroupFilter) return false;
                  return !q || item.email.toLowerCase().includes(q) || (item.name || '').toLowerCase().includes(q) || (item.group || '').toLowerCase().includes(q);
                });
                const assignPickedToGroup = (groupName: string) => {
                  if (!pickedContacts.length) return;
                  const targetSet = new Set(pickedContacts.map((e) => e.toLowerCase()));
                  const cleanGroup = groupName.trim();
                  setSettings((cur) => {
                    const updated = cur.recent.map((item) => targetSet.has(item.email.toLowerCase()) ? { ...item, group: cleanGroup || undefined } : item);
                    const changedItems = updated.filter((item) => targetSet.has(item.email.toLowerCase()));
                    void props.saveSettings?.({ recent: changedItems }).catch(() => undefined);
                    return { ...cur, recent: updated };
                  });
                  showToast(cleanGroup ? `${pickedContacts.length} kişi "${cleanGroup}" grubuna atandı.` : `${pickedContacts.length} kişinin grup etiketi kaldırıldı.`);
                };
                const addPickedToField = (fieldName: 'to' | 'cc' | 'bcc') => {
                  if (!pickedContacts.length) return;
                  addMultipleRecipientsToField(pickedContacts, fieldName, false);
                  showToast(`${pickedContacts.length} adres ${fieldName.toUpperCase()} alanına eklendi.`);
                };
                const handlePasteBulk = () => {
                  const parts = extractRecipientTokens(bulkPasteInput)
                    .map((p) => (p.match(/<([^<>]+)>$/)?.[1] || p).trim())
                    .filter((e) => e.includes('@') && !/[\r\n<>]/.test(e));
                  if (!parts.length) return;
                  mergeContactsIntoState(parts.map((email) => ({ email, sent: true })));
                  void props.saveSettings?.({ recent: parts.map((email) => ({ email, name: '', sentCount: 1, receivedCount: 0, lastAt: Date.now() })) }).catch(() => undefined);
                  setPickedContacts((cur) => [...new Set([...cur, ...parts])]);
                  setBulkPasteInput('');
                  showToast(`${parts.length} adres rehbere eklendi ve seçildi.`);
                };
                return (
                  <div className="bulk-picker" aria-label="Ortak kişi rehberi ve toplu seçim">
                    <div className="bulk-picker-bar">
                      <strong>Ortak Kişi Rehberi &amp; Toplu Alıcı Seçimi (Sık gönderilenler en üstte · {pickedContacts.length} seçili)</strong>
                      <div className="bulk-picker-actions">
                        <button type="button" className="chip-btn" disabled={busy} onClick={() => setPickedContacts(filtered.slice(0, 16).map((c) => c.email))}>İlk 16 Adresi Seç</button>
                        <button type="button" className="chip-btn" disabled={busy} onClick={() => setPickedContacts(filtered.slice(0, 20).map((c) => c.email))}>İlk 20 Adresi Seç</button>
                        <button type="button" className="chip-btn" disabled={busy} onClick={() => setPickedContacts(filtered.slice(0, 50).map((c) => c.email))}>İlk 50 Adresi Seç</button>
                        <button type="button" className="chip-btn" disabled={busy} onClick={() => setPickedContacts(filtered.slice(0, 100).map((c) => c.email))}>İlk 100 Adresi Seç</button>
                        <button type="button" className="chip-btn" disabled={busy} onClick={() => setPickedContacts(filtered.slice(0, 500).map((c) => c.email))}>İlk 500 Adresi Seç</button>
                        <button type="button" className="chip-btn" disabled={busy} onClick={() => setPickedContacts(filtered.map((c) => c.email))}>Tümünü Seç ({filtered.length})</button>
                        <button type="button" className="chip-btn" disabled={busy} onClick={() => setPickedContacts([])}>Temizle</button>
                        <button type="button" className="chip-btn" disabled={busy} onClick={openContactsPage}>Ayrıntılı Kişilerim Sayfası</button>
                      </div>
                    </div>
                    <div className="contact-groups-bar">
                      <span className="quick-label">Grup filtresi:</span>
                      <button type="button" className={contactGroupFilter === 'all' ? 'chip-btn on' : 'chip-btn'} onClick={() => setContactGroupFilter('all')}>Tümü ({settings.recent.length})</button>
                      {allGroups.map((g) => {
                        const count = groupCounts.get(g) || 0;
                        return (
                          <button key={g} type="button" className={contactGroupFilter === g ? 'chip-btn on' : 'chip-btn'} onClick={() => setContactGroupFilter(g)}>
                            {g} ({count})
                          </button>
                        );
                      })}
                      {pickedContacts.length > 0 ? (
                        <span className="contact-group-assign">
                          <select aria-label="Gruba ata" value={assignGroupName} onChange={(e) => setAssignGroupName(e.target.value)}>
                            {allGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                          <button type="button" className="chip-btn" onClick={() => assignPickedToGroup(assignGroupName)}>Seçilenleri Gruba Ata</button>
                          <button type="button" className="chip-btn" onClick={() => assignPickedToGroup('')}>Grubu Kaldır</button>
                        </span>
                      ) : null}
                    </div>
                    <div className="bulk-picker-inputs">
                      <input
                        type="search"
                        placeholder="Rehberde e-posta veya isim ara…"
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                      />
                      <div className="bulk-paste-row">
                        <input
                          placeholder="Toplu e-posta yapıştır (16, 20, 50+ adres; virgül veya boşlukla)…"
                          value={bulkPasteInput}
                          onChange={(e) => setBulkPasteInput(e.target.value)}
                        />
                        <button type="button" className="chip-btn" onClick={handlePasteBulk} disabled={busy || !bulkPasteInput.trim()}>Rehbere ekle &amp; seç</button>
                      </div>
                    </div>
                    <div className="bulk-picker-grid">
                      {filtered.slice(0, 500).map((item) => (
                        <label key={item.email} className="choice bulk-choice">
                          <input
                            type="checkbox"
                            checked={pickedSet.has(item.email)}
                            disabled={busy}
                            onChange={() => setPickedContacts((cur) => pickedSet.has(item.email) ? cur.filter((e) => e !== item.email) : [...cur, item.email])}
                          />
                          <span>
                            <strong>{item.name || item.email}</strong>
                            {item.name ? <small> {item.email}</small> : null}
                            {item.group ? <em className="group-badge">{item.group}</em> : null}
                            {item.sentCount ? <em className="freq-badge">Sık gönderilen ×{item.sentCount}</em> : null}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="bulk-picker-footer">
                      <button type="button" className="primary slim" disabled={busy || !pickedContacts.length} onClick={() => addPickedToField('to')}>
                        Seçilenleri Kime Ekle ({pickedContacts.length})
                      </button>
                      <button type="button" className="cmd" disabled={busy || !pickedContacts.length} onClick={() => addPickedToField('bcc')}>
                        Seçilenleri Bcc (Gizli Toplu) Ekle ({pickedContacts.length})
                      </button>
                      <button type="button" className="cmd" disabled={busy || !pickedContacts.length} onClick={() => addPickedToField('cc')}>
                        Seçilenleri Cc Ekle ({pickedContacts.length})
                      </button>
                    </div>
                  </div>
                );
              })() : null}
              {settings.templates.length ? (
                <label className="field">Şablon
                  <select defaultValue="" disabled={busy} onChange={(e) => { if (e.target.value) insertTemplate(e.target.value); e.target.value = ''; }}>
                    <option value="">Şablon ekle…</option>
                    {settings.templates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </label>
              ) : null}
              {compose.showExtra ? (
                <>
                  <label className="field">Cc
                    <input
                      value={compose.cc}
                      onFocus={() => setActiveRecipientField('cc')}
                      onClick={() => setActiveRecipientField('cc')}
                      onChange={(e) => handleRecipientChange('cc', e.target.value)}
                      onBlur={() => handleRecipientBlur('cc')}
                      onKeyDown={(e) => handleRecipientKeyDown('cc', e)}
                      onPaste={(e) => handleRecipientPaste('cc', e)}
                      placeholder="Çoklu Cc alıcısı seçmek için tıklayın veya adresleri girin…"
                      disabled={busy}
                    />
                  </label>
                  <ComposeRecipientChips
                    label="Cc Alıcıları"
                    value={compose.cc}
                    onChange={(val) => setCompose({ ...compose, cc: val })}
                    disabled={busy}
                  />
                  {renderRecipientPickerDropdown('cc')}
                  <label className="field">Bcc
                    <input
                      value={compose.bcc}
                      onFocus={() => setActiveRecipientField('bcc')}
                      onClick={() => setActiveRecipientField('bcc')}
                      onChange={(e) => handleRecipientChange('bcc', e.target.value)}
                      onBlur={() => handleRecipientBlur('bcc')}
                      onKeyDown={(e) => handleRecipientKeyDown('bcc', e)}
                      onPaste={(e) => handleRecipientPaste('bcc', e)}
                      placeholder="Çoklu Bcc alıcısı seçmek için tıklayın veya adresleri girin…"
                      disabled={busy}
                    />
                  </label>
                  <ComposeRecipientChips
                    label="Bcc Alıcıları"
                    value={compose.bcc}
                    onChange={(val) => setCompose({ ...compose, bcc: val })}
                    disabled={busy}
                  />
                  {renderRecipientPickerDropdown('bcc')}
                </>
              ) : null}
              {settings.recent.length > 0 ? (() => {
                const toSelectedKeys = new Set(extractRecipientTokens(compose.to).filter((t) => t.includes('@')).map((t) => emailKey(t)));
                return (
                  <div className="quick-bar" aria-label="Sık kullanılan alıcılar">
                    <span className="quick-label">Hızlı alıcı:</span>
                    {settings.recent.slice(0, 10).map((item) => {
                      const isAdded = toSelectedKeys.has(emailKey(item.email));
                      return (
                        <button
                          key={item.email}
                          type="button"
                          className={isAdded ? 'chip-btn on' : 'chip-btn'}
                          disabled={busy}
                          onClick={() => appendRecipient(item.email)}
                          title={isAdded ? `${item.email} adresini Kime alanından çıkar` : `${item.email} adresini Kime alanına ekle`}
                        >
                          {isAdded ? '✓ ' : '+ '}{item.name ? `${item.name} (${item.email})` : item.email}
                        </button>
                      );
                    })}
                  </div>
                );
              })() : null}
              <label className="field">Konu<input value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} disabled={busy} placeholder="Konu (isteğe bağlı)" /></label>
              {compose.attachments.length > 0 ? (
                <ul className="files">
                  {compose.attachments.map((file) => (
                    <li key={file.id || `${file.source?.uid || ''}-${file.source?.index ?? file.filename}`} className="file-card">
                      <span className="file-kind">{fileKind(file.contentType, file.filename)}</span>
                      <span className="file-copy">
                        <strong>{file.filename}</strong>
                        <small>{fileKind(file.contentType, file.filename)} · {fileSize(file.size)}</small>
                      </span>
                      <button type="button" className="text-btn" disabled={busy} onClick={() => {
                        if (file.id) { void onRemoveFile(file.id); return; }
                        setCompose((current) => current ? { ...current, attachments: current.attachments.filter((item) => item !== file) } : current);
                      }}>Kaldır</button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="quick-bar quick-phrases" aria-label="Hazır cümle kalıpları">
                <span className="quick-label">Hızlı metin:</span>
                <button type="button" className="chip-btn" disabled={busy} onClick={() => insertQuickPhrase('Bilgilerinize sunarım. İyi çalışmalar.')}>+ Bilgilerinize</button>
                <button type="button" className="chip-btn" disabled={busy} onClick={() => insertQuickPhrase('Teşekkür ederim, iyi çalışmalar dilerim.')}>+ Teşekkürler</button>
                <button type="button" className="chip-btn" disabled={busy} onClick={() => insertQuickPhrase('İlgili dosya ekte bilgilerinize sunulmuştur.')}>+ Dosya ektedir</button>
                <button type="button" className="chip-btn" disabled={busy} onClick={() => insertQuickPhrase('Tarafımızca incelenmiş ve onaylanmıştır. Teşekkür ederiz.')}>+ Onaylandı</button>
                <button type="button" className="chip-btn" disabled={busy} onClick={() => insertQuickPhrase('Konuyla ilgili uygun olduğunuzda dönüşünüzü rica ederim.')}>+ Dönüş ricası</button>
              </div>
              <label className="body-field">İleti
                <RichEditor
                  value={compose.body}
                  onChange={(html) => setCompose({ ...compose, body: html })}
                  disabled={busy}
                  label="İleti"
                />
              </label>
            </form>
          ) : null}
        </section>
        {(panel === 'list' || panel === 'home') && account && account.enabled !== false ? (
          <button
            type="button"
            className="mobile-fab"
            data-label="Yaz"
            aria-label="Yeni ileti yaz"
            onClick={startCompose}
            disabled={busy}
          >
            <Icon name="compose" size={20} />
          </button>
        ) : null}
      </div>
      <nav className="mobile-dock" aria-label="Mobil alt menü">
        <button type="button" className={panel === 'accounts' ? 'cmd on' : 'cmd'} onClick={() => setPanel('accounts')}>
          <Icon name="menu" size={18} /><span>Klasörler</span>
        </button>
        {props.loadPreview && accounts.length > 1 ? (
          <button type="button" className={home && panel === 'home' ? 'cmd on' : 'cmd'} onClick={goHome} disabled={busy}>
            <span className="dock-icon-wrap">
              <Icon name="inbox" size={18} />
              {homeUnseen ? <em className={homeFresh ? 'avatar-count fresh' : 'avatar-count'} data-count={String(homeUnseen)} aria-hidden="true" /> : null}
            </span>
            <span>Tümü</span>
          </button>
        ) : null}
        <button
          type="button"
          className={!home && panel === 'list' ? 'cmd on' : 'cmd'}
          onClick={() => {
            if (operation.current) return;
            if (compose && !confirmLeave()) return;
            setCompose(null);
            setShowSettings(false);
    setShowContactsPage(false);
            setShowAdd(false);
            setHome(false);
            setPanel('list');
          }}
          disabled={busy || !account}
        >
          <span className="dock-icon-wrap">
            <Icon name="mail" size={18} />
            {unseen ? <em className="avatar-count" data-count={String(unseen)} aria-hidden="true" /> : null}
          </span>
          <span>Liste</span>
        </button>
        <button type="button" className={compose ? 'cmd dock-compose on' : 'cmd dock-compose'} onClick={startCompose} disabled={!account || account.enabled === false || busy}>
          <Icon name="compose" size={18} /><span>Yeni</span>
        </button>
        <button type="button" className={showContactsPage && panel === 'read' ? 'cmd on' : 'cmd'} onClick={openContactsPage} disabled={busy}>
          <Icon name="mail" size={18} /><span>Kişiler</span>
        </button>
        <button type="button" className={showSettings && panel === 'read' ? 'cmd on' : 'cmd'} onClick={openSettings} disabled={busy}>
          <Icon name="check" size={18} /><span>Ayarlar</span>
        </button>
      </nav>
      {notice ? (
        <div className="toast-host" role="status" aria-live="polite">
          <div className="toast">
            <span>{notice}</span>
            {undo ? <button type="button" className="text-btn" onClick={() => { void undoLast(); }} disabled={busy}>Geri al</button> : null}
            <button type="button" className="icon-btn" aria-label="Kapat" onClick={() => { setNotice(''); setUndo(null); }}><Icon name="close" size={14} /></button>
          </div>
        </div>
      ) : null}
      {previewModal ? (
        <div className="help-overlay preview-overlay" role="dialog" aria-labelledby="preview-title" onClick={closePreviewModal}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-head">
              <strong id="preview-title">{previewModal.filename}</strong>
              <div className="preview-actions">
                {account && message ? (
                  <button
                    type="button"
                    className="primary slim"
                    onClick={() => {
                      showToast(`${previewModal.filename} indiriliyor...`);
                      void props.downloadFile(account.id, folder, message.uid, previewModal.index, previewModal.filename)
                        .catch((err: Error) => showToast(err.message));
                    }}
                  >
                    İndir
                  </button>
                ) : null}
                <button type="button" className="text-btn" onClick={closePreviewModal}>Kapat</button>
              </div>
            </div>
            <div className="preview-body">
              {previewModal.text !== undefined ? (
                <pre className="preview-text">{previewModal.text}</pre>
              ) : /^image\//i.test(previewModal.contentType) || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(previewModal.filename) ? (
                <img src={previewModal.url} alt={previewModal.filename} className="preview-image" />
              ) : (
                <iframe src={previewModal.url} title={previewModal.filename} className="preview-frame" />
              )}
            </div>
          </div>
        </div>
      ) : null}
      {showHelp ? (
        <div className="help-overlay" role="dialog" aria-labelledby="help-title">
          <div className="help-card">
            <h2 id="help-title">Klavye kısayolları</h2>
            <dl className="help-list">
              <div><dt><kbd>C</kbd></dt><dd>Yeni ileti</dd></div>
              <div><dt><kbd>R</kbd></dt><dd>Yanıtla</dd></div>
              <div><dt><kbd>F</kbd></dt><dd>İlet</dd></div>
              <div><dt><kbd>E</kbd></dt><dd>Arşivle</dd></div>
              <div><dt><kbd>Del</kbd></dt><dd>Sil</dd></div>
              <div><dt><kbd>Shift</kbd>+<kbd>I</kbd></dt><dd>Okundu yap</dd></div>
              <div><dt><kbd>Shift</kbd>+<kbd>U</kbd></dt><dd>Okunmadı yap</dd></div>
              <div><dt><kbd>J</kbd> / <kbd>K</kbd></dt><dd>Sonraki / önceki ileti</dd></div>
              <div><dt><kbd>/</kbd></dt><dd>Aramaya git</dd></div>
              <div><dt><kbd>Esc</kbd></dt><dd>Detaydan çık</dd></div>
              <div><dt><kbd>Ctrl</kbd>+<kbd>Enter</kbd></dt><dd>Gönder</dd></div>
            </dl>
            <button type="button" className="primary slim" onClick={() => setShowHelp(false)}>Anladım</button>
          </div>
        </div>
      ) : null}
      {showQuotaModal && quota ? (
        <div className="help-overlay" role="dialog" aria-labelledby="quota-modal-title" onClick={() => !archiving && setShowQuotaModal(false)}>
          <div className="help-card quota-modal" onClick={(e) => e.stopPropagation()}>
            <div className="quota-modal-head">
              <h2 id="quota-modal-title">Kotayı Rahatlat · Firebase Arşiv</h2>
              <button type="button" className="icon-btn" onClick={() => setShowQuotaModal(false)} disabled={archiving} aria-label="Kapat">
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="quota-bar-container">
              <div className="quota-bar-head">
                <span>Natro Sunucu Doluluk Oranı</span>
                <strong>%{quota.percent} ({fileSize(quota.usageBytes)} / {fileSize(quota.limitBytes)})</strong>
              </div>
              <div className="quota-bar-track">
                <div
                  className={`quota-bar-fill ${quota.percent >= 85 ? 'danger' : quota.percent >= 70 ? 'warn' : ''}`}
                  style={{ width: `${Math.min(100, quota.percent)}%` }}
                />
              </div>
            </div>

            <div className="quota-safety-badge">
              <Icon name="check" size={16} />
              <div>
                <strong>Sıfır Veri Kaybı Güvencesi:</strong>
                <p>Mailleriniz önce tüm ekleri ve orijinalleriyle Firebase Cloud Storage ve Firestore veritabanına bayt bayt eksiksiz kopyalanır ve doğrulanır; yalnızca onay alındığında sunucudan temizlenir. Arşivlenen tüm maillerinize sol menüdeki <em>"Arşiv"</em> klasöründen her zaman erişebilirsiniz.</p>
              </div>
            </div>

            <div className="quota-options" role="radiogroup" aria-label="Arşivleme seçeneği">
              <label className="quota-opt">
                <input type="radio" name="arcMode" checked={archiveMode === 'days'} onChange={() => setArchiveMode('days')} disabled={archiving} />
                <div>
                  <strong>30 günden eski mailleri Firebase'e aktar</strong>
                  <small>Son 1 ay sunucuda kalır, eskiler güvenle Firebase arşivine taşınır.</small>
                </div>
              </label>
              <label className="quota-opt">
                <input type="radio" name="arcMode" checked={archiveMode === 'size'} onChange={() => setArchiveMode('size')} disabled={archiving} />
                <div>
                  <strong>2 MB'tan büyük ekli mailleri Firebase'e aktar</strong>
                  <small>Kotayı en çok tüketen PDF ve büyük dosyaları sunucudan temizler.</small>
                </div>
              </label>
              <label className="quota-opt">
                <input type="radio" name="arcMode" checked={archiveMode === 'count'} onChange={() => setArchiveMode('count')} disabled={archiving} />
                <div>
                  <strong>En eski 50 maili Firebase'e aktar</strong>
                  <small>İlk 50 iletiyi Firebase kalıcı arşivine taşır.</small>
                </div>
              </label>
            </div>

            {archiveError ? <p className="alert" role="alert">{archiveError}</p> : null}

            {archiveResult ? (
              <div className="quota-result success">
                <Icon name="check" size={16} />
                <span>{archiveResult.archivedCount} ileti Firebase'e güvenle aktarıldı, {fileSize(archiveResult.freedBytes)} yer açıldı.</span>
              </div>
            ) : null}

            <div className="quota-modal-actions">
              <button type="button" className="text-btn" onClick={() => setShowQuotaModal(false)} disabled={archiving}>Vazgeç</button>
              <button type="button" className="primary" onClick={handleRunArchive} disabled={archiving}>
                {archiving ? 'Firebase\'e Aktarılıyor...' : 'Firebase\'e Aktar ve Kotayı Rahatlat'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Undo Send Floating Banner */}
      <UndoSendBanner item={undoSendItem} />

      {/* Canned Templates Modal */}
      {showTemplateModal ? (
        <Suspense fallback={null}>
          <TemplateSelectorModal
            open={showTemplateModal}
            templates={settings.templates || []}
            currentText={compose?.body}
            onSelect={(bodyText: string) => {
              if (compose) {
                setCompose((cur) => cur ? { ...cur, body: cur.body ? `${cur.body}<br/><br/>${textToHtml(bodyText)}` : textToHtml(bodyText) } : cur);
              }
              setShowTemplateModal(false);
            }}
            onSaveTemplate={async (title: string, bodyText: string) => {
              const newTpl = { id: crypto.randomUUID(), title, body: bodyText };
              const updated = [...(settings.templates || []), newTpl];
              setSettings((cur) => ({ ...cur, templates: updated }));
              await persistSettings({ templates: updated });
              showToast(`"${title}" şablon olarak kaydedildi.`);
            }}
            onDeleteTemplate={async (tplId: string) => {
              const updated = (settings.templates || []).filter((t) => t.id !== tplId);
              setSettings((cur) => ({ ...cur, templates: updated }));
              await persistSettings({ templates: updated });
              showToast('Şablon silindi.');
            }}
            onClose={() => setShowTemplateModal(false)}
          />
        </Suspense>
      ) : null}

      {/* Custom IMAP Folder Modal */}
      {showNewFolderModal ? (
        <Suspense fallback={null}>
          <NewFolderModal
            open={showNewFolderModal}
            busy={busy}
            onCreate={async (name: string) => {
              await handleCreateCustomFolder(name);
            }}
            onClose={() => setShowNewFolderModal(false)}
          />
        </Suspense>
      ) : null}

      {/* Scheduled Emails Modal */}
      {showScheduledModal ? (
        <Suspense fallback={null}>
          <ScheduledEmailsModal
            open={showScheduledModal}
            scheduled={scheduledEmails}
            accounts={accounts}
            serverBacked={Boolean(props.scheduleMail)}
            onSendNow={async (item: ScheduledEmail) => {
              await handleSendScheduledNow(item.id);
            }}
            onEdit={(item: ScheduledEmail) => {
              if (item.accountId && item.accountId !== accountId) {
                setAccountId(item.accountId);
              }
              setCompose({
                draftId: crypto.randomUUID(),
                mode: item.payload.mode,
                uid: item.payload.uid,
                replyFolder: item.payload.folder,
                to: item.payload.to,
                cc: item.payload.cc || '',
                bcc: item.payload.bcc || '',
                subject: item.payload.subject || '',
                body: item.payload.htmlBody || item.payload.body || '',
                showExtra: Boolean(item.payload.cc || item.payload.bcc),
                attachments: item.payload.attachments || [],
              });
              handleCancelScheduled(item.id);
              setShowScheduledModal(false);
              setPanel('read');
            }}
            onCancel={handleCancelScheduled}
            onClose={() => setShowScheduledModal(false)}
          />
        </Suspense>
      ) : null}

      {/* Add Account Modal Dialog */}
      {showAdd && canAdd ? (
        <div
          className="modal-backdrop add-account-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-account-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && accounts.length > 0 && !busy) {
              setShowAdd(false);
            }
          }}
        >
          <div className="modal-dialog add-account-modal" onClick={(e) => e.stopPropagation()}>
            <form className="compose add-form card" onSubmit={onAddAccount}>
              <div className="add-account-header">
                <h2 id="add-account-title">Posta hesabı ekle</h2>
                {accounts.length > 0 ? (
                  <button
                    type="button"
                    className="close-modal-btn"
                    onClick={() => setShowAdd(false)}
                    disabled={busy}
                    aria-label="Kapat"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
              <p className="meta">Kurumsal, Natro veya Gmail e-posta adresinizi ve şifresini girin. Şifre sunucuda şifrelenerek saklanır, tarayıcıda tutulmaz.</p>
              {props.connectGoogleAccount ? (
                <div className="oauth-box">
                  <button type="button" className="google-oauth-btn" onClick={onConnectGoogle} disabled={busy}>
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
                    </svg>
                    <span>{busy ? 'Google bekleniyor…' : 'Google ile Gmail Bağla (Tek Tıkla OAuth)'}</span>
                  </button>
                  <div className="oauth-divider"><span>veya e-posta ve şifre ile ekle</span></div>
                </div>
              ) : null}
              <label>Görünen ad<input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Satış, Destek…" disabled={busy} /></label>
              <label>E-posta<input type="email" autoComplete="off" value={addEmail} onChange={(e) => { const val = e.target.value; setAddEmail(val); const lower = val.trim().toLowerCase(); if (lower.endsWith('@gmail.com') || lower.endsWith('@googlemail.com')) setAddPreset('gmail'); else if (lower.endsWith('@kurumsaleposta.com')) setAddPreset('kurumsal'); }} required disabled={busy} /></label>
              <label>Posta şifresi<input type="password" autoComplete="new-password" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} required minLength={4} disabled={busy} /></label>
              <fieldset className="preset">
                <legend>Sunucu</legend>
                <label className="choice"><input type="radio" name="preset" checked={addPreset === 'domain'} onChange={() => setAddPreset('domain')} disabled={busy} /> Alan Adı Mail Sunucusu (mail.alanadiniz.com)</label>
                <label className="choice"><input type="radio" name="preset" checked={addPreset === 'kurumsal'} onChange={() => setAddPreset('kurumsal')} disabled={busy} /> Kurumsal E-Posta / Natro (mail.kurumsaleposta.com)</label>
                <label className="choice"><input type="radio" name="preset" checked={addPreset === 'yandex'} onChange={() => setAddPreset('yandex')} disabled={busy} /> Yandex 360 Kurumsal (imap.yandex.com)</label>
                <label className="choice"><input type="radio" name="preset" checked={addPreset === 'gmail'} onChange={() => setAddPreset('gmail')} disabled={busy} /> Gmail / Google Workspace (imap.gmail.com)</label>
                <label className="choice"><input type="radio" name="preset" checked={addPreset === 'custom'} onChange={() => setAddPreset('custom')} disabled={busy} /> Özel IMAP / SMTP Sunucu Bilgisi Gir</label>
              </fieldset>
              {addPreset === 'custom' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8 }}>
                  <label>IMAP Sunucusu<input value={customImapHost} onChange={(e) => setCustomImapHost(e.target.value)} placeholder="mail.kuzeydeniziyapi.com.tr" required disabled={busy} /></label>
                  <label>IMAP Port<input value={customImapPort} onChange={(e) => setCustomImapPort(e.target.value)} placeholder="993" required disabled={busy} /></label>
                  <label>SMTP Sunucusu<input value={customSmtpHost} onChange={(e) => setCustomSmtpHost(e.target.value)} placeholder="mail.kuzeydeniziyapi.com.tr" required disabled={busy} /></label>
                  <label>SMTP Port<input value={customSmtpPort} onChange={(e) => setCustomSmtpPort(e.target.value)} placeholder="465" required disabled={busy} /></label>
                </div>
              ) : null}
              {(addPreset === 'gmail' || /@(gmail|googlemail)\.com$/i.test(addEmail.trim())) ? (
                <p className="note"><strong>Gmail İpucu:</strong> Normal Google şifreniz yerine 16 haneli <strong>Uygulama Şifresi</strong> girmeniz gerekir (Google Hesabı → Güvenlik → 2 Adımlı Doğrulama → Uygulama Şifreleri). Boşluklu yapıştırabilirsiniz, otomatik temizlenir.</p>
              ) : null}
              {addError ? <p className="alert" role="alert">{addError}</p> : null}
              <div className="actions">
                <button className="primary" type="submit" disabled={busy}>{busy ? 'Ekleniyor…' : 'Hesabı kaydet'}</button>
                {accounts.length > 0 ? <button type="button" className="text-btn" onClick={() => setShowAdd(false)} disabled={busy}>Vazgeç</button> : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
