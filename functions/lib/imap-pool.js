const { publicError } = require('./errors');

// One operation owns each connection at a time. Idle sockets are kept briefly;
// no polling or long-running IDLE task survives the request.
function forceClose(client) {
  if (!client) return;
  try {
    if (typeof client.close === 'function') {
      const pending = client.close();
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
      return;
    }
  } catch { /* fall through to logout */ }
  try {
    const pending = typeof client.logout === 'function' ? client.logout() : null;
    if (pending && typeof pending.catch === 'function') pending.catch(() => {});
  } catch { /* already closed */ }
}

function createImapPool({ connect, maxConnections = 4, idleMs = 10000, waitMs = 30000, now = Date.now, onWaitTimeout = () => {} }) {
  const entries = new Map();
  const waiters = new Set();
  const notify = () => { for (const wake of waiters) wake(); waiters.clear(); };
  const close = (key, entry) => {
    clearTimeout(entry.timer);
    forceClose(entry.client);
    if (entries.get(key) === entry) entries.delete(key);
    notify();
  };
  const wait = (remaining) => new Promise((resolve, reject) => {
    let timer;
    const wake = () => { clearTimeout(timer); waiters.delete(wake); resolve(); };
    waiters.add(wake);
    timer = setTimeout(() => {
      waiters.delete(wake);
      reject(publicError(503, 'Posta kutusu meşgul. Biraz sonra tekrar deneyin.'));
    }, remaining);
  });

  async function acquire(key, connectFn = connect) {
    const deadline = now() + waitMs;
    let waitStarted;
    const reportWaitTimeout = () => {
      try {
        onWaitTimeout({
          waitedMs: waitStarted == null ? 0 : Math.max(0, now() - waitStarted),
          poolSize: entries.size,
          busyConnections: [...entries.values()].filter((entry) => entry.busy).length,
          waiters: waiters.size,
        });
      } catch { /* diagnostics must not change request behavior */ }
    };
    for (;;) {
      for (const [otherKey, other] of entries) {
        if (!other.busy && (other.expires <= now() || other.client.usable === false)) close(otherKey, other);
      }
      let entry = entries.get(key);
      if (entry && !entry.busy) {
        entry.busy = true;
        clearTimeout(entry.timer);
        try {
          if (entry.client && entry.client.usable === false) throw new Error('connection not usable');
          const idleTime = now() - (entry.lastActive || 0);
          if (idleTime > 25000 && typeof entry.client.noop === 'function') {
            await entry.client.noop();
          }
          entry.lastActive = now();
          return { entry, reused: true };
        } catch {
          close(key, entry);
          continue;
        }
      }
      if (!entry && entries.size >= maxConnections) {
        const idle = [...entries].filter(([, item]) => !item.busy).sort((a, b) => a[1].expires - b[1].expires)[0];
        if (idle) close(idle[0], idle[1]);
      }
      if (!entry && entries.size < maxConnections) {
        entry = { busy: true, client: null, expires: 0, timer: null, lastActive: now() };
        entries.set(key, entry);
        try { entry.client = await connectFn(); return { entry, reused: false }; }
        catch (err) { close(key, entry); throw err; }
      }
      const remaining = deadline - now();
      if (remaining <= 0) {
        reportWaitTimeout();
        throw publicError(503, 'Posta kutusu meşgul. Biraz sonra tekrar deneyin.');
      }
      if (waitStarted == null) waitStarted = now();
      try {
        await wait(remaining);
      } catch (err) {
        reportWaitTimeout();
        throw err;
      }
    }
  }

  return {
    async run(key, fn, connectFn) {
      const started = now();
      const { entry, reused } = await acquire(key, connectFn);
      const ready = now();
      try {
        return await fn(entry.client, { reused, connectionMs: ready - started });
      } catch (err) {
        close(key, entry);
        throw err;
      } finally {
        if (entries.get(key) === entry) {
          entry.busy = false;
          entry.lastActive = now();
          entry.expires = now() + idleMs;
          entry.timer = setTimeout(() => { if (!entry.busy) close(key, entry); }, idleMs);
          if (typeof entry.timer.unref === 'function') entry.timer.unref();
          notify();
        }
      }
    },
    closeAll() { for (const [key, entry] of entries) close(key, entry); },
  };
}

module.exports = { createImapPool };
