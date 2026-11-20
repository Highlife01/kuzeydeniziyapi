const { randomUUID } = require('node:crypto');
const admin = require('./firestore-db').withDatabase(require('firebase-admin'));
const { publicError } = require('./errors');
const { sealSecret } = require('./secret-box');
const { withImap } = require('./imap-mail');
const { invalidateAccount, invalidateAccess } = require('./access');
const {
  mailboxEmail,
  serversForMailbox,
  mailAccountRecord,
  publicAccount,
  accountFromRecord,
  cleanDisplayName,
} = require('./accounts');

const MAX_MAILBOXES = 60;

function db() {
  return admin.firestore();
}

function authFailure(err) {
  const code = String((err && (err.authenticationFailed || err.code)) || '');
  const text = String((err && err.message) || '');
  return /auth/i.test(code) || /authentication/i.test(text) || code === 'EAUTH';
}

function tlsFailure(err) {
  const code = String((err && err.code) || '');
  const text = String((err && err.message) || '');
  return /CERT|UNABLE_TO_VERIFY|DEPTH_ZERO|self.signed|ERR_TLS/i.test(`${code} ${text}`);
}

function timeoutFailure(err) {
  const code = String((err && err.code) || '');
  const text = String((err && err.message) || '');
  return /ETIMEDOUT|ESOCKETTIMEDOUT|timeout|ETIME/i.test(`${code} ${text}`);
}

function hostFailure(err) {
  const code = String((err && err.code) || '');
  return /ENOTFOUND|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH/i.test(code);
}

async function verifyMailbox(account) {
  try {
    await withImap(account, async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      lock.release();
    });
  } catch (err) {
    if (err && err.public) throw err;
    if (authFailure(err)) {
      if (account && account.imapHost === 'imap.gmail.com') {
        if (String(account.password || '').startsWith('oauth2:')) {
          throw publicError(401, 'Google OAuth oturumu doğrulanamadı veya süresi doldu. Lütfen "Google ile Gmail Bağla" düğmesiyle yeniden izin verin.');
        }
        throw publicError(401, 'Gmail için normal şifre yerine 16 haneli Google Uygulama Şifresi girilmelidir (myaccount.google.com/apppasswords).');
      }
      throw publicError(401, 'E-posta veya şifre hatalı.');
    }
    throw publicError(502, 'Bağlantı hatası');
  }
}

function mailboxInput(body = {}) {
  const email = mailboxEmail(body.email);
  const password = String(body.password || '');
  const preset = ['kurumsal', 'gmail', 'yandex', 'custom'].includes(body.preset) ? body.preset : 'domain';
  const custom = {
    imapHost: body.imapHost,
    imapPort: body.imapPort,
    smtpHost: body.smtpHost,
    smtpPort: body.smtpPort,
  };
  const oauthToken = String(body.oauthAccessToken || (password.startsWith('oauth2:') ? password.slice(7) : '')).trim();
  if (oauthToken) {
    if (!email) throw publicError(400, 'E-posta adresi geçersiz.');
    if (oauthToken.length < 16 || oauthToken.length > 2048 || /[\r\n\s]/.test(oauthToken)) {
      throw publicError(400, 'Google OAuth erişim anahtarı geçersiz.');
    }
    const gmailServers = serversForMailbox(email, 'gmail');
    if (!gmailServers) throw publicError(400, 'E-posta adresi geçersiz.');
    return {
      displayName: cleanDisplayName(body.displayName, email.split('@')[0]) || email.split('@')[0],
      email,
      password: `oauth2:${oauthToken}`,
      ...gmailServers,
    };
  }
  const servers = email ? serversForMailbox(email, preset, custom) : null;
  if (servers && servers.imapHost === 'imap.gmail.com' && !/[\r\n]/.test(password) && /^[a-zA-Z0-9]{16}$/.test(password.replace(/[ \t]+/g, ''))) {
    return {
      displayName: cleanDisplayName(body.displayName, email.split('@')[0]) || email.split('@')[0],
      email,
      password: password.replace(/[ \t]+/g, ''),
      ...servers,
    };
  }
  if (!email || !servers) throw publicError(400, 'E-posta adresi geçersiz.');
  if (!password || password.length < 4 || password.length > 256 || /[\r\n]/.test(password)) {
    throw publicError(400, 'Posta şifresi geçersiz.');
  }
  const displayName = cleanDisplayName(body.displayName, email.split('@')[0]);
  return {
    displayName: displayName || email.split('@')[0],
    email,
    password,
    ...servers,
  };
}

