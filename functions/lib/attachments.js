const admin = require('./firestore-db').withDatabase(require('firebase-admin'));
const { randomUUID } = require('node:crypto');
const { publicError } = require('./errors');

function cleanFilename(value) {
  return String(value || 'ek').replace(/[/\\]/g, '_').replace(/[\x00-\x1f\x7f"]/g, '').trim().slice(0, 150) || 'ek';
}

function cleanContentType(value) {
  const type = String(value || '').split(';')[0].trim().toLowerCase();
  return /^[\w.+-]+\/[\w.+-]+$/.test(type) && !/html|svg|xml|javascript/i.test(type)
    ? type : 'application/octet-stream';
}

function attachmentPrefix(uid, accountId) {
  if (typeof uid !== 'string' || !uid || uid.length > 128 || !require('./accounts').isAccountId(accountId)) {
    throw publicError(400, 'Ek bilgisi geçersiz.');
  }
  return `cukurovabartu/mail-attachments/${Buffer.from(uid).toString('base64url')}/${accountId}/`;
}

function attachmentId(value) {
  const id = typeof value === 'string' ? value : value && value.id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || '')) {
    throw publicError(400, 'Ek bilgisi geçersiz.');
  }
  return id;
}

function bucket() {
  return admin.storage().bucket(process.env.MAIL_ATTACHMENT_BUCKET || undefined);
}

function validateResolvedAttachments(attachments = []) {
  if (!Array.isArray(attachments)) throw publicError(400, 'Ek bilgisi geçersiz.');
  const files = attachments.map((attachment) => {
    const rawContent = attachment && attachment.content;
    const content = Buffer.isBuffer(rawContent)
      ? rawContent
      : (rawContent instanceof Uint8Array || ArrayBuffer.isView(rawContent) || rawContent instanceof ArrayBuffer)
        ? Buffer.from(rawContent)
        : null;
    if (!content) throw publicError(400, 'Ek bilgisi geçersiz.');
    const cid = String(attachment.cid || '').replace(/[<>\r\n\x00]/g, '').trim().slice(0, 180);
    return {
      filename: cleanFilename(attachment.filename),
      contentType: cleanContentType(attachment.contentType),
      content,
      ...(cid && !/\s/.test(cid) ? { cid, contentDisposition: 'inline' } : {}),
    };
  });
  return files;
}

async function stageAttachment({ uid, accountId, filename, contentType, content }) {
  const prefix = attachmentPrefix(uid, accountId);
  const [file] = validateResolvedAttachments([{ filename, contentType, content }]);
  const descriptor = { id: randomUUID(), filename: file.filename, contentType: file.contentType, size: file.content.length };
  try {
    await bucket().file(`${prefix}${descriptor.id}`).save(file.content, {
      resumable: false,
      validation: 'crc32c',
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: file.contentType,
        cacheControl: 'private, no-store',
        metadata: { ownerUid: uid, accountId, filename: file.filename, createdAt: new Date().toISOString() },
      },
    });
    return descriptor;
  } catch (err) {
    await stageInFirestore({ uid, accountId, descriptor, content: file.content });
    return descriptor;
  }
}

const PART_BYTES = 700000;
const PARTS_PER_BATCH = 8;

function blobRef(id) {
  return admin.firestore().collection('mailAttachmentBlobs').doc(id);
}

