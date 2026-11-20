import { type CSSProperties, useState } from 'react';
import type { InboxPreview, MailAccount, MailListItem } from './types';
import { formatWhen, initials } from './format';
import Icon, { accountColor, mailColor } from './Icon';

export type PreviewState = {
  data?: InboxPreview;
  error?: string;
  fresh: number[];
};

type Props = {
  accounts: MailAccount[];
  previews: Record<string, PreviewState>;
  refreshing: boolean;
  refreshedAt: number | null;
  busy: boolean;
  onRefresh: () => void;
  onOpenAccount: (accountId: string, uid?: number) => void;
  onShowAccounts: () => void;
  onComposeAccount?: (accountId: string, toEmail?: string) => void;
  onAddAccount?: () => void;
};

export default function Overview({ accounts, previews, refreshing, refreshedAt, busy, onRefresh, onOpenAccount, onShowAccounts, onComposeAccount, onAddAccount }: Props) {
  const [viewMode, setViewMode] = useState<'cards' | 'stream'>('cards');
  const [onlyUnseen, setOnlyUnseen] = useState(false);
  const [unseenFirst, setUnseenFirst] = useState(false);
  const [quickFilter, setQuickFilter] = useState('');
  const normalizedFilter = quickFilter.trim().toLowerCase();

  const totalUnseen = accounts.reduce((sum, item) => sum + (previews[item.id]?.data?.unseen || 0), 0);
  const totalMails = accounts.reduce((sum, item) => sum + (previews[item.id]?.data?.total || 0), 0);
  const freshTotal = accounts.reduce((sum, item) => sum + (previews[item.id]?.fresh.length || 0), 0);
  const stamp = refreshedAt ? new Date(refreshedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';

  const accountIndexMap = new Map<string, number>();
  const accountColorMap = new Map<string, string>();
  accounts.forEach((acc, idx) => {
    accountIndexMap.set(acc.id, idx);
    accountColorMap.set(acc.id, accountColor(idx, acc.email));
  });

  const filteredAccounts = (() => {
    let list = onlyUnseen
      ? accounts.filter((item) => (previews[item.id]?.data?.unseen || 0) > 0 || (previews[item.id]?.fresh.length || 0) > 0)
      : [...accounts];
    if (normalizedFilter) {
      list = list.filter((item) => {
        if (item.displayName.toLowerCase().includes(normalizedFilter) || item.email.toLowerCase().includes(normalizedFilter)) {
          return true;
        }
        const msgs = previews[item.id]?.data?.messages || [];
        return msgs.some(
          (m) =>
            (m.from || '').toLowerCase().includes(normalizedFilter) ||
            (m.fromEmail || '').toLowerCase().includes(normalizedFilter) ||
            (m.subject || '').toLowerCase().includes(normalizedFilter)
        );
      });
    }
    if (unseenFirst) {
      list = [...list].sort((a, b) => {
        const ua = (previews[a.id]?.data?.unseen || 0) + (previews[a.id]?.fresh.length || 0) * 100;
        const ub = (previews[b.id]?.data?.unseen || 0) + (previews[b.id]?.fresh.length || 0) * 100;
        return ub - ua;
      });
    }
    return list;
  })();

  const unifiedStream = (() => {
    const entries: { account: MailAccount; message: MailListItem; isFresh: boolean }[] = [];
    for (const item of accounts) {
      if (item.enabled === false) continue;
      const state = previews[item.id];
      const freshSet = new Set(state?.fresh || []);
      for (const msg of state?.data?.messages || []) {
        const isFresh = freshSet.has(msg.uid);
        if (onlyUnseen && msg.seen && !isFresh) continue;
        if (normalizedFilter) {
          const hit =
            item.displayName.toLowerCase().includes(normalizedFilter) ||
            item.email.toLowerCase().includes(normalizedFilter) ||
            (msg.from || '').toLowerCase().includes(normalizedFilter) ||
            (msg.fromEmail || '').toLowerCase().includes(normalizedFilter) ||
            (msg.subject || '').toLowerCase().includes(normalizedFilter);
          if (!hit) continue;
        }
        entries.push({ account: item, message: msg, isFresh });
      }
    }
    return entries.sort((a, b) => (Date.parse(b.message.date) || 0) - (Date.parse(a.message.date) || 0));
  })();

  return (
    <section className="overview" aria-label="Tüm gelen kutuları">
      <div className="overview-head">
        <button type="button" className="back-btn icon-btn" onClick={onShowAccounts} aria-label="Hesaplar"><Icon name="menu" /></button>
        <div className="overview-title">
          <div className="overview-title-row">
            <h2>Tüm gelen kutuları</h2>
            {totalUnseen > 0 ? (
              <em
                className={freshTotal ? 'count count-lg fresh' : 'count count-lg'}
                data-count={String(totalUnseen)}
                aria-label={`${totalUnseen} okunmamış`}
              />
            ) : null}
          </div>
          <small>
            {accounts.length} hesap · {totalUnseen} okunmamış · {totalMails} toplam ileti
            {freshTotal ? <> · <strong className="fresh-note">{freshTotal} yeni ileti</strong></> : null}
            {stamp ? ` · ${stamp}` : ''}
          </small>
        </div>
        <div className="overview-controls">
          <div className="overview-filter-wrap">
            <input
              type="search"
              className="overview-filter-input"
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Hesap veya ileti filtrele…"
              aria-label="Hesap veya ileti filtrele"
              disabled={busy}
            />
            {quickFilter ? (
              <button
                type="button"
                className="icon-btn overview-filter-clear"
                onClick={() => setQuickFilter('')}
                aria-label="Filtreyi temizle"
                title="Filtreyi temizle"
              >
                ✕
              </button>
            ) : null}
          </div>
          {onAddAccount ? (
            <button
              type="button"
              className="primary slim overview-add-btn"
              onClick={onAddAccount}
              disabled={busy}
              title="Yeni e-posta hesabı ekle"
            >
              <Icon name="add" size={14} /> Yeni Hesap Ekle
            </button>
          ) : null}
          <div className="overview-tabs" role="group" aria-label="Görünüm modu">
            <button
              type="button"
              className={viewMode === 'cards' ? 'chip-btn on' : 'chip-btn'}
              onClick={() => setViewMode('cards')}
              disabled={busy}
            >
              Kartlar
            </button>
            <button
              type="button"
              className={viewMode === 'stream' ? 'chip-btn on' : 'chip-btn'}
              onClick={() => setViewMode('stream')}
              disabled={busy}
            >
              Birleşik Akış
            </button>
          </div>
          <button
            type="button"
            className={onlyUnseen ? 'chip-btn on' : 'chip-btn'}
            onClick={() => setOnlyUnseen((v) => !v)}
            disabled={busy}
            title="Yalnızca okunmamış iletisi olanları göster"
          >
            Sadece okunmamış
          </button>
          {viewMode === 'cards' ? (
            <button
              type="button"
              className={unseenFirst ? 'chip-btn on' : 'chip-btn'}
              onClick={() => setUnseenFirst((v) => !v)}
              disabled={busy}
              title="Okunmamış maili olan kutuları en üste taşı"
            >
              Yeni olanlar üstte
            </button>
          ) : null}
          <button type="button" className={refreshing ? 'primary slim spin' : 'primary slim'} onClick={onRefresh} disabled={busy || refreshing}>
            <Icon name="refresh" size={16} />{refreshing ? 'Yenileniyor…' : 'Yenile'}
          </button>
        </div>
      </div>

      {viewMode === 'stream' ? (
        <div className="stream-wrap">
          {unifiedStream.length === 0 ? (
            <div className="empty-state">
              <Icon name="mail" size={40} />
              <p>{onlyUnseen ? 'Okunmamış yeni ileti yok.' : 'Henüz görüntülenecek ileti yok.'}</p>
              {onlyUnseen ? (
                <button type="button" className="text-btn" onClick={() => setOnlyUnseen(false)}>Tüm iletileri göster</button>
              ) : null}
            </div>
          ) : (
            <ul className="stream-list">
              {unifiedStream.map(({ account: acc, message, isFresh }, idx) => {
                const isUnread = !message.seen || isFresh;
                const accColor = accountColorMap.get(acc.id) || accountColor(-1, acc.email);
                const rowColor = mailColor(idx, 0);
                return (
                  <li key={`${acc.id}-${message.uid}`} className="stream-item">
                    <button
                      type="button"
                      className={isUnread ? 'tile-row stream-row unread' : 'tile-row stream-row'}
                      style={{ '--row-accent': rowColor, '--tile-accent': accColor } as CSSProperties}
                      onClick={() => onOpenAccount(acc.id, message.uid)}
                      disabled={busy}
                    >
                      <em
                        className={isFresh ? 'mail-num fresh' : isUnread ? 'mail-num unread' : 'mail-num'}
                        data-num={String(idx + 1)}
                        aria-hidden="true"
                      />
                      <span className="tile-row-body">
                        <span className="tile-top">
                          <span
                            className="stream-account-pill"
                            style={{ background: accColor }}
                            data-account={acc.displayName || acc.email}
                            aria-hidden="true"
                          />
                          <span className="tile-from">{message.from}</span>
                          <time>{formatWhen(message.date)}</time>
                        </span>
                        <span className="tile-subject">
                          {isFresh ? <em className="new-tag">Yeni</em> : null}
                          {message.subject}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="tiles">
          {accounts.length === 0 ? (
            <div className="empty-state overview-empty-card" style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--line-strong)', margin: '24px auto', maxWidth: '540px' }}>
              <Icon name="mail" size={56} />
              <h3 style={{ margin: '16px 0 8px', fontSize: '20px', fontWeight: 700 }}>Henüz bir e-posta hesabı eklenmemiş</h3>
              <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: '14px', lineHeight: 1.5 }}>
                Natro, Kurumsal E-posta veya Gmail hesabınızı ekleyerek tüm iletilerinizi tek ekrandan yönetmeye başlayın.
              </p>
              {onAddAccount ? (
                <button
                  type="button"
                  className="primary"
                  onClick={onAddAccount}
                  style={{ padding: '12px 28px', fontSize: '15px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}
                >
                  <Icon name="add" size={18} /> + Yeni Posta Hesabı Ekle
                </button>
              ) : null}
            </div>
          ) : null}
          {filteredAccounts.length === 0 && (onlyUnseen || normalizedFilter) && accounts.length > 0 ? (
            <div className="empty-state">
              <Icon name="mail" size={40} />
              <p>{normalizedFilter ? 'Aramanıza uygun hesap veya ileti bulunamadı.' : 'Okunmamış iletisi olan hesap yok.'}</p>
              <button type="button" className="text-btn" onClick={() => { setOnlyUnseen(false); setQuickFilter(''); }}>Tüm hesapları göster</button>
            </div>
          ) : null}
          {filteredAccounts.map((item) => {
            const state = previews[item.id];
            const data = state?.data;
            const fresh = new Set(state?.fresh || []);
            const disabled = item.enabled === false;
            const unseenCount = data?.unseen || 0;
            const accIdx = accountIndexMap.get(item.id) ?? 0;
            const accColor = accountColorMap.get(item.id) || accountColor(accIdx, item.email);
            let unreadIndex = 0;
            return (
              <article
                key={item.id}
                className={fresh.size ? 'tile fresh' : unseenCount ? 'tile has-unseen' : 'tile'}
                style={{ '--tile-accent': accColor } as CSSProperties}
              >
                <button type="button" className="tile-head" onClick={() => onOpenAccount(item.id)} disabled={busy} title={`${item.email} gelen kutusunu aç`}>
                  <span className="avatar-badge-wrap">
                    <span className="avatar" style={{ background: accColor }}>{initials(item.displayName, item.email)}</span>
                    {unseenCount > 0 ? (
                      <em
                        className={fresh.size ? 'avatar-count fresh' : 'avatar-count'}
                        data-count={String(unseenCount)}
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>
                  <span className="tile-copy">
                    <strong>{item.displayName}</strong>
                    <small>{item.email}</small>
                  </span>
                  <span className="tile-badges">
                    {data ? (
                      <em
                        className="total-badge"
                        data-label={`${data.total} ileti`}
                        aria-label={`${data.total} toplam ileti`}
                      />
                    ) : null}
                    {unseenCount > 0 ? (
                      <em
                        className={fresh.size ? 'count tile-count fresh' : 'count tile-count'}
                        data-count={String(unseenCount)}
                        aria-label={`${unseenCount} okunmamış`}
                      />
                    ) : data ? (
                      <em
                        className="count tile-count zero"
                        data-count="0"
                        aria-label="0 okunmamış"
                      />
                    ) : null}
                  </span>
                </button>
                {!disabled && onComposeAccount ? (
                  <div className="tile-bar">
                    <button type="button" className="chip-btn" onClick={() => onComposeAccount(item.id)} disabled={busy} title={`${item.email} adresinden yeni ileti oluştur`}>
                      <Icon name="compose" size={13} /> Bu hesaptan yaz
                    </button>
                  </div>
                ) : null}
                {disabled ? <p className="tile-note">Bu hesap pasif.</p> : null}
                {!disabled && !data && !state?.error ? (
                  <div className="tile-skel" aria-hidden="true"><i /><i /><i /></div>
                ) : null}
                {!disabled && state?.error ? <p className="tile-note error">{state.error}</p> : null}
                {!disabled && data && data.messages.length === 0 ? <p className="tile-note">Gelen kutusu boş.</p> : null}
                {!disabled && data && data.messages.length > 0 ? (
                  <ul className="tile-list">
                    {data.messages.map((message, index) => {
                      const isUnread = !message.seen || fresh.has(message.uid);
                      if (isUnread) unreadIndex += 1;
                      const displayNum = isUnread ? unreadIndex : index + 1;
                      const rowColor = mailColor(index, accIdx * 3 + 1, accColor);
                      return (
                        <li key={message.uid}>
                          <button
                            type="button"
                            className={message.seen ? 'tile-row' : 'tile-row unread'}
                            style={{ '--row-accent': rowColor } as CSSProperties}
                            onClick={() => onOpenAccount(item.id, message.uid)}
                            disabled={busy}
                          >
                            <em
                              className={fresh.has(message.uid) ? 'mail-num fresh' : isUnread ? 'mail-num unread' : 'mail-num'}
                              data-num={String(displayNum)}
                              aria-hidden="true"
                            />
                            <span className="tile-row-body">
                              <span className="tile-top">
                                <span className="tile-from">{message.from}</span>
                                <time>{formatWhen(message.date)}</time>
                              </span>
                              <span className="tile-subject">
                                {fresh.has(message.uid) ? <em className="new-tag">Yeni</em> : null}
                                {message.subject}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
