import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, SUPER_ADMIN_EMAILS } from '../core/firebase';
import {
  DEFAULT_SETTINGS,
  SEED_ACCOUNTING,
  SEED_CONTACT_MESSAGES,
  SEED_MAIL_ACCOUNTS,
  SEED_MAIL_LOGS,
  SEED_MAIL_MESSAGES,
  SEED_PROJECTS,
} from '../data/seedData';
import {
  AccountingEntry,
  ContactMessage,
  DashboardSettings,
  MailAccount,
  MailCheckLog,
  MailMessage,
  ProjectItem,
} from '../types';

const STORAGE_KEYS = {
  PROJECTS: 'cb_projects_v2',
  MESSAGES: 'cb_contact_messages_v2',
  ACCOUNTING: 'cb_accounting_v2',
  MAIL_ACCOUNTS: 'cb_mail_accounts_v2',
  MAIL_MESSAGES: 'cb_mail_messages_v2',
  MAIL_LOGS: 'cb_mail_logs_v2',
  SETTINGS: 'cb_dashboard_settings_v2',
} as const;

let activeDataScope = 'preview';

export function setDataServiceLocalScope(scope?: string | null): void {
  const clean = String(scope || 'preview')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '_');
  activeDataScope = clean || 'preview';
}

function resolveKey(baseKey: string): string {
  if (baseKey === STORAGE_KEYS.PROJECTS) return baseKey;
  return `${baseKey}_${activeDataScope}`;
}

const SYNC_CHANNEL_NAME = 'kuzeydenizi_realtime_sync';
const LOCAL_EVENT_NAME = 'kuzeydenizi:local-sync';

function notifyLocalChange(topic: string) {
  try {
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT_NAME, { detail: { topic } }));
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
      bc.postMessage({ topic, at: Date.now() });
      bc.close();
    }
  } catch {
    // Ignore BroadcastChannel unavailability
  }
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const resolved = resolveKey(key);
    const raw = localStorage.getItem(resolved);
    if (!raw) {
      localStorage.setItem(resolved, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, data: T, topic: string): void {
  try {
    localStorage.setItem(resolveKey(key), JSON.stringify(data));
    notifyLocalChange(topic);
  } catch {
    // Ignore quota errors
  }
}

export function subscribeLocalTopic(topic: string, handler: () => void): () => void {
  const onWin = (e: Event) => {
    const ce = e as CustomEvent<{ topic?: string }>;
    if (!ce.detail?.topic || ce.detail.topic === topic || ce.detail.topic === 'all') {
      handler();
    }
  };
  const onStorage = () => handler();

  window.addEventListener(LOCAL_EVENT_NAME, onWin);
  window.addEventListener('storage', onStorage);

  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
    bc.onmessage = (ev) => {
      if (!ev.data?.topic || ev.data.topic === topic || ev.data.topic === 'all') {
        handler();
      }
    };
  }

  return () => {
    window.removeEventListener(LOCAL_EVENT_NAME, onWin);
    window.removeEventListener('storage', onStorage);
    bc?.close();
  };
}

// ---------- PUBLIC & CONTACT OPERATIONS ----------

export function getLocalProjects(): ProjectItem[] {
  return readLocal<ProjectItem[]>(STORAGE_KEYS.PROJECTS, SEED_PROJECTS);
}

export function subscribePublicProjects(onData: (projects: ProjectItem[]) => void): Unsubscribe {
  // Always emit local/seed immediately so public UI renders without delay
  onData(getLocalProjects().filter((p) => p.publishedOnSite));

  let unsubFirestore: Unsubscribe | null = null;
  try {
    const q = query(collection(db, 'projects'), where('publishedOnSite', '==', true));
    unsubFirestore = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const items = snap.docs.map((d) => ({ ...(d.data() as ProjectItem), id: d.id }));
          items.sort((a, b) =>
            String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
          );
          onData(items.filter((p) => p.publishedOnSite));
        }
      },
      () => {
        // Fallback silently to local/seed data if Firestore is unreachable or uninitialized
      }
    );
  } catch {
    // Fallback to local data
  }

  const unsubLocal = subscribeLocalTopic('projects', () => {
    onData(getLocalProjects().filter((p) => p.publishedOnSite));
  });

  return () => {
    unsubFirestore?.();
    unsubLocal();
  };
}

export interface SubmitContactPayload {
  name: string;
  company: string;
  phone: string;
  email: string;
  service: string;
  serviceLabel: string;
  message: string;
  sourcePage: 'Ana Sayfa' | 'İletişim Sayfası';
}

