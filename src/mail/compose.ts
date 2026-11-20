import type { ComposeAttachment, FolderRole, MailMessage } from './types';

export type ComposeFields = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachments?: ComposeAttachment[];
};

export function visibleComposeText(value: string) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

export function isComposeBlank(compose: ComposeFields) {
  return ![compose.to, compose.cc, compose.bcc, compose.subject]
    .some((value) => value.trim()) && !visibleComposeText(compose.body) && !(compose.attachments && compose.attachments.length);
}

export function composeFingerprint(compose: ComposeFields) {
  const attachments = (compose.attachments || [])
    .map((file) => `${file.id || ''}:${file.filename}:${file.size}`)
    .join('|');
  return JSON.stringify([compose.to, compose.cc, compose.bcc, compose.subject, compose.body, attachments]);
}

export function nextUnseen(unseen: number | null, wasSeen: boolean, willBeSeen: boolean) {
  if (unseen == null) return unseen;
  if (wasSeen === willBeSeen) return unseen;
  return Math.max(0, unseen + (willBeSeen ? -1 : 1));
}

export const AUTO_SAVE_MS = 1500;
export const REFRESH_GAP_MS = 45000;

export function isMailFolder(value: FolderRole | null | undefined): value is FolderRole {
  return value === 'inbox' || value === 'sent' || value === 'archive' || value === 'trash' || value === 'spam';
}

export function withSignature(body: string, signature: string) {
  const html = String(signature || '').trim();
  if (!html || /data-safir-signature/.test(body || '')) return body;
  return `${body || ''}<div data-safir-signature="1">${html}</div>`;
}

export function folderEmptyCopy(role: FolderRole, query = '', drafts = false) {
  if (query.trim()) {
    return { title: 'Bu aramayla eşleşen ileti bulunamadı.', hint: 'Arama filtrelerini temizleyin veya daha genel bir ifade deneyin.', action: 'clear' as const };
  }
  if (drafts) return { title: 'Kayıtlı taslak yok.', hint: 'Yazmaya başladığınız iletiler otomatik kaydedilir.', action: null };
  if (role === 'inbox') return { title: 'Gelen kutunuz temiz.', hint: 'Yeni iletiler geldiğinde burada görünecek.', action: null };
  if (role === 'sent') return { title: 'Gönderilenler boş.', hint: 'Gönderdiğiniz iletiler burada listelenir.', action: null };
  if (role === 'archive') return { title: 'Arşivde ileti yok.', hint: 'Arşivlediğiniz iletiler bu klasörde durur.', action: null };
  if (role === 'spam') return { title: 'Spam klasörü boş.', hint: 'İstenmeyen iletiler burada toplanır.', action: null };
  if (role === 'trash') return { title: 'Çöp kutusunda ileti yok.', hint: 'Sildiğiniz iletileri buradan geri alabilirsiniz.', action: null };
  return { title: 'Bu klasörde ileti yok.', hint: '', action: null };
}

export function folderTitle(role: FolderRole, drafts = false) {
  if (drafts) return 'Taslaklar';
  if (role === 'sent') return 'Gönderilen';
  if (role === 'archive') return 'Arşiv';
  if (role === 'trash') return 'Çöp Kutusu';
  if (role === 'spam') return 'Spam';
  return 'Gelen Kutusu';
}

export function emailKey(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const email = (raw.match(/<([^<>]+)>$/)?.[1] || raw).trim();
  const at = email.lastIndexOf('@');
  if (at < 1) return email.toLowerCase();
  return `${email.slice(0, at).toLowerCase()}@${email.slice(at + 1).toLowerCase()}`;
}

const GLUED_EMAIL_RE = /^([^\s@<>]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*?\.(?:com\.tr|org\.tr|net\.tr|edu\.tr|gov\.tr|bel\.tr|pol\.tr|av\.tr|dr\.tr|k12\.tr|gen\.tr|web\.tr|biz\.tr|info\.tr|tv\.tr|co\.uk|org\.uk|ac\.uk|com|net|org|edu|gov|mil|int|info|biz|name|pro|io|co|me|ai|app|dev|tech|online|site|store|xyz|cloud|shop|mail|email|test|local|tr|de|uk|fr|nl|it|es|ru|ch|at|be|se|no|dk|fi|pl|cz|gr|pt|ro|bg|hu|ua|az|kz|uz|ge|us|ca|au|nz|jp|cn|in|br|mx|ar|za|ae|sa))([a-zA-Z0-9_+-]+(?:\.[a-zA-Z0-9_+-]+)*@.*)$/i;

export function splitGluedRecipientToken(token: string): string[] {
  let current = token;
  const out: string[] = [];
  while ((current.match(/@/g) || []).length > 1) {
    const match = current.match(GLUED_EMAIL_RE);
    if (!match) break;
    out.push(match[1]);
    current = match[2];
  }
  out.push(current);
  return out;
}

export type ParsedRecipient = {
  raw: string;
  name: string;
  email: string;
};

