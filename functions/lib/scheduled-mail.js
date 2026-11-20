const { randomUUID } = require('node:crypto');
const admin = require('./firestore-db').withDatabase(require('firebase-admin'));
const { publicError } = require('./errors');
const { requireAccount } = require('./access');
const { deliver } = require('./smtp-mail');
const { readAttachment, isMailFolder } = require('./imap-mail');
const { readArchivedAttachment } = require('./mail-archive');
const {
  cleanFilename,
  cleanContentType,
  attachmentId,
  getStagedAttachments,
  deleteStagedAttachment,
} = require('./attachments');
const { generateTrackingId, createTrackingRecord } = require('./tracking');
const { rememberRecipients } = require('./settings');

const COLLECTION = 'scheduledEmails';
const MAX_PENDING_PER_USER = 60;
const STALE_LOCK_MS = 5 * 60 * 1000;
const MAX_SCHEDULE_HORIZON_MS = 366 * 24 * 60 * 60 * 1000;

function db() {
  return admin.firestore();
}

function validRole(value) {
  const role = String(value || 'inbox');
  if (typeof isMailFolder === 'function' ? !isMailFolder(role) : !['inbox', 'sent', 'archive', 'trash', 'spam'].includes(role)) {
    throw publicError(400, 'Klasör geçersiz.');
  }
  return role;
}

function validUid(value) {
  if (value == null || value === '') return undefined;
  const uid = Number(value);
  if (!Number.isInteger(uid) || uid <= 0 || uid > 4294967295) {
    throw publicError(400, 'İleti kimliği geçersiz.');
  }
  return uid;
}

function sanitizeScheduledId(value) {
  const raw = String(value || '').trim();
  if (!raw) return randomUUID();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(raw)) {
    throw publicError(400, 'Zamanlama kimliği geçersiz.');
  }
  return raw;
}

function sanitizeAttachments(value) {
  if (value == null || value === '') return [];
  if (!Array.isArray(value)) throw publicError(400, 'Ek bilgisi geçersiz.');
  if (value.length > 15) throw publicError(400, 'En fazla 15 ek eklenebilir.');
  return value.map((item) => {
    const source = item && item.source;
    if (source && source.folder != null) {
      const index = Number(source.index);
      if (!Number.isInteger(index) || index < 0) throw publicError(400, 'Ek bilgisi geçersiz.');
      return {
        filename: cleanFilename(item.filename),
        contentType: cleanContentType(item.contentType),
        size: Number(item.size) || 0,
        source: { folder: validRole(source.folder), uid: validUid(source.uid), index, ...(source.accountId ? { accountId: String(source.accountId) } : {}) },
      };
    }
    return {
      id: attachmentId(item),
      filename: cleanFilename(item && item.filename),
      contentType: cleanContentType(item && item.contentType),
      size: Number(item && item.size) || 0,
    };
  });
}

function toClientScheduled(docId, d) {
  return {
    id: d.id || docId,
    accountId: d.accountId,
    payload: d.payload,
    scheduledAt: Number(d.scheduledAt) || 0,
    createdAt: Number(d.createdAt) || 0,
    targetEmail: String(d.targetEmail || ''),
    subject: String(d.subject || '(Konusuz)'),
    status: d.status || 'pending',
    lastError: d.lastError || undefined,
  };
}

async function listScheduledEmails(uid, customDeps = {}) {
  const store = customDeps.db || db();
  const snap = await store.collection(COLLECTION).where('uid', '==', uid).limit(100).get();
  const items = [];
  for (const doc of snap.docs || []) {
    const d = doc.data() || {};
    if (d.status === 'pending' || d.status === 'processing' || d.status === 'failed') {
      items.push(toClientScheduled(doc.id, d));
    }
  }
  items.sort((a, b) => a.scheduledAt - b.scheduledAt);
  return items;
}

