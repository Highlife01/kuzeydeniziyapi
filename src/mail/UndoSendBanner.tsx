import { useEffect, useState } from 'react';

export type UndoSendItem = {
  id: string;
  recipient: string;
  subject: string;
  totalSeconds: number;
  onUndo: () => void;
  onSendNow: () => void;
};

export default function UndoSendBanner(props: { item: UndoSendItem | null }) {
  const { item } = props;
  const [secondsLeft, setSecondsLeft] = useState(item ? item.totalSeconds : 0);

  useEffect(() => {
    if (!item) return;
    setSecondsLeft(item.totalSeconds);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          item.onSendNow();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [item]);

  if (!item) return null;

  return (
    <div className="undo-send-banner" role="status" aria-live="polite">
      <div className="undo-send-info">
        <span className="undo-send-spinner" aria-hidden="true" />
        <span className="undo-send-text">
          İleti gönderiliyor... <strong>{secondsLeft}s</strong>
          {item.recipient ? ` (${item.recipient})` : ''}
        </span>
      </div>
      <div className="undo-send-actions">
        <button
          type="button"
          className="cmd undo-send-btn"
          onClick={item.onUndo}
          title="Gönderimi durdur ve düzenlemeye dön"
        >
          ↩️ Geri Al
        </button>
        <button
          type="button"
          className="text-btn undo-now-btn"
          onClick={item.onSendNow}
          title="Beklemeden hemen gönder"
        >
          Hemen Gönder
        </button>
      </div>
    </div>
  );
}
