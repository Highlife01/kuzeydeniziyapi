import React, { useState } from 'react';
import { ContactMessage, ContactMessageStatus, ProjectItem } from '../../types';
import { formatDateTimeTR } from '../../utils/formatters';

interface MessagesTabProps {
  messages: ContactMessage[];
  onSaveMessage: (msg: ContactMessage) => Promise<void>;
  onDeleteMessage: (id: string) => Promise<void>;
  onConvertToProject: (msg: ContactMessage) => Promise<ProjectItem>;
  onReplyInMailControl: (msg: ContactMessage) => void;
}

const STATUS_FILTERS: { id: 'all' | ContactMessageStatus; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'yeni', label: 'Yeni / Okunmamış' },
  { id: 'inceleniyor', label: 'İnceleniyor' },
  { id: 'teklif-verildi', label: 'Teklif Verildi' },
  { id: 'arsiv', label: 'Arşiv' },
];

const STATUS_BADGES: Record<ContactMessageStatus, { label: string; cls: string }> = {
  yeni: {
    label: 'YENİ MESAJ',
    cls: 'bg-red-600 text-white border-red-400',
  },
  inceleniyor: {
    label: 'İnceleniyor',
    cls: 'bg-amber-950 text-amber-300 border-amber-500/50',
  },
  'teklif-verildi': {
    label: 'Teklif Verildi',
    cls: 'bg-emerald-950 text-emerald-300 border-emerald-500/50',
  },
  arsiv: {
    label: 'Arşivlendi',
    cls: 'bg-slate-800 text-slate-300 border-slate-600',
  },
};