async function scheduleEmails(uid, body = {}, customDeps = {}) {
  const store = customDeps.db || db();
  const checkAccount = customDeps.requireAccount || requireAccount;

  const rawItems = Array.isArray(body.items) ? body.items : [body];
  if (rawItems.length === 0 || rawItems.length > 30) {
    throw publicError(400, 'Zamanlanacak ileti sayısı geçersiz.');
  }

  const existing = await listScheduledEmails(uid, customDeps);
  if (existing.length + rawItems.length > MAX_PENDING_PER_USER) {
    throw publicError(400, `En fazla ${MAX_PENDING_PER_USER} zamanlanmış ileti bekleyebilir.`);
  }

  const now = Date.now();
  const prepared = [];

  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') throw publicError(400, 'Zamanlama verisi geçersiz.');
    const id = sanitizeScheduledId(raw.id);
    const accountId = String(raw.accountId || '').trim();
    if (!accountId) throw publicError(400, 'Gönderici posta hesabı gerekli.');
    await checkAccount(uid, accountId, 'send');

    const payloadIn = raw.payload && typeof raw.payload === 'object' ? raw.payload : {};
    const to = String(payloadIn.to || '').replace(/[\r\n\0]/g, '').trim().slice(0, 2000);
    const cc = String(payloadIn.cc || '').replace(/[\r\n\0]/g, '').trim().slice(0, 2000);
    const bcc = String(payloadIn.bcc || '').replace(/[\r\n\0]/g, '').trim().slice(0, 2000);
    if (!to && !cc && !bcc) {
      throw publicError(400, 'En az bir alıcı adresi zorunludur.');
    }

    const textBody = String(payloadIn.body || '').slice(0, 200000);
    const htmlBody = payloadIn.htmlBody ? String(payloadIn.htmlBody).slice(0, 400000) : '';
    if (!textBody.trim() && !htmlBody.trim()) {
      throw publicError(400, 'İleti metni zorunludur.');
    }

    const attachmentAccountId = payloadIn.attachmentAccountId ? String(payloadIn.attachmentAccountId).trim() : '';
    if (attachmentAccountId && attachmentAccountId !== accountId) {
      await checkAccount(uid, attachmentAccountId, 'send');
    }

    const scheduledAt = Number(raw.scheduledAt !== undefined ? raw.scheduledAt : body.scheduledAt);
    if (!Number.isFinite(scheduledAt) || scheduledAt < now - 120000 || scheduledAt > now + MAX_SCHEDULE_HORIZON_MS) {
      throw publicError(400, 'Zamanlama tarihi geçersiz.');
    }

    const mode = payloadIn.mode === 'reply' ? 'reply' : payloadIn.mode === 'forward' ? 'forward' : 'new';
    const subject = String(payloadIn.subject || raw.subject || '').replace(/[\r\n\0]/g, ' ').trim().slice(0, 400);
    const attachments = sanitizeAttachments(payloadIn.attachments);

    prepared.push({
      id,
      uid,
      accountId,
      status: 'pending',
      retryCount: 0,
      scheduledAt: Math.round(scheduledAt),
      createdAt: now,
      targetEmail: to || cc || bcc,
      subject: subject || '(Konusuz)',
      payload: {
        mode,
        folder: validRole(payloadIn.folder || 'inbox'),
        ...(mode === 'reply' && payloadIn.uid ? { uid: validUid(payloadIn.uid) } : {}),
        to,
        cc,
        bcc,
        subject,
        body: textBody,
        htmlBody,
        attachments,
        ...(attachmentAccountId ? { attachmentAccountId } : {}),
        track: Boolean(payloadIn.track),
        keepAttachments: Boolean(payloadIn.keepAttachments),
      },
    });
  }

  await Promise.all(
    prepared.map((record) => store.collection(COLLECTION).doc(record.id).set(record)),
  );

  const scheduled = await listScheduledEmails(uid, customDeps);
  return { ok: true, scheduled };
}