async function stageInFirestore({ uid, accountId, descriptor, content }) {
  const parts = [];
  for (let offset = 0; offset < content.length; offset += PART_BYTES) {
    parts.push(content.subarray(offset, offset + PART_BYTES).toString('base64'));
  }
  const ref = blobRef(descriptor.id);
  const record = {
    ownerUid: uid,
    accountId,
    filename: descriptor.filename,
    contentType: descriptor.contentType,
    size: descriptor.size,
    parts: parts.length,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (parts.length === 1 && parts[0].length < 900000) {
    await ref.set({ ...record, content: parts[0] });
    return;
  }
  await ref.set(record);
  // Base64 expands the bytes, so keep each commit below Firestore's request limit.
  for (let offset = 0; offset < parts.length; offset += PARTS_PER_BATCH) {
    const batch = admin.firestore().batch();
    parts.slice(offset, offset + PARTS_PER_BATCH).forEach((part, index) => {
      const partIndex = offset + index;
      batch.set(ref.collection('parts').doc(String(partIndex)), { index: partIndex, content: part });
    });
    await batch.commit();
  }
}

async function readFirestoreAttachment(uid, accountId, id) {
  const ref = blobRef(id);
  const snap = await ref.get();
  if (!snap.exists) throw publicError(404, 'Ek bulunamadı.');
  if (snap.get('ownerUid') !== uid || snap.get('accountId') !== accountId) throw publicError(403, 'Bu eke erişiminiz yok.');
  const size = Number(snap.get('size'));
  if (!Number.isSafeInteger(size) || size < 0) throw publicError(400, 'Ek bilgisi geçersiz.');
  const encoded = snap.get('content');
  let content;
  if (typeof encoded === 'string') {
    content = Buffer.from(encoded, 'base64');
  } else {
    const parts = await ref.collection('parts').orderBy('index').get();
    // Each chunk has its own base64 padding and must be decoded separately.
    content = Buffer.concat(parts.docs.map((doc) => Buffer.from(String(doc.get('content') || ''), 'base64')));
  }
  if (content.length !== size) throw publicError(409, 'Ek değişti. Yeniden yükleyin.');
  return {
    id,
    filename: cleanFilename(snap.get('filename')),
    contentType: cleanContentType(snap.get('contentType')),
    size,
    content,
  };
}

async function getStagedAttachments({ uid, accountId, ids = [] }) {
  const prefix = attachmentPrefix(uid, accountId);
  if (!Array.isArray(ids)) throw publicError(400, 'Ek bilgisi geçersiz.');
  const unique = [...new Set(ids.map(attachmentId))];
  const files = [];
  // Read sizes and ownership before downloading any content.
  const descriptions = await Promise.all(unique.map(async (id) => {
    let object;
    let metadata;
    try {
      object = bucket().file(`${prefix}${id}`);
      [metadata] = await object.getMetadata();
    }
    catch (err) {
      if (Number(err.code) === 404 || err.code === 404) return readFirestoreAttachment(uid, accountId, id);
      const message = String(err.message || '');
      if (/bucket|storage/i.test(message)) return readFirestoreAttachment(uid, accountId, id);
      throw err;
    }
    if (!metadata.metadata || metadata.metadata.ownerUid !== uid || metadata.metadata.accountId !== accountId) throw publicError(403, 'Bu eke erişiminiz yok.');
    const size = Number(metadata.size);
    if (!Number.isSafeInteger(size) || size < 0) throw publicError(400, 'Ek bilgisi geçersiz.');
    return { id, object, metadata, size };
  }));
  for (const item of descriptions) {
    if (item.content) {
      files.push(item);
      continue;
    }
    const { id, object, metadata, size } = item;
    const [content] = await object.download({ validation: 'crc32c' });
    if (content.length !== size) throw publicError(409, 'Ek değişti. Yeniden yükleyin.');
    files.push({ id, filename: cleanFilename(metadata.metadata.filename), contentType: cleanContentType(metadata.contentType), size, content });
  }
  validateResolvedAttachments(files);
  return files;
}

async function deleteStagedAttachment({ uid, accountId, id }) {
  const prefix = attachmentPrefix(uid, accountId);
  const safeId = attachmentId(id);
  const ref = blobRef(safeId);
  const snap = await ref.get();
  if (snap.exists && (snap.get('ownerUid') !== uid || snap.get('accountId') !== accountId)) {
    throw publicError(403, 'Bu eke erişiminiz yok.');
  }
  try {
    await bucket().file(`${prefix}${safeId}`).delete({ ignoreNotFound: true });
  } catch { /* depolama yoksa Firestore kopyası silinir */ }
  if (!snap.exists) return { ok: true };
  const parts = await ref.collection('parts').get();
  if (!parts.empty) {
    const batch = admin.firestore().batch();
    parts.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  await ref.delete();
  return { ok: true };
}

module.exports = {
  cleanFilename, cleanContentType, attachmentId,
  validateResolvedAttachments, stageAttachment, getStagedAttachments, deleteStagedAttachment,
};
