function tokenize(query) {
  return String(query || '').match(/(?:[^\s"]+|"[^"]*")+/g) || [];
}

function unquote(value) {
  const text = String(value || '').trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1).trim();
  return text;
}

function parseDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseMailQuery(raw) {
  const source = String(raw || '').replace(/[\r\n\0]/g, ' ').trim();
  const parsed = {
    text: '',
    from: '',
    to: '',
    subject: '',
    body: '',
    unseen: false,
    flagged: false,
    hasAttachment: false,
    after: null,
    before: null,
  };
  if (!source) return parsed;
  const leftover = [];
  for (const token of tokenize(source)) {
    const match = token.match(/^(from|to|subject|body|has|is|after|before):(.*)$/i);
    if (!match) {
      leftover.push(unquote(token));
      continue;
    }
    const key = match[1].toLowerCase();
    const value = unquote(match[2]);
    if (key === 'from') parsed.from = value.slice(0, 80);
    else if (key === 'to') parsed.to = value.slice(0, 80);
    else if (key === 'subject') parsed.subject = value.slice(0, 80);
    else if (key === 'body') parsed.body = value.slice(0, 80);
    else if (key === 'has' && /^attachments?$/i.test(value)) parsed.hasAttachment = true;
    else if (key === 'is' && /^(unread|unseen)$/i.test(value)) parsed.unseen = true;
    else if (key === 'is' && /^(starred|flagged)$/i.test(value)) parsed.flagged = true;
    else if (key === 'after') parsed.after = parseDate(value);
    else if (key === 'before') parsed.before = parseDate(value);
    else leftover.push(token);
  }
  parsed.text = leftover.filter(Boolean).join(' ').trim().slice(0, 80);
  return parsed;
}

function toImapCriteria(parsed, unseenOnly) {
  const criteria = {};
  if (unseenOnly || parsed.unseen) criteria.seen = false;
  if (parsed.flagged) criteria.flagged = true;
  if (parsed.from) criteria.from = parsed.from;
  if (parsed.to) criteria.to = parsed.to;
  if (parsed.subject) criteria.subject = parsed.subject;
  if (parsed.after) criteria.since = parsed.after;
  if (parsed.before) criteria.before = parsed.before;
  if (parsed.body && !parsed.text) criteria.body = parsed.body;
  else if (parsed.text || parsed.body) {
    const or = [];
    if (parsed.text) or.push({ subject: parsed.text }, { from: parsed.text }, { to: parsed.text }, { body: parsed.text });
    if (parsed.body) or.push({ body: parsed.body });
    criteria.or = or;
  }
  return criteria;
}

module.exports = { parseMailQuery, toImapCriteria };