async function resolveAttachmentsForScheduled(account, attachmentAccount, uid, listed, customDeps = {}) {
  if (!Array.isArray(listed) || listed.length === 0) return [];
  const getStaged = customDeps.getStagedAttachments || getStagedAttachments;
  const readImapAtt = customDeps.readAttachment || readAttachment;
  const readArchAtt = customDeps.readArchivedAttachment || readArchivedAttachment;
  const checkAccount = customDeps.requireAccount || requireAccount;

  const staged = listed.filter((item) => item.id);
  const sourced = listed.filter((item) => item.source);
  const files = [];
  if (staged.length) {
    files.push(...await getStaged({ uid, accountId: attachmentAccount.id, ids: staged.map((item) => item.id) }));
  }
  for (const item of sourced) {
    const sourceAccId = item.source && item.source.accountId;
    const targetAccount = (sourceAccId && sourceAccId !== account.id)
      ? await checkAccount(uid, sourceAccId, 'read')
      : account;
    let file;
    if (item.source.folder === 'archive') {
      try {
        file = await readArchAtt(targetAccount.id, item.source.uid, item.source.index);
      } catch {
        file = await readImapAtt(targetAccount, {
          role: item.source.folder,
          uid: item.source.uid,
          index: item.source.index,
        });
      }
    } else {
      file = await readImapAtt(targetAccount, {
        role: item.source.folder,
        uid: item.source.uid,
        index: item.source.index,
      });
    }
    files.push({
      filename: item.filename || file.filename,
      contentType: file.contentType,
      content: Buffer.isBuffer(file && file.content) ? file.content : Buffer.from(file.content),
    });
  }
  return files;
}

async function cleanupUnreferencedAttachments(store, uid, attachmentAccountId, stagedIds, excludeScheduledId, customDeps = {}) {
  if (!stagedIds.length) return;
  const delStaged = customDeps.deleteStagedAttachment || deleteStagedAttachment;
  let stillUsed = new Set();
  try {
    const snap = await store.collection(COLLECTION).where('uid', '==', uid).limit(100).get();
    for (const doc of snap.docs || []) {
      if (doc.id === excludeScheduledId) continue;
      const d = doc.data() || {};
      if (d.status !== 'pending' && d.status !== 'processing') continue;
      const list = (d.payload && Array.isArray(d.payload.attachments)) ? d.payload.attachments : [];
      for (const att of list) {
        if (att && att.id) stillUsed.add(att.id);
      }
    }
  } catch {
    return; // Fail safe: do not delete if check failed
  }

  const removable = stagedIds.filter((id) => !stillUsed.has(id));
  await Promise.all(
    removable.map((id) => delStaged({ uid, accountId: attachmentAccountId, id }).catch(() => undefined)),
  );
}

async function executeScheduledRecord(docId, customDeps = {}) {
  const store = customDeps.db || db();
  const checkAccount = customDeps.requireAccount || requireAccount;
  const smtpDeliver = customDeps.deliver || deliver;
  const now = customDeps.now || Date.now();
  const ref = store.collection(COLLECTION).doc(docId);

  let claimed = null;
  await store.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap || !snap.exists) return;
    const data = snap.data() || {};
    const staleLock = data.status === 'processing' && Number(data.lockedAt || 0) + STALE_LOCK_MS < now;
    if (data.status !== 'pending' && !staleLock && data.status !== 'failed') return;
    claimed = { ...data, id: data.id || docId };
    tx.update(ref, {
      status: 'processing',
      lockedAt: now,
    });
  });

  if (!claimed) return { skipped: true };

  try {
    const account = await checkAccount(claimed.uid, claimed.accountId, 'send');
    const payload = claimed.payload || {};
    const attachmentAccount = payload.attachmentAccountId && payload.attachmentAccountId !== account.id
      ? await checkAccount(claimed.uid, payload.attachmentAccountId, 'send')
      : account;
    const listed = Array.isArray(payload.attachments) ? payload.attachments : [];
    const files = listed.length
      ? await resolveAttachmentsForScheduled(account, attachmentAccount, claimed.uid, listed, customDeps)
      : [];
    const trackingId = payload.track ? generateTrackingId() : undefined;

    const sendRes = await smtpDeliver(account, {
      mode: payload.mode || 'new',
      role: payload.folder || 'inbox',
      uid: payload.mode === 'reply' ? payload.uid : undefined,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      body: payload.body,
      htmlBody: payload.htmlBody,
      attachments: files,
      trackingId,
    });

    if (sendRes && sendRes.ok) {
      const saveTracking = customDeps.createTrackingRecord || createTrackingRecord;
      const saveRecipients = customDeps.rememberRecipients || rememberRecipients;
      if (trackingId) {
        await Promise.resolve().then(() => saveTracking({
          trackingId,
          uid: claimed.uid,
          accountId: account.id,
          subject: payload.subject,
          recipients: sendRes.accepted || [],
        })).catch(() => undefined);
      }
      await Promise.resolve().then(() => saveRecipients(claimed.uid, sendRes.accepted || [])).catch(() => undefined);
      await ref.delete();
      const stagedIds = listed.filter((f) => f && f.id).map((f) => f.id);
      if (stagedIds.length) {
        await cleanupUnreferencedAttachments(store, claimed.uid, attachmentAccount.id, stagedIds, docId, customDeps);
      }
      return { ok: true, id: docId, result: sendRes };
    }

    throw new Error('SMTP gönderimi tamamlanamadı.');
  } catch (err) {
    const retries = Number(claimed.retryCount || 0) + 1;
    const nextStatus = retries >= 2 ? 'failed' : 'pending';
    const safeMessage = err && err.public && err.message
      ? String(err.message).slice(0, 180)
      : 'Zamanlanmış gönderim sırasında bağlantı hatası oluştu.';
    await ref.set({
      status: nextStatus,
      retryCount: retries,
      lastError: safeMessage,
      // Retry 2 minutes later if transient
      ...(nextStatus === 'pending' ? { scheduledAt: now + 2 * 60 * 1000 } : {}),
      lockedAt: null,
    }, { merge: true }).catch(() => undefined);
    return { ok: false, id: docId, error: safeMessage };
  }
}