export const MessagesTab: React.FC<MessagesTabProps> = ({
  messages,
  onSaveMessage,
  onDeleteMessage,
  onConvertToProject,
  onReplyInMailControl,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | ContactMessageStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [converting, setConverting] = useState(false);

  const filtered = messages.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.company.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.message.toLowerCase().includes(q) ||
      m.serviceLabel.toLowerCase().includes(q)
    );
  });

  const selected =
    messages.find((m) => m.id === selectedId) || filtered[0] || messages[0] || null;
  const noteInput = selected
    ? noteDrafts[selected.id] ?? selected.adminNotes ?? ''
    : '';

  const setNoteInput = (val: string) => {
    if (!selected) return;
    setNoteDrafts((prev) => ({ ...prev, [selected.id]: val }));
  };

  const handleSelect = async (msg: ContactMessage) => {
    setSelectedId(msg.id);
    if (msg.status === 'yeni') {
      const updated: ContactMessage = {
        ...msg,
        status: 'inceleniyor',
        readAt: new Date().toISOString(),
      };
      await onSaveMessage(updated);
    }
  };

  const handleUpdateStatus = async (status: ContactMessageStatus) => {
    if (!selected) return;
    const updated: ContactMessage = { ...selected, status, adminNotes: noteInput };
    await onSaveMessage(updated);
  };

  const handleSaveNotes = async () => {
    if (!selected) return;
    const updated: ContactMessage = { ...selected, adminNotes: noteInput };
    await onSaveMessage(updated);
  };

  const handleConvert = async () => {
    if (!selected) return;
    setConverting(true);
    try {
      const created = await onConvertToProject(selected);
      const updatedNotes =
        (noteInput ? `${noteInput}\n` : '') +
        `[Otomatik] ${created.code} kodlu proje taslağına dönüştürüldü.`;
      const updated: ContactMessage = {
        ...selected,
        status: 'teklif-verildi',
        convertedProjectId: created.id,
        adminNotes: updatedNotes,
      };
      setNoteDrafts((prev) => ({ ...prev, [selected.id]: updatedNotes }));
      await onSaveMessage(updated);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Header */}
      <div className="bg-[#0b1329] p-5 rounded-2xl border-2 border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">
            İletişim Formundan Gelen Mesajlar &amp; Teklif Talepleri
          </h2>
          <p className="text-xs text-slate-400">
            Ana Sayfa (#teklif-al) ve İletişim (/iletisim) formlarından gönderilen tüm mesajlar
            anlık buraya düşer.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim, kurum veya mesaj ara..."
            className="px-4 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-xs text-white placeholder-slate-400"
          />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                statusFilter === f.id
                  ? 'bg-blue-600 text-white border border-blue-300'
                  : 'bg-[#070d1e] text-slate-300 border border-slate-700 hover:border-blue-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Master-Detail Split */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left List */}
        <div className="lg:col-span-5 bg-[#0b1329] rounded-2xl border-2 border-slate-700 divide-y divide-slate-800 max-h-[680px] overflow-y-auto">
          {filtered.map((msg) => {
            const active = selected?.id === msg.id;
            const badge = STATUS_BADGES[msg.status];
            return (
              <div
                key={msg.id}
                onClick={() => handleSelect(msg)}
                className={`p-5 cursor-pointer transition space-y-2 ${
                  active
                    ? 'bg-blue-950/60 border-l-4 border-l-blue-400'
                    : msg.status === 'yeni'
                      ? 'bg-slate-900/90 hover:bg-slate-800/70'
                      : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-white text-sm">{msg.name}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                {msg.company && (
                  <div className="text-xs font-semibold text-slate-300">{msg.company}</div>
                )}
                <div className="text-[11px] font-bold text-blue-400">{msg.serviceLabel}</div>
                <p className="text-xs text-slate-400 line-clamp-2">{msg.message}</p>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <span>{msg.sourcePage}</span>
                  <span>{formatDateTimeTR(msg.createdAt)}</span>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-slate-400">
              Seçili filtrede mesaj bulunmuyor.
            </div>
          )}
        </div>

        {/* Right Detail Inspector */}
        <div className="lg:col-span-7 bg-[#0b1329] rounded-2xl border-2 border-slate-700 p-6 sm:p-8">
          {selected ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-2xl font-black text-white">{selected.name}</h3>
                    <span
                      className={`px-3 py-0.5 rounded-full text-[11px] font-black border ${
                        STATUS_BADGES[selected.status].cls
                      }`}
                    >
                      {STATUS_BADGES[selected.status].label}
                    </span>
                  </div>
                  {selected.company && (
                    <div className="text-sm font-bold text-amber-300">{selected.company}</div>
                  )}
                  <div className="text-xs text-slate-400">
                    Kaynak: {selected.sourcePage} &bull; {formatDateTimeTR(selected.createdAt)} &bull;
                    ID: <code className="text-slate-300">{selected.id}</code>
                  </div>
                </div>

                <select
                  value={selected.status}
                  onChange={(e) => handleUpdateStatus(e.target.value as ContactMessageStatus)}
                  className="px-3.5 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-xs font-extrabold text-white"
                >
                  <option value="yeni">Yeni / Okunmadı</option>
                  <option value="inceleniyor">İnceleniyor</option>
                  <option value="teklif-verildi">Teklif Verildi</option>
                  <option value="arsiv">Arşivle</option>
                </select>
              </div>

              {/* Contact Details Grid */}
              <div className="grid sm:grid-cols-3 gap-4 text-xs">
                <a
                  href={`tel:${selected.phone}`}
                  className="p-3.5 rounded-xl bg-[#070d1e] border border-slate-700 hover:border-blue-400 transition"
                >
                  <div className="text-slate-400 mb-1">Telefon</div>
                  <div className="font-black text-white">{selected.phone}</div>
                </a>
                <a
                  href={`mailto:${selected.email}`}
                  className="p-3.5 rounded-xl bg-[#070d1e] border border-slate-700 hover:border-blue-400 transition"
                >
                  <div className="text-slate-400 mb-1">E-Posta</div>
                  <div className="font-black text-blue-300 truncate">{selected.email}</div>
                </a>
                <div className="p-3.5 rounded-xl bg-[#070d1e] border border-slate-700">
                  <div className="text-slate-400 mb-1">Talep Edilen Hizmet</div>
                  <div className="font-black text-amber-300">{selected.serviceLabel}</div>
                </div>
              </div>

              {/* Message Body */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Müşteri / Kurum Mesajı
                </div>
                <div className="p-5 rounded-2xl bg-[#070d1e] border border-slate-700 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {selected.message}
                </div>
              </div>

              {/* Admin Notes */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400">
                  Yönetici / Keşif Notu
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <textarea
                    rows={2}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Görüşme özeti, keşif randevu tarihi veya fiyat notları..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#0f172a] border border-slate-600 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black border border-slate-600 shrink-0"
                  >
                    Notu Kaydet
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href={`https://wa.me/${selected.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition"
                  >
                    <i className="fa-brands fa-whatsapp text-sm" />
                    <span>WhatsApp&apos;tan Yaz</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => onReplyInMailControl(selected)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition"
                  >
                    <i className="fa-solid fa-envelope" />
                    <span>Mail Kontrol&apos;de Yanıtla</span>
                  </button>
                  <button
                    type="button"
                    disabled={converting || Boolean(selected.convertedProjectId)}
                    onClick={handleConvert}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black transition"
                  >
                    <i className="fa-solid fa-diagram-project" />
                    <span>
                      {selected.convertedProjectId
                        ? 'Projeye Dönüştürüldü'
                        : converting
                          ? 'Dönüştürülüyor...'
                          : 'Projeye Dönüştür'}
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onDeleteMessage(selected.id);
                    setSelectedId(null);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-red-950/70 hover:bg-red-600 text-red-300 hover:text-white text-xs font-bold border border-red-500/40"
                >
                  <i className="fa-solid fa-trash mr-1.5" />
                  Sil
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-20 space-y-3">
              <i className="fa-solid fa-inbox text-4xl text-slate-600" />
              <div className="text-sm font-bold text-slate-300">
                İncelemek için sol taraftan bir iletişim mesajı seçin
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
