const { createHash } = require('node:crypto');

const accountKeyCache = new WeakMap();

function accountKey(account) {
  if (account && typeof account === 'object') {
    const cached = accountKeyCache.get(account);
    if (cached) return cached;
    const computed = createHash('sha256').update(JSON.stringify([
      account.id, account.imapHost, account.imapPort, account.email, account.password,
    ])).digest('hex');
    accountKeyCache.set(account, computed);
    return computed;
  }
  return createHash('sha256').update(JSON.stringify([
    account?.id, account?.imapHost, account?.imapPort, account?.email, account?.password,
  ])).digest('hex');
}

function createMailCache({ maxEntries = 200, now = Date.now } = {}) {
  const entries = new Map();
  const pending = new Map();
  const keyOf = (account, context) => `${accountKey(account)}:${JSON.stringify(context)}`;
  const store = (key, value, ttlMs) => {
    entries.delete(key);
    entries.set(key, { expires: now() + ttlMs, value: structuredClone(value) });
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
  };
  const cache = {
    get(account, context) {
      const key = keyOf(account, context);
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expires <= now()) { entries.delete(key); return undefined; }
      return structuredClone(entry.value);
    },
    set(account, context, value, ttlMs = 3000) {
      const key = keyOf(account, context);
      pending.delete(key);
      store(key, value, ttlMs);
      return value;
    },
    async load(account, context, loader, ttlMs = 3000) {
      const cached = cache.get(account, context);
      if (cached !== undefined) return cached;
      const key = keyOf(account, context);
      let flight = pending.get(key);
      if (!flight) {
        flight = {};
        pending.set(key, flight);
        flight.promise = Promise.resolve().then(loader).then((value) => {
          // A mutation can invalidate a read while it is waiting for IMAP.
          // Its existing callers may finish, but it must not refill the cache.
          if (pending.get(key) === flight) store(key, value, ttlMs);
          return value;
        }).finally(() => {
          if (pending.get(key) === flight) pending.delete(key);
        });
      }
      // Concurrent callers must not share mutable result objects.
      return structuredClone(await flight.promise);
    },
    invalidate(account) {
      const prefix = `${accountKey(account)}:`;
      for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
      for (const key of pending.keys()) if (key.startsWith(prefix)) pending.delete(key);
    },
    clear() { entries.clear(); pending.clear(); },
  };
  return cache;
}

module.exports = { accountKey, createMailCache };