export function parseRecipientToken(token: string): ParsedRecipient {
  const trimmed = String(token || '').trim();
  if (!trimmed) return { raw: '', name: '', email: '' };
  const match = trimmed.match(/^(.*?)\s*<([^<>]+)>$/);
  if (match) {
    const rawName = match[1].trim().replace(/^["']|["']$/g, '');
    const email = match[2].trim();
    return { raw: trimmed, name: rawName, email };
  }
  const cleanEmail = trimmed.replace(/[<>]/g, '').trim();
  return { raw: trimmed, name: '', email: cleanEmail };
}

export function parseRecipientTokens(rawStr: string, emailList?: string[]): ParsedRecipient[] {
  if (!rawStr && (!emailList || !emailList.length)) return [];
  const tokens = extractRecipientTokens(rawStr);
  if (!tokens.length && emailList && emailList.length) {
    return emailList.map((em) => ({ raw: em, name: '', email: em }));
  }
  return tokens.map(parseRecipientToken);
}

export function extractRecipientTokens(value: string): string[] {
  const raw = String(value || '').replace(/[\r\n\t]+/g, ' ').trim();
  if (!raw) return [];
  const separated = raw
    .replace(/>(?=\s*[^,;\s])/g, '>, ')
    .replace(/(?<![<\w.-])([^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+)(?=\s+[^,;\s])/g, '$1, ');
  return separated
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      if (/<[^<>]+>$/.test(part)) return [part];
      return part.split(/\s+/).filter(Boolean).flatMap(splitGluedRecipientToken);
    });
}

export function formatRecipientInput(value: string, trailingSeparator = false): string {
  const tokens = extractRecipientTokens(value);
  if (!tokens.length) return '';
  const joined = tokens.join(', ');
  return trailingSeparator ? `${joined}, ` : joined;
}

export function autoFormatRecipientChange(nextValue: string, prevValue = ''): string {
  const raw = String(nextValue || '');
  if (!raw) return '';
  if (prevValue.endsWith(', ') && raw === prevValue.slice(0, -1)) {
    return raw.slice(0, -1);
  }
  const hasTrailingCommit = /(?:[^\s@,;<>]+@[^\s@,;<>]+\.[a-zA-Z]{2,}|<[^\s@,;<>]+@[^\s@,;<>]+\.[a-zA-Z]{2,}>)(?:\s+|[;,])$/.test(raw);
  if (hasTrailingCommit) {
    return formatRecipientInput(raw, true);
  }
  const normalized = raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/>(?=\s*[^,;\s])/g, '>, ')
    .replace(/(?<![<\w.-])([^\s@,;<>]+@[^\s@,;<>]+\.[a-zA-Z]{2,})(?=\s+[^,;\s])/g, '$1, ');
  return normalized
    .split(/[,;]/)
    .map((segment, idx, arr) => {
      const trimmed = segment.trim();
      if ((trimmed.match(/@/g) || []).length > 1 && !/<[^<>]+>$/.test(trimmed)) {
        const parts = splitGluedRecipientToken(trimmed);
        if (parts.length > 1) return parts.join(', ');
      }
      return idx < arr.length - 1 ? trimmed : segment.replace(/^\s+/, '');
    })
    .join(', ');
}

function uniqueAddresses(list: string[], skip: Set<string>) {
  const out: string[] = [];
  const seen = new Set(skip);
  for (const item of list) {
    const key = emailKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

export function replyFields(message: Pick<MailMessage, 'fromEmail' | 'subject' | 'toEmails'>, myEmail: string) {
  const from = (message.fromEmail || '').trim();
  const mine = emailKey(myEmail);
  const to = emailKey(from) === mine ? ((message.toEmails || [])[0] || '') : from;
  return { to, cc: '', subject: replySubject(message.subject), showExtra: false };
}

function quoteSubject(subject: string, prefix: 'Re' | 'Fw') {
  const clean = String(subject || '').replace(/[\r\n]+/g, ' ').trim();
  const pattern = prefix === 'Re' ? /^(re|ynt)\s*:/i : /^(fw|fwd|ileti)\s*:/i;
  const quoted = pattern.test(clean) ? clean : `${prefix}: ${clean}`;
  return quoted.slice(0, 500);
}

function replySubject(subject: string) {
  return quoteSubject(subject, 'Re');
}

export function quotedHtml(message: Pick<MailMessage, 'from' | 'fromEmail' | 'to' | 'date' | 'html' | 'subject'>, kind: 'reply' | 'forward') {
  const heading = kind === 'forward' ? '---------- İletilen ileti ----------' : `${message.from || message.fromEmail} yazdı:`;
  const excerpt = String(message.html || '').slice(0, 20000);
  return `<p><br></p><blockquote><p>${heading}</p>${excerpt}</blockquote>`;
}

export function forwardFields(
  message: Pick<MailMessage, 'fromEmail' | 'subject' | 'toEmails' | 'ccEmails' | 'from' | 'to' | 'date' | 'html' | 'uid' | 'attachments' | 'folder' | 'accountId'>,
  folder: FolderRole,
  accountId?: string,
) {
  const targetFolder = message.folder || folder;
  const targetAccountId = message.accountId || accountId;
  return {
    to: '',
    cc: '',
    subject: quoteSubject(message.subject, 'Fw'),
    body: quotedHtml(message, 'forward'),
    showExtra: false,
    attachments: (message.attachments || []).map((file) => ({
      filename: file.filename,
      contentType: file.contentType,
      size: file.size,
      source: {
        folder: targetFolder,
        uid: message.uid,
        index: file.index,
        ...(targetAccountId ? { accountId: targetAccountId } : {}),
      },
    })),
  };
}

export function replyAllFields(message: Pick<MailMessage, 'fromEmail' | 'subject' | 'toEmails' | 'ccEmails'>, myEmail: string) {
  const from = (message.fromEmail || '').trim();
  const mine = emailKey(myEmail);
  const fromKey = emailKey(from);
  const iSent = Boolean(fromKey && fromKey === mine);
  const others = uniqueAddresses([...(message.toEmails || []), ...(message.ccEmails || [])], new Set([mine, iSent ? '' : fromKey].filter(Boolean)));
  const to = iSent ? (others[0] || '') : (from || others[0] || '');
  const cc = uniqueAddresses(others, new Set([emailKey(to)])).join(', ');
  return { to, cc, subject: replySubject(message.subject), showExtra: Boolean(cc) };
}