export async function submitContactMessage(
  payload: SubmitContactPayload
): Promise<{ id: string; cloudSaved: boolean }> {
  const now = new Date().toISOString();
  const docId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const record: ContactMessage = {
    id: docId,
    name: payload.name.trim(),
    company: payload.company.trim(),
    phone: payload.phone.trim(),
    email: payload.email.trim(),
    service: payload.service,
    serviceLabel: payload.serviceLabel,
    message: payload.message.trim(),
    sourcePage: payload.sourcePage,
    status: 'yeni',
    adminNotes: '',
    createdAt: now,
  };

  // 1. Store into localStorage only when offline/preview so public browser history never leaks CRM data across sessions
  if (activeDataScope === 'preview') {
    const existing = readLocal<ContactMessage[]>(STORAGE_KEYS.MESSAGES, SEED_CONTACT_MESSAGES);
    writeLocal(STORAGE_KEYS.MESSAGES, [record, ...existing], 'messages');
  }

  // 2. Write to Cloud Firestore kuzeydenizi-db so authorized admin sessions see it live
  let cloudSaved = false;
  try {
    await setDoc(doc(db, 'contact_messages', docId), record);
    cloudSaved = true;
  } catch (err) {
    console.warn('[kuzeydenizi] Firestore contact write warning:', err);
  }

  // 3. Optional notification webhook if configured
  const settings = readLocal<DashboardSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  if (settings.mailWebhookUrl) {
    try {
      await fetch(settings.mailWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
    } catch {
      // Non-blocking webhook notification
    }
  }

  return { id: docId, cloudSaved };
}

// ---------- DASHBOARD CLOUD + LOCAL SYNC HELPERS ----------

export async function ensureCloudSeeded(): Promise<boolean> {
  try {
    const snap = await getDocs(collection(db, 'projects'));
    if (!snap.empty) return false;

    const batch = writeBatch(db);
    SEED_PROJECTS.forEach((p) => batch.set(doc(db, 'projects', p.id), p));
    SEED_ACCOUNTING.forEach((a) => batch.set(doc(db, 'accounting_entries', a.id), a));
    SEED_CONTACT_MESSAGES.forEach((m) => batch.set(doc(db, 'contact_messages', m.id), m));
    batch.set(doc(db, 'dashboard_settings', 'general'), DEFAULT_SETTINGS);
    await batch.commit();
    return true;
  } catch (err) {
    console.warn('[kuzeydenizi] Cloud seed skipped:', err);
    return false;
  }
}

export function getUnreadCountLocal(): number {
  const msgs = readLocal<ContactMessage[]>(STORAGE_KEYS.MESSAGES, SEED_CONTACT_MESSAGES);
  return msgs.filter((m) => m.status === 'yeni').length;
}

export function subscribeCollectionData<T extends { id: string }>(
  collectionName:
    | 'projects'
    | 'contact_messages'
    | 'accounting_entries'
    | 'mail_messages'
    | 'mail_accounts'
    | 'mail_check_logs',
  cloudMode: boolean,
  onData: (items: T[]) => void
): Unsubscribe {
  const storageMap = {
    projects: { key: STORAGE_KEYS.PROJECTS, seed: SEED_PROJECTS, topic: 'projects' },
    contact_messages: { key: STORAGE_KEYS.MESSAGES, seed: SEED_CONTACT_MESSAGES, topic: 'messages' },
    accounting_entries: { key: STORAGE_KEYS.ACCOUNTING, seed: SEED_ACCOUNTING, topic: 'accounting' },
    mail_messages: { key: STORAGE_KEYS.MAIL_MESSAGES, seed: SEED_MAIL_MESSAGES, topic: 'mail_messages' },
    mail_accounts: { key: STORAGE_KEYS.MAIL_ACCOUNTS, seed: SEED_MAIL_ACCOUNTS, topic: 'mail_accounts' },
    mail_check_logs: { key: STORAGE_KEYS.MAIL_LOGS, seed: SEED_MAIL_LOGS, topic: 'mail_logs' },
  }[collectionName];

  if (!cloudMode) {
    onData(readLocal<T[]>(storageMap.key, storageMap.seed as unknown as T[]));
    return subscribeLocalTopic(storageMap.topic, () => {
      onData(readLocal<T[]>(storageMap.key, storageMap.seed as unknown as T[]));
    });
  }

  let unsub: Unsubscribe = () => {};
  try {
    const q = query(collection(db, collectionName));
    unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
        list.sort((a: any, b: any) =>
          String(b.createdAt || b.checkedAt || b.date || '').localeCompare(
            String(a.createdAt || a.checkedAt || a.date || '')
          )
        );
        onData(list);
      },
      (err) => {
        if ((err as any)?.code === 'permission-denied') {
          onData([]);
          return;
        }
        console.warn(`[kuzeydenizi] ${collectionName} snapshot error:`, err);
        onData([]);
      }
    );
  } catch {
    onData([]);
  }
  return unsub;
}

