const admin = require('./firestore-db').withDatabase(require('firebase-admin'));
const { createHash } = require('node:crypto');
const { simpleParser } = require('mailparser');
const { publicError } = require('./errors');
const { withImap, mailboxPath, inlineCid, invalidateMail } = require('./imap-mail');
const { sanitizeMailHtml, textToHtml } = require('./sanitize-mail');

function cleanFilename(name) {
  const base = String(name || 'ek').replace(/[/\\]/g, '_').replace(/[\r\n"]/g, '').slice(0, 120);
  return base || 'ek';
}

function cleanContentType(type) {
  const value = String(type || '').split(';')[0].trim().toLowerCase();
  return /^[\w.+-]+\/[\w.+-]+$/.test(value) && !/html|svg|xml|javascript/i.test(value)
    ? value
    : 'application/octet-stream';
}

const { parseMailQuery } = require('./mail-query');

function storageBucket() {
  const fallbackBucket = process.env.GCLOUD_PROJECT ? `${process.env.GCLOUD_PROJECT}.firebasestorage.app` : undefined;
  return admin.storage().bucket(process.env.MAIL_ATTACHMENT_BUCKET || fallbackBucket);
}

function archiveCollectionRef(accountId) {
  return admin.firestore().collection('accounts').doc(accountId).collection('archived_messages');
}

function archiveDocRef(accountId, archiveId) {
  return archiveCollectionRef(accountId).doc(archiveId);
}

function archiveBlobRef(id) {
  return admin.firestore().collection('mailArchiveBlobs').doc(id);
}

function numericArchiveUid(archiveId) {
  const hex = createHash('sha256').update(String(archiveId)).digest('hex').slice(0, 8);
  const val = parseInt(hex, 16) & 0x7fffffff;
  return val > 0 ? val : 1;
}

const PART_BYTES = 700000;
const PARTS_PER_BATCH = 8;

async function savePayload(storagePath, content, contentType, metadata) {
  try {
    const bucket = storageBucket();
    await bucket.file(storagePath).save(content, {
      resumable: false,
      validation: 'crc32c',
      metadata: {
        contentType,
        cacheControl: 'private, no-store',
        metadata,
      },
    });
    return { type: 'storage', path: storagePath };
  } catch {
    // Fallback to chunked Firestore if Cloud Storage bucket is not configured or unavailable
    const blobId = createHash('sha256').update(storagePath).digest('hex').slice(0, 40);
    const ref = archiveBlobRef(blobId);
    const parts = [];
    for (let offset = 0; offset < content.length; offset += PART_BYTES) {
      parts.push(content.subarray(offset, offset + PART_BYTES).toString('base64'));
    }
    const record = {
      storagePath,
      contentType,
      size: content.length,
      parts: parts.length,
      metadata,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (parts.length <= 1 && (!parts[0] || parts[0].length < 900000)) {
      await ref.set({ ...record, content: parts[0] || '' });
    } else {
      await ref.set(record);
      for (let offset = 0; offset < parts.length; offset += PARTS_PER_BATCH) {
        const batch = admin.firestore().batch();
        parts.slice(offset, offset + PARTS_PER_BATCH).forEach((part, index) => {
          const partIndex = offset + index;
          batch.set(ref.collection('parts').doc(String(partIndex)), { index: partIndex, content: part });
        });
        await batch.commit();
      }
    }
    return { type: 'firestore', blobId };
  }
}

async function loadPayload(location, storagePath) {
  if (location && location.type === 'storage') {
    try {
      const bucket = storageBucket();
      const [buffer] = await bucket.file(location.path || storagePath).download();
      return buffer;
    } catch {
      // Fall through to Firestore check
    }
  }
  const blobId = (location && location.blobId) || createHash('sha256').update(storagePath).digest('hex').slice(0, 40);
  const ref = archiveBlobRef(blobId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (data.content !== undefined) {
    return Buffer.from(data.content, 'base64');
  }
  const partsSnap = await ref.collection('parts').get();
  if (partsSnap.empty) return null;
  const sorted = partsSnap.docs.map((d) => d.data()).sort((a, b) => a.index - b.index);
  return Buffer.concat(sorted.map((item) => Buffer.from(item.content, 'base64')));
}

function normalizeQuotaStorage(storage) {
  const rawUsage = Math.max(0, Number(storage && storage.usage) || 0);
  const rawLimit = Math.max(0, Number(storage && storage.limit) || 0);
  // If limit is under 10,000,000 (e.g. 256000 KB in raw RFC 2087), both usage and limit are in KB;
  // otherwise (ImapFlow / SurgeMail bytes) both are already in bytes.
  const multiplier = rawLimit > 0 && rawLimit < 10000000 ? 1024 : 1;
  const usageBytes = rawUsage * multiplier;
  const limitBytes = rawLimit * multiplier;
  const percent = limitBytes > 0 ? Math.min(100, Math.round((usageBytes / limitBytes) * 100)) : 0;
  return { usageBytes, limitBytes, percent };
}

async function getMailboxQuota(account) {
  return withImap(account, async (client) => {
    try {
      if (typeof client.getQuota === 'function') {
        const quota = await client.getQuota();
        if (quota && quota.storage) {
          const { usageBytes, limitBytes, percent } = normalizeQuotaStorage(quota.storage);
          return {
            usageBytes,
            limitBytes,
            percent,
            status: quota.storage.status || `${percent}%`,
            supported: true,
          };
        }
      }
    } catch {
      // Fall through
    }
    let total = 0;
    try {
      const inbox = await client.status('INBOX', { messages: true });
      total = Number(inbox.messages) || 0;
    } catch {}
    const estimatedUsage = total * 75000;
    const defaultLimit = 250 * 1024 * 1024;
    const percent = Math.min(100, Math.round((estimatedUsage / defaultLimit) * 100));
    return {
      usageBytes: estimatedUsage,
      limitBytes: defaultLimit,
      percent,
      status: `~${percent}%`,
      supported: false,
      messageCount: total,
    };
  });
}

function parseEmailAddress(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (field.text) return field.text;
  if (Array.isArray(field.value) && field.value[0]) {
    const item = field.value[0];
    return item.name && item.address ? `${item.name} <${item.address}>` : (item.address || item.name || '');
  }
  return '';
}

function firstAddressOnly(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (Array.isArray(field.value) && field.value[0] && field.value[0].address) {
    return field.value[0].address;
  }
  return '';
}

function parsedEmailsList(field) {
  if (!field) return [];
  const groups = Array.isArray(field) ? field : [field];
  return groups.flatMap((group) => group.value || []).map((item) => item.address).filter(Boolean);
}

async function archiveSingleMessageUnlocked(client, account, { role, uid }) {
  const full = await client.fetchOne(uid, {
    uid: true,
    flags: true,
    envelope: true,
    internalDate: true,
    size: true,
    source: true,
  }, { uid: true });
  if (!full || !full.source || !full.source.length) {
    throw publicError(404, 'İleti IMAP sunucusunda bulunamadı.');
  }

  const parsed = await simpleParser(full.source);
  const rawMessageId = String(parsed.messageId || (full.envelope && full.envelope.messageId) || '').trim();
  const hashBasis = rawMessageId || `${account.id}-${role}-${uid}-${Date.parse(full.internalDate || parsed.date || new Date())}`;
  const safeHash = createHash('sha256').update(hashBasis).digest('hex').slice(0, 24);
  const archiveId = `arc_${safeHash}`;
  const archiveUid = numericArchiveUid(archiveId);

  const emlPath = `cukurovabartu/mail-archive/${account.id}/${archiveId}/source.eml`;
  const emlLocation = await savePayload(emlPath, full.source, 'message/rfc822', {
    accountId: account.id,
    archiveId,
    originalUid: String(uid),
  });

  // Zero-Data-Loss Check 1: Verify raw EML payload can be read back with exact byte length
  const verifiedEml = await loadPayload(emlLocation, emlPath);
  if (!verifiedEml || verifiedEml.length !== full.source.length) {
    throw publicError(500, 'Arşiv doğrulama hatası: EML kaynağı depolama alanında doğrulanamadı.');
  }

  const attachmentsMeta = (parsed.attachments || []).map((att, i) => ({
    index: i,
    filename: cleanFilename(att.filename || `ek_${i + 1}`),
    contentType: cleanContentType(att.contentType),
    size: att.size || (att.content ? att.content.length : 0),
    cid: att.cid ? String(att.cid).replace(/[<>]/g, '') : null,
  }));

  const subject = (full.envelope && full.envelope.subject) || parsed.subject || '(Konu yok)';
  const fromText = parseEmailAddress(parsed.from) || (full.envelope && full.envelope.from ? full.envelope.from.map((a) => a.address).join(', ') : 'Bilinmeyen');
  const fromEmail = firstAddressOnly(parsed.from) || (full.envelope && full.envelope.from && full.envelope.from[0] ? full.envelope.from[0].address : '');
  const toText = parseEmailAddress(parsed.to) || (full.envelope && full.envelope.to ? full.envelope.to.map((a) => a.address).join(', ') : '');
  const toEmail = firstAddressOnly(parsed.to) || (full.envelope && full.envelope.to && full.envelope.to[0] ? full.envelope.to[0].address : '');
  const ccText = parseEmailAddress(parsed.cc);
  const toEmails = parsedEmailsList(parsed.to);
  const ccEmails = parsedEmailsList(parsed.cc);
  const dateIso = new Date(full.internalDate || parsed.date || Date.now()).toISOString();
  const plainText = String(parsed.text || '').replace(/\s+/g, ' ').trim();
  const snippet = plainText.slice(0, 300);

  const docRef = archiveDocRef(account.id, archiveId);
  const docData = {
    id: archiveId,
    uid: archiveUid,
    accountId: account.id,
    originalUid: uid,
    originalRole: role,
    messageId: rawMessageId,
    subject,
    from: fromText,
    fromEmail,
    to: toText,
    toEmail,
    cc: ccText,
    toEmails,
    ccEmails,
    date: dateIso,
    seen: Boolean(full.flags && (typeof full.flags.has === 'function' ? full.flags.has('\\Seen') : Array.isArray(full.flags) && full.flags.includes('\\Seen'))),
    flagged: Boolean(full.flags && (typeof full.flags.has === 'function' ? full.flags.has('\\Flagged') : Array.isArray(full.flags) && full.flags.includes('\\Flagged'))),
    size: Number(full.size) || full.source.length,
    hasAttachments: attachmentsMeta.length > 0,
    attachments: attachmentsMeta,
    snippet,
    emlLocation,
    emlPath,
    archivedAt: new Date().toISOString(),
    textSearch: `${subject} ${fromText} ${fromEmail} ${toText} ${toEmail} ${snippet}`.toLowerCase(),
  };

  // Step 1: Save metadata to Firestore
  await docRef.set(docData);

  // Zero-Data-Loss Check 2: Verify Firestore document exists and matches size
  const checkSnap = await docRef.get();
  if (!checkSnap.exists || checkSnap.data().size !== docData.size) {
    throw publicError(500, 'Arşiv doğrulanamadı: Firestore kaydı teyit edilemedi.');
  }

  // Step 3: Delete from IMAP ONLY after both storage and Firestore checks succeeded
  await client.messageDelete(uid, { uid: true });

  return {
    archiveId,
    uid: archiveUid,
    originalUid: uid,
    subject,
    size: docData.size,
    freedBytes: docData.size,
  };
}

async function archiveSingleMessage(client, account, { role, uid }) {
  const path = await mailboxPath(client, role);
  const lock = await client.getMailboxLock(path);
  try {
    return await archiveSingleMessageUnlocked(client, account, { role, uid });
  } finally {
    lock.release();
  }
}

async function bulkArchive(account, { role = 'inbox', uids, olderThanDays, minSizeBytes, limit = 50 }) {
  const maxItems = Math.min(Math.max(Number(limit) || 50, 1), 100);
  return withImap(account, async (client) => {
    const path = await mailboxPath(client, role);
    const lock = await client.getMailboxLock(path);
    const archived = [];
    const errors = [];
    let freedBytes = 0;
    let targetUids = [];
    try {
      if (Array.isArray(uids) && uids.length) {
        targetUids = [...new Set(uids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, maxItems);
      } else {
        const criteria = {};
        if (olderThanDays && Number(olderThanDays) > 0) {
          criteria.before = new Date(Date.now() - Number(olderThanDays) * 86400000);
        }
        if (minSizeBytes && Number(minSizeBytes) > 0) {
          criteria.larger = Number(minSizeBytes);
        }
        const searchResult = await client.search(Object.keys(criteria).length ? criteria : { all: true }, { uid: true });
        if (Array.isArray(searchResult)) {
          // Sort oldest UID first so older emails get archived first
          targetUids = searchResult.sort((a, b) => a - b).slice(0, maxItems);
        }
      }

      for (const uid of targetUids) {
        try {
          const res = await archiveSingleMessageUnlocked(client, account, { role, uid });
          archived.push(res);
          freedBytes += res.freedBytes || 0;
        } catch (err) {
          errors.push({ uid, error: err instanceof Error ? err.message : 'Arşivlenemedi' });
        }
      }
    } finally {
      lock.release();
    }

    if (archived.length) {
      invalidateMail(account);
    }

    return {
      archivedCount: archived.length,
      freedBytes,
      archived,
      errors,
      targetCount: targetUids.length,
    };
  });
}

async function archiveSingleMessageDirect(account, { role, uid }) {
  return withImap(account, async (client) => {
    const res = await archiveSingleMessage(client, account, { role, uid });
    invalidateMail(account);
    return res;
  });
}

async function findArchivedDoc(accountId, idOrUid) {
  if (!idOrUid) return null;
  const col = archiveCollectionRef(accountId);
  const str = String(idOrUid).trim();
  if (str.startsWith('arc_')) {
    const snap = await col.doc(str).get();
    if (snap.exists) return snap;
  }
  const num = Number(str);
  if (Number.isInteger(num) && num > 0) {
    const byUid = await col.where('uid', '==', num).limit(1).get();
    if (!byUid.empty) return byUid.docs[0];
    const byOrig = await col.where('originalUid', '==', num).limit(1).get();
    if (!byOrig.empty) return byOrig.docs[0];
  }
  return null;
}

function matchesArchivedQuery(m, parsed, unseenOnly) {
  if ((unseenOnly || parsed.unseen) && m.seen) return false;
  if (parsed.flagged && !m.flagged) return false;
  if (parsed.hasAttachment && !m.hasAttachments) return false;
  if (parsed.from) {
    const f = parsed.from.toLowerCase();
    if (!m.from.toLowerCase().includes(f) && !m.fromEmail.toLowerCase().includes(f)) return false;
  }
  if (parsed.to) {
    const t = parsed.to.toLowerCase();
    if (!m.to.toLowerCase().includes(t) && !m.toEmail.toLowerCase().includes(t)) return false;
  }
  if (parsed.subject && !m.subject.toLowerCase().includes(parsed.subject.toLowerCase())) return false;
  if (parsed.body && !m.snippet.toLowerCase().includes(parsed.body.toLowerCase())) return false;
  if (parsed.after) {
    const d = Date.parse(m.date);
    if (!Number.isNaN(d) && d < parsed.after.getTime()) return false;
  }
  if (parsed.before) {
    const d = Date.parse(m.date);
    if (!Number.isNaN(d) && d >= parsed.before.getTime()) return false;
  }
  if (parsed.text) {
    const q = parsed.text.toLowerCase();
    const hit = m.subject.toLowerCase().includes(q)
      || m.from.toLowerCase().includes(q)
      || m.fromEmail.toLowerCase().includes(q)
      || m.to.toLowerCase().includes(q)
      || m.toEmail.toLowerCase().includes(q)
      || m.snippet.toLowerCase().includes(q);
    if (!hit) return false;
  }
  return true;
}

async function listArchivedMessages(accountId, { cursor, query, unseenOnly, limit = 50 } = {}) {
  const maxLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const hasFilter = Boolean(unseenOnly || (query && typeof query === 'string' && query.trim()));
  const fetchLimit = hasFilter ? 1000 : maxLimit + 1;

  let q = archiveCollectionRef(accountId)
    .orderBy('date', 'desc')
    .limit(fetchLimit);

  if (cursor) {
    const cursorDoc = await findArchivedDoc(accountId, cursor);
    if (cursorDoc && cursorDoc.exists) {
      q = q.startAfter(cursorDoc);
    }
  }

  const snap = await q.get();
  const docs = snap.docs;

  const allMapped = docs.map((d) => {
    const data = d.data();
    return {
      uid: data.uid || data.originalUid || numericArchiveUid(data.id),
      archiveId: data.id,
      subject: data.subject || '(Konu yok)',
      from: data.from || 'Bilinmeyen',
      fromEmail: data.fromEmail || '',
      to: data.to || '',
      toEmail: data.toEmail || '',
      date: data.date,
      seen: data.seen !== false,
      flagged: Boolean(data.flagged),
      hasAttachments: Boolean(data.hasAttachments),
      size: data.size || 0,
      snippet: data.snippet || '',
      isArchived: true,
    };
  });

  const parsed = parseMailQuery(query);
  const filtered = hasFilter
    ? allMapped.filter((m) => matchesArchivedQuery(m, parsed, Boolean(unseenOnly)))
    : allMapped;

  const hasMore = filtered.length > maxLimit;
  const messages = hasMore ? filtered.slice(0, maxLimit) : filtered;
  const lastMsg = hasMore && messages.length ? messages[messages.length - 1] : null;
  const nextCursor = lastMsg ? lastMsg.uid : null;

  let total = messages.length;
  try {
    const countSnap = await archiveCollectionRef(accountId).count().get();
    total = countSnap.data().count ?? messages.length;
  } catch {}

  return {
    messages,
    nextCursor,
    total,
  };
}

async function readArchivedMessage(accountId, idOrUid) {
  const snap = await findArchivedDoc(accountId, idOrUid);
  if (!snap || !snap.exists) throw publicError(404, 'Arşivlenmiş ileti bulunamadı.');
  const data = snap.data();

  let html = '';
  let parsedTo = data.to || '';
  let parsedCc = data.cc || '';
  let toEmails = Array.isArray(data.toEmails) ? data.toEmails : (data.toEmail ? [data.toEmail] : []);
  let ccEmails = Array.isArray(data.ccEmails) ? data.ccEmails : [];

  if (data.emlLocation || data.emlPath) {
    try {
      const emlBuffer = await loadPayload(data.emlLocation, data.emlPath);
      if (emlBuffer) {
        const parsed = await simpleParser(emlBuffer);
        const rawHtml = parsed.html || parsed.textAsHtml || textToHtml(parsed.text || '');
        html = sanitizeMailHtml(inlineCid(rawHtml, parsed.attachments));
        if (parsed.to && parsed.to.text) parsedTo = parsed.to.text;
        if (parsed.cc && parsed.cc.text) parsedCc = parsed.cc.text;
        if (!toEmails.length) toEmails = parsedEmailsList(parsed.to);
        if (!ccEmails.length) ccEmails = parsedEmailsList(parsed.cc);
      }
    } catch {
      // Fallback to snippet
    }
  }

  if (!html && data.snippet) {
    html = sanitizeMailHtml(textToHtml(data.snippet));
  }

  if (!data.seen) {
    snap.ref.set({ ...data, seen: true }, { merge: true }).catch(() => undefined);
  }

  return {
    uid: data.uid || data.originalUid || numericArchiveUid(data.id),
    archiveId: data.id,
    subject: data.subject || '(Konu yok)',
    from: data.from || 'Bilinmeyen',
    fromEmail: data.fromEmail || '',
    to: parsedTo,
    toEmail: data.toEmail || '',
    cc: parsedCc,
    toEmails,
    ccEmails,
    date: data.date,
    seen: true,
    flagged: Boolean(data.flagged),
    hasAttachments: Boolean(data.hasAttachments),
    html,
    messageId: data.messageId || '',
    isArchived: true,
    attachments: (data.attachments || []).map((att, idx) => ({
      index: att.index ?? idx,
      filename: att.filename,
      contentType: att.contentType,
      size: att.size,
    })),
  };
}

async function readArchivedAttachment(accountId, idOrUid, index) {
  const snap = await findArchivedDoc(accountId, idOrUid);
  if (!snap || !snap.exists) throw publicError(404, 'İleti bulunamadı.');
  const data = snap.data();
  const attMeta = (data.attachments || [])[index];
  if (!attMeta) throw publicError(404, 'Ek bulunamadı.');

  const attPath = attMeta.location?.path || `cukurovabartu/mail-archive/${accountId}/${data.id}/attachments/${index}_${attMeta.filename}`;
  let buffer = attMeta.location ? await loadPayload(attMeta.location, attPath) : null;
  if (!buffer && (data.emlLocation || data.emlPath)) {
    const emlBuffer = await loadPayload(data.emlLocation, data.emlPath);
    if (emlBuffer) {
      const parsed = await simpleParser(emlBuffer);
      const targetAtt = (parsed.attachments || [])[index];
      if (targetAtt && targetAtt.content) buffer = targetAtt.content;
    }
  }

  if (!buffer) throw publicError(404, 'Ek dosyası okunamadı.');

  return {
    filename: attMeta.filename,
    contentType: cleanContentType(attMeta.contentType),
    content: buffer,
  };
}

async function setArchivedSeen(accountId, idOrUid, seen) {
  const snap = await findArchivedDoc(accountId, idOrUid);
  if (!snap || !snap.exists) throw publicError(404, 'Arşivlenmiş ileti bulunamadı.');
  await snap.ref.set({ seen: Boolean(seen) }, { merge: true });
}

async function setArchivedFlagged(accountId, idOrUid, flagged) {
  const snap = await findArchivedDoc(accountId, idOrUid);
  if (!snap || !snap.exists) throw publicError(404, 'Arşivlenmiş ileti bulunamadı.');
  await snap.ref.set({ flagged: Boolean(flagged) }, { merge: true });
}

async function readArchivedThread(accountId, idOrUid) {
  const snap = await findArchivedDoc(accountId, idOrUid);
  if (!snap || !snap.exists) return { messageId: '', references: '' };
  const data = snap.data();
  return { messageId: String(data.messageId || ''), references: '' };
}

async function restoreArchivedToInbox(account, idOrUid, destination = 'inbox') {
  const snap = await findArchivedDoc(account.id, idOrUid);
  if (!snap || !snap.exists) throw publicError(404, 'Arşivlenmiş ileti bulunamadı.');
  const data = snap.data();
  const emlBuffer = await loadPayload(data.emlLocation, data.emlPath);
  if (!emlBuffer) throw publicError(404, 'Arşiv kaynağı okunamadı.');

  await withImap(account, async (client) => {
    const targetRole = destination === 'archive' ? 'inbox' : destination;
    const path = await mailboxPath(client, targetRole);
    const flags = [];
    if (data.seen !== false) flags.push('\\Seen');
    if (data.flagged) flags.push('\\Flagged');
    await client.append(path, emlBuffer, flags, new Date(data.date || Date.now()));
  });
  await snap.ref.delete().catch(() => undefined);
  invalidateMail(account);
}

module.exports = {
  normalizeQuotaStorage,
  numericArchiveUid,
  matchesArchivedQuery,
  getMailboxQuota,
  bulkArchive,
  archiveSingleMessageDirect,
  findArchivedDoc,
  listArchivedMessages,
  readArchivedMessage,
  readArchivedAttachment,
  readArchivedThread,
  setArchivedSeen,
  setArchivedFlagged,
  restoreArchivedToInbox,
};
