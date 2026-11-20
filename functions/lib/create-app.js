const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const admin = require('./firestore-db').withDatabase(require('firebase-admin'));
const { publicError, toClient } = require('./errors');
const { allow, clientIp } = require('./rate');
const { listMessages, inboxPreview, readMessage, readAttachment, setSeen, setFlagged, deleteMessage, moveMessage, applyBulk, readRawMessage, listAllFolders, createCustomFolder, searchAcrossAccounts } = require('./imap-mail');
const { deliver } = require('./smtp-mail');
const { upsertUser, maybeBootstrap, listAuthorized, requireAccount, canCreateMailbox } = require('./access');
const { getAdminOverview, inviteUser, acceptInvitations, setUserAccess } = require('./admin-management');
const { createMailbox, updateMailboxName, testMailboxConnection, setMailboxEnabled, removeMailboxAccess } = require('./create-mailbox');
const { readSettings, writeSettings, rememberRecipients, rememberMessagesContacts, sortAccounts } = require('./settings');
const { allowShared } = require('./rate-store');
const {
  cleanFilename,
  cleanContentType,
  attachmentId,
  stageAttachment,
  getStagedAttachments,
  deleteStagedAttachment,
} = require('./attachments');
const {
  generateTrackingId,
  TRANSPARENT_PIXEL_GIF,
  createTrackingRecord,
  recordOpen,
  getTrackingSummary,
} = require('./tracking');
const {
  getMailboxQuota,
  bulkArchive,
  archiveSingleMessageDirect,
  listArchivedMessages,
  readArchivedMessage,
  readArchivedAttachment,
  setArchivedSeen,
  setArchivedFlagged,
  restoreArchivedToInbox,
} = require('./mail-archive');
const {
  listScheduledEmails,
  scheduleEmails,
  cancelScheduledEmail,
  sendScheduledEmailNow,
} = require('./scheduled-mail');

const ALLOWED_ORIGINS = new Set([
  'https://www.kuzeydenizinsaat.com.tr',
  'https://kuzeydenizinsaat.com.tr',
  'https://www.kuzeydeniziyapi.com.tr',
  'https://kuzeydeniziyapi.com.tr',
  'https://kuzeyyildiziyapi.web.app',
  'https://kuzeyyildiziyapi.firebaseapp.com',
  'https://www.cukurovabartu.com.tr',
  'https://cukurovabartu.com.tr',
  'https://cukurovabartu.web.app',
  'https://cukurovabartu.firebaseapp.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);

function isMailFolder(value) {
  return value === 'inbox' || value === 'sent' || value === 'archive' || value === 'trash' || value === 'spam';
}

function bulkActionOf(value) {
  const action = String(value || '');
  if (!['seen', 'unseen', 'star', 'unstar', 'delete', 'move', 'empty'].includes(action)) {
    throw publicError(400, 'İşlem geçersiz.');
  }
  return action;
}

function draftTime(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') {
    try { return value.toDate().getTime() || 0; } catch { return 0; }
  }
  return 0;
}

function roleOf(value) {
  const role = String(value || 'inbox');
  if (!isMailFolder(role)) throw publicError(400, 'Klasör geçersiz.');
  return role;
}

function uidOf(value) {
  const uid = Number(value);
  if (!Number.isInteger(uid) || uid <= 0 || uid > 4294967295) throw publicError(404, 'İleti bulunamadı.');
  return uid;
}

function cursorOf(value) {
  if (value == null || value === '') return null;
  const uid = Number(value);
  if (!Number.isInteger(uid) || uid <= 0) throw publicError(400, 'Sayfa geçersiz.');
  return uid;
}

function queryOf(value) {
  const query = String(value || '').replace(/[\r\n\0]/g, '').trim();
  if (!query) return '';
  if (query.length < 2 || query.length > 160) throw publicError(400, 'Arama ifadesi geçersiz.');
  return query;
}

function draftIdOf(value) {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(String(value || ''))) throw publicError(400, 'Taslak geçersiz.');
  return String(value);
}

function textField(value, max) {
  return String(value || '').replace(/[\r\n]/g, ' ').trim().slice(0, max);
}

function sourceAttachmentOf(item) {
  const source = item && item.source;
  if (!source || source.folder == null) return null;
  const index = Number(source.index);
  if (!Number.isInteger(index) || index < 0) throw publicError(400, 'Ek bilgisi geçersiz.');
  return {
    filename: cleanFilename(item.filename),
    contentType: cleanContentType(item.contentType),
    size: Number(item.size) || 0,
    source: {
      folder: roleOf(source.folder),
      uid: uidOf(source.uid),
      index,
      ...(source.accountId ? { accountId: String(source.accountId) } : {}),
    },
  };
}

