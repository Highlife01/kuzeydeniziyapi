const nodemailer = require('nodemailer');
const MailComposer = require('nodemailer/lib/mail-composer');
const { domainToASCII } = require('node:url');
const { publicError } = require('./errors');
const { sanitizeMailHtml, textToHtml, visibleText } = require('./sanitize-mail');
const { appendSent, readThread, markAnswered, resolvePublicHost } = require('./imap-mail');
const { readArchivedThread } = require('./mail-archive');
const { validateResolvedAttachments } = require('./attachments');

const GLUED_EMAIL_RE = /^([^\s@<>]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*?\.(?:com\.tr|org\.tr|net\.tr|edu\.tr|gov\.tr|bel\.tr|pol\.tr|av\.tr|dr\.tr|k12\.tr|gen\.tr|web\.tr|biz\.tr|info\.tr|tv\.tr|co\.uk|org\.uk|ac\.uk|com|net|org|edu|gov|mil|int|info|biz|name|pro|io|co|me|ai|app|dev|tech|online|site|store|xyz|cloud|shop|mail|email|test|local|tr|de|uk|fr|nl|it|es|ru|ch|at|be|se|no|dk|fi|pl|cz|gr|pt|ro|bg|hu|ua|az|kz|uz|ge|us|ca|au|nz|jp|cn|in|br|mx|ar|za|ae|sa))([a-zA-Z0-9_+-]+(?:\.[a-zA-Z0-9_+-]+)*@.+)$/i;

function splitGluedEmails(token) {
  let current = token;
  const out = [];
  while ((current.match(/@/g) || []).length > 1) {
    const match = current.match(GLUED_EMAIL_RE);
    if (!match) break;
    out.push(match[1]);
    current = match[2];
  }
  out.push(current);
  return out;
}

function tokenizeAddressList(raw) {
  const separated = raw
    .replace(/>(?=\s*[^,;\s])/g, '>, ')
    .replace(/(?<![<\w.-])([^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+)(?=\s+[^,;\s])/g, '$1, ');
  return separated
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      if (/<[^<>]+>$/.test(part)) return [part];
      return part.split(/\s+/).filter(Boolean).flatMap(splitGluedEmails);
    });
}

function parseAddressList(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  if (/[\r\n]/.test(raw)) throw publicError(400, 'Alıcı adresi geçersiz.');
  const parts = tokenizeAddressList(raw);
  if (parts.length > 5000) throw publicError(400, 'Çok fazla alıcı.');
  return parts.map((part) => {
    const wrapped = part.match(/<([^<>]+)>$/);
    const email = (wrapped ? wrapped[1] : part).trim();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw publicError(400, 'Alıcı adresi geçersiz.');
    return email;
  });
}

function cleanSubject(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 500);
}

function defaultSubjectFromText(text, account) {
  const firstLine = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .find((line) => line && !line.startsWith('>') && !/yazdı:$/.test(line) && !/^-{3,}/.test(line));
  if (firstLine && firstLine.length >= 6 && !/^(test|deneme)$/i.test(firstLine)) {
    return firstLine.length > 72 ? `${firstLine.slice(0, 69).trim()}...` : firstLine;
  }
  const senderName = String((account && account.displayName) || '').replace(/[\r\n]+/g, ' ').trim();
  return senderName ? `${senderName} - Bilgilendirme` : 'Bilgilendirme';
}

