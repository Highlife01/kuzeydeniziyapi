const admin = require('./firestore-db').withDatabase(require('firebase-admin'));
const { publicError } = require('./errors');
const { accountsFromEnv, getAccount, isAccountId } = require('./accounts');
const { requireAdmin, grantPermissions, invalidateAccount, invalidateAccess } = require('./access');

function timestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function emailOf(value) {
  if (typeof value !== 'string') throw publicError(400, 'E-posta adresi geçersiz.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    throw publicError(400, 'E-posta adresi geçersiz.');
  }
  return email;
}

function uidOf(value) {
  if (typeof value !== 'string' || !value || value.length > 128 || /[/\\\u0000-\u001f\u007f]/.test(value)) {
    throw publicError(400, 'Kullanıcı geçersiz.');
  }
  return value;
}

function accountOf(value) {
  if (typeof value !== 'string' || (!getAccount(value) && !isAccountId(value))) throw publicError(400, 'Posta hesabı geçersiz.');
  return value;
}

function permissionsOf(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((key) => !['read', 'send', 'manage'].includes(key))
    || Object.values(value).some((item) => typeof item !== 'boolean')) {
    throw publicError(400, 'İzinler geçersiz.');
  }
  return { read: value.read === true, send: value.send === true, manage: value.manage === true };
}

function audit(store, writer, user, action, target) {
  writer.create(store.collection('mailAudit').doc(), {
    actor: String(user.email || user.uid), action, target,
    createdAt: timestamp(),
  });
}

function iso(value) {
  if (!value) return null;
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function getAdminOverview(user) {
  requireAdmin(user);
  const store = admin.firestore();
  const [userRows, accountRows, accessRows, invitationRows, auditRows] = await Promise.all([
    store.collection('mailUsers').get(),
    store.collection('mailAccounts').get(),
    store.collectionGroup('accounts').get(),
    store.collection('mailInvitations').orderBy('createdAt', 'desc').limit(200).get(),
    store.collection('mailAudit').orderBy('createdAt', 'desc').limit(100).get(),
  ]);
  const configured = accountsFromEnv(process.env);
  const metadata = new Map(accountRows.docs.map((row) => [row.id, row.data()]));
  const allAccounts = [
    ...configured.map((account) => ({
      id: account.id,
      email: account.email,
      displayName: metadata.get(account.id)?.displayName || account.displayName,
      enabled: metadata.get(account.id)?.enabled !== false,
    })),
    ...accountRows.docs
      .filter((row) => isAccountId(row.id) && !configured.some((c) => c.id === row.id))
      .map((row) => {
        const d = row.data() || {};
        return {
          id: row.id,
          email: String(d.imapUser || d.email || ''),
          displayName: String(d.displayName || d.imapUser || row.id),
          enabled: d.enabled !== false,
        };
      }),
  ];
  const accountIds = new Set(allAccounts.map((account) => account.id));
  const users = new Map(userRows.docs.map((row) => [row.id, {
    uid: row.id, email: String(row.get('email') || ''), displayName: String(row.get('displayName') || ''),
  }]));
  const grants = [];
  for (const row of accessRows.docs) {
    const match = row.ref.path.match(/^userMailAccess\/([^/]+)\/accounts\/([^/]+)$/);
    if (!match || !accountIds.has(match[2])) continue;
    if (!users.has(match[1])) users.set(match[1], { uid: match[1], email: '', displayName: '' });
    grants.push({ uid: match[1], accountId: match[2], permissions: grantPermissions(row.data()) });
  }
  return {
    users: [...users.values()],
    accounts: allAccounts,
    grants,
    invitations: invitationRows.docs.map((row) => ({
      id: row.id, email: String(row.get('email') || ''),
      accountIds: (Array.isArray(row.get('accountIds')) ? row.get('accountIds') : []).filter((id) => accountIds.has(id)),
      permissions: grantPermissions(row.data()), status: String(row.get('status') || 'pending'),
    })),
    audit: auditRows.docs.map((row) => ({
      id: row.id, actor: String(row.get('actor') || ''), action: String(row.get('action') || ''),
      target: String(row.get('target') || ''), createdAt: iso(row.get('createdAt')),
    })),
  };
}

async function inviteUser(user, input = {}) {
  requireAdmin(user);
  const email = emailOf(input.email);
  if (!Array.isArray(input.accountIds) || !input.accountIds.length || input.accountIds.length > 25) {
    throw publicError(400, 'En az bir posta hesabı seçin.');
  }
  const accountIds = [...new Set(input.accountIds.map(accountOf))];
  const permissions = permissionsOf(input.permissions);
  if (!Object.values(permissions).some(Boolean)) throw publicError(400, 'En az bir izin seçin.');
  let knownUser = null;
  try { knownUser = await admin.auth().getUserByEmail(email); } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }
  const store = admin.firestore();
  const invitation = store.collection('mailInvitations').doc();
  const batch = store.batch();
  batch.create(invitation, {
    email, accountIds, permissions, status: knownUser ? 'accepted' : 'pending',
    createdAt: timestamp(), createdBy: user.uid,
    ...(knownUser ? { acceptedBy: knownUser.uid, acceptedAt: timestamp() } : {}),
  });
  if (knownUser) {
    batch.set(store.collection('mailUsers').doc(knownUser.uid), {
      email: knownUser.email || email, displayName: knownUser.displayName || '',
    }, { merge: true });
    for (const accountId of accountIds) {
      batch.set(store.collection('userMailAccess').doc(knownUser.uid).collection('accounts').doc(accountId), {
        permissions, grantedBy: user.uid, grantedAt: timestamp(),
      });
    }
  }
  audit(store, batch, user, 'invitation.created', email);
  await batch.commit();
  return { invitationId: invitation.id, email, accountIds, permissions, status: knownUser ? 'accepted' : 'pending' };
}

