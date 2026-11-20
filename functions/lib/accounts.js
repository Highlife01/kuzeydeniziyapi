const KURUMSAL_HOST = 'mail.kurumsaleposta.com';
const GMAIL_IMAP_HOST = 'imap.gmail.com';
const GMAIL_SMTP_HOST = 'smtp.gmail.com';
const YANDEX_IMAP_HOST = 'imap.yandex.com';
const YANDEX_SMTP_HOST = 'smtp.yandex.com';
const STORED_ID = /^mbox-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENV_ID = /^mail-(0[1-9]|1\d|2[0-5])$/;

function isHost(host) {
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)
    && !host.includes('..')
    && !host.startsWith('.')
    && !host.endsWith('.');
}

function isAccountId(value) {
  return ENV_ID.test(String(value || '')) || STORED_ID.test(String(value || ''));
}

function cleanDisplayName(value, fallback = '') {
  const name = String(value || '').replace(/[\r\n]/g, ' ').trim().slice(0, 80);
  if (name) return name;
  return String(fallback || '').replace(/[\r\n]/g, ' ').trim().slice(0, 80);
}

function withStoredName(account, meta) {
  if (!account) return null;
  const named = cleanDisplayName(meta && meta.displayName);
  return named ? { ...account, displayName: named } : account;
}

function mailboxEmail(value) {
  const email = String(value || '').trim();
  const at = email.lastIndexOf('@');
  if (at < 1 || at !== email.indexOf('@') || email.length > 254 || /[\s\r\n<>]/.test(email)) return null;
  const domain = email.slice(at + 1).toLowerCase().replace(/\.$/, '');
  if (!isHost(domain)) return null;
  return `${email.slice(0, at)}@${domain}`;
}

function serversForMailbox(email, preset, custom = {}) {
  const parsed = mailboxEmail(email);
  if (!parsed) return null;
  const domain = parsed.split('@')[1];
  if (preset === 'gmail' || domain === 'gmail.com' || domain === 'googlemail.com') {
    return { imapHost: GMAIL_IMAP_HOST, smtpHost: GMAIL_SMTP_HOST, imapPort: 993, smtpPort: 465 };
  }
  if (preset === 'yandex' || domain === 'yandex.com' || domain === 'yandex.ru' || domain === 'yandex.com.tr') {
    return { imapHost: YANDEX_IMAP_HOST, smtpHost: YANDEX_SMTP_HOST, imapPort: 993, smtpPort: 465 };
  }
  if (preset === 'kurumsal' || domain === 'kurumsaleposta.com') {
    return { imapHost: KURUMSAL_HOST, smtpHost: KURUMSAL_HOST, imapPort: 993, smtpPort: 465 };
  }
  if (preset === 'custom') {
    const imapHost = String(custom.imapHost || '').trim().toLowerCase();
    const smtpHost = String(custom.smtpHost || imapHost).trim().toLowerCase();
    const imapPort = Number(custom.imapPort || 993);
    const smtpPort = Number(custom.smtpPort || 465);
    if (!isHost(imapHost) || !isHost(smtpHost) || imapPort !== 993 || (smtpPort !== 465 && smtpPort !== 587)) {
      return null;
    }
    return { imapHost, smtpHost, imapPort, smtpPort };
  }
  if (preset !== 'domain') return null;
  return { imapHost: `mail.${domain}`, smtpHost: `mail.${domain}`, imapPort: 993, smtpPort: 465 };
}

function accountsFromEnv(env) {
  const imapHost = String(env.NATRO_IMAP_HOST || '').trim().toLowerCase();
  const smtpHost = String(env.NATRO_SMTP_HOST || '').trim().toLowerCase();
  const imapPort = Number(env.NATRO_IMAP_PORT || 993);
  const smtpPort = Number(env.NATRO_SMTP_PORT || 465);
  if (!isHost(imapHost) || !isHost(smtpHost) || imapPort !== 993 || (smtpPort !== 465 && smtpPort !== 587)) {
    return [];
  }

  const accounts = [];
  for (let i = 1; i <= 25; i += 1) {
    const nn = String(i).padStart(2, '0');
    const email = String(env[`NATRO_MAIL_${nn}_USER`] || '').trim();
    const password = String(env[`NATRO_MAIL_${nn}_PASS`] || '');
    if (!email || !password || /[\s\r\n]/.test(email) || !email.includes('@') || /[\r\n]/.test(password)) continue;
    const named = cleanDisplayName(env[`NATRO_MAIL_${nn}_NAME`], email.split('@')[0]);
    accounts.push({
      id: `mail-${nn}`,
      displayName: named,
      email,
      password,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
    });
  }
  return accounts;
}

function publicAccount(account) {
  return {
    id: account.id,
    displayName: account.displayName,
    email: account.email,
    enabled: account.enabled !== false,
    lastOkAt: account.lastOkAt || null,
    lastError: account.lastError || '',
  };
}

function mailAccountRecord(account) {
  return {
    displayName: account.displayName,
    imapUser: account.email,
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    enabled: true,
  };
}

function getAccount(accountId, env = process.env) {
  if (!ENV_ID.test(String(accountId || ''))) return null;
  return accountsFromEnv(env).find((account) => account.id === accountId) || null;
}

function accountFromRecord(accountId, meta, password) {
  if (!isAccountId(accountId) || !meta || typeof password !== 'string' || !password || /[\r\n]/.test(password)) return null;
  const email = mailboxEmail(meta.imapUser || meta.email);
  const imapHost = String(meta.imapHost || '').trim().toLowerCase();
  const smtpHost = String(meta.smtpHost || '').trim().toLowerCase();
  const imapPort = Number(meta.imapPort || 993);
  const smtpPort = Number(meta.smtpPort || 465);
  if (!email || !isHost(imapHost) || !isHost(smtpHost) || imapPort !== 993 || (smtpPort !== 465 && smtpPort !== 587)) return null;
  return {
    id: accountId,
    displayName: cleanDisplayName(meta.displayName, email.split('@')[0]),
    email,
    password,
    imapHost,
    imapPort,
    smtpHost,
    smtpPort,
  };
}

module.exports = {
  KURUMSAL_HOST,
  GMAIL_IMAP_HOST,
  GMAIL_SMTP_HOST,
  accountsFromEnv,
  publicAccount,
  mailAccountRecord,
  getAccount,
  isAccountId,
  mailboxEmail,
  serversForMailbox,
  accountFromRecord,
  cleanDisplayName,
  withStoredName,
};
