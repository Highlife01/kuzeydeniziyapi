import React, { useState } from 'react';

export default function NewFolderModal(props: {
  open: boolean;
  busy: boolean;
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const { open, busy, onCreate, onClose } = props;
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError('Klasör adı boş olamaz.');
      return;
    }
    if (clean.length < 2 || clean.length > 50) {
      setError('Klasör adı 2 ile 50 karakter arasında olmalıdır.');
      return;
    }
    try {
      setError('');
      await onCreate(clean);
      setName('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klasör oluşturulamadı.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Yeni Klasör Oluştur">
      <div className="modal-content new-folder-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📁 Yeni Klasör Oluştur</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Kapat">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="new-folder-form">
          <label className="field-label">
            Klasör Adı
            <input
              type="text"
              className="input"
              placeholder="Örn: Teklifler 2026, Müşteriler..."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              autoFocus
              disabled={busy}
            />
          </label>
          {error ? <p className="field-error">{error}</p> : null}
          <div className="modal-actions">
            <button type="button" className="text-btn" onClick={onClose} disabled={busy}>
              İptal
            </button>
            <button type="submit" className="cmd primary" disabled={busy || !name.trim()}>
              {busy ? 'Oluşturuluyor...' : 'Klasör Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
