import { useState } from 'react';
import type { MailTemplate } from './types';

export const DEFAULT_TEMPLATES: MailTemplate[] = [
  {
    id: 'default-teklif',
    title: 'Ticari Teklif İletisi',
    body: 'Sayın İlgili,\n\nTalep etmiş olduğunuz ürün/hizmet teklifimiz ekte bilginize sunulmuştur. İnceleyip onay ve sorularınızı iletmenizi rica eder, iyi çalışmalar dileriz.\n\nSaygılarımızla,',
  },
  {
    id: 'default-fatura',
    title: 'Fatura & Ödeme Bilgisi',
    body: 'Sayın Yetkili,\n\nCari hesabınıza ait güncel fatura ve banka hesap detaylarımız ekte yer almaktadır. Ödeme dekontunuzu bu e-postaya yanıt olarak iletmenizi rica ederiz.\n\nTeşekkür eder, bol kazançlar dileriz.',
  },
  {
    id: 'default-toplanti',
    title: 'Toplantı & Görüşme Talebi',
    body: 'Merhaba,\n\nKonunun detaylarını değerlendirmek ve sonraki adımları planlamak üzere online veya yüz yüze bir görüşme gerçekleştirmek isteriz. Sizin için bu hafta hangi gün ve saat aralıkları uygundur?\n\nİyi çalışmalar,',
  },
  {
    id: 'default-tesekkur',
    title: 'Bilgilendirme & Teşekkür',
    body: 'Merhaba,\n\nİletiniz ve geri bildiriminiz için teşekkür ederiz. Talebiniz ilgili departmanımıza aktarılmış olup en kısa sürede tarafınıza dönüş sağlanacaktır.\n\nİyi günler dileriz.',
  },
];

export default function TemplateSelectorModal(props: {
  open: boolean;
  templates: MailTemplate[];
  currentText?: string;
  onSelect: (body: string) => void;
  onSaveTemplate: (title: string, body: string) => void;
  onDeleteTemplate: (id: string) => void;
  onClose: () => void;
}) {
  const { open, templates, currentText, onSelect, onSaveTemplate, onDeleteTemplate, onClose } = props;
  const [filter, setFilter] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  if (!open) return null;

  const allTemplates = templates && templates.length > 0 ? templates : DEFAULT_TEMPLATES;
  const filtered = allTemplates.filter(
    (t) =>
      t.title.toLowerCase().includes(filter.toLowerCase()) ||
      t.body.toLowerCase().includes(filter.toLowerCase())
  );

  const handleSaveCurrent = () => {
    if (!newTitle.trim()) return;
    onSaveTemplate(newTitle.trim(), currentText || '');
    setNewTitle('');
    setShowAddForm(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="E-posta Şablonları">
      <div className="modal-content template-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📄 Hızlı Yanıt Şablonları</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Kapat">✕</button>
        </div>

        <div className="template-modal-body">
          <input
            type="search"
            className="input template-search"
            placeholder="Şablonlarda ara..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />

          <div className="template-list">
            {filtered.length === 0 ? (
              <p className="empty-hint">Aramanıza uygun şablon bulunamadı.</p>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className="template-item">
                  <div className="template-item-content">
                    <h4 className="template-item-title">{item.title}</h4>
                    <p className="template-item-preview">{item.body.slice(0, 140)}...</p>
                  </div>
                  <div className="template-item-actions">
                    <button
                      type="button"
                      className="cmd template-use-btn"
                      onClick={() => {
                        onSelect(item.body);
                        onClose();
                      }}
                    >
                      Ekle
                    </button>
                    {!item.id.startsWith('default-') ? (
                      <button
                        type="button"
                        className="text-btn danger"
                        onClick={() => onDeleteTemplate(item.id)}
                        title="Şablonu sil"
                      >
                        🗑️
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          {currentText && currentText.trim().length > 10 ? (
            <div className="template-save-box">
              {showAddForm ? (
                <div className="template-save-form">
                  <input
                    type="text"
                    className="input"
                    placeholder="Şablon başlığı girin (Örn: Fiyat Teklifi)..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                  <div className="template-save-actions">
                    <button
                      type="button"
                      className="cmd primary"
                      onClick={handleSaveCurrent}
                      disabled={!newTitle.trim()}
                    >
                      Kaydet
                    </button>
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => setShowAddForm(false)}
                    >
                      İptal
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-btn template-add-btn"
                  onClick={() => setShowAddForm(true)}
                >
                  ➕ Mevcut Yazıyı Şablon Olarak Kaydet
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
