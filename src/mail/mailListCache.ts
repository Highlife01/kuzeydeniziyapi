import type { FolderRole, ListResult } from './types';

type ListKey = { accountId: string; folder: FolderRole; cursor: number | null; q: string; unseen: boolean };
type Entry = { accountId: string; data?: ListResult; at: number; pending?: Promise<ListResult> };

// This cache belongs to one mounted mailbox/session. Nothing is persisted or shared between users.
export function createMailListCache(ttlMs: number, maxEntries = 32, now = Date.now) {
  const entries = new Map<string, Entry>();
  const revisions = new Map<string, number>();
  const identify = (key: ListKey) => `${key.accountId}:${key.folder}:${key.cursor ?? ''}:${key.q}:${key.unseen ? 1 : 0}`;
  const touch = (key: string, entry: Entry) => {
    entries.delete(key);
    entries.set(key, entry);
    if (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
  };

  return {
    revision: (accountId: string) => revisions.get(accountId) || 0,
    peek(key: ListKey) {
      const entry = entries.get(identify(key));
      return entry?.data ? { data: entry.data, at: entry.at } : undefined;
    },
    load(key: ListKey, loader: () => Promise<ListResult>, force = false): Promise<ListResult> {
      const id = identify(key);
      const cached = entries.get(id);
      if (cached?.pending) return cached.pending;
      if (!force && cached?.data && now() - cached.at < ttlMs) {
        touch(id, cached);
        return Promise.resolve(cached.data);
      }
      const entry: Entry = cached || { accountId: key.accountId, at: 0 };
      const pending = Promise.resolve().then(loader).then((data) => {
        // Invalidated/evicted requests may finish, but must never refill the cache.
        if (entries.get(id) === entry && entry.pending === pending) {
          entry.data = data;
          entry.at = now();
        }
        return data;
      }).finally(() => {
        if (entries.get(id) === entry && entry.pending === pending) {
          entry.pending = undefined;
          if (!entry.data) entries.delete(id);
        }
      });
      entry.pending = pending;
      touch(id, entry);
      return pending;
    },
    invalidate(accountId: string) {
      revisions.set(accountId, (revisions.get(accountId) || 0) + 1);
      for (const [key, entry] of entries) if (entry.accountId === accountId) entries.delete(key);
    },
  };
}