function draftAttachmentsOf(value) {
  if (value == null || value === '') return [];
  if (!Array.isArray(value)) throw publicError(400, 'Ek bilgisi geçersiz.');
  return value.map((item) => {
    const sourced = sourceAttachmentOf(item);
    if (sourced) return sourced;
    return {
      id: attachmentId(item),
      filename: cleanFilename(item && item.filename),
      contentType: cleanContentType(item && item.contentType),
      size: Number(item && item.size) || 0,
    };
  });
}

async function resolveSendAttachments(account, uid, listed) {
  const staged = listed.filter((item) => item.id);
  const sourced = listed.filter((item) => item.source);
  const files = [];
  if (staged.length) {
    files.push(...await getStagedAttachments({ uid, accountId: account.id, ids: staged.map((item) => item.id) }));
  }
  for (const item of sourced) {
    const sourceAccId = item.source && item.source.accountId;
    const targetAccount = (sourceAccId && sourceAccId !== account.id)
      ? await requireAccount(uid, sourceAccId, 'read')
      : account;
    let file;
    if (item.source.folder === 'archive') {
      try {
        file = await readArchivedAttachment(targetAccount.id, item.source.uid, item.source.index);
      } catch {
        file = await readAttachment(targetAccount, {
          role: item.source.folder,
          uid: item.source.uid,
          index: item.source.index,
        });
      }
    } else {
      file = await readAttachment(targetAccount, {
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

const receiveFile = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fields: 4 },
  defParamCharset: 'utf8',
  streamHandler(req, parser) {
    // Firebase Functions has already consumed the stream and kept its bytes here.
    if (Buffer.isBuffer(req.rawBody)) parser.end(req.rawBody);
    else req.pipe(parser);
  },
}).single('file');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (origin) {
      if (!ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ error: 'İstek reddedildi' });
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Content-Disposition');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.path === '/' || req.path === '/api/health') return next();
    if (!allow(`ip:${clientIp(req)}`, 2400, 60 * 1000)) {
      return res.status(429).json({ error: 'Çok fazla istek. Biraz bekleyin.' });
    }
    return next();
  });

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  async function requireUser(req, res, next) {
    try {
      const header = req.get('authorization') || '';
      let token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
      if (!token && req.query.token && typeof req.query.token === 'string') {
        token = req.query.token.trim();
      }
      if (!token) return res.status(401).json({ error: 'Oturum geçersiz' });
      const decoded = await admin.auth().verifyIdToken(token);
      const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
      const emailLower = String(decoded.email || '').trim().toLowerCase();
      if (!emulator && !decoded.email_verified) {
        const superAdmins = new Set([
          'cebrailkara@gmail.com',
          'hayrullahcingoz81@gmail.com',
          'yalinizlargrup@gmail.com',
          'ilkeryaliniz@gmail.com',
          'info@kuzeydenizinsaat.com.tr',
          'info@kuzeydeniziyapi.com.tr',
          'info@cukurovabartu.com.tr',
        ]);
        let erpAuthorized = superAdmins.has(emailLower);
        if (!erpAuthorized && emailLower) {
          const [admSnap, usrSnap] = await Promise.all([
            admin.firestore().collection('authorized_admins').doc(emailLower).get(),
            admin.firestore().collection('users').doc(emailLower).get(),
          ]);
          erpAuthorized = admSnap.exists || (usrSnap.exists && usrSnap.get('active') !== false);
        }
        if (!erpAuthorized) {
          return res.status(403).json({ error: 'E-posta adresinizi doğrulayın veya sistem yöneticisi onayı alın.' });
        }
      }
      const sendLimit = req.method === 'POST' && req.path.endsWith('/send');
      if (!allow(`uid:${decoded.uid}:${sendLimit ? 'send' : 'api'}`, sendLimit ? 300 : 1800, 60 * 1000)) {
        return res.status(429).json({ error: 'Çok fazla istek. Biraz bekleyin.' });
      }
      req.user = {
        uid: decoded.uid,
        email: decoded.email || '',
        name: decoded.name || '',
        emailVerified: Boolean(decoded.email_verified),
        mailAdmin: decoded.mailAdmin === true,
      };
      return next();
    } catch {
      return res.status(401).json({ error: 'Oturum geçersiz' });
    }
  }

  app.get('/', (_req, res) => {
    res.status(200).send('ok');
  });
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/session', requireUser, wrap(async (req, res) => {
    const settingsRead = readSettings(req.user.uid);
    settingsRead.catch(() => {});
    await Promise.all([upsertUser(req.user), maybeBootstrap(req.user), acceptInvitations(req.user).catch(() => {})]);
    const [accounts, settings] = await Promise.all([listAuthorized(req.user.uid), settingsRead]);
    res.json({
      user: { email: req.user.email, displayName: req.user.name || '' },
      accounts: sortAccounts(accounts, settings),
      settings,
      canAddMailbox: canCreateMailbox(req.user),
    });
  }));

  app.get('/api/accounts', requireUser, wrap(async (req, res) => {
    const [accounts, settings] = await Promise.all([
      listAuthorized(req.user.uid),
      readSettings(req.user.uid),
    ]);
    res.json({ accounts: sortAccounts(accounts, settings) });
  }));

  app.post('/api/accounts', requireUser, wrap(async (req, res) => {
    if (!canCreateMailbox(req.user)) throw publicError(403, 'Posta hesabı eklemek için yönetici yetkisi gerekiyor.');
    if (!allow(`uid:${req.user.uid}:mailbox`, 40, 60 * 60 * 1000)
      || !(await allowShared(`mailbox:${req.user.uid}`, 40, 60 * 60 * 1000))) {
      return res.status(429).json({ error: 'Hesap ekleme sınırı doldu. Bir saat sonra tekrar deneyin.' });
    }
    const account = await createMailbox(req.user, req.body || {});
    res.json({ account });
  }));

  app.put('/api/accounts/:accountId', requireUser, wrap(async (req, res) => {
    const body = req.body || {};
    if (body.enabled === true || body.enabled === false) {
      const account = await requireAccount(req.user.uid, req.params.accountId, 'manage');
      const updated = await setMailboxEnabled(account, body.enabled);
      return res.json({ account: updated });
    }
    const account = await requireAccount(req.user.uid, req.params.accountId);
    const updated = await updateMailboxName(account, body.displayName);
    res.json({ account: updated });
  }));

  app.post('/api/accounts/:accountId/test', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId, 'read', { allowDisabled: true });
    if (!allow(`uid:${req.user.uid}:test`, 8, 10 * 60 * 1000)
      || !(await allowShared(`test:${req.user.uid}`, 8, 10 * 60 * 1000))) {
      return res.status(429).json({ error: 'Bağlantı testi sınırı doldu. Biraz bekleyin.' });
    }
    res.json(await testMailboxConnection(account));
  }));

  app.delete('/api/accounts/:accountId', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId, 'manage');
    res.json(await removeMailboxAccess(req.user, account));
  }));

  app.get('/api/accounts/:accountId/messages', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId);
    const folder = roleOf(req.query.folder);
    if (folder === 'archive') {
      try {
        const archived = await listArchivedMessages(account.id, {
          cursor: req.query.cursor,
          query: req.query.q,
          unseenOnly: req.query.unseen === '1',
          limit: 50,
        });
        const unseenCount = archived.messages.filter((m) => !m.seen).length;
        return res.json({
          messages: archived.messages,
          nextCursor: archived.nextCursor,
          unseen: null,
          folderUnseen: unseenCount,
          inboxUnseen: null,
          total: archived.total,
          isFirebaseArchive: true,
        });
      } catch (err) {
        // IMAP arşiv klasörü denemesine geç
      }
    }
    const data = await listMessages(account, {
      role: folder,
      cursor: cursorOf(req.query.cursor),
      query: queryOf(req.query.q),
      unseenOnly: req.query.unseen === '1',
      fresh: req.query.fresh === '1',
    });
    rememberMessagesContacts(req.user.uid, data && data.messages, account.email, roleOf(req.query.folder) === 'sent').catch(() => undefined);
    res.json(data);
  }));

  app.get('/api/accounts/:accountId/preview', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId);
    const previewData = await inboxPreview(account, {
      limit: Number(req.query.limit) || 4,
      fresh: req.query.fresh === '1',
    });
    rememberMessagesContacts(req.user.uid, previewData && previewData.messages, account.email, false).catch(() => undefined);
    res.json(previewData);
  }));

  app.get('/api/accounts/:accountId/messages/:uid/attachments/:index', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId);
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0) throw publicError(404, 'Ek bulunamadı.');
    const folder = roleOf(req.query.folder);
    if (folder === 'archive') {
      try {
        const targetId = req.query.archiveId || uidOf(req.params.uid);
        const file = await readArchivedAttachment(account.id, targetId, index);
        const ascii = file.filename.replace(/[^\w.\- ]+/g, '_') || 'ek';
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
        res.setHeader('Content-Length', file.content.length);
        res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
        return res.send(file.content);
      } catch (err) {
        // IMAP eklenti okumasına geç
      }
    }
    const file = await readAttachment(account, {
      role: folder,
      uid: uidOf(req.params.uid),
      index,
    });
    const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content);
    const ascii = file.filename.replace(/[^\w.\- ]+/g, '_') || 'ek';
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.setHeader('Content-Length', content.length);
    res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
    res.send(content);
  }));

  app.get('/api/accounts/:accountId/messages/:uid', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId);
    const folder = roleOf(req.query.folder);
    if (folder === 'archive') {
      try {
        const targetId = req.query.archiveId || uidOf(req.params.uid);
        const msg = await readArchivedMessage(account.id, targetId);
        rememberMessagesContacts(req.user.uid, [msg], account.email, false).catch(() => undefined);
        return res.json(msg);
      } catch (err) {
        // IMAP ileti okumasına geç
      }
    }
    const message = await readMessage(account, {
      role: folder,
      uid: uidOf(req.params.uid),
      ensureSeen: req.query.markSeen === '1',
    });
    rememberMessagesContacts(req.user.uid, [message], account.email, roleOf(req.query.folder) === 'sent').catch(() => undefined);
    res.json(message);
  }));

  app.get('/api/accounts/:accountId/messages/:uid/raw', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId);
    const folder = roleOf(req.query.folder);
    const uid = uidOf(req.params.uid);
    const rawBuffer = await readRawMessage(account, { role: folder, uid });
    res.setHeader('Content-Type', 'message/rfc822');
    res.setHeader('Content-Disposition', `attachment; filename="message-${uid}.eml"`);
    res.setHeader('Content-Length', rawBuffer.length);
    res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
    res.send(rawBuffer);
  }));

  app.get('/api/accounts/:accountId/folders', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId);
    const folders = await listAllFolders(account);
    res.json({ folders });
  }));

  app.post('/api/accounts/:accountId/folders', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId);
    const name = String(req.body && req.body.name || '').trim();
    if (!name) throw publicError(400, 'Klasör adı gereklidir.');
    const result = await createCustomFolder(account, name);
    res.json(result);
  }));

  app.post('/api/accounts/:accountId/messages/:uid/quick-replies', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId);
    const folder = roleOf(req.query.folder);
    const uid = uidOf(req.params.uid);
    const message = await readMessage(account, { role: folder, uid });
    const replies = await generateQuickReplies(account, message);
    const list = Array.isArray(replies)
      ? replies
      : [replies?.positive?.body, replies?.inquiry?.body, replies?.decline?.body].filter(Boolean);
    res.json(Array.isArray(replies) ? { replies } : { ...replies, replies: list });
  }));

  app.post('/api/accounts/:accountId/messages/:uid/seen', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId);
    const folder = roleOf(req.body && req.body.folder);
    const seen = !(req.body && req.body.seen === false);
    if (folder === 'archive') {
      await setArchivedSeen(account.id, uidOf(req.params.uid), seen);
      return res.json({ ok: true });
    }
    await setSeen(account, {
      role: folder,
      uid: uidOf(req.params.uid),
      seen,
    });
    res.json({ ok: true });
  }));

  app.post('/api/accounts/:accountId/messages/:uid/delete', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId);
    const folder = roleOf(req.body && req.body.folder);
    if (folder === 'archive') {
      throw publicError(403, 'Firebase arşivindeki iletiler veri kaybını önlemek için silinemez (Salt Okunur Koruma).');
    }
    const result = await deleteMessage(account, {
      role: folder,
      uid: uidOf(req.params.uid),
    });
    res.json({ ok: true, permanent: Boolean(result && result.permanent) });
  }));

  app.post('/api/accounts/:accountId/messages/:uid/flag', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId);
    const folder = roleOf(req.body && req.body.folder);
    const flagged = !(req.body && req.body.flagged === false);
    if (folder === 'archive') {
      await setArchivedFlagged(account.id, uidOf(req.params.uid), flagged);
      return res.json({ ok: true });
    }
    await setFlagged(account, {
      role: folder,
      uid: uidOf(req.params.uid),
      flagged,
    });
    res.json({ ok: true });
  }));

  app.post('/api/accounts/:accountId/messages/:uid/move', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId);
    const sourceFolder = roleOf(req.body && req.body.folder);
    const destination = roleOf(req.body && req.body.destination);
    if (sourceFolder === 'archive') {
      if (destination === 'archive') return res.json({ ok: true });
      await restoreArchivedToInbox(account, uidOf(req.params.uid), destination);
      return res.json({ ok: true, restored: true });
    }
    if (destination === 'archive') {
      const result = await archiveSingleMessageDirect(account, {
        role: sourceFolder,
        uid: uidOf(req.params.uid),
      });
      return res.json({ ok: true, archived: true, result });
    }
    await moveMessage(account, {
      role: sourceFolder,
      uid: uidOf(req.params.uid),
      destination,
    });
    res.json({ ok: true });
  }));

  app.post('/api/accounts/:accountId/messages/bulk', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId);
    const body = req.body || {};
    const folder = roleOf(body.folder);
    const action = bulkActionOf(body.action);
    if (folder === 'archive') {
      if (action === 'delete' || action === 'empty') {
        throw publicError(403, 'Firebase arşivindeki iletiler veri kaybını önlemek için silinemez (Salt Okunur Koruma).');
      }
      const uids = Array.isArray(body.uids) ? body.uids.map(Number).filter((u) => Number.isInteger(u) && u > 0) : [];
      if (action === 'seen' || action === 'unseen') {
        for (const u of uids) await setArchivedSeen(account.id, u, action === 'seen');
        return res.json({ ok: true, count: uids.length });
      }
      if (action === 'star' || action === 'unstar') {
        for (const u of uids) await setArchivedFlagged(account.id, u, action === 'star');
        return res.json({ ok: true, count: uids.length });
      }
      if (action === 'move') {
        const dest = roleOf(body.destination);
        if (dest === 'archive') return res.json({ ok: true, count: 0 });
        for (const u of uids) await restoreArchivedToInbox(account, u, dest);
        return res.json({ ok: true, count: uids.length });
      }
      throw publicError(400, 'İşlem geçersiz.');
    }
    if (action === 'move' && body.destination === 'archive') {
      const result = await bulkArchive(account, {
        role: folder,
        uids: body.uids,
      });
      if (result.archivedCount === 0 && Array.isArray(result.errors) && result.errors.length > 0) {
        throw publicError(502, result.errors[0].error || 'İletiler arşivlenemedi.');
      }
      return res.json({ ok: true, count: result.archivedCount, archived: true, ...result });
    }
    res.json(await applyBulk(account, {
      role: folder,
      uids: body.uids,
      action,
      destination: action === 'move' ? roleOf(body.destination) : undefined,
    }));
  }));

  app.get('/api/accounts/:accountId/quota', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId, 'read');
    res.json(await getMailboxQuota(account));
  }));

  app.post('/api/accounts/:accountId/archive/run', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId);
    res.json(await bulkArchive(account, req.body || {}));
  }));

  app.get('/api/accounts/:accountId/archive/messages', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId, 'read');
    res.json(await listArchivedMessages(account.id, req.query || {}));
  }));

  app.get('/api/accounts/:accountId/archive/messages/:archiveId', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId, 'read');
    res.json(await readArchivedMessage(account.id, req.params.archiveId));
  }));

  app.get('/api/accounts/:accountId/archive/messages/:archiveId/attachments/:index', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId, 'read');
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0) throw publicError(404, 'Ek bulunamadı.');
    const file = await readArchivedAttachment(account.id, req.params.archiveId, index);
    const ascii = file.filename.replace(/[^\w.\- ]+/g, '_') || 'ek';
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.send(file.content);
  }));

  app.post('/api/accounts/:accountId/attachments', requireUser, (req, res, next) => {
    receiveFile(req, res, (err) => (err ? next(err) : next()));
  }, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId, 'send');
    const file = req.file;
    if (!file || !file.buffer || !file.buffer.length) throw publicError(400, 'Ek bilgisi geçersiz.');
    const staged = await stageAttachment({
      uid: req.user.uid,
      accountId: account.id,
      filename: file.originalname,
      contentType: file.mimetype,
      content: file.buffer,
    });
    res.json(staged);
  }));

  app.delete('/api/accounts/:accountId/attachments/:id', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId, 'send');
    await deleteStagedAttachment({ uid: req.user.uid, accountId: account.id, id: req.params.id });
    res.json({ ok: true });
  }));

  app.post('/api/accounts/:accountId/send', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId, 'send');
    if (!(await allowShared(`send:${req.user.uid}`, 300, 10 * 60 * 1000))) {
      return res.status(429).json({ error: 'Çok fazla gönderim. Biraz bekleyin.' });
    }
    const body = req.body || {};
    const mode = body.mode === 'reply' ? 'reply' : body.mode === 'forward' ? 'forward' : 'new';
    const listed = draftAttachmentsOf(body.attachments);
    const attachmentAccount = body.attachmentAccountId && String(body.attachmentAccountId) !== account.id
      ? await requireAccount(req.user.uid, String(body.attachmentAccountId), 'send')
      : account;
    const files = listed.length ? await resolveSendAttachments(attachmentAccount, req.user.uid, listed) : [];
    const shouldTrack = Boolean(body.track);
    const trackingId = shouldTrack ? generateTrackingId() : undefined;
    const result = await deliver(account, {
      mode,
      role: roleOf(body.folder),
      uid: mode === 'reply' ? uidOf(body.uid) : undefined,
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      body: body.body,
      htmlBody: body.htmlBody,
      attachments: files,
      trackingId,
    });
    if (result.ok) {
      if (trackingId) {
        await createTrackingRecord({
          trackingId,
          uid: req.user.uid,
          accountId: account.id,
          subject: body.subject,
          recipients: result.accepted || [],
        }).catch(() => undefined);
      }
      await rememberRecipients(req.user.uid, result.accepted).catch(() => undefined);
      if (body.keepAttachments !== true) {
        await Promise.all(listed.filter((file) => file.id).map((file) => deleteStagedAttachment({
          uid: req.user.uid,
          accountId: attachmentAccount.id,
          id: file.id,
        }).catch(() => undefined)));
      }
    }
    res.json(result);
  }));

  app.get('/api/accounts/:accountId/tracking', requireUser, wrap(async (req, res) => {
    const account = await requireAccount(req.user.uid, req.params.accountId, 'read');
    const summary = await getTrackingSummary(req.user.uid, account.id);
    res.json({ tracking: summary });
  }));

  app.get('/api/track/open/:trackingId.png', wrap(async (req, res) => {
    const trackingId = String(req.params.trackingId || '').replace(/\.png$/, '');
    const userAgent = req.get('user-agent') || '';
    if (trackingId) {
      recordOpen(trackingId, { userAgent }).catch(() => undefined);
    }
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.end(TRANSPARENT_PIXEL_GIF);
  }));

  app.get('/api/drafts', requireUser, wrap(async (req, res) => {
    const accountId = req.query.accountId ? String(req.query.accountId) : '';
    if (accountId) await requireAccount(req.user.uid, accountId);
    let draftQuery = admin.firestore().collection('drafts').doc(req.user.uid).collection('drafts');
    if (accountId) draftQuery = draftQuery.where('accountId', '==', accountId);
    const snap = await draftQuery.limit(80).get();
    const drafts = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data(), updatedAt: doc.get('updatedAt') && doc.get('updatedAt').toDate ? doc.get('updatedAt').toDate().toISOString() : null }))
      .filter((draft) => !accountId || draft.accountId === accountId)
      .sort((a, b) => draftTime(b.updatedAt) - draftTime(a.updatedAt))
      .slice(0, 40)
      .map((draft) => ({
        id: draft.id,
        accountId: draft.accountId || '',
        to: draft.to || '',
        cc: draft.cc || '',
        bcc: draft.bcc || '',
        subject: draft.subject || '',
        body: draft.body || '',
        attachments: Array.isArray(draft.attachments) ? draft.attachments : [],
        mode: draft.mode === 'forward' ? 'forward' : (draft.replyUid && isMailFolder(draft.replyFolder) ? 'reply' : 'new'),
        replyUid: draft.replyUid && isMailFolder(draft.replyFolder) ? draft.replyUid : null,
        replyFolder: draft.replyUid && isMailFolder(draft.replyFolder) ? draft.replyFolder : null,
        updatedAt: draft.updatedAt,
      }));
    res.json({ drafts });
  }));

  app.put('/api/drafts/:draftId', requireUser, wrap(async (req, res) => {
    const draftId = draftIdOf(req.params.draftId);
    const body = req.body || {};
    const accountId = String(body.accountId || '');
    await requireAccount(req.user.uid, accountId);
    const replyUid = body.replyUid ? uidOf(body.replyUid) : null;
    if (replyUid && !isMailFolder(body.replyFolder)) {
      throw publicError(400, 'Yanıtın kaynak klasörü geçersiz.');
    }
    const record = {
      accountId,
      to: textField(body.to, 250000),
      cc: textField(body.cc, 250000),
      bcc: textField(body.bcc, 250000),
      subject: textField(body.subject, 500),
      body: String(body.body || '').slice(0, 100000),
      attachments: draftAttachmentsOf(body.attachments),
      mode: body.mode === 'forward' ? 'forward' : (replyUid ? 'reply' : 'new'),
      replyUid,
      replyFolder: replyUid ? body.replyFolder : null,
      inReplyTo: '',
      references: '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await admin.firestore().collection('drafts').doc(req.user.uid).collection('drafts').doc(draftId).set(record, { merge: true });
    res.json({ ok: true, id: draftId });
  }));

  app.delete('/api/drafts/:draftId', requireUser, wrap(async (req, res) => {
    const draftId = draftIdOf(req.params.draftId);
    await admin.firestore().collection('drafts').doc(req.user.uid).collection('drafts').doc(draftId).delete();
    res.json({ ok: true });
  }));

  app.get('/api/settings', requireUser, wrap(async (req, res) => {
    res.json({ settings: await readSettings(req.user.uid) });
  }));

  app.put('/api/settings', requireUser, wrap(async (req, res) => {
    res.json({ settings: await writeSettings(req.user.uid, req.body || {}) });
  }));

  app.get('/api/admin/overview', requireUser, wrap(async (req, res) => {
    res.json(await getAdminOverview(req.user));
  }));

  app.post('/api/admin/invitations', requireUser, wrap(async (req, res) => {
    res.json(await inviteUser(req.user, req.body || {}));
  }));

  app.put('/api/admin/access', requireUser, wrap(async (req, res) => {
    res.json(await setUserAccess(req.user, req.body || {}));
  }));

  app.get('/api/messages/search', requireUser, wrap(async (req, res) => {
    if (!allow(`uid:${req.user.uid}:gsearch`, 20, 5 * 60 * 1000)) {
      return res.status(429).json({ error: 'Çok fazla küresel arama isteği. Biraz bekleyin.' });
    }
    const q = queryOf(req.query.q);
    if (!q) throw publicError(400, 'Arama ifadesi en az 2 karakter olmalıdır.');
    const folder = req.query.folder ? roleOf(req.query.folder) : 'inbox';
    const authorized = await listAuthorized(req.user.uid);
    const result = await searchAcrossAccounts(authorized, {
      role: folder,
      query: q,
      unseenOnly: req.query.unseen === '1',
      limit: Math.min(Math.max(Number(req.query.limit) || 60, 1), 150),
    });
    res.json(result);
  }));

  app.get('/api/scheduled', requireUser, wrap(async (req, res) => {
    const scheduled = await listScheduledEmails(req.user.uid);
    res.json({ scheduled });
  }));

  app.post('/api/scheduled', requireUser, wrap(async (req, res) => {
    if (!allow(`uid:${req.user.uid}:sched`, 30, 10 * 60 * 1000)) {
      return res.status(429).json({ error: 'Çok fazla zamanlanmış gönderim isteği. Biraz bekleyin.' });
    }
    res.json(await scheduleEmails(req.user.uid, req.body || {}));
  }));

  app.delete('/api/scheduled/:scheduledId', requireUser, wrap(async (req, res) => {
    res.json(await cancelScheduledEmail(req.user.uid, req.params.scheduledId));
  }));

  app.post('/api/scheduled/:scheduledId/send-now', requireUser, wrap(async (req, res) => {
    if (!allow(`uid:${req.user.uid}:send`, 30, 10 * 60 * 1000)) {
      return res.status(429).json({ error: 'Gönderim sınırı aşıldı. Biraz bekleyin.' });
    }
    res.json(await sendScheduledEmailNow(req.user.uid, req.params.scheduledId));
  }));

  app.post('/api/erp/upload', requireUser, (req, res, next) => {
    receiveFile(req, res, (err) => (err ? next(err) : next()));
  }, wrap(async (req, res) => {
    const email = String(req.user.email || '').trim().toLowerCase();
    const superAdmins = new Set([
      'cebrailkara@gmail.com',
      'hayrullahcingoz81@gmail.com',
      'yalinizlargrup@gmail.com',
      'ilkeryaliniz@gmail.com',
      'info@kuzeydenizinsaat.com.tr',
      'info@kuzeydeniziyapi.com.tr',
      'info@cukurovabartu.com.tr',
    ]);
    let canUpload = superAdmins.has(email);
    let userData = null;
    if (!canUpload && email) {
      const dbRef = admin.firestore();
      const [userSnap, adminSnap] = await Promise.all([
        dbRef.collection('users').doc(email).get(),
        dbRef.collection('authorized_admins').doc(email).get(),
      ]);
      userData = userSnap.exists ? userSnap.data() : null;
      canUpload =
        (userSnap.exists && userData?.active !== false && userData?.roleId !== 'salt_okunur') ||
        adminSnap.exists;
    }
    if (!canUpload) {
      throw publicError(403, 'ERP dosya yükleme yetkiniz bulunmuyor.');
    }

    const file = req.file;
    if (!file || !file.buffer || !file.buffer.length) {
      throw publicError(400, 'Yüklenecek dosya geçersiz.');
    }
    if (file.buffer.length > 20 * 1024 * 1024) {
      throw publicError(400, 'Dosya boyutu 20 MB sınırını aşamaz.');
    }

    const originalName = String(file.originalname || 'dosya').replace(/[^\w.\-()]+/g, '_');
    const lower = originalName.toLowerCase();
    const mime = String(file.mimetype || 'application/octet-stream');
    const allowedExts = ['.jpg', '.jpeg', '.png', '.heic', '.webp', '.pdf', '.xml'];
    const allowedMimes = ['image/', 'application/pdf', 'text/xml', 'application/xml'];
    if (!allowedExts.some((ext) => lower.endsWith(ext)) && !allowedMimes.some((m) => mime.startsWith(m))) {
      throw publicError(400, 'Desteklenmeyen dosya türü.');
    }

    const requestedPath = String(req.body?.path || `uploads/${Date.now()}-${originalName}`)
      .replace(/^\/+/, '')
      .replace(/\.\./g, '')
      .replace(/[^\w.\-/]/g, '_');

    const roleId = superAdmins.has(email) ? 'sirket_sahibi' : String(userData?.roleId || 'salt_okunur');
    const projectScopedRoles = new Set(['proje_muduru', 'santiye_sefi', 'saha_personeli']);
    let isolatedRelativePath = requestedPath;
    if (!superAdmins.has(email) && projectScopedRoles.has(roleId)) {
      const assigned = Array.isArray(userData?.assignedProjectIds)
        ? userData.assignedProjectIds.map(String)
        : [];
      if (assigned.length === 0) {
        throw publicError(403, 'Dosya yüklemek için atanmış yetkili proje bulunmuyor.');
      }
      const segments = requestedPath.split('/').filter(Boolean);
      const explicitProjectId = String(req.body?.projectId || '').trim();
      const isInvoiceStage =
        segments[0] === 'invoices' && (segments[1] === 'originals' || segments[1] === 'previews');
      if (explicitProjectId && !assigned.includes(explicitProjectId)) {
        throw publicError(403, 'Bu projeye dosya yükleme yetkiniz yok.');
      }
      if (isInvoiceStage) {
        isolatedRelativePath = `users/${req.user.uid}/${requestedPath}`;
      } else if (
        segments.length >= 2 &&
        ['projects', 'documents', 'sitelogs', 'invoices'].includes(segments[0]) &&
        !assigned.includes(segments[1])
      ) {
        throw publicError(403, 'Bu projeye dosya yükleme yetkiniz yok.');
      }
    }

    const fullPath = `cukurovabartu/${isolatedRelativePath}`;
    const bucketName = 'finansarena-bdae9.firebasestorage.app';
    const token = crypto.randomUUID();
    const fileObj = admin.storage().bucket(bucketName).file(fullPath);

    await fileObj.save(file.buffer, {
      resumable: false,
      contentType: mime,
      metadata: {
        contentType: mime,
        metadata: {
          firebaseStorageDownloadTokens: token,
          uploadedBy: email,
          roleId,
        },
      },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(fullPath)}?alt=media&token=${token}`;
    res.json({ ok: true, url, path: fullPath });
  }));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'İstek bulunamadı' });
  });

  app.use((err, _req, res, _next) => {
    const mapped = toClient(err);
    if (!err || !err.public) {
      console.error(JSON.stringify({ event: 'api_error', code: (err && err.code) || 'ERR', status: mapped.status }));
    }
    res.status(mapped.status).json({ error: mapped.error });
  });

  return app;
}

module.exports = { createApp, roleOf, queryOf };
