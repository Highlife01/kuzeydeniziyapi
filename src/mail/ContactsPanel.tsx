import { FormEvent, useMemo, useState } from 'react';
import type { ContactItem } from './types';
import { initials } from './format';
import Icon, { tint } from './Icon';

type Props = {
  contacts: ContactItem[];
  busy?: boolean;
  onClose: () => void;
  onSaveContacts: (nextContacts: ContactItem[], deletedEmails?: string[]) => Promise<void>;
  onComposeTo: (emails: string[]) => void;
  onNotify: (msg: string) => void;
};

const DEFAULT_GROUPS = ['Müşteriler', 'Tedarikçiler', 'Ekip', 'VIP', 'Resmi Kurum', 'Genel'];

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function ContactsPanel({ contacts, busy, onClose, onSaveContacts, onComposeTo, onNotify }: Props) {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'freq' | 'name' | 'email' | 'recent'>('freq');
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingOriginalEmail, setEditingOriginalEmail] = useState<string | null>(null);

  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formGroup, setFormGroup] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  const [importText, setImportText] = useState('');
  const [importGroup, setImportGroup] = useState('');
  const [bulkGroupTarget, setBulkGroupTarget] = useState('Müşteriler');
  const [saving, setSaving] = useState(false);

  const allGroups = useMemo(() => {
    const set = new Set<string>(DEFAULT_GROUPS);
    for (const c of contacts) {
      if (c.group?.trim()) set.add(c.group.trim());
    }
    return [...set];
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = contacts.filter((c) => {
      if (groupFilter === '__frequent__') {
        if ((c.sentCount || 0) <= 0) return false;
      } else if (groupFilter !== 'all') {
        if ((c.group || '') !== groupFilter) return false;
      }
      if (!q) return true;
      return (
        c.email.toLowerCase().includes(q)
        || (c.name || '').toLowerCase().includes(q)
        || (c.phone || '').toLowerCase().includes(q)
        || (c.company || '').toLowerCase().includes(q)
        || (c.group || '').toLowerCase().includes(q)
        || (c.notes || '').toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name || a.email).localeCompare(b.name || b.email, 'tr');
      }
      if (sortBy === 'email') {
        return a.email.localeCompare(b.email, 'tr');
      }
      if (sortBy === 'recent') {
        return (b.lastAt || 0) - (a.lastAt || 0);
      }
      return (
        ((b.sentCount || 0) - (a.sentCount || 0))
        || (((b.sentCount || 0) + (b.receivedCount || 0)) - ((a.sentCount || 0) + (a.receivedCount || 0)))
        || ((b.lastAt || 0) - (a.lastAt || 0))
      );
    });
  }, [contacts, search, groupFilter, sortBy]);

  const frequentCount = useMemo(() => contacts.filter((c) => (c.sentCount || 0) > 0).length, [contacts]);
  const groupedCount = useMemo(() => contacts.filter((c) => Boolean(c.group?.trim())).length, [contacts]);

  function openNewForm() {
    setEditingOriginalEmail(null);
    setFormEmail('');
    setFormName('');
    setFormPhone('');
    setFormCompany('');
    setFormGroup('');
    setFormNotes('');
    setFormError('');
    setShowImport(false);
    setShowForm(true);
  }

  function openEditForm(item: ContactItem) {
    setEditingOriginalEmail(item.email);
    setFormEmail(item.email);
    setFormName(item.name || '');
    setFormPhone(item.phone || '');
    setFormCompany(item.company || '');
    setFormGroup(item.group || '');
    setFormNotes(item.notes || '');
    setFormError('');
    setShowImport(false);
    setShowForm(true);
  }

  async function handleSaveForm(e: FormEvent) {
    e.preventDefault();
    const cleanEmail = formEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(cleanEmail)) {
      setFormError('Geçerli bir e-posta adresi girin.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      const existing = contacts.find((c) => c.email.toLowerCase() === (editingOriginalEmail || cleanEmail).toLowerCase());
      const updatedItem: ContactItem = {
        email: formEmail.trim(),
        name: formName.trim(),
        phone: formPhone.trim() || undefined,
        company: formCompany.trim() || undefined,
        group: formGroup.trim() || undefined,
        notes: formNotes.trim() || undefined,
        sentCount: existing?.sentCount || 0,
        receivedCount: existing?.receivedCount || 0,
        lastAt: Date.now(),
      };
      const nextList = contacts.filter((c) => {
        const key = c.email.toLowerCase();
        if (editingOriginalEmail && key === editingOriginalEmail.toLowerCase()) return false;
        if (key === cleanEmail) return false;
        return true;
      });
      nextList.unshift(updatedItem);
      const deleted = editingOriginalEmail && editingOriginalEmail.toLowerCase() !== cleanEmail ? [editingOriginalEmail] : undefined;
      await onSaveContacts(nextList, deleted);
      setShowForm(false);
      setEditingOriginalEmail(null);
      onNotify(editingOriginalEmail ? `${updatedItem.email} güncellendi.` : `${updatedItem.email} rehbere eklendi.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kişi kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSingle(email: string) {
    if (!window.confirm(`${email} adresini rehberden silmek istiyor musunuz?`)) return;
    setSaving(true);
    try {
      const nextList = contacts.filter((c) => c.email.toLowerCase() !== email.toLowerCase());
      await onSaveContacts(nextList, [email]);
      setSelectedEmails((cur) => cur.filter((e) => e.toLowerCase() !== email.toLowerCase()));
      onNotify(`${email} rehberden silindi.`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSelected() {
    if (!selectedEmails.length) return;
    if (!window.confirm(`Seçili ${selectedEmails.length} kişiyi rehberden silmek istiyor musunuz?`)) return;
    setSaving(true);
    try {
      const delSet = new Set(selectedEmails.map((e) => e.toLowerCase()));
      const nextList = contacts.filter((c) => !delSet.has(c.email.toLowerCase()));
      await onSaveContacts(nextList, selectedEmails);
      onNotify(`${selectedEmails.length} kişi rehberden silindi.`);
      setSelectedEmails([]);
    } finally {
      setSaving(false);
    }
  }

  async function handleAssignGroupSelected() {
    if (!selectedEmails.length) return;
    setSaving(true);
    try {
      const selSet = new Set(selectedEmails.map((e) => e.toLowerCase()));
      const nextList = contacts.map((c) => (
        selSet.has(c.email.toLowerCase()) ? { ...c, group: bulkGroupTarget.trim() || undefined } : c
      ));
      await onSaveContacts(nextList);
      onNotify(`${selectedEmails.length} kişi "${bulkGroupTarget || 'Grupsuz'}" olarak güncellendi.`);
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkImport(e: FormEvent) {
    e.preventDefault();
    if (!importText.trim()) return;
    const lines = importText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsedItems: ContactItem[] = [];
    const now = Date.now();

    for (const line of lines) {
      if (line.includes(';') || (line.includes(',') && !line.includes('<'))) {
        const sep = line.includes(';') ? ';' : ',';
        const cols = line.split(sep).map((p) => p.replace(/^["']|["']$/g, '').trim());
        const emailIdx = cols.findIndex((c) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c));
        if (emailIdx >= 0) {
          const email = cols[emailIdx];
          if (/^e-?posta|^email/i.test(email)) continue;
          const name = emailIdx === 1 ? cols[0] : (cols[0] !== email ? cols[0] : '');
          const phone = cols[emailIdx + 1] || '';
          const company = cols[emailIdx + 2] || '';
          const grp = cols[emailIdx + 3] || importGroup.trim();
          const notes = cols[emailIdx + 4] || '';
          parsedItems.push({
            email,
            name: name || undefined,
            phone: phone || undefined,
            company: company || undefined,
            group: grp || undefined,
            notes: notes || undefined,
            sentCount: 0,
            receivedCount: 0,
            lastAt: now,
          });
          continue;
        }
      }
      const tokens = line.split(/[\s,;]+/).map((t) => (t.match(/<([^<>]+)>$/)?.[1] || t).trim());
      for (const token of tokens) {
        if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(token)) {
          parsedItems.push({
            email: token,
            group: importGroup.trim() || undefined,
            sentCount: 0,
            receivedCount: 0,
            lastAt: now,
          });
        }
      }
    }

    if (!parsedItems.length) {
      onNotify('İçe aktarılacak geçerli e-posta adresi bulunamadı.');
      return;
    }

    setSaving(true);
    try {
      const byEmail = new Map<string, ContactItem>();
      for (const c of contacts) {
        byEmail.set(c.email.toLowerCase(), { ...c });
      }
      for (const item of parsedItems) {
        const key = item.email.toLowerCase();
        const prev = byEmail.get(key);
        byEmail.set(key, {
          email: prev?.email || item.email,
          name: item.name || prev?.name || '',
          phone: item.phone || prev?.phone,
          company: item.company || prev?.company,
          group: item.group || prev?.group,
          notes: item.notes || prev?.notes,
          sentCount: prev?.sentCount || 0,
          receivedCount: prev?.receivedCount || 0,
          lastAt: prev?.lastAt || now,
        });
      }
      const nextList = [...byEmail.values()];
      await onSaveContacts(nextList);
      setImportText('');
      setShowImport(false);
      onNotify(`${parsedItems.length} kişi rehbere aktarıldı.`);
    } finally {
      setSaving(false);
    }
  }

  function exportTargetList(): ContactItem[] {
    if (selectedEmails.length > 0) {
      const selSet = new Set(selectedEmails.map((e) => e.toLowerCase()));
      return contacts.filter((c) => selSet.has(c.email.toLowerCase()));
    }
    return filteredContacts;
  }

  function handleExportCsv() {
    const list = exportTargetList();
    if (!list.length) {
      onNotify('Dışa aktarılacak kişi yok.');
      return;
    }
    const esc = (v?: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'Ad Soyad;E-posta;Telefon;Firma;Grup;Notlar;Gönderim Sayısı;Alım Sayısı;Son Etkileşim';
    const rows = list.map((c) => [
      esc(c.name || ''),
      esc(c.email),
      esc(c.phone || ''),
      esc(c.company || ''),
      esc(c.group || ''),
      esc(c.notes || ''),
      esc(c.sentCount || 0),
      esc(c.receivedCount || 0),
      esc(c.lastAt ? new Date(c.lastAt).toLocaleString('tr-TR') : ''),
    ].join(';'));
    const csvContent = `\uFEFF${[header, ...rows].join('\r\n')}`;
    downloadBlob(`safirmail-kisiler-${new Date().toISOString().slice(0, 10)}.csv`, csvContent, 'text/csv;charset=utf-8');
    onNotify(`${list.length} kişi CSV (Excel) olarak dışa aktarıldı.`);
  }

  function handleExportVcard() {
    const list = exportTargetList();
    if (!list.length) {
      onNotify('Dışa aktarılacak kişi yok.');
      return;
    }
    const cards = list.map((c) => {
      const fn = (c.name || c.email).replace(/[\r\n]/g, ' ');
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${fn}`,
        `EMAIL;TYPE=INTERNET:${c.email}`,
      ];
      if (c.phone) lines.push(`TEL;TYPE=CELL:${c.phone}`);
      if (c.company) lines.push(`ORG:${c.company}`);
      if (c.group) lines.push(`CATEGORIES:${c.group}`);
      if (c.notes) lines.push(`NOTE:${c.notes.replace(/[\r\n]+/g, ' ')}`);
      lines.push('END:VCARD');
      return lines.join('\r\n');
    }).join('\r\n');
    downloadBlob(`safirmail-rehber-${new Date().toISOString().slice(0, 10)}.vcf`, cards, 'text/vcard;charset=utf-8');
    onNotify(`${list.length} kişi vCard (.vcf) rehber dosyası olarak indirildi.`);
  }

  function handleExportTxt() {
    const list = exportTargetList();
    if (!list.length) {
      onNotify('Dışa aktarılacak kişi yok.');
      return;
    }
    const txt = list.map((c) => c.email).join('\r\n');
    downloadBlob(`safirmail-epostalar-${new Date().toISOString().slice(0, 10)}.txt`, txt, 'text/plain;charset=utf-8');
    onNotify(`${list.length} e-posta adresi .txt olarak indirildi.`);
  }

  function handleCopyEmails() {
    const list = exportTargetList();
    if (!list.length) return;
    const text = list.map((c) => c.email).join(', ');
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(() => onNotify(`${list.length} e-posta adresi panoya kopyalandı.`));
    } else {
      onNotify(text);
    }
  }

  const disabled = Boolean(busy || saving);

  return (
    <div className="contacts-page card" aria-label="Kişilerim ve Ortak Rehber">
      <div className="settings-head contacts-head">
        <div>
          <h2>Kişilerim · Ortak Kişi Rehberi</h2>
          <p className="meta">
            Tüm hesaplarınızın ortak kullandığı kişi listesi · <strong>{contacts.length}</strong> kayıtlı adres ·{' '}
            <strong>{frequentCount}</strong> sık gönderilen · <strong>{groupedCount}</strong> gruplu kişi
          </p>
        </div>
        <div className="contacts-head-actions">
          <button type="button" className="primary slim" onClick={openNewForm} disabled={disabled}>
            <Icon name="add" size={15} /> Yeni Kişi Ekle
          </button>
          <button type="button" className="cmd" onClick={() => { setShowForm(false); setShowImport((v) => !v); }} disabled={disabled}>
            Toplu İçe Aktar
          </button>
          <button type="button" className="cmd" onClick={handleExportCsv} disabled={disabled} title="Excel uyumlu CSV olarak indir">
            CSV / Excel İndir
          </button>
          <button type="button" className="cmd" onClick={handleExportVcard} disabled={disabled} title="Telefon ve Outlook uyumlu vCard (.vcf) olarak indir">
            vCard (.vcf) İndir
          </button>
          <button type="button" className="cmd" onClick={handleExportTxt} disabled={disabled} title="Düz e-posta listesi (.txt) olarak indir">
            TXT İndir
          </button>
          <button type="button" className="text-btn" onClick={onClose} disabled={disabled}>Kapat</button>
        </div>
      </div>

      {showForm ? (
        <form className="contacts-form" onSubmit={handleSaveForm}>
          <h3>{editingOriginalEmail ? `Kişiyi Düzenle (${editingOriginalEmail})` : 'Yeni Kişi Ekle'}</h3>
          <div className="contacts-form-grid">
            <label>Ad Soyad / Görünen Ad
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Örn: Ahmet Yılmaz" maxLength={80} disabled={disabled} />
            </label>
            <label>E-posta Adresi *
              <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="ornek@firma.com" required maxLength={120} disabled={disabled} />
            </label>
            <label>Telefon Numarası
              <input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="+90 532 000 00 00" maxLength={40} disabled={disabled} />
            </label>
            <label>Firma / Kurum / Departman
              <input value={formCompany} onChange={(e) => setFormCompany(e.target.value)} placeholder="Örn: Safir Lojistik A.Ş." maxLength={80} disabled={disabled} />
            </label>
            <label>Grup / Kategori
              <input value={formGroup} onChange={(e) => setFormGroup(e.target.value)} list="contact-group-options" placeholder="Müşteriler, Tedarikçiler, VIP…" maxLength={40} disabled={disabled} />
              <datalist id="contact-group-options">
                {allGroups.map((g) => <option key={g} value={g} />)}
              </datalist>
            </label>
            <label>Notlar / Açıklama
              <input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Özel not, unvan veya ek bilgi…" maxLength={300} disabled={disabled} />
            </label>
          </div>
          {formError ? <p className="alert" role="alert">{formError}</p> : null}
          <div className="actions">
            <button type="submit" className="primary slim" disabled={disabled}>
              {saving ? 'Kaydediliyor…' : editingOriginalEmail ? 'Değişiklikleri Kaydet' : 'Kişiyi Rehbere Ekle'}
            </button>
            <button type="button" className="text-btn" onClick={() => { setShowForm(false); setEditingOriginalEmail(null); }} disabled={disabled}>Vazgeç</button>
          </div>
        </form>
      ) : null}

      {showImport ? (
        <form className="contacts-form" onSubmit={handleBulkImport}>
          <h3>Toplu Kişi İçe Aktar (CSV / Metin / Liste)</h3>
          <p className="meta">
            Her satıra bir kişi (`Ad Soyad;eposta@firma.com;Telefon;Firma;Grup`) veya virgül/boşlukla ayrılmış yüzlerce e-posta adresi yapıştırabilirsiniz.
          </p>
          <div className="contacts-form-grid">
            <label style={{ gridColumn: '1 / -1' }}>E-posta veya CSV Listesi
              <textarea
                rows={5}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={'Ahmet Yılmaz;ahmet@firma.com;05321112233;ABC A.Ş.;Müşteriler\nsatis@ornek.com, destek@ornek.com'}
                disabled={disabled}
              />
            </label>
            <label>Varsayılan Grup (İsteğe Bağlı)
              <input value={importGroup} onChange={(e) => setImportGroup(e.target.value)} list="contact-group-options" placeholder="Örn: Müşteriler" disabled={disabled} />
            </label>
          </div>
          <div className="actions">
            <button type="submit" className="primary slim" disabled={disabled || !importText.trim()}>
              {saving ? 'Aktarılıyor…' : 'Kişileri Rehbere Aktar'}
            </button>
            <button type="button" className="text-btn" onClick={() => setShowImport(false)} disabled={disabled}>Vazgeç</button>
          </div>
        </form>
      ) : null}

      <div className="contacts-toolbar">
        <div className="contacts-search-row">
          <input
            type="search"
            className="contacts-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kişilerde ara (Ad, e-posta, telefon, firma, grup veya not)…"
          />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label="Sıralama">
            <option value="freq">Sırala: Sık Gönderilenler Üstte</option>
            <option value="name">Sırala: Ad Soyad (A-Z)</option>
            <option value="email">Sırala: E-posta (A-Z)</option>
            <option value="recent">Sırala: Son Etkileşim</option>
          </select>
        </div>

        <div className="contacts-group-pills" role="tablist" aria-label="Kişi grupları">
          <button type="button" className={groupFilter === 'all' ? 'chip-btn on' : 'chip-btn'} onClick={() => setGroupFilter('all')}>
            Tümü ({contacts.length})
          </button>
          <button type="button" className={groupFilter === '__frequent__' ? 'chip-btn on' : 'chip-btn'} onClick={() => setGroupFilter('__frequent__')}>
            ★ Sık Gönderilenler ({frequentCount})
          </button>
          {allGroups.map((grp) => {
            const cnt = contacts.filter((c) => c.group === grp).length;
            if (!cnt && !DEFAULT_GROUPS.includes(grp)) return null;
            return (
              <button key={grp} type="button" className={groupFilter === grp ? 'chip-btn on' : 'chip-btn'} onClick={() => setGroupFilter(grp)}>
                {grp} ({cnt})
              </button>
            );
          })}
        </div>

        <div className="contacts-bulk-bar">
          <div className="bulk-picker-actions">
            <button type="button" className="chip-btn" disabled={disabled} onClick={() => setSelectedEmails(filteredContacts.slice(0, 16).map((c) => c.email))}>İlk 16 Seç</button>
            <button type="button" className="chip-btn" disabled={disabled} onClick={() => setSelectedEmails(filteredContacts.slice(0, 20).map((c) => c.email))}>İlk 20 Seç</button>
            <button type="button" className="chip-btn" disabled={disabled} onClick={() => setSelectedEmails(filteredContacts.slice(0, 50).map((c) => c.email))}>İlk 50 Seç</button>
            <button type="button" className="chip-btn" disabled={disabled} onClick={() => setSelectedEmails(filteredContacts.slice(0, 100).map((c) => c.email))}>İlk 100 Seç</button>
            <button type="button" className="chip-btn" disabled={disabled} onClick={() => setSelectedEmails(filteredContacts.map((c) => c.email))}>Tümünü Seç ({filteredContacts.length})</button>
            {selectedEmails.length > 0 ? (
              <button type="button" className="chip-btn" disabled={disabled} onClick={() => setSelectedEmails([])}>Seçimi Temizle ({selectedEmails.length})</button>
            ) : null}
          </div>

          {selectedEmails.length > 0 ? (
            <div className="contacts-selected-actions">
              <button type="button" className="primary slim" disabled={disabled} onClick={() => onComposeTo(selectedEmails)}>
                <Icon name="send" size={14} /> Seçilenlere İleti Yaz ({selectedEmails.length})
              </button>
              <button type="button" className="cmd" disabled={disabled} onClick={handleCopyEmails}>
                Adresleri Kopyala
              </button>
              <div className="contacts-group-assign">
                <input
                  value={bulkGroupTarget}
                  onChange={(e) => setBulkGroupTarget(e.target.value)}
                  list="contact-group-options"
                  placeholder="Grup adı…"
                  aria-label="Atanacak grup"
                />
                <button type="button" className="cmd" disabled={disabled} onClick={() => { void handleAssignGroupSelected(); }}>
                  Gruba Ata
                </button>
              </div>
              <button type="button" className="cmd danger" disabled={disabled} onClick={() => { void handleDeleteSelected(); }}>
                <Icon name="trash" size={14} /> Seçilenleri Sil ({selectedEmails.length})
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {filteredContacts.length === 0 ? (
        <div className="empty-state">
          <Icon name="mail" size={40} />
          <p>{search || groupFilter !== 'all' ? 'Arama kriterlerine uygun kişi bulunamadı.' : 'Henüz kayıtlı kişi yok.'}</p>
          <small>Gelen ve giden maillerdeki adresler otomatik eklenir veya yukarıdan "Yeni Kişi Ekle" diyebilirsiniz.</small>
        </div>
      ) : (
        <div className="contacts-table-wrap">
          <ul className="contacts-list">
            {filteredContacts.slice(0, 600).map((item) => {
              const checked = selectedEmails.includes(item.email);
              return (
                <li key={item.email} className={checked ? 'contact-card selected' : 'contact-card'}>
                  <label className="contact-check">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => setSelectedEmails((cur) => cur.includes(item.email) ? cur.filter((e) => e !== item.email) : [...cur, item.email])}
                    />
                  </label>
                  <span className="avatar" style={{ background: tint(item.email) }} aria-hidden="true">
                    {initials(item.name || '', item.email)}
                  </span>
                  <div className="contact-info">
                    <div className="contact-top-line">
                      <strong>{item.name || item.email}</strong>
                      {item.name ? <span className="contact-email">&lt;{item.email}&gt;</span> : null}
                      {item.group ? <em className="contact-group-badge">{item.group}</em> : null}
                      {item.sentCount ? <em className="freq-badge">Gönderilen ×{item.sentCount}</em> : null}
                      {item.receivedCount ? <em className="rec-badge">Gelen ×{item.receivedCount}</em> : null}
                    </div>
                    <div className="contact-meta-line">
                      {item.company ? <span>🏢 {item.company}</span> : null}
                      {item.phone ? <span>📞 {item.phone}</span> : null}
                      {item.notes ? <span className="contact-note">📝 {item.notes}</span> : null}
                      {item.lastAt ? (
                        <span className="contact-date">
                          Son: {new Date(item.lastAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="contact-actions">
                    <button type="button" className="chip-btn" disabled={disabled} onClick={() => onComposeTo([item.email])} title="Bu kişiye yeni ileti yaz">
                      Mesaj Yaz
                    </button>
                    <button type="button" className="chip-btn" disabled={disabled} onClick={() => openEditForm(item)} title="Kişi bilgilerini düzenle">
                      Düzenle
                    </button>
                    <button
                      type="button"
                      className="chip-btn"
                      disabled={disabled}
                      onClick={() => {
                        if (navigator.clipboard?.writeText) {
                          void navigator.clipboard.writeText(item.email).then(() => onNotify(`${item.email} kopyalandı.`));
                        }
                      }}
                      title="E-posta adresini kopyala"
                    >
                      Kopyala
                    </button>
                    <button type="button" className="text-btn danger" disabled={disabled} onClick={() => { void handleDeleteSingle(item.email); }} title="Kişiyi rehberden sil">
                      Sil
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {filteredContacts.length > 600 ? (
            <p className="meta" style={{ textAlign: 'center', padding: '10px 0' }}>
              İlk 600 kişi gösteriliyor (Toplam {filteredContacts.length} kişi). Daha fazlası için arama kutusunu kullanabilir veya tümünü dışa aktarabilirsiniz.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