export async function saveEntity<T extends { id: string }>(
  collectionName:
    | 'projects'
    | 'contact_messages'
    | 'accounting_entries'
    | 'mail_messages'
    | 'mail_accounts'
    | 'mail_check_logs',
  item: T,
  cloudMode: boolean
): Promise<void> {
  const storageMap = {
    projects: { key: STORAGE_KEYS.PROJECTS, seed: SEED_PROJECTS, topic: 'projects' },
    contact_messages: { key: STORAGE_KEYS.MESSAGES, seed: SEED_CONTACT_MESSAGES, topic: 'messages' },
    accounting_entries: { key: STORAGE_KEYS.ACCOUNTING, seed: SEED_ACCOUNTING, topic: 'accounting' },
    mail_messages: { key: STORAGE_KEYS.MAIL_MESSAGES, seed: SEED_MAIL_MESSAGES, topic: 'mail_messages' },
    mail_accounts: { key: STORAGE_KEYS.MAIL_ACCOUNTS, seed: SEED_MAIL_ACCOUNTS, topic: 'mail_accounts' },
    mail_check_logs: { key: STORAGE_KEYS.MAIL_LOGS, seed: SEED_MAIL_LOGS, topic: 'mail_logs' },
  }[collectionName];

  const list = readLocal<T[]>(storageMap.key, storageMap.seed as unknown as T[]);
  const idx = list.findIndex((x) => x.id === item.id);
  const next = idx >= 0 ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
  writeLocal(storageMap.key, next, storageMap.topic);

  if (cloudMode) {
    await setDoc(doc(db, collectionName, item.id), item, { merge: true });
  }
}

export async function removeEntity(
  collectionName:
    | 'projects'
    | 'contact_messages'
    | 'accounting_entries'
    | 'mail_messages'
    | 'mail_accounts'
    | 'mail_check_logs',
  id: string,
  cloudMode: boolean
): Promise<void> {
  const storageMap = {
    projects: { key: STORAGE_KEYS.PROJECTS, seed: SEED_PROJECTS, topic: 'projects' },
    contact_messages: { key: STORAGE_KEYS.MESSAGES, seed: SEED_CONTACT_MESSAGES, topic: 'messages' },
    accounting_entries: { key: STORAGE_KEYS.ACCOUNTING, seed: SEED_ACCOUNTING, topic: 'accounting' },
    mail_messages: { key: STORAGE_KEYS.MAIL_MESSAGES, seed: SEED_MAIL_MESSAGES, topic: 'mail_messages' },
    mail_accounts: { key: STORAGE_KEYS.MAIL_ACCOUNTS, seed: SEED_MAIL_ACCOUNTS, topic: 'mail_accounts' },
    mail_check_logs: { key: STORAGE_KEYS.MAIL_LOGS, seed: SEED_MAIL_LOGS, topic: 'mail_logs' },
  }[collectionName];

  const list = readLocal<{ id: string }[]>(storageMap.key, storageMap.seed);
  writeLocal(
    storageMap.key,
    list.filter((x) => x.id !== id),
    storageMap.topic
  );

  if (cloudMode) {
    await deleteDoc(doc(db, collectionName, id));
  }
}

export async function loadSettings(cloudMode: boolean): Promise<DashboardSettings> {
  const local = readLocal<DashboardSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  if (!cloudMode) return local;
  try {
    const snap = await getDocs(collection(db, 'dashboard_settings'));
    const found = snap.docs.find((d) => d.id === 'general');
    return found ? ({ ...DEFAULT_SETTINGS, ...found.data() } as DashboardSettings) : local;
  } catch {
    return local;
  }
}

export async function saveSettings(
  settings: DashboardSettings,
  cloudMode: boolean
): Promise<void> {
  writeLocal(STORAGE_KEYS.SETTINGS, settings, 'settings');
  if (cloudMode) {
    await setDoc(doc(db, 'dashboard_settings', 'general'), settings, { merge: true });
  }
}

export async function fetchAuthorizedAdmins(cloudMode: boolean): Promise<string[]> {
  if (!cloudMode) return [...SUPER_ADMIN_EMAILS];
  try {
    const snap = await getDocs(collection(db, 'authorized_admins'));
    const emails = snap.docs.map((d) => d.id);
    return Array.from(new Set([...SUPER_ADMIN_EMAILS, ...emails]));
  } catch {
    return [...SUPER_ADMIN_EMAILS];
  }
}

export async function addAuthorizedAdmin(email: string): Promise<void> {
  const clean = email.toLowerCase().trim();
  if (!clean) return;
  await setDoc(doc(db, 'authorized_admins', clean), {
    email: clean,
    addedAt: new Date().toISOString(),
  });
}

