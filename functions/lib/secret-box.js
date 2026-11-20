const crypto = require('node:crypto');
const { publicError } = require('./errors');

// Mailbox passwords are sealed with AES-256-GCM. The key comes from the
// MAIL_CREDENTIAL_KEY secret (Secret Manager in production). A predictable
// fallback is only allowed outside Cloud Functions (local dev / tests).
const PREFIX = Buffer.from('s1');
const DEV_FALLBACK = 'safirmail-local-development-only-key';
let cached = null;

function isDeployed(env = process.env) {
  return Boolean(env.K_SERVICE || env.FUNCTION_TARGET) && env.FUNCTIONS_EMULATOR !== 'true';
}

function key() {
  const configured = String(process.env.MAIL_CREDENTIAL_KEY || '');
  if (configured && configured.length < 32) throw publicError(500, 'Sunucu yapılandırması eksik.');
  if (!configured && isDeployed()) throw publicError(500, 'Sunucu yapılandırması eksik.');
  const secret = configured || DEV_FALLBACK;
  if (!cached || cached.secret !== secret) {
    cached = { secret, key: crypto.scryptSync(secret, 'safirmail-mailbox-v1', 32) };
  }
  return cached.key;
}

function isSealed(value) {
  try {
    const buf = Buffer.from(String(value || ''), 'base64url');
    return buf.length >= 31 && buf.subarray(0, 2).equals(PREFIX);
  } catch {
    return false;
  }
}

function sealSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return Buffer.concat([PREFIX, iv, cipher.getAuthTag(), data]).toString('base64url');
}

function openSecret(value) {
  const raw = String(value || '');
  if (!raw || !isSealed(raw)) return '';
  const buf = Buffer.from(raw, 'base64url');
  const k = key();
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', k, buf.subarray(2, 14));
    decipher.setAuthTag(buf.subarray(14, 30));
    return Buffer.concat([decipher.update(buf.subarray(30)), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

// Records written before encryption was introduced hold the plain password.
function readStoredPassword(value) {
  const raw = String(value || '');
  if (!raw) return '';
  return isSealed(raw) ? openSecret(raw) : raw;
}

module.exports = { sealSecret, openSecret, isSealed, readStoredPassword, isDeployed };