function wrapHtmlDocument(fragment) {
  const content = String(fragment || '').trim();
  if (!content) return '';
  if (/<html[\s>]/i.test(content)) return content;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${content}</body></html>`;
}

function cleanBody(value, htmlBody) {
  const htmlSource = String(htmlBody || '').trim();
  if (htmlSource) {
    if (htmlSource.length > 100000) throw publicError(400, 'İleti metni boş olamaz.');
    const html = sanitizeMailHtml(htmlSource);
    const text = visibleText(html) || String(value || '').replace(/\r\n/g, '\n').trim();
    if (!text) throw publicError(400, 'İleti metni boş olamaz.');
    return { text, html };
  }
  const body = String(value || '').replace(/\r\n/g, '\n');
  if (!body.trim() || body.length > 100000) throw publicError(400, 'İleti metni boş olamaz.');
  const html = sanitizeMailHtml(textToHtml(body));
  if (!visibleText(html)) throw publicError(400, 'İleti metni boş olamaz.');
  return { text: body, html };
}

function buildRaw(options) {
  return new Promise((resolve, reject) => {
    const composer = new MailComposer(options);
    composer.compile().build((err, message) => {
      if (err) reject(err);
      else resolve(message);
    });
  });
}

function senderAddress(account) {
  const email = String((account && account.email) || '').trim();
  const name = String((account && account.displayName) || '').replace(/[\r\n]+/g, ' ').trim();
  if (!name || name.toLowerCase() === email.toLowerCase()) return email;
  return { name, address: email };
}

function recipientKey(address) {
  const separator = address.lastIndexOf('@');
  const local = address.slice(0, separator);
  const domain = address.slice(separator + 1);
  return `${local}@${(domainToASCII(domain) || domain).toLowerCase()}`;
}

function uniqueRecipients(addresses) {
  const unique = new Map();
  for (const address of addresses) {
    const key = recipientKey(address);
    if (!unique.has(key)) unique.set(key, address);
  }
  return [...unique.values()];
}

function senderEhloDomain(account) {
  const email = String((account && account.email) || '').trim();
  const at = email.lastIndexOf('@');
  const rawDomain = at > 0 ? email.slice(at + 1) : String((account && account.smtpHost) || '');
  const ascii = domainToASCII(rawDomain.trim()) || rawDomain.trim();
  return ascii || 'localhost';
}

async function createTransport(account) {
  // Same SSRF guard as IMAP: refuse internal addresses and pin the socket to
  // the vetted IP; TLS still validates the certificate against smtpHost.
  const address = await resolvePublicHost(account.smtpHost);
  return nodemailer.createTransport({
    host: address,
    port: account.smtpPort,
    secure: account.smtpPort === 465,
    requireTLS: account.smtpPort === 587,
    auth: typeof account.password === 'string' && account.password.startsWith('oauth2:') ? { type: 'OAuth2', user: account.email, accessToken: account.password.slice(7) } : { user: account.email, pass: account.password },
    tls: { rejectUnauthorized: true, servername: account.smtpHost },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
    name: senderEhloDomain(account),
  });
}

async function smtpSend(account, raw, recipients) {
  const transporter = await createTransport(account);
  try {
    const result = await transporter.sendMail({
      envelope: { from: account.email, to: recipients },
      raw,
    });
    if (!result || !Array.isArray(result.accepted) || !Array.isArray(result.rejected)
      || !result.accepted.every((address) => typeof address === 'string')
      || !result.rejected.every((address) => typeof address === 'string')
      || !result.accepted.length) {
      throw publicError(502, 'Gönderim sonucu doğrulanamadı. Aynı iletiyi yeniden göndermeden önce teslim durumunu kontrol edin.');
    }
    const accepted = uniqueRecipients(result.accepted);
    const acceptedKeys = new Set(accepted.map(recipientKey));
    const rejected = uniqueRecipients(result.rejected).filter((address) => !acceptedKeys.has(recipientKey(address)));
    const requestedKeys = new Set(recipients.map(recipientKey));
    const reportedKeys = new Set([...accepted, ...rejected].map(recipientKey));
    if (reportedKeys.size !== requestedKeys.size || [...reportedKeys].some((key) => !requestedKeys.has(key))) {
      throw publicError(502, 'Gönderim sonucu doğrulanamadı. Aynı iletiyi yeniden göndermeden önce teslim durumunu kontrol edin.');
    }
    return { accepted, rejected };
  } finally {
    transporter.close();
  }
}

async function verifySmtp(account) {
  const transporter = await createTransport(account);
  try {
    await transporter.verify();
  } finally {
    transporter.close();
  }
}

async function deliver(account, input) {
  const to = parseAddressList(input.to);
  const cc = parseAddressList(input.cc);
  const bcc = parseAddressList(input.bcc);
  const recipients = uniqueRecipients([...to, ...cc, ...bcc]);
  if (!recipients.length) throw publicError(400, 'Alıcı boş olamaz.');
  const { text, html } = cleanBody(input.body, input.htmlBody);
  const subject = cleanSubject(input.subject) || defaultSubjectFromText(text, account);
  const baseHtml = wrapHtmlDocument(html);
  let finalHtml = baseHtml;
  if (input.trackingId && baseHtml) {
    const trackingPixelUrl = `https://www.kuzeydenizinsaat.com.tr/api/track/open/${encodeURIComponent(input.trackingId)}.png`;
    const trackingPixelTag = `<img src="${trackingPixelUrl}" width="1" height="1" alt="" />`;
    if (finalHtml.includes('</body>')) {
      finalHtml = finalHtml.replace('</body>', `${trackingPixelTag}</body>`);
    } else {
      finalHtml = `${finalHtml}${trackingPixelTag}`;
    }
  }
  const files = validateResolvedAttachments(input.attachments || []);
  let inReplyTo;
  let references;
  if (input.mode === 'reply') {
    let thread = { messageId: '', references: '' };
    if (input.role === 'archive') {
      try {
        thread = await readArchivedThread(account.id, input.uid);
      } catch {
        thread = { messageId: '', references: '' };
      }
    }
    if (!thread.messageId) {
      try {
        thread = await readThread(account, { role: input.role, uid: input.uid });
      } catch (err) {
        if (input.role !== 'archive') throw err;
      }
    }
    inReplyTo = thread.messageId || undefined;
    references = [thread.references, thread.messageId].filter(Boolean).join(' ').trim() || undefined;
  }
  const from = senderAddress(account);
  const raw = await buildRaw({
    from,
    to: to.length ? to : 'undisclosed-recipients:;',
    cc: cc.length ? cc : undefined,
    subject,
    html: finalHtml,
    text,
    inReplyTo,
    references,
    attachments: files.length ? files : undefined,
  });
  const { accepted, rejected } = await smtpSend(account, raw, recipients);
  let stored = true;
  try {
    if (String(account.smtpHost || '').toLowerCase() !== 'smtp.gmail.com') {
      const sentRaw = finalHtml === baseHtml ? raw : await buildRaw({
        from,
        to: to.length ? to : 'undisclosed-recipients:;',
        cc: cc.length ? cc : undefined,
        subject,
        html: baseHtml,
        text,
        inReplyTo,
        references,
        attachments: files.length ? files : undefined,
      });
      await appendSent(account, sentRaw);
    }
  } catch {
    stored = false;
  }
  if (input.mode === 'reply') {
    try {
      await markAnswered(account, { role: input.role, uid: input.uid });
    } catch { /* yanıt bayrağı yazılamazsa gönderim geçerlidir */ }
  }
  const response = { ok: rejected.length === 0, stored, accepted, rejected };
  if (input.trackingId) response.trackingId = input.trackingId;
  return response;
}

module.exports = {
  parseAddressList,
  cleanSubject,
  cleanBody,
  deliver,
  verifySmtp,
};
