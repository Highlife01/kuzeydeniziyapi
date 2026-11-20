const admin = require('./firestore-db').withDatabase(require('firebase-admin'));
const { isAccountId } = require('./accounts');
const { sanitizeMailHtml } = require('./sanitize-mail');

const MAX_CONTACTS = 25000;
const CHUNK_SIZE = 4000;

function db() {
  return admin.firestore();
}

function stamp(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    try { return value.toDate().toISOString(); } catch { return null; }
  }
  if (value instanceof Date) return value.toISOString();
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function cleanSignature(value) {
  return sanitizeMailHtml(String(value || '')).slice(0, 20000);
}

function publicSettings(data = {}) {
  const signatures = {};
  const raw = data.signatures && typeof data.signatures === 'object' ? data.signatures : {};
  for (const [id, value] of Object.entries(raw)) {
    if (!isAccountId(id)) continue;
    if (typeof value === 'string') {
      const html = String(value).slice(0, 20000);
      signatures[id] = { new: html, reply: html };
    } else {
      signatures[id] = {
        new: String((value && value.new) || '').slice(0, 20000),
        reply: String((value && value.reply) || '').slice(0, 20000),
      };
    }
  }
  const templates = (Array.isArray(data.templates) ? data.templates : []).slice(0, 12).map((item, index) => ({
    id: /^[A-Za-z0-9_-]{8,80}$/.test(String(item && item.id || '')) ? String(item.id) : `tpl-${index + 1}`,
    title: String((item && item.title) || 'Şablon').replace(/[\r\n]/g, ' ').trim().slice(0, 80) || 'Şablon',
    body: String((item && item.body) || '').slice(0, 20000),
  }));
  const recent = (Array.isArray(data.recent) ? data.recent : []).slice(0, MAX_CONTACTS).map((item) => {
    const email = String((item && item.email) || '').trim().slice(0, 120);
    if (!email || !email.includes('@') || /[\s\r\n<>]/.test(email)) return null;
    const group = item && item.group ? String(item.group).replace(/[\r\n]/g, ' ').trim().slice(0, 40) : '';
    const phone = item && item.phone ? String(item.phone).replace(/[\r\n]/g, ' ').trim().slice(0, 40) : '';
    const company = item && item.company ? String(item.company).replace(/[\r\n]/g, ' ').trim().slice(0, 80) : '';
    const notes = item && item.notes ? String(item.notes).replace(/[\r\n]/g, ' ').trim().slice(0, 300) : '';
    return {
      email,
      name: String((item && item.name) || '').replace(/[\r\n]/g, ' ').trim().slice(0, 80),
      sentCount: Math.max(0, Number(item && item.sentCount) || 0),
      receivedCount: Math.max(0, Number(item && item.receivedCount) || 0),
      lastAt: Math.max(0, Number(item && item.lastAt) || 0),
      ...(group ? { group } : {}),
      ...(phone ? { phone } : {}),
      ...(company ? { company } : {}),
      ...(notes ? { notes } : {}),
    };
  }).filter(Boolean).sort((a, b) => (b.sentCount - a.sentCount) || ((b.sentCount + b.receivedCount) - (a.sentCount + a.receivedCount)) || (b.lastAt - a.lastAt));
  const accountOrder = (Array.isArray(data.accountOrder) ? data.accountOrder : [])
    .filter((id) => isAccountId(id))
    .slice(0, 120);
  const labels = (Array.isArray(data.labels) ? data.labels : []).slice(0, 30).map((l, idx) => ({
    id: /^[a-zA-Z0-9_-]{2,32}$/.test(String(l && l.id || '')) ? String(l.id) : `lbl_${idx + 1}`,
    name: String((l && l.name) || 'Etiket').replace(/[\r\n]/g, ' ').trim().slice(0, 40) || 'Etiket',
    color: /^#[0-9a-fA-F]{6}$/.test(String(l && l.color || '')) ? String(l.color).toLowerCase() : '#3b82f6',
  }));
  const rules = (Array.isArray(data.rules) ? data.rules : []).slice(0, 50).map((r, idx) => ({
    id: /^[a-zA-Z0-9_-]{2,32}$/.test(String(r && r.id || '')) ? String(r.id) : `rule_${idx + 1}`,
    name: String((r && r.name) || 'Kural').replace(/[\r\n]/g, ' ').trim().slice(0, 60) || 'Kural',
    field: ['from', 'to', 'subject'].includes(r && r.field) ? r.field : 'from',
    condition: ['contains', 'equals', 'starts'].includes(r && r.condition) ? r.condition : 'contains',
    value: String((r && r.value) || '').trim().slice(0, 100),
    action: ['label', 'star', 'read', 'move'].includes(r && r.action) ? r.action : 'label',
    target: String((r && r.target) || '').trim().slice(0, 50),
    enabled: r && r.enabled !== false,
  }));
  const sound = data.sound === 'off' ? 'off' : 'on';
  const rawUndo = Number(data.undoSendSeconds);
  const undoSendSeconds = Number.isFinite(rawUndo) && rawUndo > 0 ? Math.min(30, Math.round(rawUndo)) : 0;
  const pinned = {};
  const rawPinned = data.pinned && typeof data.pinned === 'object' && !Array.isArray(data.pinned) ? data.pinned : {};
  for (const [accId, list] of Object.entries(rawPinned)) {
    if (!isAccountId(accId) || !Array.isArray(list)) continue;
    const cleaned = [...new Set(list.map((u) => Number(u)).filter((u) => Number.isInteger(u) && u > 0))];
    if (cleaned.length) pinned[accId] = cleaned.slice(0, 500);
  }
  const snoozed = {};
  const rawSnoozed = data.snoozed && typeof data.snoozed === 'object' && !Array.isArray(data.snoozed) ? data.snoozed : {};
  for (const [accId, entries] of Object.entries(rawSnoozed)) {
    if (!isAccountId(accId) || !entries || typeof entries !== 'object' || Array.isArray(entries)) continue;
    const accMap = {};
    for (const [uidKey, wakeTs] of Object.entries(entries)) {
      const uidNum = Number(uidKey);
      const tsNum = Number(wakeTs);
      if (Number.isInteger(uidNum) && uidNum > 0 && Number.isFinite(tsNum) && tsNum > 0) {
        accMap[String(uidNum)] = tsNum;
      }
    }
    if (Object.keys(accMap).length > 0) snoozed[accId] = accMap;
  }
  const customLabels = {};
  const rawCustomLabels = data.customLabels && typeof data.customLabels === 'object' && !Array.isArray(data.customLabels) ? data.customLabels : {};
  for (const [msgKey, lblList] of Object.entries(rawCustomLabels)) {
    if (!Array.isArray(lblList)) continue;
    const cleaned = [...new Set(lblList.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 20);
    if (cleaned.length > 0) customLabels[String(msgKey).slice(0, 140)] = cleaned;
  }
  const scheduledEmails = (Array.isArray(data.scheduledEmails) ? data.scheduledEmails : []).slice(0, 100).map((item) => ({
    id: String(item.id || ''),
    accountId: String(item.accountId || ''),
    payload: item.payload || {},
    scheduledAt: Number(item.scheduledAt) || 0,
    createdAt: Number(item.createdAt) || 0,
    targetEmail: String(item.targetEmail || ''),
    subject: String(item.subject || ''),
  }));
  return {
    theme: data.theme === 'dark' ? 'dark' : 'light',
    defaultAccountId: isAccountId(data.defaultAccountId) ? data.defaultAccountId : '',
    accountOrder,
    signatures,
    templates,
    labels,
    rules,
    recent,
    sound,
    undoSendSeconds,
    pinned,
    snoozed,
    customLabels,
    scheduledEmails,
  };
}

function sortAccounts(accounts, settings) {
  const order = (settings && settings.accountOrder) || [];
  const rank = new Map(order.map((id, index) => [id, index]));
  const preferred = settings && settings.defaultAccountId;
  return [...accounts].sort((a, b) => {
    if (preferred && a.id === preferred && b.id !== preferred) return -1;
    if (preferred && b.id === preferred && a.id !== preferred) return 1;
    const ia = rank.has(a.id) ? rank.get(a.id) : 1000;
    const ib = rank.has(b.id) ? rank.get(b.id) : 1000;
    if (ia !== ib) return ia - ib;
    return String(a.displayName || '').localeCompare(String(b.displayName || ''), 'tr');
  });
}

async function upsertSettingsDoc(docRef, payload, docExists) {
  if (docExists && typeof docRef.update === 'function') {
    try {
      await docRef.update(payload);
      return;
    } catch (err) {
      if (err && err.code !== 5 && !/NOT_FOUND/i.test(String(err.message || ''))) throw err;
    }
  }
  await docRef.set(payload, { merge: true });
}

async function readSettingsState(uid) {
  const docRef = db().collection('userSettings').doc(uid);
  const snap = await docRef.get();
  const data = snap.exists ? { ...(snap.data() || {}) } : {};
  const chunksCount = Math.min(8, Math.max(0, Number(data.contactChunksCount) || 0));
  if (chunksCount > 0 && typeof docRef.collection === 'function') {
    const chunkSnaps = await Promise.all(
      Array.from({ length: chunksCount }, (_, i) => docRef.collection('contactChunks').doc(`chunk_${i}`).get().catch(() => null))
    );
    const extra = [];
    for (const cs of chunkSnaps) {
      if (cs && cs.exists && Array.isArray(cs.data()?.items)) extra.push(...cs.data().items);
    }
    data.recent = [...(Array.isArray(data.recent) ? data.recent : []), ...extra];
  }
  return { docRef, docExists: Boolean(snap && snap.exists), settings: publicSettings(data) };
}

async function readSettings(uid) {
  const { settings } = await readSettingsState(uid);
  return settings;
}

async function saveChunkedRecent(uid, fullRecent, extraFields = {}, docExists = false) {
  const docRef = db().collection('userSettings').doc(uid);
  const mainRecent = fullRecent.slice(0, CHUNK_SIZE);
  const overflow = fullRecent.slice(CHUNK_SIZE, MAX_CONTACTS);
  const chunksCount = Math.ceil(overflow.length / CHUNK_SIZE);
  const { recent: _ignoredRecent, ...scalarFields } = extraFields || {};
  await upsertSettingsDoc(docRef, {
    ...scalarFields,
    recent: mainRecent,
    contactChunksCount: chunksCount,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, docExists);
  if (chunksCount > 0 && typeof docRef.collection === 'function') {
    await Promise.all(
      Array.from({ length: chunksCount }, (_, i) => docRef.collection('contactChunks').doc(`chunk_${i}`).set({
        items: overflow.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      }))
    );
  }
}

async function writeSettings(uid, body = {}) {
  const docRef = db().collection('userSettings').doc(uid);
  const recentTouched = Array.isArray(body.recent) || (Array.isArray(body.deletedEmails) && body.deletedEmails.length > 0);
  const omitRecent = !recentTouched && body.omitRecent === true;

  let current;
  let docExists = false;
  if (omitRecent) {
    // Only read the single settings document when client preserves its loaded contacts cache
    const snap = await docRef.get();
    docExists = Boolean(snap && snap.exists);
    current = publicSettings(docExists ? { ...(snap.data() || {}), recent: [] } : {});
  } else {
    const state = await readSettingsState(uid);
    docExists = state.docExists;
    current = state.settings;
  }

  const signatures = body.signatures && typeof body.signatures === 'object' ? {} : current.signatures;
  if (body.signatures && typeof body.signatures === 'object') {
    for (const [id, value] of Object.entries(body.signatures)) {
      if (!isAccountId(id)) continue;
      signatures[id] = {
        new: cleanSignature(value && typeof value === 'object' ? value.new : value),
        reply: cleanSignature(value && typeof value === 'object' ? value.reply : value),
      };
    }
  }
  let baseRecent = current.recent;
  if (Array.isArray(body.deletedEmails) && body.deletedEmails.length) {
    const delSet = new Set(body.deletedEmails.map((e) => String(e || '').trim().toLowerCase()));
    baseRecent = baseRecent.filter((item) => !delSet.has(String(item.email || '').toLowerCase()));
  }
  const nextRecent = Array.isArray(body.recent)
    ? (body.replaceRecent === true ? body.recent : mergeContactLists(baseRecent, body.recent))
    : baseRecent;
  const next = publicSettings({
    theme: body.theme == null ? current.theme : body.theme,
    defaultAccountId: body.defaultAccountId == null ? current.defaultAccountId : body.defaultAccountId,
    accountOrder: Array.isArray(body.accountOrder) ? body.accountOrder : current.accountOrder,
    signatures,
    templates: Array.isArray(body.templates) ? body.templates.map((item) => ({
      ...item,
      body: cleanSignature(item && item.body),
    })) : current.templates,
    labels: Array.isArray(body.labels) ? body.labels : current.labels,
    rules: Array.isArray(body.rules) ? body.rules : current.rules,
    recent: nextRecent,
    sound: body.sound == null ? current.sound : body.sound,
    undoSendSeconds: body.undoSendSeconds == null ? current.undoSendSeconds : body.undoSendSeconds,
    pinned: body.pinned == null ? current.pinned : body.pinned,
    snoozed: body.snoozed == null ? current.snoozed : body.snoozed,
    customLabels: body.customLabels == null ? current.customLabels : body.customLabels,
    scheduledEmails: body.scheduledEmails == null ? current.scheduledEmails : body.scheduledEmails,
  });

  if (recentTouched) {
    await saveChunkedRecent(uid, next.recent, next, docExists);
    return next;
  }

  // Avoid rewriting up to 4,000+ contacts and contactChunks; replace top-level maps cleanly when doc exists
  const { recent: _omitRecentField, ...nonRecentFields } = next;
  await upsertSettingsDoc(docRef, {
    ...nonRecentFields,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, docExists);
  return omitRecent ? { ...next, recent: [], recentOmitted: true } : next;
}

function mergeContactLists(existing = [], incoming = []) {
  const byEmail = new Map();
  for (const item of existing) {
    if (!item || !item.email) continue;
    const key = String(item.email).trim().toLowerCase();
    byEmail.set(key, {
      email: String(item.email).trim(),
      name: String(item.name || '').trim(),
      sentCount: Number(item.sentCount) || 0,
      receivedCount: Number(item.receivedCount) || 0,
      lastAt: Number(item.lastAt) || 0,
      group: String(item.group || '').trim(),
      phone: String(item.phone || '').trim(),
      company: String(item.company || '').trim(),
      notes: String(item.notes || '').trim(),
    });
  }
  const now = Date.now();
  for (const raw of incoming) {
    const obj = typeof raw === 'string' ? { email: raw, sent: true } : (raw || {});
    const email = String(obj.email || '').trim().slice(0, 120);
    if (!email || !email.includes('@') || /[\s\r\n<>]/.test(email)) continue;
    const key = email.toLowerCase();
    const prev = byEmail.get(key) || {
      email, name: '', sentCount: 0, receivedCount: 0, lastAt: 0,
      group: '', phone: '', company: '', notes: '',
    };
    const cleanName = String(obj.name || '').replace(/[\r\n]/g, ' ').trim().slice(0, 80);
    const addSent = obj.sentCount != null ? Math.max(0, Number(obj.sentCount) || 0) : (obj.sent ? 1 : 0);
    const addRec = obj.receivedCount != null ? Math.max(0, Number(obj.receivedCount) || 0) : (obj.sent === false ? 1 : 0);
    byEmail.set(key, {
      email: prev.email || email,
      name: cleanName && cleanName.toLowerCase() !== key ? cleanName : prev.name,
      sentCount: obj.sentCount != null ? Math.max(prev.sentCount, addSent) : prev.sentCount + addSent,
      receivedCount: obj.receivedCount != null ? Math.max(prev.receivedCount, addRec) : prev.receivedCount + addRec,
      lastAt: Math.max(prev.lastAt, Number(obj.lastAt) || now),
      group: obj.group !== undefined ? String(obj.group || '').replace(/[\r\n]/g, ' ').trim().slice(0, 40) : prev.group,
      phone: obj.phone !== undefined ? String(obj.phone || '').replace(/[\r\n]/g, ' ').trim().slice(0, 40) : prev.phone,
      company: obj.company !== undefined ? String(obj.company || '').replace(/[\r\n]/g, ' ').trim().slice(0, 80) : prev.company,
      notes: obj.notes !== undefined ? String(obj.notes || '').replace(/[\r\n]/g, ' ').trim().slice(0, 300) : prev.notes,
    });
  }
  return [...byEmail.values()]
    .sort((a, b) => (b.sentCount - a.sentCount) || ((b.sentCount + b.receivedCount) - (a.sentCount + a.receivedCount)) || (b.lastAt - a.lastAt))
    .slice(0, MAX_CONTACTS);
}

async function rememberRecipients(uid, addresses, options = { sent: true }) {
  const list = (Array.isArray(addresses) ? addresses : []).map((item) => (
    typeof item === 'string' ? { email: item, sent: options.sent !== false } : { ...item, sent: item && item.sent != null ? item.sent : options.sent !== false }
  ));
  if (!list.length) return;
  const { settings: current, docExists } = await readSettingsState(uid);
  const merged = mergeContactLists(current.recent, list);
  await saveChunkedRecent(uid, merged, {}, docExists);
}

const harvestBuffer = new Map();
const harvestLastWrite = new Map();

async function rememberMessagesContacts(uid, messages = [], ownEmail = '', isSentFolder = false) {
  if (!uid || !Array.isArray(messages) || !messages.length) return;
  const selfKey = String(ownEmail || '').trim().toLowerCase();
  const dedup = harvestBuffer.get(uid) || new Map();
  const pushEntry = (email, name, sent) => {
    const clean = String(email || '').trim();
    if (!clean) return;
    const lower = clean.toLowerCase();
    if (lower === selfKey) return;
    const key = `${lower}|${sent ? 1 : 0}`;
    const prev = dedup.get(key);
    dedup.set(key, {
      email: prev ? prev.email : clean,
      name: String(name || '').trim() || (prev ? prev.name : ''),
      sent,
    });
  };
  for (const msg of messages) {
    if (!msg) continue;
    if (msg.fromEmail) pushEntry(msg.fromEmail, msg.from, false);
    if (msg.toEmail) pushEntry(msg.toEmail, msg.to, isSentFolder);
    if (Array.isArray(msg.toEmails)) {
      for (const addr of msg.toEmails) pushEntry(addr, '', isSentFolder);
    }
    if (Array.isArray(msg.ccEmails)) {
      for (const addr of msg.ccEmails) pushEntry(addr, '', isSentFolder);
    }
  }
  if (!dedup.size) return;
  if (dedup.size > 5000) {
    const excess = dedup.size - 5000;
    let i = 0;
    for (const k of dedup.keys()) {
      dedup.delete(k);
      if (++i >= excess) break;
    }
  }
  harvestBuffer.set(uid, dedup);
  const now = Date.now();
  if (now - (harvestLastWrite.get(uid) || 0) < 20000) return;
  harvestLastWrite.set(uid, now);
  const batch = [...dedup.values()];
  harvestBuffer.delete(uid);
  await rememberRecipients(uid, batch, { sent: isSentFolder });
}

module.exports = { publicSettings, readSettings, writeSettings, rememberRecipients, rememberMessagesContacts, mergeContactLists, sortAccounts, stamp };
