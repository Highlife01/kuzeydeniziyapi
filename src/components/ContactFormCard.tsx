import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitContactMessage } from '../services/dataService';
import { getServiceLabel, SERVICE_OPTIONS } from '../utils/formatters';

interface ContactFormCardProps {
  sourcePage: 'Ana Sayfa' | 'İletişim Sayfası';
  includeCompanyField?: boolean;
  submitLabel?: string;
}

export const ContactFormCard: React.FC<ContactFormCardProps> = ({
  sourcePage,
  includeCompanyField = false,
  submitLabel = 'Teklif Talebini Gönder',
}) => {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [service, setService] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ id: string; cloudSaved: boolean } | null>(null);

  const inputCls =
    'w-full px-4 py-3.5 rounded-xl bg-[#0f172a] border-2 border-slate-600 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 text-white placeholder-slate-400 text-sm font-medium transition shadow-inner';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessInfo(null);

    if (!name.trim() || !phone.trim() || !email.trim() || !service || !message.trim()) {
      setError('Lütfen zorunlu (*) alanların tamamını eksiksiz doldurun.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitContactMessage({
        name,
        company,
        phone,
        email,
        service,
        serviceLabel: getServiceLabel(service),
        message,
        sourcePage,
      });
      setSuccessInfo(result);
      setName('');
      setCompany('');
      setPhone('');
      setEmail('');
      setService('');
      setMessage('');
    } catch {
      setError('Mesaj kaydedilirken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form id="contactForm" onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-4 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 text-sm font-semibold flex items-center gap-3">
          <i className="fa-solid fa-circle-exclamation text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {successInfo && (
        <div className="p-5 rounded-2xl bg-emerald-950/80 border-2 border-emerald-500/70 text-emerald-100 space-y-2">
          <div className="flex items-center gap-2.5 font-extrabold text-base text-emerald-300">
            <i className="fa-solid fa-circle-check text-xl" />
            <span>Mesajınız Kuzey Denizi Yönetim Paneli&apos;ne İletildi!</span>
          </div>
          <p className="text-xs text-emerald-200/90 leading-relaxed">
            Talep Kodunuz: <strong className="font-mono text-white">{successInfo.id}</strong> —
            Mühendislik ve teklif ekibimiz en kısa sürede sizinle iletişime geçecektir.
          </p>
          <div className="pt-1">
            <Link
              to="/dashboard?tab=messages"
              className="inline-flex items-center gap-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 rounded-lg transition"
            >
              <i className="fa-solid fa-inbox" />
              <span>Dashboard Gelen Mesajlarda Gör</span>
            </Link>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-2">
            Ad Soyad / Yetkili *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn: Ahmet Yılmaz"
            className={inputCls}
          />
        </div>

        {includeCompanyField ? (
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-2">
              Kurum / Firma Adı
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Kurumunuzun veya Şirketinizin Adı"
              className={inputCls}
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-2">
              Telefon Numarası *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0 (5XX) XXX XX XX"
              className={inputCls}
            />
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {includeCompanyField && (
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-2">
              Telefon Numarası *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0 (5XX) XXX XX XX"
              className={inputCls}
            />
          </div>
        )}

        <div className={includeCompanyField ? '' : 'sm:col-span-2'}>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-2">
            E-Posta Adresi *
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@kurum.com.tr"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-2">
          İlgilenilen Faaliyet Alanı *
        </label>
        <select
          required
          value={service}
          onChange={(e) => setService(e.target.value)}
          className={inputCls}
        >
          <option value="">Lütfen Bir Hizmet Alanı Seçiniz</option>
          {SERVICE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-2">
          Proje Notları, Lokasyon ve Şartname Gereksinimleri *
        </label>
        <textarea
          rows={4}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Projenin bulunduğu il/ilçe, yaklaşık alan (m²), çatı/yangın kapsamı veya teslim takviminiz..."
          className={inputCls}
        />
      </div>

      <button
        id="submitBtn"
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black text-base px-8 py-4 rounded-xl shadow-xl shadow-blue-600/40 border border-blue-300 transform hover:scale-[1.01] transition"
      >
        <i className={`fa-solid ${submitting ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} />
        <span>{submitting ? 'Gönderiliyor...' : submitLabel}</span>
      </button>
    </form>
  );
};
