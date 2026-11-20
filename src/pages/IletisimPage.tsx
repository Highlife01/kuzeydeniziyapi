import React from 'react';
import { ContactFormCard } from '../components/ContactFormCard';
import { PublicLayout } from '../components/PublicLayout';

export const IletisimPage: React.FC = () => {
  return (
    <PublicLayout>
      {/* Sub-page Hero */}
      <section className="relative py-20 bg-[#042A53] border-b-4 border-[#F25C05] overflow-hidden text-white">
        <div className="absolute inset-0 blueprint-grid-dark opacity-40 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-[#F7941D] text-xs font-black uppercase tracking-widest">
            <i className="fa-solid fa-headset" />
            <span>İletişim &amp; Teklif Talebi</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Yeni Yaşamınıza Birlikte Yön Verelim
          </h1>
          <p className="text-slate-200 max-w-3xl text-base sm:text-lg font-medium">
            Projelerimiz hakkında detaylı katalog almak, ödeme planlarını öğrenmek veya kat karşılığı
            arsa ve taahhüt tekliflerinizi iletmek için formu doldurun; mesajınız doğrudan{' '}
            <strong className="text-[#F7941D]">Kuzey Denizi Yönetim Dashboard&apos;una</strong> düşsün.
          </p>
        </div>
      </section>

      {/* 3-Column Quick Contact Cards */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-6">
          <a
            href="#harita"
            className="p-7 rounded-3xl bg-slate-50 border border-slate-200 hover:border-[#0068C9] transition space-y-3 shadow-sm"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#042A53] text-[#F7941D] flex items-center justify-center text-xl shadow-sm">
              <i className="fa-solid fa-location-dot" />
            </div>
            <h3 className="text-lg font-black text-[#042A53]">Merkez Ofis &amp; Showroom</h3>
            <p className="text-sm text-slate-600">
              Güzelyalı Mah. 81178 Sk. Yalı 2 Apt No: 6 İç Kapı No: 02, Çukurova / ADANA
            </p>
          </a>

          <a
            href="tel:+905336779109"
            className="p-7 rounded-3xl bg-slate-50 border border-slate-200 hover:border-emerald-500 transition space-y-3 shadow-sm"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#0068C9] text-white flex items-center justify-center text-xl shadow-sm">
              <i className="fa-solid fa-phone" />
            </div>
            <h3 className="text-lg font-black text-[#042A53]">Telefon &amp; WhatsApp</h3>
            <p className="text-sm font-bold text-[#0068C9]">+90 533 677 91 09</p>
            <p className="text-xs text-slate-500">Pzt - Cmt: 08:30 - 18:30</p>
          </a>

          <a
            href="mailto:info@kuzeydeniziyapi.com.tr"
            className="p-7 rounded-3xl bg-slate-50 border border-slate-200 hover:border-[#F25C05] transition space-y-3 shadow-sm"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F7941D] to-[#F25C05] text-white flex items-center justify-center text-xl shadow-sm">
              <i className="fa-solid fa-envelope" />
            </div>
            <h3 className="text-lg font-black text-[#042A53]">Kurumsal E-Posta</h3>
            <p className="text-sm font-bold text-[#042A53]">info@kuzeydeniziyapi.com.tr</p>
            <p className="text-xs text-slate-500">www.kuzeydeniziyapi.com.tr</p>
          </a>
        </div>
      </section>

      {/* 2-Column Form & Map Section */}
      <section className="py-20 bg-slate-50 blueprint-grid-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0068C9] via-[#042A53] to-[#F25C05]" />
            <div className="mb-7 space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-[#042A53]">
                Bilgi, Randevu &amp; Teklif Formu
              </h2>
              <p className="text-sm text-slate-500">
                Gönderilen her mesaj gerçek zamanlı olarak Dashboard &rarr; İletişim Mesajları
                bölümüne düşer.
              </p>
            </div>
            <ContactFormCard
              sourcePage="İletişim Sayfası"
              includeCompanyField
              submitLabel="Teklif Talebini Gönder"
            />
          </div>

          <div id="harita" className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
              <h3 className="text-lg font-black text-[#042A53] flex items-center gap-2">
                <i className="fa-solid fa-map-location-dot text-[#F25C05]" />
                <span>Ofis Harita Konumu (Çukurova / Adana)</span>
              </h3>
              <div className="rounded-2xl overflow-hidden border border-slate-200 h-[316px]">
                <iframe
                  title="Kuzey Denizi İnşaat Merkez Konum"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=35.2500%2C37.0200%2C35.3100%2C37.0600&layer=mapnik&marker=37.0420%2C35.2830"
                  className="w-full h-full border-0"
                  loading="lazy"
                />
              </div>
              <a
                href="https://maps.google.com/?q=G%C3%BCzelyal%C4%B1+Mah.+81178+Sk.+Yal%C4%B1+2+Apt+No+6+%C3%87ukurova+Adana"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-extrabold text-[#0068C9] hover:text-[#F25C05] transition"
              >
                <i className="fa-solid fa-arrow-up-right-from-square" />
                <span>Google Haritalar&apos;da Yol Tarifi Al</span>
              </a>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="font-black text-[#042A53]">Adres &amp; Vergi Bilgisi</div>
                <p>
                  Güzelyalı Mah. 81178 Sk. Yalı 2 Apt No: 6 İç Kapı No: 02, Çukurova / ADANA —
                  Ziyapaşa Vergi Dairesi Müd. (VKN: 6010491372)
                </p>
              </div>
            </div>

            <div className="bg-[#042A53] text-white p-7 rounded-3xl border border-[#0068C9]/50 shadow-xl space-y-4">
              <div className="text-xs font-black uppercase tracking-widest text-[#F7941D]">
                Hızlı Müşteri &amp; WhatsApp Hattı
              </div>
              <div className="text-2xl font-black text-white">+90 533 677 91 09</div>
              <p className="text-xs text-slate-300">
                Projeler, daire tipleri, ödeme planları ve teknik keşif talepleri için doğrudan
                WhatsApp veya telefon üzerinden ulaşabilirsiniz.
              </p>
              <a
                href="https://wa.me/905336779109?text=Merhaba%2C%20Kuzey%20Denizi%20%C4%B0n%C5%9Faat%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white font-black text-sm py-3.5 rounded-xl shadow-lg transition"
              >
                <i className="fa-brands fa-whatsapp text-lg" />
                <span>WhatsApp ile Mesaj Gönder</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};
