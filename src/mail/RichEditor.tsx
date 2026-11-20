import { useEffect, useRef, useState } from 'react';
import { sanitizeComposeHtml } from './format';

export type RichEditorAiInput = {
  text: string;
  instruction?: string;
  mode: 'expand' | 'translate' | 'polish' | 'shorten';
  targetLanguage: string;
};

export type RichEditorAiOutput = {
  subject?: string;
  htmlBody: string;
  body: string;
  warning?: string;
};

type Props = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  label?: string;
  onAiAssist?: (input: RichEditorAiInput) => Promise<RichEditorAiOutput>;
};

const AI_LANGUAGES = [
  { code: 'tr', label: '🇹🇷 Türkçe' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'ar', label: '🇸🇦 العربية (Arapça)' },
  { code: 'ru', label: '🇷🇺 Русский (Rusça)' },
  { code: 'de', label: '🇩🇪 Deutsch (Almanca)' },
  { code: 'fr', label: '🇫🇷 Français (Fransızca)' },
  { code: 'es', label: '🇪🇸 Español (İspanyolca)' },
];

export default function RichEditor({ value, onChange, disabled, label = 'Biçimli ileti', onAiAssist }: Props) {
  const editor = useRef<HTMLDivElement>(null);
  const [showLinkBox, setShowLinkBox] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [showAiBar, setShowAiBar] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const [aiLang, setAiLang] = useState('en');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  useEffect(() => {
    if (editor.current && editor.current !== document.activeElement) {
      editor.current.innerHTML = sanitizeComposeHtml(value);
    }
  }, [value]);

  function command(name: string, argument?: string) {
    editor.current?.focus();
    document.execCommand(name, false, argument);
    if (editor.current) onChange(sanitizeComposeHtml(editor.current.innerHTML));
  }

  function applyLink() {
    const trimmed = linkUrl.trim();
    if (trimmed && /^(https?:\/\/|mailto:)/i.test(trimmed)) {
      command('createLink', trimmed);
    }
    setShowLinkBox(false);
    setLinkUrl('https://');
  }

  async function runAi(mode: 'expand' | 'translate' | 'polish' | 'shorten') {
    if (!onAiAssist || aiBusy || disabled) return;
    const currentHtml = editor.current ? editor.current.innerHTML : value;
    const plainCurrent = (editor.current?.innerText || '').trim();
    const effectiveText = plainCurrent || aiNote.trim();
    if (!effectiveText) {
      setAiMessage('Lütfen editöre veya aşağıdaki kutuya kısa bir not yazın.');
      return;
    }
    setAiBusy(true);
    setAiMessage('');
    try {
      const res = await onAiAssist({
        text: plainCurrent ? currentHtml : aiNote.trim(),
        instruction: plainCurrent && aiNote.trim() ? aiNote.trim() : '',
        mode,
        targetLanguage: aiLang,
      });
      const safe = sanitizeComposeHtml(res.htmlBody || '');
      if (editor.current) {
        editor.current.innerHTML = safe;
      }
      onChange(safe);
      setAiNote('');
      setAiMessage(res.warning ? `ℹ️ ${res.warning}` : '✨ Kurumsal metin hazırlandı ve editöre uygulandı.');
    } catch (err) {
      setAiMessage(`⚠️ ${err instanceof Error ? err.message : 'AI yazım desteği başarısız oldu.'}`);
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="rich-editor">
      <div className="editor-toolbar" role="toolbar" aria-label="Metin biçimlendirme" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {([['bold', 'Kalın'], ['italic', 'İtalik'], ['underline', 'Altı çizili'], ['insertUnorderedList', 'Liste']] as const).map(([name, title]) => (
          <button
            key={name}
            type="button"
            className="text-btn"
            disabled={disabled || aiBusy}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command(name)}
          >
            {title}
          </button>
        ))}
        <button
          type="button"
          className={showLinkBox ? 'text-btn on' : 'text-btn'}
          disabled={disabled || aiBusy}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setShowLinkBox((v) => !v)}
        >
          Bağlantı
        </button>

        {onAiAssist ? (
          <button
            type="button"
            className={showAiBar ? 'primary slim' : 'cmd'}
            style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600 }}
            disabled={disabled || aiBusy}
            onClick={() => {
              setShowAiBar((v) => !v);
              setAiMessage('');
            }}
            title="Kısa bir Türkçe notu kurumsal e-postaya dönüştürün veya yabancı dile çevirin"
          >
            ✨ AI ile Yaz &amp; Çevir
          </button>
        ) : null}
      </div>

      {showLinkBox ? (
        <div style={{ display: 'flex', gap: 6, padding: '6px 10px', background: 'var(--bg-secondary, rgba(0,0,0,0.03))', borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.08))', alignItems: 'center' }}>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
          />
          <button type="button" className="primary slim" onClick={applyLink}>Ekle</button>
          <button type="button" className="text-btn" onClick={() => setShowLinkBox(false)}>İptal</button>
        </div>
      ) : null}

      {onAiAssist && showAiBar ? (
        <div
          className="ai-compose-bar"
          style={{
            display: 'grid',
            gap: 8,
            padding: '10px 12px',
            background: 'linear-gradient(135deg, rgba(37,99,235,0.07), rgba(124,58,237,0.06))',
            borderBottom: '1px solid rgba(37,99,235,0.2)',
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={aiNote}
              onChange={(e) => setAiNote(e.target.value)}
              disabled={disabled || aiBusy}
              placeholder="Kısa not veya talimat (Örn: Yarın yükleme hazır, konşimentoyu öğleden sonra ileteceğiz)…"
              style={{ flex: '1 1 240px', fontSize: 13, padding: '6px 10px', borderRadius: 6 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void runAi('expand');
                }
              }}
            />
            <select
              aria-label="Hedef dil"
              value={aiLang}
              onChange={(e) => setAiLang(e.target.value)}
              disabled={disabled || aiBusy}
              style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, fontWeight: 600 }}
            >
              {AI_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="primary slim"
              disabled={disabled || aiBusy}
              onClick={() => { void runAi('expand'); }}
              title="Kısa notu seçili dilde tam kurumsal e-postaya dönüştürür"
            >
              {aiBusy ? '⏳ Hazırlanıyor…' : '✨ Kurumsal Genişlet'}
            </button>
            <button
              type="button"
              className="cmd"
              disabled={disabled || aiBusy}
              onClick={() => { void runAi('translate'); }}
              title="Mevcut metni seçili dile profesyonelce çevirir"
            >
              🌐 Seçili Dile Çevir
            </button>
            <button
              type="button"
              className="cmd"
              disabled={disabled || aiBusy}
              onClick={() => { void runAi('polish'); }}
              title="İmla ve üslubu daha diplomatik ve kurumsal hale getirir"
            >
              🪄 Resmi Üsluba Düzelt
            </button>
            <button
              type="button"
              className="cmd"
              disabled={disabled || aiBusy}
              onClick={() => { void runAi('shorten'); }}
              title="Metni net ve öz hale getirir"
            >
              ✂️ Özetle / Kısalt
            </button>
            <button
              type="button"
              className="text-btn"
              style={{ marginLeft: 'auto', fontSize: 12 }}
              onClick={() => setShowAiBar(false)}
              disabled={aiBusy}
            >
              Gizle
            </button>
          </div>
          {aiMessage ? (
            <div style={{ fontSize: 12, color: aiMessage.startsWith('⚠️') ? '#dc2626' : '#1d4ed8', fontWeight: 500 }}>
              {aiMessage}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        ref={editor}
        className="editor-content"
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        contentEditable={!disabled && !aiBusy}
        suppressContentEditableWarning
        onInput={() => editor.current && onChange(sanitizeComposeHtml(editor.current.innerHTML))}
        onPaste={(event) => {
          event.preventDefault();
          const html = event.clipboardData.getData('text/html');
          if (html) command('insertHTML', sanitizeComposeHtml(html));
          else command('insertText', event.clipboardData.getData('text/plain'));
        }}
      />
    </div>
  );
}
