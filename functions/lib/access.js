const admin = require('./firestore-db').withDatabase(require('firebase-admin'));
const { publicError } = require('./errors');
const { getAccount, publicAccount, mailAccountRecord, accountsFromEnv, accountFromRecord, isAccountId, withStoredName } = require('./accounts');
const { readStoredPassword } = require('./secret-box');

function db() {
  return admin.firestore();
}

const SUPER_ADMIN_EMAILS = new Set([
  'cebrailkara@gmail.com',
  'hayrullahcingoz81@gmail.com',
  'yalinizlargrup@gmail.com',
  'ilkeryaliniz@gmail.com',
  'info@kuzeydenizinsaat.com.tr',
  'info@kuzeydeniziyapi.com.tr',
  'info@cukurovabartu.com.tr',
]);

function isAdmin(user) {
  if (!user) return false;
  const email = String(user.email || '').trim().toLowerCase();
  if (user.mailAdmin === true) return true;
  if (email && SUPER_ADMIN_EMAILS.has(email)) return true;
  if (user.emailVerified !== true && process.env.FUNCTIONS_EMULATOR !== 'true') return false;
  const configured = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  return Boolean(configured && email === configured);
}

function requireAdmin(user) {
  if (!isAdmin(user)) throw publicError(403, 'Bu işlem için yönetici yetkisi gerekiyor.');
}

// Adding a mailbox creates an isolated, encrypted account scoped strictly to
// the caller's ownerUid and userMailAccess. Permitted for administrators,
// configured creator allow-lists, or any authenticated user when no restrictive
// allow-list is configured.
function canCreateMailbox(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const email = String(user.email || '').trim().toLowerCase();
  if (email && SUPER_ADMIN_EMAILS.has(email)) return true;
  const allowed = String(process.env.MAILBOX_CREATOR_EMAILS || '')
    .split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (allowed.length > 0) {
    if (user.emailVerified !== true && process.env.FUNCTIONS_EMULATOR !== 'true') return false;
    return Boolean(email && allowed.includes(email));
  }
  return Boolean(user.uid || email);
}

function grantPermissions(record) {
  if (!record || record.permissions == null) return { read: true, send: true, manage: false };
  const permissions = record.permissions;
  return {
    read: permissions.read === true,
    send: permissions.send === true,
    manage: permissions.manage === true,
  };
}

const userUpsertCache = new Map();
const UPSERT_TTL_MS = 5 * 60 * 1000;

async function upsertUser(user) {
  const email = user.email || '';
  const displayName = user.name || '';
  const cached = userUpsertCache.get(user.uid);
  const now = Date.now();
  if (cached && now - cached.at < UPSERT_TTL_MS && cached.email === email && cached.displayName === displayName) {
    return;
  }
  const ref = db().collection('mailUsers').doc(user.uid);
  const snap = await ref.get();
  const data = {
    email,
    displayName,
    lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!snap.exists) data.createdAt = admin.firestore.FieldValue.serverTimestamp();
  await ref.set(data, { merge: true });
  userUpsertCache.set(user.uid, { at: now, email, displayName });
}

async function maybeBootstrap(user) {
  const adminEmail = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!adminEmail || String(user.email || '').toLowerCase() !== adminEmail) return;
  if (process.env.FUNCTIONS_EMULATOR !== 'true' && !user.emailVerified) return;
  const batchWrites = accountsFromEnv(process.env);
  const store = db();
  for (const account of batchWrites) {
    const accountRef = store.collection('mailAccounts').doc(account.id);
    const accessRef = store.collection('userMailAccess').doc(user.uid).collection('accounts').doc(account.id);
    const bootstrapRef = store.collection('mailBootstrap').doc(account.id);
    await store.runTransaction(async (transaction) => {
      const [bootstrap, existingAccount, existingAccess] = await Promise.all([
        transaction.get(bootstrapRef),
        transaction.get(accountRef),
        transaction.get(accessRef),
      ]);
      if (bootstrap.exists) return;
      // Existing accounts may have been disabled or had access revoked before
      // bootstrap tracking was introduced; leave their authorization untouched.
      if (!existingAccount.exists) {
        transaction.create(accountRef, mailAccountRecord(account));
        if (!existingAccess.exists) {
          transaction.create(accessRef, {
            grantedAt: admin.firestore.FieldValue.serverTimestamp(),
            grantedBy: 'bootstrap',
            permissions: { read: true, send: true, manage: true },
          });
        }
      }
      transaction.create(bootstrapRef, {
        initializedAt: admin.firestore.FieldValue.serverTimestamp(),
        initializedBy: user.uid,
      });
    });
  }
}