async function acceptInvitations(user) {
  if (!user || user.emailVerified !== true || !user.email) return { accepted: 0 };
  const email = emailOf(user.email);
  const store = admin.firestore();
  const pending = await store.collection('mailInvitations').where('email', '==', email).where('status', '==', 'pending').get();
  let accepted = 0;
  for (const row of pending.docs) {
    const changed = await store.runTransaction(async (transaction) => {
      const current = await transaction.get(row.ref);
      if (!current.exists || current.get('status') !== 'pending' || current.get('email') !== email) return false;
      const data = current.data();
      const accountIds = Array.isArray(data.accountIds) ? data.accountIds.filter((id) => getAccount(id) || isAccountId(id)) : [];
      const permissions = permissionsOf(data.permissions);
      const refs = accountIds.map((accountId) => store.collection('userMailAccess').doc(user.uid).collection('accounts').doc(accountId));
      const existing = await Promise.all(refs.map((ref) => transaction.get(ref)));
      for (let i = 0; i < refs.length; i += 1) {
        // A pending invitation must never replace an administrator's newer grant.
        if (!existing[i].exists) transaction.create(refs[i], {
          permissions, grantedBy: data.createdBy || 'invitation', grantedAt: timestamp(),
        });
      }
      transaction.update(row.ref, { status: 'accepted', acceptedBy: user.uid, acceptedAt: timestamp() });
      audit(store, transaction, user, 'invitation.accepted', row.id);
      return true;
    });
    if (changed) accepted += 1;
  }
  return { accepted };
}

async function setUserAccess(user, input = {}) {
  requireAdmin(user);
  const uid = uidOf(input.uid);
  const accountId = accountOf(input.accountId);
  const permissions = input.permissions === null ? null : permissionsOf(input.permissions);
  const store = admin.firestore();
  const batch = store.batch();
  const reference = store.collection('userMailAccess').doc(uid).collection('accounts').doc(accountId);
  if (permissions) batch.set(reference, { permissions, grantedBy: user.uid, grantedAt: timestamp() });
  else batch.delete(reference);
  audit(store, batch, user, permissions ? 'access.updated' : 'access.revoked', `${uid}:${accountId}`);
  await batch.commit();
  invalidateAccess(uid, accountId);
  return { ok: true };
}

async function setAccountEnabled(user, input = {}) {
  requireAdmin(user);
  const accountId = accountOf(input.accountId);
  if (typeof input.enabled !== 'boolean') throw publicError(400, 'Hesap durumu geçersiz.');
  const store = admin.firestore();
  const batch = store.batch();
  batch.set(store.collection('mailAccounts').doc(accountId), { enabled: input.enabled }, { merge: true });
  audit(store, batch, user, input.enabled ? 'account.enabled' : 'account.disabled', accountId);
  await batch.commit();
  invalidateAccount(accountId);
  return { ok: true };
}

module.exports = { getAdminOverview, inviteUser, acceptInvitations, setUserAccess, setAccountEnabled };
