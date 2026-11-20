const crypto = require('node:crypto');
const admin = require('./firestore-db').withDatabase(require('firebase-admin'));

function db() {
  return admin.firestore();
}

function generateTrackingId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 1x1 şeffaf GIF pikselleri
 */
const TRANSPARENT_PIXEL_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

async function createTrackingRecord({ trackingId, uid, accountId, subject, recipients }) {
  if (!trackingId || !uid) return;
  const docRef = db().collection('mailTracking').doc(trackingId);
  await docRef.set({
    trackingId,
    uid,
    accountId,
    subject: String(subject || '').slice(0, 500),
    recipients: Array.isArray(recipients) ? recipients.slice(0, 50) : [],
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    openCount: 0,
    firstOpenedAt: null,
    lastOpenedAt: null,
    userAgent: null,
  });
}

async function recordOpen(trackingId, meta = {}) {
  if (!trackingId || typeof trackingId !== 'string' || !/^[a-f0-9]{32}$/i.test(trackingId)) return null;
  const docRef = db().collection('mailTracking').doc(trackingId);
  const snap = await docRef.get();
  if (!snap.exists) return null;

  const data = snap.data() || {};
  const currentCount = Number(data.openCount) || 0;
  const now = admin.firestore.FieldValue.serverTimestamp();

  await docRef.update({
    openCount: currentCount + 1,
    firstOpenedAt: data.firstOpenedAt || now,
    lastOpenedAt: now,
    userAgent: String(meta.userAgent || '').slice(0, 150) || data.userAgent || null,
  });

  return { ...data, openCount: currentCount + 1 };
}

async function getTrackingSummary(uid, accountId) {
  if (!uid || !accountId) return [];
  const snap = await db().collection('mailTracking')
    .where('uid', '==', uid)
    .limit(300)
    .get();

  return snap.docs
    .map((doc) => {
      const data = doc.data() || {};
      return {
        trackingId: doc.id,
        accountId: data.accountId || '',
        subject: data.subject || '',
        recipients: Array.isArray(data.recipients) ? data.recipients : [],
        openCount: Number(data.openCount) || 0,
        sentAt: data.sentAt?.toDate?.()?.toISOString() || (typeof data.sentAt === 'string' ? data.sentAt : null),
        firstOpenedAt: data.firstOpenedAt?.toDate?.()?.toISOString() || (typeof data.firstOpenedAt === 'string' ? data.firstOpenedAt : null),
        lastOpenedAt: data.lastOpenedAt?.toDate?.()?.toISOString() || (typeof data.lastOpenedAt === 'string' ? data.lastOpenedAt : null),
      };
    })
    .filter((item) => item.accountId === accountId)
    .sort((a, b) => (Date.parse(b.sentAt || '') || 0) - (Date.parse(a.sentAt || '') || 0))
    .slice(0, 100);
}

module.exports = {
  generateTrackingId,
  TRANSPARENT_PIXEL_GIF,
  createTrackingRecord,
  recordOpen,
  getTrackingSummary,
};
