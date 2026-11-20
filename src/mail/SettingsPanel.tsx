import { FormEvent, useState } from 'react';
import type { AdminOverview, MailAccount, UserSettings } from './types';
import RichEditor from './RichEditor';

type Props = {
  accounts: MailAccount[];
  accountId: string;
  settings: UserSettings;
  busy?: boolean;
  onClose: () => void;
  onAddAccount?: () => void;
  onSave: (patch: Partial<UserSettings>) => Promise<void>;
  onToggleEnabled?: (accountId: string, enabled: boolean) => Promise<void>;
  onTest?: (accountId: string) => Promise<void>;
  onLoadAdminOverview?: () => Promise<AdminOverview>;
  onInviteUser?: (input: { email: string; accountIds: string[]; permissions: { read: boolean; send: boolean; manage: boolean } }) => Promise<void>;
  onSetUserAccess?: (input: { uid: string; accountId: string; permissions: { read: boolean; send: boolean; manage: boolean } | null }) => Promise<void>;
};

export default function SettingsPanel(props: Props) {
  const current = props.accounts.find((item) => item.id === props.accountId) || props.accounts[0];
  const signature = current ? props.settings.signatures[current.id] || { new: '', reply: '' } : { new: '', reply: '' };
  const [theme, setTheme] = useState(props.settings.theme);
  const [defaultAccountId, setDefaultAccountId] = useState(props.settings.defaultAccountId || props.accountId);
  const [undoSendSeconds, setUndoSendSeconds] = useState(props.settings.undoSendSeconds !== undefined ? props.settings.undoSendSeconds : 5);
  const [sigNew, setSigNew] = useState(signature.new);
  const [sigReply, setSigReply] = useState(signature.reply);
  const [templates, setTemplates] = useState(props.settings.templates);
  const [labels, setLabels] = useState(props.settings.labels || [
    { id: 'lbl_work', name: 'İş / Müşteri', color: '#2563eb' },
    { id: 'lbl_urgent', name: 'Acil', color: '#dc2626' },
    { id: 'lbl_finance', name: 'Fatura / Muhasebe', color: '#16a34a' },
  ]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#2563eb');
  const [rules, setRules] = useState(props.settings.rules || []);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleField, setNewRuleField] = useState<'from' | 'to' | 'subject'>('from');
  const [newRuleCondition, setNewRuleCondition] = useState<'contains' | 'equals' | 'starts'>('contains');
  const [newRuleValue, setNewRuleValue] = useState('');
  const [newRuleAction, setNewRuleAction] = useState<'label' | 'star' | 'read' | 'move'>('label');
  const [newRuleTarget, setNewRuleTarget] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(props.settings.sound !== 'off');
  const [notifPerm, setNotifPerm] = useState(() => {
    try { return typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported'; } catch { return 'unsupported'; }
  });
  const [adminData, setAdminData] = useState<AdminOverview | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteAccounts, setInviteAccounts] = useState<string[]>([]);
  const [invitePerms, setInvitePerms] = useState({ read: true, send: true, manage: false });
  const [adminNotice, setAdminNotice] = useState('');

  async function loadAdmin() {
    if (!props.onLoadAdminOverview || adminBusy) return;
    setAdminBusy(true);
    setError('');
    try {
      const res = await props.onLoadAdminOverview();
      setAdminData(res);
      setAdminOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yönetici verileri alınamadı.');
    } finally {
      setAdminBusy(false);
    }
  }

  async function submitInvite() {
    if (!props.onInviteUser || !inviteEmail.trim() || !inviteAccounts.length || adminBusy) return;
    setAdminBusy(true);
    setError('');
    setAdminNotice('');
    try {
      await props.onInviteUser({ email: inviteEmail.trim(), accountIds: inviteAccounts, permissions: invitePerms });
      setInviteEmail('');
      setInviteAccounts([]);
      setAdminNotice('Kullanıcı yetkilendirildi / davet oluşturuldu.');
      if (props.onLoadAdminOverview) setAdminData(await props.onLoadAdminOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Davet gönderilemedi.');
    } finally {
      setAdminBusy(false);
    }
  }

  async function revokeGrant(uid: string, accId: string) {
    if (!props.onSetUserAccess || adminBusy) return;
    setAdminBusy(true);
    setError('');
    try {
      await props.onSetUserAccess({ uid, accountId: accId, permissions: null });
      if (props.onLoadAdminOverview) setAdminData(await props.onLoadAdminOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yetki kaldırılamadı.');
    } finally {
      setAdminBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const signatures = { ...props.settings.signatures };
      if (current) signatures[current.id] = { new: sigNew, reply: sigReply };
      await props.onSave({ theme, defaultAccountId, signatures, templates, labels, rules, undoSendSeconds });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ayarlar kaydedilemedi.');
    }
  }

  function addLabel() {
    if (!newLabelName.trim()) return;
    const newLbl = { id: `lbl_${Date.now()}`, name: newLabelName.trim(), color: newLabelColor };
    setLabels((prev) => [...prev, newLbl]);
    setNewLabelName('');
  }

  function removeLabel(id: string) {
    setLabels((prev) => prev.filter((l) => l.id !== id));
  }

  function addRule() {
    if (!newRuleValue.trim()) return;
    const rule = {
      id: `rule_${Date.now()}`,
      name: newRuleName.trim() || `${newRuleField} ${newRuleCondition} ${newRuleValue}`,
      field: newRuleField,
      condition: newRuleCondition,
      value: newRuleValue.trim(),
      action: newRuleAction,
      target: newRuleTarget.trim(),
      enabled: true,
    };
    setRules((prev) => [...prev, rule]);
    setNewRuleName('');
    setNewRuleValue('');
    setNewRuleTarget('');
  }

  function removeRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  async function addTemplate(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setTemplates((rows) => [...rows, { id: crypto.randomUUID(), title: title.trim(), body }].slice(0, 12));
    setTitle('');
    setBody('');
  }

  return (
    <div className="settings card">
      <div className="settings-head">
        <h2>Ayarlar</h2>
        <button type="button" className="text-btn" onClick={props.onClose} disabled={props.busy}>Kapat</button>
      </div>
      {props.onAddAccount ? (
        <button type="button" className="primary slim" style={{ marginTop: 16 }} onClick={props.onAddAccount} disabled={props.busy}>Yeni e-posta hesabı ekle</button>
      ) : null}
      <form onSubmit={save}>
        <h3>Sesli ve masaüstü bildirimleri</h3>
        <div className="preset" style={{ marginBottom: 14 }}>
          <label className="choice">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => {
                const next = e.target.checked;
                setSoundEnabled(next);
                void props.onSave({ sound: next ? 'on' : 'off' });
              }}
            />
            Yeni gelen iletilerde sesli bildirim çal
          </label>
          {notifPerm !== 'unsupported' ? (
            <div className="actions" style={{ marginTop: 4 }}>
              <span className="meta">
                Tarayıcı bildirimi: <strong>{notifPerm === 'granted' ? 'Açık' : notifPerm === 'denied' ? 'Engellendi' : 'İzin bekleniyor'}</strong>
              </span>
              {notifPerm !== 'granted' ? (
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => {
                    try {
                      void window.Notification.requestPermission().then((res) => setNotifPerm(res));
                    } catch { /* ignore */ }
                  }}
                >
                  Bildirim izni ver
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <h3>Görünüm</h3>
        <fieldset className="preset">
          <legend>Tema</legend>
          <label className="choice"><input type="radio" name="theme" checked={theme === 'light'} onChange={() => setTheme('light')} /> Açık</label>
          <label className="choice"><input type="radio" name="theme" checked={theme === 'dark'} onChange={() => setTheme('dark')} /> Koyu</label>
        </fieldset>
        <label>Varsayılan hesap
          <select value={defaultAccountId} onChange={(e) => setDefaultAccountId(e.target.value)} disabled={props.busy}>
            {props.accounts.map((item) => <option key={item.id} value={item.id}>{item.displayName} — {item.email}</option>)}
          </select>
        </label>
        <label>Gönderimi Geri Alma Süresi (Undo Send)
          <select value={undoSendSeconds} onChange={(e) => setUndoSendSeconds(Number(e.target.value))} disabled={props.busy}>
            <option value={0}>Kapalı (Anında Gönder)</option>
            <option value={5}>5 Saniye</option>
            <option value={10}>10 Saniye (Önerilen)</option>
            <option value={20}>20 Saniye</option>
            <option value={30}>30 Saniye</option>
          </select>
        </label>
        {current ? (
          <>
            <h3>{current.displayName} imzası</h3>
            <p className="meta">Yeni iletiler ve yanıtlar için ayrı imza kullanabilirsiniz.</p>
            <label className="body-field">Yeni ileti imzası
              <RichEditor value={sigNew} onChange={setSigNew} disabled={props.busy} label="Yeni ileti imzası" />
            </label>
            <label className="body-field">Yanıt / ilet imzası
              <RichEditor value={sigReply} onChange={setSigReply} disabled={props.busy} label="Yanıt imzası" />
            </label>
          </>
        ) : null}
        <h3>Hazır şablonlar</h3>
        <div className="template-add">
          <label>Başlık<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} /></label>
          <label className="body-field">Metin
            <RichEditor value={body} onChange={setBody} disabled={props.busy} label="Şablon" />
          </label>
          <button type="button" className="text-btn" onClick={addTemplate} disabled={props.busy}>Şablon ekle</button>
        </div>
        {templates.map((item) => (
          <div key={item.id} className="template-row">
            <strong>{item.title}</strong>
            <button type="button" className="text-btn danger" onClick={() => setTemplates((rows) => rows.filter((row) => row.id !== item.id))} disabled={props.busy}>Sil</button>
          </div>
        ))}
        <h3>Renkli Etiketler (Labels)</h3>
        <p className="meta">İletileri kategorize etmek ve gelen kutusunda ayırt etmek için özel etiketler tanımlayın.</p>
        <div className="template-add" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={newLabelName}
            onChange={(e) => setNewLabelName(e.target.value)}
            placeholder="Etiket adı (Örn: Müşteri, Teklif, Acil)"
            style={{ flex: 1 }}
          />
          <input
            type="color"
            value={newLabelColor}
            onChange={(e) => setNewLabelColor(e.target.value)}
            title="Renk seçin"
            style={{ width: 40, height: 36, padding: 2, cursor: 'pointer' }}
          />
          <button type="button" className="text-btn" onClick={addLabel} disabled={props.busy}>Etiket Ekle</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {labels.map((lbl) => (
            <span key={lbl.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${lbl.color}22`, color: lbl.color, border: `1px solid ${lbl.color}`, borderRadius: 16, padding: '4px 10px', fontSize: 13, fontWeight: 500 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: lbl.color }} />
              {lbl.name}
              <button type="button" onClick={() => removeLabel(lbl.id)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 14 }}>×</button>
            </span>
          ))}
        </div>

        <h3>Otomatik Filtre Kuralları (Auto-Rules)</h3>
        <p className="meta">Gelen iletileri gönderen, alıcı veya konuya göre otomatik etiketleyin, yıldızlayın veya klasörleyin.</p>
        <div className="template-add" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, background: 'rgba(0,0,0,0.03)', padding: 12, borderRadius: 8 }}>
          <input value={newRuleName} onChange={(e) => setNewRuleName(e.target.value)} placeholder="Kural Adı" />
          <select value={newRuleField} onChange={(e) => setNewRuleField(e.target.value as any)}>
            <option value="from">Gönderen</option>
            <option value="to">Alıcı</option>
            <option value="subject">Konu</option>
          </select>
          <select value={newRuleCondition} onChange={(e) => setNewRuleCondition(e.target.value as any)}>
            <option value="contains">İçeriyorsa</option>
            <option value="equals">Tam Eşleşirse</option>
            <option value="starts">İle Başlıyorsa</option>
          </select>
          <input value={newRuleValue} onChange={(e) => setNewRuleValue(e.target.value)} placeholder="Eşleşecek Değer (Örn: @firma.com)" />
          <select value={newRuleAction} onChange={(e) => setNewRuleAction(e.target.value as any)}>
            <option value="label">Etiketle</option>
            <option value="star">Yıldızla</option>
            <option value="read">Okundu İşaretle</option>
            <option value="move">Klasöre Taşı</option>
          </select>
          {newRuleAction === 'label' ? (
            <select value={newRuleTarget} onChange={(e) => setNewRuleTarget(e.target.value)}>
              <option value="">Etiket seçin…</option>
              {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          ) : newRuleAction === 'move' ? (
            <select value={newRuleTarget} onChange={(e) => setNewRuleTarget(e.target.value)}>
              <option value="">Klasör seçin…</option>
              <option value="archive">Arşiv</option>
              <option value="trash">Çöp</option>
              <option value="spam">Spam</option>
            </select>
          ) : null}
          <button type="button" className="primary slim" onClick={addRule} disabled={props.busy} style={{ gridColumn: '1 / -1' }}>Kural Ekle</button>
        </div>
        {rules.map((rule) => (
          <div key={rule.id} className="template-row" style={{ marginTop: 8 }}>
            <span>
              <strong>{rule.name}</strong>{' '}
              <small>({rule.field} {rule.condition} "{rule.value}" → {rule.action} {rule.target || ''})</small>
            </span>
            <button type="button" className="text-btn danger" onClick={() => removeRule(rule.id)} disabled={props.busy}>Sil</button>
          </div>
        ))}
        <h3>Hesaplar</h3>
        {props.accounts.map((item) => (
          <div key={item.id} className="settings-account">
            <div>
              <strong>{item.displayName}</strong>
              <small>{item.email}{item.enabled === false ? ' · Pasif' : ''}{item.lastOkAt ? ` · Son bağlantı ${new Date(item.lastOkAt).toLocaleString('tr-TR')}` : ''}{item.lastError ? ` · ${item.lastError}` : ''}</small>
            </div>
            <div className="settings-account-actions">
              {props.onToggleEnabled ? <button type="button" className="text-btn" disabled={props.busy} onClick={() => { void props.onToggleEnabled?.(item.id, item.enabled === false); }}>{item.enabled === false ? 'Etkinleştir' : 'Pasifleştir'}</button> : null}
              {props.onTest ? <button type="button" className="text-btn" disabled={props.busy} onClick={() => { void props.onTest?.(item.id); }}>IMAP/SMTP test</button> : null}
            </div>
          </div>
        ))}
        {props.onLoadAdminOverview ? (
          <>
            <h3>Ekip &amp; Yetki Yönetimi (Admin)</h3>
            <p className="meta">Ekip üyelerine belirli posta hesapları için okuma, gönderme veya yönetim yetkisi tanımlayın.</p>
            {!adminOpen ? (
              <button type="button" className="chip-btn" disabled={props.busy || adminBusy} onClick={() => { void loadAdmin(); }}>
                {adminBusy ? 'Yükleniyor…' : 'Yetki ve Denetim Panelini Aç'}
              </button>
            ) : (
              <div className="bulk-picker" style={{ marginBottom: 14 }}>
                <div className="bulk-picker-bar">
                  <strong>Kullanıcı Yetkilendir / Davet Et</strong>
                  <button type="button" className="chip-btn" disabled={adminBusy} onClick={() => { void loadAdmin(); }}>Yenile</button>
                </div>
                {adminNotice ? <p className="note" role="status">{adminNotice}</p> : null}
                <div className="template-add" style={{ display: 'grid', gap: 8 }}>
                  <input
                    type="email"
                    placeholder="Ekip üyesi e-posta adresi (örn: kullanici@firma.com)"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <div className="contact-groups-bar">
                    <span className="quick-label">İzinler:</span>
                    <label className="choice"><input type="checkbox" checked={invitePerms.read} onChange={(e) => setInvitePerms((p) => ({ ...p, read: e.target.checked }))} /> Okuma</label>
                    <label className="choice"><input type="checkbox" checked={invitePerms.send} onChange={(e) => setInvitePerms((p) => ({ ...p, send: e.target.checked }))} /> Gönderme</label>
                    <label className="choice"><input type="checkbox" checked={invitePerms.manage} onChange={(e) => setInvitePerms((p) => ({ ...p, manage: e.target.checked }))} /> Yönetim</label>
                    <button type="button" className="chip-btn" onClick={() => setInviteAccounts(props.accounts.map((a) => a.id))}>Tüm Hesapları Seç</button>
                  </div>
                  <div className="bulk-picker-grid" style={{ maxHeight: 140 }}>
                    {props.accounts.map((acc) => (
                      <label key={acc.id} className="choice bulk-choice">
                        <input
                          type="checkbox"
                          checked={inviteAccounts.includes(acc.id)}
                          onChange={() => setInviteAccounts((cur) => cur.includes(acc.id) ? cur.filter((x) => x !== acc.id) : [...cur, acc.id])}
                        />
                        <span><strong>{acc.displayName}</strong> <small>{acc.email}</small></span>
                      </label>
                    ))}
                  </div>
                  <button type="button" className="primary slim" disabled={adminBusy || !inviteEmail.trim() || !inviteAccounts.length} onClick={() => { void submitInvite(); }}>
                    Yetki Tanımla / Davet Gönder
                  </button>
                </div>
                {adminData && adminData.grants.length > 0 ? (
                  <div style={{ marginTop: 10 }}>
                    <strong style={{ fontSize: 12 }}>Mevcut Yetkiler ({adminData.grants.length})</strong>
                    {adminData.grants.slice(0, 30).map((g) => {
                      const usr = adminData.users.find((u) => u.uid === g.uid);
                      const acc = props.accounts.find((a) => a.id === g.accountId);
                      return (
                        <div key={`${g.uid}:${g.accountId}`} className="template-row" style={{ marginTop: 6 }}>
                          <span>
                            <strong>{usr?.email || g.uid}</strong> → {acc?.displayName || g.accountId}{' '}
                            <small>({[g.permissions.read && 'Oku', g.permissions.send && 'Gönder', g.permissions.manage && 'Yönet'].filter(Boolean).join(', ')})</small>
                          </span>
                          <button type="button" className="text-btn danger" disabled={adminBusy} onClick={() => { void revokeGrant(g.uid, g.accountId); }}>Kaldır</button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}
          </>
        ) : null}
        <h3>Kısayollar</h3>
        <p className="shortcuts"><kbd>C</kbd>/<kbd>N</kbd> yeni · <kbd>R</kbd> yanıtla · <kbd>F</kbd> ilet · <kbd>E</kbd> arşivle · <kbd>Del</kbd> sil · <kbd>Shift+I</kbd> okundu · <kbd>/</kbd> ara · <kbd>Esc</kbd> geri</p>
        {error ? <p className="alert" role="alert">{error}</p> : null}
        <div className="actions"><button className="primary" type="submit" disabled={props.busy}>Ayarları kaydet</button></div>
      </form>
    </div>
  );
}
