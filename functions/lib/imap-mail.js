const dns = require('dns').promises;
const { BlockList, isIP } = require('net');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { publicError } = require('./errors');
const { sanitizeMailHtml, textToHtml } = require('./sanitize-mail');
const { createImapPool } = require('./imap-pool');
const { accountKey, createMailCache } = require('./mail-cache');
const { parseMailQuery, toImapCriteria } = require('./mail-query');

const silentLog = { debug() {}, info() {}, warn() {}, error() {}, trace() {}, fatal() {} };

const blocked = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blocked.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
  ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['2002::', 16], ['100::', 64],
]) blocked.addSubnet(net, prefix, 'ipv6');

function mappedIpv4(ipv6) {
  // Normalise any spelling (::ffff:127.0.0.1, ::ffff:7f00:1, 0:0:0:0:0:ffff:…).
  let host;
  try { host = new URL(`http://[${ipv6}]/`).hostname.slice(1, -1); } catch { return null; }
  const match = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!match) return null;
  const high = parseInt(match[1], 16);
  const low = parseInt(match[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
}

function isPrivateIp(ip) {
  const value = String(ip || '').trim().toLowerCase();
  const version = isIP(value);
  if (version === 4) return blocked.check(value, 'ipv4');
  if (version === 6) {
    const dotted = value.match(/^(?:0{0,4}:){0,5}(?::|0{0,4}:)?ffff:(\d+\.\d+\.\d+\.\d+)$/);
    const v4 = dotted ? dotted[1] : mappedIpv4(value);
    if (v4) return isPrivateIp(v4);
    return blocked.check(value, 'ipv6');
  }
  return true;
}

const DNS_CACHE_TTL_MS = 5 * 60 * 1000;
const dnsCache = new Map();

async function resolvePublicHost(host) {
  const cached = dnsCache.get(host);
  if (cached && cached.expires > Date.now()) {
    return cached.address;
  }
  let records;
  try {
    records = await dns.lookup(host, { all: true, verbatim: true });
  } catch (err) {
    err.code = err.code || 'ENOTFOUND';
    throw err;
  }
  if (!records.length || records.some((record) => isPrivateIp(record.address))) {
    throw publicError(502, 'Bağlantı hatası');
  }
  // Callers connect to this exact address so a second DNS answer (rebinding)
  // cannot redirect the socket to an internal service.
  const address = records[0].address;
  dnsCache.set(host, { address, expires: Date.now() + DNS_CACHE_TTL_MS });
  return address;
}

async function assertPublicHost(host) {
  await resolvePublicHost(host);
}

function closeImapClient(client) {
  try {
    if (client && typeof client.close === 'function') {
      const pending = client.close();
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
      return;
    }
  } catch { /* fall through to logout */ }
  try {
    const pending = client && typeof client.logout === 'function' ? client.logout() : null;
    if (pending && typeof pending.catch === 'function') pending.catch(() => {});
  } catch { /* already closed */ }
}

async function connectImap(account) {
  const address = await resolvePublicHost(account.imapHost);
  const client = new ImapFlow({
    host: address,
    port: account.imapPort,
    secure: true,
    auth: typeof account.password === 'string' && account.password.startsWith('oauth2:') ? { user: account.email, accessToken: account.password.slice(7) } : { user: account.email, pass: account.password },
    logger: silentLog,
    disableAutoIdle: true,
    tls: { rejectUnauthorized: true, servername: account.imapHost },
    clientInfo: { name: 'Safir Mail', version: '1.0.0' },
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
  client.on('error', () => {});
  let timer;
  try {
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error('timeout');
          err.code = 'ETIMEDOUT';
          reject(err);
        }, 20000);
      }),
    ]);
    return client;
  } catch (err) {
    closeImapClient(client);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const pool = createImapPool({
  maxConnections: 35,
  idleMs: 120000,
  waitMs: 30000,
  onWaitTimeout: (stats) => console.warn(JSON.stringify({ event: 'imap_pool_wait_timeout', ...stats })),
});
const listCache = createMailCache({ maxEntries: 300 });
const messageCache = createMailCache({ maxEntries: 400 });
const attachmentCache = createMailCache({ maxEntries: 200 });
const rawMessageCache = createMailCache({ maxEntries: 100 });

async function withImap(account, fn) {
  return pool.run(accountKey(account), (client) => fn(client), () => connectImap(account));
}

function hasFlag(flags, name) {
  if (!flags) return false;
  if (typeof flags.has === 'function') return flags.has(name);
  return Array.isArray(flags) && flags.includes(name);
}

function formatAddresses(list) {
  return (list || [])
    .filter((item) => item && (item.name || item.address))
    .map((item) => (item.name && item.address ? `${item.name} <${item.address}>` : (item.address || item.name)))
    .join(', ');
}

function firstAddress(list) {
  const found = (list || []).find((item) => item && item.address);
  return found ? found.address : '';
}

function nodeHasFile(node) {
  if (!node) return false;
  const disposition = String(node.disposition || '').toLowerCase();
  if (disposition === 'attachment') return true;
  const filename = (node.dispositionParameters && (node.dispositionParameters.filename || node.dispositionParameters.name))
    || (node.parameters && (node.parameters.name || node.parameters.filename));
  if (filename) return true;
  return (node.childNodes || []).some(nodeHasFile);
}

function extractHeaderText(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(extractHeaderText);
  if (typeof value === 'string') return [value];
  if (typeof value === 'object') {
    if (typeof value.value === 'string') return [value.value];
    if (typeof value.text === 'string') return [value.text];
  }
  return [String(value)];
}

function collectAuthHeaders(source) {
  const result = { authLines: [], spfLines: [], hasDkimSignature: false };
  if (!source) return result;
  if (Buffer.isBuffer(source) || typeof source === 'string') {
    const unfolded = String(source).replace(/\r?\n[ \t]+/g, ' ');
    for (const rawLine of unfolded.split(/\r?\n/)) {
      const idx = rawLine.indexOf(':');
      if (idx <= 0) continue;
      const key = rawLine.slice(0, idx).trim().toLowerCase();
      const val = rawLine.slice(idx + 1).trim();
      if (!val) continue;
      if (key === 'authentication-results' || key === 'arc-authentication-results') result.authLines.push(val);
      else if (key === 'received-spf') result.spfLines.push(val);
      else if (key === 'dkim-signature') result.hasDkimSignature = true;
    }
    return result;
  }
  if (Array.isArray(source.headerLines)) {
    for (const entry of source.headerLines) {
      if (!entry || !entry.key) continue;
      const key = String(entry.key).toLowerCase();
      const rawLine = String(entry.line || '').replace(/\r?\n[ \t]+/g, ' ');
      const idx = rawLine.indexOf(':');
      const val = idx > 0 ? rawLine.slice(idx + 1).trim() : '';
      if (key === 'authentication-results' || key === 'arc-authentication-results') {
        if (val) result.authLines.push(val);
      } else if (key === 'received-spf') {
        if (val) result.spfLines.push(val);
      } else if (key === 'dkim-signature') {
        result.hasDkimSignature = true;
      }
    }
    return result;
  }
  const map = source.headers && typeof source.headers.get === 'function'
    ? source.headers
    : (typeof source.get === 'function' ? source : null);
  if (map) {
    result.authLines.push(...extractHeaderText(map.get('authentication-results')));
    result.authLines.push(...extractHeaderText(map.get('arc-authentication-results')));
    result.spfLines.push(...extractHeaderText(map.get('received-spf')));
    result.hasDkimSignature = Boolean(map.get('dkim-signature'));
  }
  return result;
}

function pickAuthStatus(lines, mechanism, strongValues) {
  let fallback = '';
  const regex = new RegExp(`(?:^|[;\\s])${mechanism}=([a-z]+)\\b`, 'i');
  for (const line of lines) {
    const match = String(line || '').match(regex);
    if (!match) continue;
    const status = match[1].toLowerCase();
    if (strongValues.has(status)) return status;
    if (!fallback) fallback = status;
  }
  return fallback;
}

function extractAuthResults(source) {
  const { authLines, spfLines, hasDkimSignature } = collectAuthHeaders(source);
  const strong = new Set(['pass', 'bestguesspass', 'fail', 'softfail']);
  let spf = pickAuthStatus(authLines, 'spf', strong);
  if (!spf) {
    for (const line of spfLines) {
      const m = String(line || '').match(/^\s*(pass|fail|softfail|neutral|none|temperror|permerror)\b/i);
      if (m) {
        spf = m[1].toLowerCase();
        if (strong.has(spf)) break;
      }
    }
  }
  if (!spf) spf = 'missing';

  const dmarc = pickAuthStatus(authLines, 'dmarc', strong) || 'missing';
  let dkim = pickAuthStatus(authLines, 'dkim', new Set(['pass', 'fail', 'policy']));
  if (!dkim) dkim = hasDkimSignature ? 'present' : 'missing';

  const spfPass = spf === 'pass';
  const dmarcPass = dmarc === 'pass' || dmarc === 'bestguesspass';
  const dkimPass = dkim === 'pass' || dkim === 'present';
  return {
    spfPass,
    dkimPass,
    dmarcPass,
    trusted: spfPass && dmarcPass,
    spf,
    dmarc,
    dkim,
  };
}

function toListItem(msg, role) {
  const from = msg.envelope && msg.envelope.from ? msg.envelope.from : [];
  const to = msg.envelope && msg.envelope.to ? msg.envelope.to : [];
  const cc = msg.envelope && msg.envelope.cc ? msg.envelope.cc : [];
  const counterpart = role === 'sent' ? to : from;
  const date = msg.internalDate || (msg.envelope && msg.envelope.date) || new Date();
  const authResults = role !== 'sent' && msg.headers ? extractAuthResults(msg.headers) : undefined;
  return {
    uid: msg.uid,
    subject: (msg.envelope && msg.envelope.subject) || '(Konu yok)',
    from: formatAddresses(counterpart) || (role === 'sent' ? 'Alıcı yok' : 'Bilinmeyen'),
    fromEmail: firstAddress(counterpart),
    to: formatAddresses(to),
    toEmail: firstAddress(to),
    toEmails: (to || []).map((item) => item && item.address).filter(Boolean),
    ccEmails: (cc || []).map((item) => item && item.address).filter(Boolean),
    date: new Date(date).toISOString(),
    seen: hasFlag(msg.flags, '\\Seen'),
    flagged: hasFlag(msg.flags, '\\Flagged'),
    hasAttachments: nodeHasFile(msg.bodyStructure),
    ...(authResults ? { authResults } : {}),
  };
}

function normalizeFolderKey(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .replace(/[İIıi]/g, 'i')
    .replace(/[Öö]/g, 'o')
    .replace(/[Üü]/g, 'u')
    .replace(/[Şş]/g, 's')
    .replace(/[Çç]/g, 'c')
    .replace(/[Ğğ]/g, 'g')
    .toLowerCase()
    .replace(/[-_./\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function boxCandidates(box) {
  const candidates = new Set();
  if (!box) return candidates;
  if (box.name) {
    const norm = normalizeFolderKey(box.name);
    if (norm) candidates.add(norm);
  }
  if (box.path) {
    const normPath = normalizeFolderKey(box.path);
    if (normPath) candidates.add(normPath);
    const stripped = String(box.path).replace(/^inbox[./\\]/i, '');
    const normStripped = normalizeFolderKey(stripped);
    if (normStripped) candidates.add(normStripped);
    const delim = box.delimiter || /[./\\]/;
    const parts = String(box.path).split(delim);
    const leaf = parts[parts.length - 1];
    if (leaf) {
      const normLeaf = normalizeFolderKey(leaf);
      if (normLeaf) candidates.add(normLeaf);
    }
  }
  return candidates;
}

function boxMatchesUse(box, use) {
  if (!box || !use) return false;
  const target = String(use).toLowerCase();
  if (typeof box.specialUse === 'string' && box.specialUse.toLowerCase() === target) {
    return true;
  }
  if (box.flags && typeof box.flags[Symbol.iterator] === 'function') {
    for (const flag of box.flags) {
      if (typeof flag === 'string' && flag.toLowerCase() === target) {
        return true;
      }
    }
  }
  return false;
}

const SENT_NAMES = new Set([
  'sent',
  'sent items',
  'sent item',
  'sent mail',
  'sent mails',
  'sentmail',
  'sent messages',
  'sent message',
  'outbox',
  'gonderilen',
  'gonderilenler',
  'gonderilen postalar',
  'gonderilen iletiler',
  'gonderilmis',
  'gonderilmisler',
  'gonderilmis ogeler',
  'gonderilmis postalar',
  'gonderilmis iletiler',
  'giden',
  'gidenler',
  'giden kutusu',
  'giden postalar',
  'giden iletiler',
]);

const TRASH_NAMES = new Set([
  'trash',
  'trash bin',
  'bin',
  'rubbish',
  'deleted',
  'deleted items',
  'deleted messages',
  'cop',
  'cop kutusu',
  'cop sepeti',
  'silinenler',
  'silinen postalar',
  'silinen iletiler',
  'silinmis',
  'silinmisler',
  'silinmis ogeler',
  'silinmis postalar',
  'silinmis iletiler',
]);

const JUNK_NAMES = new Set([
  'junk',
  'junk mail',
  'junk email',
  'junk e mail',
  'bulk mail',
  'bulk',
  'spam',
  'istenmeyen',
  'istenmeyen postalar',
  'istenmeyen iletiler',
  'istenmeyen e posta',
  'istenmeyen eposta',
]);

const ARCHIVE_NAMES = new Set([
  'archive',
  'archives',
  'archived',
  'arsiv',
  'arsivler',
  'arsivlenmis',
  'all mail',
  'all',
  'tum postalar',
  'tum iletiler',
]);

const PAGE_SIZE = 100;
const BULK_LIMIT = 1000;
const EMPTY_LIMIT = 1000;

const BOX_LIST_TTL_MS = 5 * 60 * 1000;
const boxLists = new WeakMap();

async function listBoxes(client) {
  const cached = boxLists.get(client);
  if (cached && cached.expires > Date.now()) return cached.boxes;
  const boxes = await client.list();
  boxLists.set(client, { boxes, expires: Date.now() + BOX_LIST_TTL_MS });
  return boxes;
}

async function specialPath(client, use, names, prefixPatterns = []) {
  const boxes = await listBoxes(client);
  if (!Array.isArray(boxes)) return null;

  // 1. Doğrudan specialUse veya bayrak eşleşmesi
  const special = boxes.find((box) => boxMatchesUse(box, use));
  if (special) return special.path;

  // 2. Normalize edilmiş tam isim eşleşmesi
  const exact = boxes.find((box) => {
    const candidates = boxCandidates(box);
    for (const c of candidates) {
      if (names.has(c)) return true;
    }
    return false;
  });
  if (exact) return exact.path;

  // 3. Ön ek / kısmi kelime eşleşmesi
  if (prefixPatterns && prefixPatterns.length) {
    const prefixed = boxes.find((box) => {
      const candidates = boxCandidates(box);
      for (const c of candidates) {
        for (const p of prefixPatterns) {
          if (c.startsWith(p)) return true;
        }
      }
      return false;
    });
    if (prefixed) return prefixed.path;
  }

  return null;
}

async function sentPath(client, { createIfMissing = false } = {}) {
  const path = await specialPath(client, '\\Sent', SENT_NAMES, ['sent', 'gonderil', 'giden']);
  if (path) return path;

  let boxes = [];
  try {
    boxes = await listBoxes(client);
  } catch { /* listeleme hatası olursa varsayılanları dene */ }

  const delimiter = (Array.isArray(boxes) && boxes.find((b) => b && b.delimiter) || {}).delimiter || '/';
  const hasInboxPrefix = Array.isArray(boxes) && boxes.some((b) => {
    const p = String((b && b.path) || '').toUpperCase();
    return p.startsWith(`INBOX${delimiter}`) && p !== 'INBOX';
  });

  const candidates = hasInboxPrefix
    ? [`INBOX${delimiter}Sent`, 'Sent', `INBOX${delimiter}Sent Items`, 'Sent Items', `INBOX${delimiter}Gönderilenler`, 'Gönderilenler']
    : ['Sent', `INBOX${delimiter}Sent`, 'Sent Items', `INBOX${delimiter}Sent Items`, 'Gönderilenler', `INBOX${delimiter}Gönderilenler`];

  if (createIfMissing) {
    for (const candidate of candidates) {
      try {
        if (typeof client.mailboxCreate === 'function') {
          await client.mailboxCreate(candidate);
          boxLists.delete(client);
          return candidate;
        }
      } catch {
        // sonraki adayı dene
      }
    }
  }

  throw publicError(404, 'Gönderilenler klasörü bulunamadı.');
}

async function trashPath(client) {
  return specialPath(client, '\\Trash', TRASH_NAMES, ['trash', 'cop', 'silin', 'deleted']);
}

async function junkPath(client) {
  return specialPath(client, '\\Junk', JUNK_NAMES, ['junk', 'spam', 'istenmey']);
}

async function archivePath(client) {
  return (await specialPath(client, '\\Archive', ARCHIVE_NAMES, ['archiv', 'arsiv']))
    || (await specialPath(client, '\\All', ARCHIVE_NAMES, ['all mail', 'tum postalar']));
}

async function mailboxPath(client, role, options = {}) {
  if (role === 'inbox') return 'INBOX';
  if (role === 'sent') return sentPath(client, options);
  if (role === 'trash') {
    const path = await trashPath(client);
    if (!path) throw publicError(404, 'Çöp kutusu bulunamadı.');
    return path;
  }
  if (role === 'spam') {
    const path = await junkPath(client);
    if (!path) throw publicError(404, 'Spam klasörü bulunamadı.');
    return path;
  }
  if (role === 'archive') {
    const path = await archivePath(client);
    if (!path) throw publicError(404, 'Arşiv klasörü bulunamadı.');
    return path;
  }
  if (role && typeof role === 'string' && role.trim()) {
    return role.trim();
  }
  throw publicError(400, 'Klasör geçersiz.');
}

function bulkUids(list) {
  const uids = [...new Set((Array.isArray(list) ? list : []).map(Number))]
    .filter((uid) => Number.isInteger(uid) && uid > 0 && uid <= 4294967295);
  if (!uids.length) throw publicError(400, 'Seçim geçersiz.');
  if (uids.length > BULK_LIMIT) throw publicError(400, 'En fazla 1000 ileti seçilebilir.');
  return uids;
}

function invalidateMail(account) {
  listCache.invalidate(account);
  messageCache.invalidate(account);
  attachmentCache.invalidate(account);
  rawMessageCache.invalidate(account);
}

async function searchUids(client, criteria) {
  try {
    return await client.search(criteria, { uid: true });
  } catch (err) {
    if (!criteria.or) throw err;
    const fallback = { ...criteria, or: criteria.or.filter((item) => !item.body) };
    if (fallback.or.length === criteria.or.length) throw err;
    if (!fallback.or.length) delete fallback.or;
    return client.search(Object.keys(fallback).length ? fallback : { all: true }, { uid: true });
  }
}

async function listMessages(account, { role, cursor, query, unseenOnly, fresh = false }) {
  if (fresh) listCache.invalidate(account);
  const context = { role, cursor: cursor || null, query: query || '', unseenOnly: Boolean(unseenOnly) };
  return listCache.load(account, context, () => withImap(account, async (client) => {
    let path;
    try {
      path = await mailboxPath(client, role);
    } catch (err) {
      if (role !== 'inbox' && (err.status === 404 || err.status === 500)) {
        let inboxUnseen = null;
        try {
          const inbox = await client.status('INBOX', { unseen: true });
          inboxUnseen = inbox.unseen ?? null;
        } catch { /* ignore */ }
        return { messages: [], nextCursor: null, unseen: inboxUnseen, folderUnseen: 0, inboxUnseen, total: 0 };
      }
      throw err;
    }
    let lock;
    try {
      lock = await client.getMailboxLock(path);
    } catch (err) {
      if (role !== 'inbox') {
        let inboxUnseen = null;
        try {
          const inbox = await client.status('INBOX', { unseen: true });
          inboxUnseen = inbox.unseen ?? null;
        } catch { /* ignore */ }
        return { messages: [], nextCursor: null, unseen: inboxUnseen, folderUnseen: 0, inboxUnseen, total: 0 };
      }
      throw err;
    }
    try {
      const parsed = parseMailQuery(query);
      const criteria = toImapCriteria(parsed, unseenOnly);
      const fields = {
        uid: true,
        flags: true,
        envelope: true,
        internalDate: true,
        bodyStructure: true,
        ...(role !== 'sent' ? { headers: ['authentication-results', 'arc-authentication-results', 'received-spf', 'dkim-signature'] } : {}),
      };
      const exists = client.mailbox ? Number(client.mailbox.exists) : NaN;
      const messages = [];
      let nextCursor = null;
      if (!Object.keys(criteria).length && cursor == null && Number.isInteger(exists) && exists >= 0) {
        // Sequence order follows UID order, so the newest page needs no SEARCH ALL.
        if (exists > 0) {
          for await (const msg of client.fetch(`${Math.max(1, exists - (PAGE_SIZE - 1))}:*`, fields)) {
            messages.push(toListItem(msg, role));
          }
        }
        if (exists > PAGE_SIZE && messages.length) nextCursor = Math.min(...messages.map((item) => item.uid));
      } else {
        let uids = Object.keys(criteria).length
          ? await searchUids(client, criteria)
          : await client.search({ all: true }, { uid: true });
        if (!Array.isArray(uids)) uids = [];
        const sorted = uids.filter((uid) => cursor == null || uid < cursor).sort((a, b) => a - b);
        const page = sorted.slice(-PAGE_SIZE);
        nextCursor = sorted.length > PAGE_SIZE ? page[0] : null;
        if (page.length) {
          for await (const msg of client.fetch(page, fields, { uid: true })) {
            messages.push(toListItem(msg, role));
          }
        }
      }
      if (parsed.hasAttachment) {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          if (!messages[i].hasAttachments) messages.splice(i, 1);
        }
      }
      messages.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      let folderUnseen = null;
      let inboxUnseen = null;
      let total = client.mailbox ? client.mailbox.exists : messages.length;
      if (total === 0) {
        folderUnseen = 0;
        if (role === 'inbox') inboxUnseen = 0;
      } else {
        try {
          const status = await client.status(path, { unseen: true, messages: true });
          folderUnseen = status.unseen ?? null;
          total = status.messages ?? total;
        } catch { /* sayaç yoksa liste yine de döner */ }
        if (role === 'inbox') inboxUnseen = folderUnseen;
      }
      if (role !== 'inbox' && inboxUnseen === null) {
        try {
          const inbox = await client.status('INBOX', { unseen: true });
          inboxUnseen = inbox.unseen ?? null;
        } catch { /* gelen kutusu sayısı yoksa açık klasör sayısı kalır */ }
      }
      return { messages, nextCursor, unseen: inboxUnseen, folderUnseen, inboxUnseen, total };
    } finally {
      lock.release();
    }
  }), 5000);
}

async function inboxPreview(account, { limit = 4, fresh = false } = {}) {
  if (fresh) listCache.invalidate(account);
  const size = Math.min(Math.max(Number(limit) || 4, 1), 10);
  const context = { preview: size };
  return listCache.load(account, context, () => withImap(account, async (client) => {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const exists = Number(client.mailbox && client.mailbox.exists) || 0;
      const messages = [];
      if (exists > 0) {
        for await (const msg of client.fetch(`${Math.max(1, exists - size + 1)}:*`, {
          uid: true,
          flags: true,
          envelope: true,
          internalDate: true,
        })) {
          messages.push(toListItem(msg, 'inbox'));
        }
      }
      messages.sort((a, b) => b.uid - a.uid);
      let unseen = null;
      if (exists === 0) {
        unseen = 0;
      } else {
        try {
          const status = await client.status('INBOX', { unseen: true });
          unseen = status.unseen ?? null;
        } catch { /* sayaç yoksa önizleme yine döner */ }
      }
      return { unseen, total: exists, lastUid: mailboxLastUid(client), messages };
    } finally {
      lock.release();
    }
  }), 8000);
}

function mailboxLastUid(client) {
  const uidNext = Number(client.mailbox && client.mailbox.uidNext) || 0;
  return uidNext > 1 ? uidNext - 1 : 0;
}

async function listNewInboxMessages(account, lastUid = 0, { initialized = false } = {}) {
  return withImap(account, async (client) => {
    const path = await mailboxPath(client, 'inbox');
    const lock = await client.getMailboxLock(path);
    try {
      const highest = Number(lastUid) > 0 ? Number(lastUid) : 0;
      if (highest <= 0 && !initialized) return { messages: [], lastUid: mailboxLastUid(client), bootstrapped: true };
      let uids = await client.search({ uid: `${highest + 1}:*` }, { uid: true });
      if (!Array.isArray(uids)) uids = [];
      uids = [...new Set(uids.map(Number).filter((uid) => Number.isInteger(uid) && uid > highest))].sort((a, b) => a - b);
      const page = uids.slice(0, 20);
      // Leave messages outside this page for the next scan.
      const last = page.length ? page[page.length - 1] : highest;
      const messages = [];
      if (page.length) {
        for await (const msg of client.fetch(page, {
          uid: true,
          flags: true,
          envelope: true,
          internalDate: true,
        }, { uid: true })) {
          const item = toListItem(msg, 'inbox');
          messages.push({
            ...item,
            messageId: String((msg.envelope && msg.envelope.messageId) || ''),
          });
        }
      }
      messages.sort((a, b) => a.uid - b.uid);
      return { messages, lastUid: last, bootstrapped: false };
    } finally {
      lock.release();
    }
  });
}

async function latestInboxUid(account) {
  return withImap(account, async (client) => {
    const path = await mailboxPath(client, 'inbox');
    const lock = await client.getMailboxLock(path);
    try {
      return mailboxLastUid(client);
    } finally {
      lock.release();
    }
  });
}

function parsedEmails(field) {
  if (!field) return [];
  const groups = Array.isArray(field) ? field : [field];
  return groups.flatMap((group) => group.value || []).map((item) => item.address).filter(Boolean);
}

function inlineCid(html, attachments) {
  let output = String(html || '');
  if (!output || !attachments || attachments.length === 0) return output;
  for (const attachment of attachments) {
    if (!attachment.cid || !attachment.content || !/^image\//i.test(attachment.contentType || '')) continue;
    const bare = String(attachment.cid).replace(/[<>]/g, '');
    if (!bare || !output.includes(bare)) continue;
    const data = `data:${attachment.contentType};base64,${attachment.content.toString('base64')}`;
    output = output.split(`cid:${bare}`).join(data);
  }
  return output;
}

function cleanFilename(name) {
  const base = String(name || 'ek').replace(/[/\\]/g, '_').replace(/[\r\n"]/g, '').slice(0, 120);
  return base || 'ek';
}

function parseCalendarEvent(icsText) {
  if (!icsText || typeof icsText !== 'string' || !icsText.includes('BEGIN:VCALENDAR')) {
    return null;
  }
  const clean = icsText.replace(/\r\n[ \t]/g, '');
  const getProp = (name) => {
    const match = clean.match(new RegExp(`(?:^|\\n)${name}(?:;[^:]*)?:([^\\r\\n]+)`, 'i'));
    return match ? match[1].trim() : '';
  };
  const summary = getProp('SUMMARY') || 'Toplantı';
  const description = getProp('DESCRIPTION');
  const location = getProp('LOCATION');
  const organizer = getProp('ORGANIZER').replace(/^mailto:/i, '');
  const dtstart = getProp('DTSTART');
  const dtend = getProp('DTEND');
  const uid = getProp('UID');
  const status = getProp('STATUS');

  return {
    summary,
    description,
    location,
    organizer,
    dtstart,
    dtend,
    uid,
    status,
    rawIcs: icsText,
  };
}

async function readMessage(account, { role, uid, ensureSeen = false }) {
  if (ensureSeen) {
    const cached = messageCache.get(account, { role, uid });
    if (cached !== undefined) {
      await withImap(account, async (client) => {
        const path = await mailboxPath(client, role);
        const lock = await client.getMailboxLock(path);
        try {
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        } finally {
          lock.release();
        }
      });
      listCache.invalidate(account);
      return cached;
    }
  }
  return messageCache.load(account, { role, uid }, async () => {
    return withImap(account, async (client) => {
      const path = await mailboxPath(client, role);
      const lock = await client.getMailboxLock(path);
      try {
        const meta = await client.fetchOne(uid, {
          uid: true,
          size: true,
          flags: true,
          envelope: true,
          internalDate: true,
          source: true,
        }, { uid: true });
        if (!meta) throw publicError(404, 'İleti bulunamadı.');
        const needsSeen = ensureSeen || !hasFlag(meta.flags, '\\Seen');
        const [parsed] = await Promise.all([
          simpleParser(meta.source),
          needsSeen ? client.messageFlagsAdd(uid, ['\\Seen'], { uid: true }) : Promise.resolve(),
        ]);
        if (needsSeen) {
          listCache.invalidate(account);
        }
        const rawHtml = parsed.html || parsed.textAsHtml || textToHtml(parsed.text || '');
        const html = sanitizeMailHtml(inlineCid(rawHtml, parsed.attachments));
        if (parsed.attachments && parsed.attachments.length) {
          const files = parsed.attachments.map((attachment) => ({
            filename: cleanFilename(attachment.filename),
            contentType: downloadType(attachment.contentType),
            content: attachment.content,
          }));
          attachmentCache.set(account, { role, uid }, files, 10 * 60 * 1000);
        }
        const item = toListItem(meta);

        let unsubscribe = null;
        if (parsed.headers) {
          const unsubHeader = parsed.headers.get('list-unsubscribe');
          if (unsubHeader) {
            const raw = typeof unsubHeader === 'string' ? unsubHeader : (unsubHeader.value || String(unsubHeader));
            const urls = (raw.match(/<([^>]+)>/g) || []).map((s) => s.slice(1, -1));
            const httpUrl = urls.find((u) => u.startsWith('http://') || u.startsWith('https://'));
            const mailto = urls.find((u) => u.startsWith('mailto:'));
            unsubscribe = {
              raw,
              url: httpUrl || null,
              mailto: mailto || null,
            };
          }
        }

        const authResults = role === 'sent' ? null : extractAuthResults(parsed);

        let calendarEvent = null;
        if (parsed.attachments && parsed.attachments.length) {
          for (const att of parsed.attachments) {
            if (
              att &&
              (att.contentType === 'text/calendar' || (att.filename && att.filename.toLowerCase().endsWith('.ics'))) &&
              att.content
            ) {
              try {
                calendarEvent = parseCalendarEvent(att.content.toString('utf8'));
                if (calendarEvent) break;
              } catch { /* ignore */ }
            }
          }
        }

        return {
          ...item,
          seen: true,
          to: parsed.to ? parsed.to.text : formatAddresses(meta.envelope && meta.envelope.to),
          cc: parsed.cc ? parsed.cc.text : '',
          bcc: parsed.bcc ? parsed.bcc.text : (meta.envelope && meta.envelope.bcc ? formatAddresses(meta.envelope.bcc) : ''),
          toEmails: parsedEmails(parsed.to),
          ccEmails: parsedEmails(parsed.cc),
          bccEmails: parsedEmails(parsed.bcc).length ? parsedEmails(parsed.bcc) : (meta.envelope && meta.envelope.bcc ? (meta.envelope.bcc || []).map((x) => x && x.address).filter(Boolean) : []),
          html,
          messageId: parsed.messageId || '',
          unsubscribe,
          authResults,
          calendarEvent,
          attachments: (parsed.attachments || []).map((attachment, index) => ({
            index,
            filename: cleanFilename(attachment.filename),
            contentType: attachment.contentType || 'application/octet-stream',
            size: attachment.size || (attachment.content ? attachment.content.length : 0),
          })),
        };
      } finally {
        lock.release();
      }
    });
  }, 20 * 60 * 1000);
}

async function readRawMessage(account, { role, uid }) {
  return rawMessageCache.load(account, { role, uid }, async () => {
    return withImap(account, async (client) => {
      const path = await mailboxPath(client, role);
      const lock = await client.getMailboxLock(path);
      try {
        const meta = await client.fetchOne(uid, { source: true }, { uid: true });
        if (!meta || !meta.source) throw publicError(404, 'İleti kaynağı bulunamadı.');
        return meta.source;
      } finally {
        lock.release();
      }
    });
  }, 10 * 60 * 1000);
}

async function listAllFolders(account) {
  return withImap(account, async (client) => {
    const boxes = await listBoxes(client);
    return (boxes || []).map((box) => ({
      path: box.path,
      name: box.name,
      delimiter: box.delimiter,
      specialUse: box.specialUse || '',
    }));
  });
}

async function createCustomFolder(account, folderName) {
  const cleanName = String(folderName || '').trim();
  if (!cleanName || cleanName.length < 2 || cleanName.length > 50) {
    throw publicError(400, 'Geçersiz klasör adı (2-50 karakter olmalı).');
  }
  return withImap(account, async (client) => {
    const boxes = await listBoxes(client);
    const delimiter = (Array.isArray(boxes) && boxes.find((b) => b && b.delimiter) || {}).delimiter || '/';
    const hasInboxPrefix = Array.isArray(boxes) && boxes.some((b) => {
      const p = String((b && b.path) || '').toUpperCase();
      return p.startsWith(`INBOX${delimiter}`) && p !== 'INBOX';
    });
    const candidate = hasInboxPrefix ? `INBOX${delimiter}${cleanName}` : cleanName;
    try {
      await client.mailboxCreate(candidate);
      boxLists.delete(client);
      return { ok: true, path: candidate, name: cleanName };
    } catch (err) {
      throw publicError(400, `Klasör oluşturulamadı: ${err.message || 'Hata'}`);
    }
  });
}

function downloadType(type) {
  if (!type || /html|svg|xml|javascript|xhtml/i.test(type) || !/^[\w.+-]+\/[\w.+-]+$/.test(type)) {
    return 'application/octet-stream';
  }
  return type;
}

async function getMessageAttachments(account, { role, uid }) {
  return attachmentCache.load(account, { role, uid }, async () => {
    return withImap(account, async (client) => {
      const path = await mailboxPath(client, role);
      const lock = await client.getMailboxLock(path);
      try {
        const full = await client.fetchOne(uid, { source: true, size: true }, { uid: true });
        if (!full) throw publicError(404, 'Ek bulunamadı.');
        const parsed = await simpleParser(full.source);
        return (parsed.attachments || []).map((attachment) => ({
          filename: cleanFilename(attachment.filename),
          contentType: downloadType(attachment.contentType),
          content: attachment.content,
        }));
      } finally {
        lock.release();
      }
    });
  }, 10 * 60 * 1000);
}

async function readAttachment(account, { role, uid, index }) {
  const attachments = await getMessageAttachments(account, { role, uid });
  const file = attachments[index];
  if (!file || !file.content) throw publicError(404, 'Ek bulunamadı.');
  return {
    ...file,
    content: Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content),
  };
}

async function setSeen(account, { role, uid, seen }) {
  try {
    return await withImap(account, async (client) => {
      const path = await mailboxPath(client, role);
      const lock = await client.getMailboxLock(path);
      try {
        if (seen) await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        else await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true });
      } finally {
        lock.release();
      }
    });
  } finally {
    invalidateMail(account);
  }
}

async function setFlagged(account, { role, uid, flagged }) {
  try {
    return await withImap(account, async (client) => {
      const path = await mailboxPath(client, role);
      const lock = await client.getMailboxLock(path);
      try {
        if (flagged) await client.messageFlagsAdd(uid, ['\\Flagged'], { uid: true });
        else await client.messageFlagsRemove(uid, ['\\Flagged'], { uid: true });
      } finally {
        lock.release();
      }
    });
  } finally {
    invalidateMail(account);
  }
}

async function readThread(account, { role, uid }) {
  return withImap(account, async (client) => {
    const path = await mailboxPath(client, role);
    const lock = await client.getMailboxLock(path);
    try {
      const msg = await client.fetchOne(uid, {
        headers: ['message-id', 'references'],
      }, { uid: true });
      if (!msg || !msg.headers) return { messageId: '', references: '' };
      const parsed = await simpleParser(Buffer.concat([msg.headers, Buffer.from('\r\n\r\n')]));
      const references = Array.isArray(parsed.references) ? parsed.references.join(' ') : (parsed.references || '');
      return { messageId: parsed.messageId || '', references };
    } finally {
      lock.release();
    }
  });
}

async function appendSent(account, raw) {
  try {
    await withImap(account, async (client) => {
      let path;
      try {
        path = await sentPath(client, { createIfMissing: true });
      } catch {
        path = 'Sent';
      }
      try {
        await client.append(path, raw, ['\\Seen']);
      } catch (err) {
        if (typeof client.mailboxCreate === 'function') {
          try {
            await client.mailboxCreate(path);
            boxLists.delete(client);
            await client.append(path, raw, ['\\Seen']);
            return;
          } catch { /* append hatasını fırlat */ }
        }
        throw err;
      }
    });
  } finally {
    invalidateMail(account);
  }
}

async function markAnswered(account, { role, uid }) {
  await withImap(account, async (client) => {
    const path = await mailboxPath(client, role);
    const lock = await client.getMailboxLock(path);
    try {
      await client.messageFlagsAdd(uid, ['\\Answered'], { uid: true });
    } finally {
      lock.release();
    }
  });
}

async function deleteMessage(account, { role, uid }) {
  try {
    return await withImap(account, async (client) => {
      const source = await mailboxPath(client, role);
      const trash = role === 'trash' ? source : await trashPath(client);
      const lock = await client.getMailboxLock(source);
      try {
        if (!trash || trash === source) {
          await client.messageDelete(uid, { uid: true });
          return { permanent: true };
        }
        await client.messageMove(uid, trash, { uid: true });
        return { permanent: false };
      } finally {
        lock.release();
      }
    });
  } finally {
    invalidateMail(account);
  }
}

async function moveMessage(account, { role, uid, destination }) {
  if (role === destination) return { ok: true };
  try {
    return await withImap(account, async (client) => {
      const source = await mailboxPath(client, role);
      const dest = await mailboxPath(client, destination, { createIfMissing: true });
      if (source === dest) return { ok: true };
      const lock = await client.getMailboxLock(source);
      try {
        await client.messageMove(uid, dest, { uid: true });
        return { ok: true };
      } finally {
        lock.release();
      }
    });
  } finally {
    invalidateMail(account);
  }
}

async function applyBulk(account, { role, uids, action, destination }) {
  const selected = action === 'empty' ? [] : bulkUids(uids);
  try {
    return await withImap(account, async (client) => {
      const source = await mailboxPath(client, role);
      const lock = await client.getMailboxLock(source);
      try {
        if (action === 'empty') {
          if (role !== 'trash' && role !== 'spam') throw publicError(400, 'Yalnız çöp veya spam boşaltılabilir.');
          let all = await client.search({ all: true }, { uid: true });
          if (!Array.isArray(all) || !all.length) return { ok: true, count: 0, truncated: false };
          const batch = all.slice(0, EMPTY_LIMIT);
          await client.messageDelete(batch, { uid: true });
          return { ok: true, count: batch.length, truncated: all.length > EMPTY_LIMIT, permanent: true };
        }
        if (action === 'seen') await client.messageFlagsAdd(selected, ['\\Seen'], { uid: true });
        else if (action === 'unseen') await client.messageFlagsRemove(selected, ['\\Seen'], { uid: true });
        else if (action === 'star') await client.messageFlagsAdd(selected, ['\\Flagged'], { uid: true });
        else if (action === 'unstar') await client.messageFlagsRemove(selected, ['\\Flagged'], { uid: true });
        else if (action === 'delete') {
          const trash = role === 'trash' ? source : await trashPath(client);
          if (!trash || trash === source) {
            await client.messageDelete(selected, { uid: true });
            return { ok: true, count: selected.length, permanent: true };
          }
          await client.messageMove(selected, trash, { uid: true });
          return { ok: true, count: selected.length, permanent: false };
        } else if (action === 'move') {
          if (!destination) throw publicError(400, 'Hedef klasör gerekli.');
          const dest = await mailboxPath(client, destination, { createIfMissing: true });
          if (source !== dest) await client.messageMove(selected, dest, { uid: true });
        } else {
          throw publicError(400, 'İşlem geçersiz.');
        }
        return { ok: true, count: selected.length };
      } finally {
        lock.release();
      }
    });
  } finally {
    invalidateMail(account);
  }
}

async function searchAcrossAccounts(
  accounts = [],
  { role = 'inbox', query = '', unseenOnly = false, limit = 100, timeoutMs = 9000 } = {},
  listFn = listMessages,
) {
  const enabled = (Array.isArray(accounts) ? accounts : []).filter((a) => a && a.id && a.enabled !== false);
  if (enabled.length === 0) {
    return {
      messages: [],
      scannedAccounts: 0,
      searchedAccounts: 0,
      matchedAccounts: 0,
      failedAccounts: 0,
      total: 0,
    };
  }

  const concurrency = Math.min(6, enabled.length);
  const combined = [];
  let matchedAccounts = 0;
  let failedAccounts = 0;
  let index = 0;

  async function worker() {
    while (index < enabled.length) {
      const currentIdx = index;
      index += 1;
      const account = enabled[currentIdx];
      let timer = null;
      try {
        const data = await Promise.race([
          listFn(account, { role, cursor: null, query, unseenOnly }),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('search_timeout')), timeoutMs);
          }),
        ]);
        const rows = (data && Array.isArray(data.messages)) ? data.messages : [];
        if (rows.length > 0) matchedAccounts += 1;
        for (const msg of rows) {
          combined.push({
            ...msg,
            accountId: account.id,
            accountEmail: account.email,
            accountDisplayName: account.displayName || account.email,
            folder: role,
          });
        }
      } catch {
        failedAccounts += 1;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  combined.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  const capped = combined.slice(0, Math.min(Math.max(Number(limit) || 100, 10), 250));

  return {
    messages: capped,
    scannedAccounts: enabled.length,
    searchedAccounts: enabled.length,
    matchedAccounts,
    failedAccounts,
    total: combined.length,
  };
}

module.exports = {
  isPrivateIp,
  resolvePublicHost,
  assertPublicHost,
  withImap,
  mailboxPath,
  inlineCid,
  listMessages,
  searchAcrossAccounts,
  inboxPreview,
  listNewInboxMessages,
  latestInboxUid,
  readMessage,
  readAttachment,
  setSeen,
  setFlagged,
  readThread,
  appendSent,
  markAnswered,
  deleteMessage,
  moveMessage,
  applyBulk,
  invalidateMail,
  toListItem,
  readRawMessage,
  listAllFolders,
  createCustomFolder,
  parseCalendarEvent,
  extractAuthResults,
};
