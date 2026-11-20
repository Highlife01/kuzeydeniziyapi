import type { MailAccount, ScheduledEmail } from './types';

export default function ScheduledEmailsModal(props: {
  open: boolean;
  scheduled: ScheduledEmail[];
  accounts?: MailAccount[];
  serverBacked?: boolean;
  onSendNow: (item: ScheduledEmail) => void;
  onEdit: (item: ScheduledEmail) => void;
  onCancel: (id: string) => void;
  onClose: () => void;
}) {
  const { open, scheduled, accounts = [], serverBacked = false, onSendNow, onEdit, onCancel, onClose } = props;

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Zamanlanan İletiler">
      <div className="modal-content scheduled-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0 }}>⏱️ Zamanlanmış İletiler ({scheduled.length})</h3>
            <small style={{ fontSize: 11, color: serverBacked ? '#059669' : 'var(--text-muted)' }}>
              {serverBacked
                ? '☁️ Sunucu Kuyruğu Aktif — Tarayıcı veya bilgisayar kapalı olsa bile zamanı geldiğinde otomatik gönderilir.'
                : 'Yerel kuyruk'}
            </small>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Kapat">✕</button>
        </div>

        <div className="scheduled-modal-body">
          {scheduled.length === 0 ? (
            <div className="empty-hint-box">
              <p>Şu anda zamanlanmış bir ileti bulunmuyor.</p>
              <p className="sub-hint">Yeni e-posta yazarken "Gönder" yanındaki ⏱️ düğmesinden ileri bir tarih ve saat seçebilirsiniz.</p>
            </div>
          ) : (
            <div className="scheduled-list">
              {scheduled.map((item) => {
                const date = new Date(item.scheduledAt);
                const isPast = Date.now() >= item.scheduledAt;
                const senderAcc = accounts.find((a) => a.id === item.accountId);
                return (
                  <div key={item.id} className="scheduled-item">
                    <div className="scheduled-item-info">
                      <div className="scheduled-item-time" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <span className="time-badge">
                          {isPast ? '⚡ Gönderilmek üzere' : `📅 ${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                        {senderAcc ? (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(37,99,235,0.1)', color: '#1d4ed8', fontWeight: 600 }}>
                            {senderAcc.displayName || senderAcc.email}
                          </span>
                        ) : null}
                        <span className="recipient-text">Kime: {item.targetEmail}</span>
                      </div>
                      <h4 className="scheduled-subject">{item.subject || '(Konu yok)'}</h4>
                      {item.lastError ? (
                        <small style={{ color: '#dc2626', fontSize: 11 }}>⚠️ Son deneme uyarısı: {item.lastError}</small>
                      ) : null}
                    </div>
                    <div className="scheduled-item-actions">
                      <button
                        type="button"
                        className="cmd send-now-btn"
                        onClick={() => onSendNow(item)}
                        title="Zamanlamayı beklemeden hemen gönder"
                      >
                        Hemen Gönder
                      </button>
                      <button
                        type="button"
                        className="text-btn edit-btn"
                        onClick={() => onEdit(item)}
                        title="Düzenlemek için aç"
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        className="text-btn danger"
                        onClick={() => onCancel(item.id)}
                        title="Zamanlamayı iptal et"
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
