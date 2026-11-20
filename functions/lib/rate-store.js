const { createHash } = require('node:crypto');
const admin = require('./firestore-db').withDatabase(require('firebase-admin'));
const { publicError } = require('./errors');

// Fixed-window counter shared by every function instance. Used only for the
// expensive/abusable routes (sending mail, adding mailboxes); the in-memory
// limiter in rate.js still handles general request floods cheaply.
// Configure a Firestore TTL policy on rateLimits.expiresAt to purge old docs.
async function allowShared(key, limit, windowMs, { now = Date.now } = {}) {
  const windowIndex = Math.floor(now() / windowMs);
  const id = `${createHash('sha256').update(String(key)).digest('hex').slice(0, 40)}_${windowIndex}`;
  try {
    const store = admin.firestore();
    const ref = store.collection('rateLimits').doc(id);
    return await store.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      const count = snap.exists ? Number(snap.get('count')) || 0 : 0;
      if (count >= limit) return false;
      transaction.set(ref, {
        count: count + 1,
        expiresAt: admin.firestore.Timestamp.fromMillis((windowIndex + 2) * windowMs),
      }, { merge: true });
      return true;
    });
  } catch (err) {
    console.error(JSON.stringify({ event: 'shared_rate_error', code: (err && err.code) || 'ERR' }));
    throw publicError(503, 'İşlem geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
  }
}

module.exports = { allowShared };