async function createMailbox(user, body, hooks = {}) {
  const verify = hooks.verify || verifyMailbox;
  const verifyOut = Object.hasOwn(hooks, 'verifyOut')
    ? hooks.verifyOut
    : (hooks.verify ? async () => {} : require('./smtp-mail').verifySmtp);
  const input = mailboxInput(body);
  const store = db();
  const access = store.collection('userMailAccess').doc(user.uid).collection('accounts');
  const existing = await access.get();
  let matchedId = null;
  if (Array.isArray(existing.docs) && existing.docs.length > 0) {
    const targetEmail = input.email.toLowerCase();
    const lookups = await Promise.all(
      existing.docs.map(async (doc) => {
        const ref = store.collection('mailAccounts').doc(doc.id);
        if (typeof ref.get !== 'function') return null;
        const snap = await ref.get();
        const data = snap && snap.exists && typeof snap.data === 'function' ? snap.data() : null;
        return data && data.ownerUid === user.uid && String(data.imapUser || '').toLowerCase() === targetEmail
          ? doc.id
          : null;
      })
    );
    matchedId = lookups.find(Boolean) || null;
  }
  if (!matchedId && existing.size >= MAX_MAILBOXES) throw publicError(400, 'En fazla 60 posta hesabı ekleyebilirsiniz.');
  const accountId = matchedId || `mbox-${randomUUID()}`;
  const account = accountFromRecord(accountId, {
    displayName: input.displayName,
    imapUser: input.email,
    imapHost: input.imapHost,
    imapPort: input.imapPort,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
  }, input.password);
  if (!account) throw publicError(400, 'E-posta adresi geçersiz.');
  try {
    await verify(account);
  } catch (err) {
    throw publicError((err && err.status) || 502, `IMAP bağlantısı başarısız: ${connectionError(err)}`);
  }
  try {
    if (verifyOut) await verifyOut(account);
  } catch (err) {
    throw publicError((err && err.status) || 502, `SMTP bağlantısı başarısız: ${connectionError(err)}`);
  }
  const sealed = sealSecret(input.password);
  if (matchedId) {
    await Promise.all([
      store.collection('mailAccounts').doc(accountId).set({
        ...mailAccountRecord(account),
        lastError: '',
        lastOkAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }),
      store.collection('mailSecrets').doc(accountId).set({
        password: sealed,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }),
    ]);
    return publicAccount(account);
  }
  // Re-count inside the transaction: verification takes seconds, so parallel
  // requests could otherwise all pass the early check and exceed the cap.
  await store.runTransaction(async (transaction) => {
    const current = await transaction.get(access);
    if (current.size >= MAX_MAILBOXES) throw publicError(400, 'En fazla 60 posta hesabı ekleyebilirsiniz.');
    transaction.create(store.collection('mailAccounts').doc(accountId), {
      ...mailAccountRecord(account),
      ownerUid: user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.create(store.collection('mailSecrets').doc(accountId), {
      password: sealed,
      ownerUid: user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.create(access.doc(accountId), {
      grantedAt: admin.firestore.FieldValue.serverTimestamp(),
      grantedBy: user.uid,
      permissions: { read: true, send: true, manage: true },
    });
  });
  return publicAccount(account);
}

async function updateMailboxName(account, displayName) {
  const name = cleanDisplayName(displayName);
  if (!name) throw publicError(400, 'Görünen ad boş olamaz.');
  await db().collection('mailAccounts').doc(account.id).set({
    displayName: name,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  invalidateAccount(account.id);
  return publicAccount({ ...account, displayName: name });
}

function connectionError(err) {
  if (authFailure(err)) return 'Kullanıcı adı veya şifre hatalı.';
  if (tlsFailure(err)) return 'TLS sertifikası geçersiz.';
  if (timeoutFailure(err)) return 'Sunucu yanıt vermiyor.';
  if (hostFailure(err)) return 'Sunucuya bağlanılamadı.';
  if (err && err.public) return err.message;
  return 'Bağlantı hatası';
}

async function recordConnection(account, result) {
  const lastError = result.ok ? '' : [result.imap && !result.imap.ok ? `IMAP: ${result.imap.error}` : '', result.smtp && !result.smtp.ok ? `SMTP: ${result.smtp.error}` : ''].filter(Boolean).join(' · ');
  await db().collection('mailAccounts').doc(account.id).set({
    lastError,
    lastImapOk: Boolean(result.imap && result.imap.ok),
    lastSmtpOk: Boolean(result.smtp && result.smtp.ok),
    ...(result.ok ? { lastOkAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  invalidateAccount(account.id);
}

async function probe(fn, account) {
  try {
    await fn(account);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: connectionError(err) };
  }
}

async function testMailboxConnection(account, { checkImap = verifyMailbox, checkSmtp } = {}) {
  const smtpCheck = checkSmtp || require('./smtp-mail').verifySmtp;
  const [imap, smtp] = await Promise.all([probe(checkImap, account), probe(smtpCheck, account)]);
  const result = { ok: imap.ok && smtp.ok, imap, smtp };
  try { await recordConnection(account, result); } catch { /* durum yazılamazsa test sonucu yine döner */ }
  return result;
}

async function setMailboxEnabled(account, enabled) {
  await db().collection('mailAccounts').doc(account.id).set({
    enabled: enabled !== false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  invalidateAccount(account.id);
  return publicAccount({ ...account, enabled: enabled !== false });
}

async function removeMailboxAccess(user, account) {
  const store = db();
  await store.collection('userMailAccess').doc(user.uid).collection('accounts').doc(account.id).delete();
  invalidateAccount(account.id);
  invalidateAccess(user.uid, account.id);
  if (!String(account.id).startsWith('mbox-')) return { ok: true, disabled: false };
  const meta = await store.collection('mailAccounts').doc(account.id).get();
  if (!meta.exists || meta.get('ownerUid') !== user.uid) return { ok: true, disabled: false };
  await store.collection('mailAccounts').doc(account.id).set({
    enabled: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  await store.collection('mailSecrets').doc(account.id).delete();
  return { ok: true, disabled: true };
}

module.exports = {
  mailboxInput,
  createMailbox,
  verifyMailbox,
  updateMailboxName,
  testMailboxConnection,
  setMailboxEnabled,
  removeMailboxAccess,
  connectionError,
  MAX_MAILBOXES,
};