export async function removeAuthorizedAdmin(email: string): Promise<void> {
  const clean = email.toLowerCase().trim();
  if (!clean || SUPER_ADMIN_EMAILS.includes(clean)) return;
  await deleteDoc(doc(db, 'authorized_admins', clean));
}

export function resetLocalDemoWorkspace(): void {
  writeLocal(STORAGE_KEYS.PROJECTS, SEED_PROJECTS, 'projects');
  writeLocal(STORAGE_KEYS.MESSAGES, SEED_CONTACT_MESSAGES, 'messages');
  writeLocal(STORAGE_KEYS.ACCOUNTING, SEED_ACCOUNTING, 'accounting');
  writeLocal(STORAGE_KEYS.MAIL_ACCOUNTS, SEED_MAIL_ACCOUNTS, 'mail_accounts');
  writeLocal(STORAGE_KEYS.MAIL_MESSAGES, SEED_MAIL_MESSAGES, 'mail_messages');
  writeLocal(STORAGE_KEYS.MAIL_LOGS, SEED_MAIL_LOGS, 'mail_logs');
  writeLocal(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS, 'settings');
}

// ---------- LIVE DNS MAIL DIAGNOSTICS (Google DNS-over-HTTPS) ----------

interface DnsAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

async function queryDns(name: string, type: 'MX' | 'TXT'): Promise<DnsAnswer[]> {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DNS sorgu hatası (${res.status})`);
  const json = await res.json();
  return Array.isArray(json.Answer) ? json.Answer : [];
}

export async function runLiveDomainMailCheck(rawDomain: string): Promise<MailCheckLog> {
  const domain = rawDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');

  const [mxAnswers, txtAnswers, dmarcAnswers, dkimDefault, dkimGoogle, dkimSel1] =
    await Promise.all([
      queryDns(domain, 'MX').catch(() => []),
      queryDns(domain, 'TXT').catch(() => []),
      queryDns(`_dmarc.${domain}`, 'TXT').catch(() => []),
      queryDns(`default._domainkey.${domain}`, 'TXT').catch(() => []),
      queryDns(`google._domainkey.${domain}`, 'TXT').catch(() => []),
      queryDns(`selector1._domainkey.${domain}`, 'TXT').catch(() => []),
    ]);

  const mxRecords = mxAnswers.map((a) => a.data.replace(/\.$/, ''));
  const mxValid = mxRecords.length > 0;

  const txtStrings = txtAnswers.map((a) => a.data.replace(/^"|"$/g, ''));
  const spfRecord = txtStrings.find((t) => t.toLowerCase().startsWith('v=spf1')) || '';
  const spfValid = Boolean(spfRecord);

  const dmarcStrings = dmarcAnswers.map((a) => a.data.replace(/^"|"$/g, ''));
  const dmarcRecord = dmarcStrings.find((t) => t.toLowerCase().startsWith('v=dmarc1')) || '';
  const dmarcValid = Boolean(dmarcRecord);

  let dkimFound = false;
  let dkimSelector = '';
  if (dkimDefault.some((a) => a.data.includes('DKIM1') || a.data.includes('p='))) {
    dkimFound = true;
    dkimSelector = `default._domainkey.${domain}`;
  } else if (dkimGoogle.some((a) => a.data.includes('DKIM1') || a.data.includes('p='))) {
    dkimFound = true;
    dkimSelector = `google._domainkey.${domain}`;
  } else if (dkimSel1.some((a) => a.data.includes('DKIM1') || a.data.includes('p='))) {
    dkimFound = true;
    dkimSelector = `selector1._domainkey.${domain}`;
  }

  let score = 0;
  if (mxValid) score += 35;
  if (spfValid) score += 25;
  if (dmarcValid) score += 20;
  if (dkimFound) score += 20;

  const summaryParts: string[] = [];
  summaryParts.push(mxValid ? `${mxRecords.length} MX kaydı aktif` : 'MX kaydı bulunamadı');
  summaryParts.push(spfValid ? 'SPF doğrulandı' : 'SPF eksik');
  summaryParts.push(dmarcValid ? 'DMARC aktif' : 'DMARC eksik');
  summaryParts.push(dkimFound ? `DKIM (${dkimSelector})` : 'Yaygın DKIM seçicisi görülmedi');

  return {
    id: `mchk-${Date.now()}`,
    domain,
    checkedAt: new Date().toISOString(),
    mxValid,
    mxRecords,
    spfValid,
    spfRecord,
    dmarcValid,
    dmarcRecord,
    dkimFound,
    dkimSelector,
    score,
    summary: summaryParts.join(' • '),
  };
}