async function cancelScheduledEmail(uid, id, customDeps = {}) {
  const store = customDeps.db || db();
  const docId = sanitizeScheduledId(id);
  const ref = store.collection(COLLECTION).doc(docId);
  const snap = await ref.get();
  if (!snap || !snap.exists) {
    return { ok: true, scheduled: await listScheduledEmails(uid, customDeps) };
  }
  const data = snap.data() || {};
  if (data.uid !== uid) {
    throw publicError(403, 'Bu zamanlanmış iletiye erişim yetkiniz yok.');
  }
  if (data.status === 'processing' && Number(data.lockedAt || 0) + STALE_LOCK_MS > Date.now()) {
    throw publicError(409, 'İleti şu anda gönderiliyor.');
  }
  await ref.delete();

  const payload = data.payload || {};
  const listed = Array.isArray(payload.attachments) ? payload.attachments : [];
  const stagedIds = listed.filter((f) => f && f.id).map((f) => f.id);
  const attachmentAccId = payload.attachmentAccountId || data.accountId;
  if (stagedIds.length && attachmentAccId) {
    await cleanupUnreferencedAttachments(store, uid, attachmentAccId, stagedIds, docId, customDeps);
  }

  return { ok: true, scheduled: await listScheduledEmails(uid, customDeps) };
}

async function sendScheduledEmailNow(uid, id, customDeps = {}) {
  const store = customDeps.db || db();
  const docId = sanitizeScheduledId(id);
  const ref = store.collection(COLLECTION).doc(docId);
  const snap = await ref.get();
  if (!snap || !snap.exists) {
    throw publicError(404, 'Zamanlanmış ileti bulunamadı.');
  }
  const data = snap.data() || {};
  if (data.uid !== uid) {
    throw publicError(403, 'Bu zamanlanmış iletiye erişim yetkiniz yok.');
  }
  const outcome = await executeScheduledRecord(docId, customDeps);
  if (!outcome.ok && !outcome.skipped) {
    throw publicError(502, outcome.error || 'Zamanlanmış ileti gönderilemedi.');
  }
  const scheduled = await listScheduledEmails(uid, customDeps);
  return { ok: true, result: outcome.result, scheduled };
}

async function dispatchDueScheduledEmails(customDeps = {}) {
  const store = customDeps.db || db();
  const now = customDeps.now || Date.now();
  const snap = await store.collection(COLLECTION).where('status', '==', 'pending').limit(60).get();
  const dueDocs = [];
  for (const doc of snap.docs || []) {
    const d = doc.data() || {};
    if (Number(d.scheduledAt || 0) <= now) {
      dueDocs.push(doc.id);
    }
  }

  let sent = 0;
  let failed = 0;
  for (const docId of dueDocs) {
    const res = await executeScheduledRecord(docId, { ...customDeps, now });
    if (res.ok) sent += 1;
    else if (!res.skipped) failed += 1;
  }

  return { processed: dueDocs.length, checked: dueDocs.length, sent, failed };
}

module.exports = {
  listScheduledEmails,
  scheduleEmails,
  cancelScheduledEmail,
  sendScheduledEmailNow,
  dispatchDueScheduledEmails,
  executeScheduledRecord,
};