function withConnectionMeta(account, meta) {
  if (!account) return null;
  const data = meta && typeof meta.data === 'function' ? meta.data() : meta;
  return {
    ...account,
    enabled: !(data && data.enabled === false),
    lastOkAt: data && data.lastOkAt && data.lastOkAt.toDate ? data.lastOkAt.toDate().toISOString() : null,
    lastError: String((data && data.lastError) || '').slice(0, 180),
  };
}

const ACCOUNT_CACHE_TTL_MS = 60 * 1000;
const ACCESS_CACHE_TTL_MS = 30 * 1000;
const accountCache = new Map();
const accessCache = new Map();

function invalidateAccount(accountId) {
  if (accountId) {
    accountCache.delete(accountId);
  } else {
    accountCache.clear();
  }
}

function invalidateAccess(uid, accountId) {
  if (uid && accountId) {
    accessCache.delete(`${uid}:${accountId}`);
  } else if (uid) {
    for (const key of accessCache.keys()) {
      if (key.startsWith(`${uid}:`)) accessCache.delete(key);
    }
  } else {
    accessCache.clear();
  }
}

async function resolveAccount(accountId, { includeDisabled } = {}) {
  if (!isAccountId(accountId)) return null;
  const now = Date.now();
  const cached = accountCache.get(accountId);
  if (cached && cached.expires > now) {
    if (cached.account.enabled === false && !includeDisabled) return null;
    return cached.account;
  }
  const fromEnv = getAccount(accountId);
  if (fromEnv) {
    const meta = await db().collection('mailAccounts').doc(accountId).get();
    if (meta.exists && meta.get('enabled') === false && !includeDisabled) return null;
    const resolved = withConnectionMeta(withStoredName(fromEnv, meta.exists ? meta.data() : null), meta.exists ? meta : null);
    if (resolved) {
      accountCache.set(accountId, { account: resolved, expires: now + ACCOUNT_CACHE_TTL_MS });
    }
    return resolved;
  }
  const [meta, secret] = await Promise.all([
    db().collection('mailAccounts').doc(accountId).get(),
    db().collection('mailSecrets').doc(accountId).get(),
  ]);
  if (!meta.exists || !secret.exists) return null;
  const resolved = withConnectionMeta(accountFromRecord(accountId, meta.data(), readStoredPassword(secret.get('password'))), meta);
  if (resolved) {
    accountCache.set(accountId, { account: resolved, expires: now + ACCOUNT_CACHE_TTL_MS });
  }
  if (meta.get('enabled') === false && !includeDisabled) return null;
  return resolved;
}

async function listAuthorized(uid) {
  const snap = await db().collection('userMailAccess').doc(uid).collection('accounts').get();
  const rows = await Promise.all(snap.docs.map(async (doc) => {
    const permissions = grantPermissions(doc.data());
    if (!permissions.read && !permissions.send && !permissions.manage) return null;
    const account = await resolveAccount(doc.id, { includeDisabled: true });
    return account ? { ...publicAccount(account), permissions } : null;
  }));
  return rows.filter(Boolean);
}

async function requireAccount(uid, accountId, permission = 'read', { allowDisabled } = {}) {
  if (!['read', 'send', 'manage'].includes(permission)) throw publicError(403, 'Bu işlem için yetkiniz yok.');
  const cacheKey = `${uid}:${accountId}`;
  const now = Date.now();
  let permissions;
  const cachedAccess = accessCache.get(cacheKey);
  if (cachedAccess && cachedAccess.expires > now) {
    permissions = cachedAccess.permissions;
  } else {
    const access = await db().collection('userMailAccess').doc(uid).collection('accounts').doc(accountId).get();
    if (!access.exists) throw publicError(403, 'Bu hesaba erişiminiz yok.');
    permissions = grantPermissions(access.data());
    accessCache.set(cacheKey, { permissions, expires: now + ACCESS_CACHE_TTL_MS });
  }
  if (!permissions[permission]) throw publicError(403, 'Bu işlem için yetkiniz yok.');
  const account = await resolveAccount(accountId, { includeDisabled: allowDisabled || permission === 'manage' });
  if (!account) throw publicError(403, 'Bu hesaba erişiminiz yok.');
  if (account.enabled === false && !allowDisabled && permission !== 'manage') {
    throw publicError(403, 'Bu hesap pasif. Ayarlardan etkinleştirin.');
  }
  return account;
}

async function acceptInvitations(user) {
  return require('./admin-management').acceptInvitations(user);
}

module.exports = {
  upsertUser,
  maybeBootstrap,
  listAuthorized,
  requireAccount,
  resolveAccount,
  invalidateAccount,
  invalidateAccess,
  isAdmin,
  requireAdmin,
  canCreateMailbox,
  grantPermissions,
  acceptInvitations,
};
