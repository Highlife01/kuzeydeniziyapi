import React from 'react';
import { ContactFormCard } from '../components/ContactFormCard';
import { PublicLayout } from '../components/PublicLayout';

export const IletisimPage: React.FC = () => {
  return (
    <PublicLayout>
      {/* Sub-page Hero */}
      <section className="relative py-20 bg-[#070d1e] border-b-2 border-slate-800 overflow-hidden">
        <div className="absolute inset-0 opacity-30 dot-pattern pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/90 border border-blue-500/40 text-blue-300 text-xs font-black uppercase tracking-widest">
            <i className="fa-solid fa-headset" />
            <span>İletişim &amp; Teklif Talebi</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Keşif, İhale ve Mühendislik Teklif Talebi Oluşturun
          </h1>
          <p className="text-slate-300 max-w-3xl text-base sm:text-lg font-medium">
            Çatı yenileme, hastane yangın güvenliği sistemleri veya kamu yapı taahhütleriniz için
            formu doldurun; mesajınız doğrudan Kuzey Denizi Yönetim Dashboard&apos;una düşsün.
          </p>
        </div>
      </section>

      {/* 3-Column Quick Contact Cards */}
      <section className="py-16 bg-[#030712] border-b-2 border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-6">
          <a
            href="#harita"
            className="p-7 rounded-3xl bg-[#0b1329] border-2 border-slate-700 hover:border-blue-400 transition space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center text-xl">
              <i className="fa-solid fa-location-dot" />
            </div>
            <h3 className="text-lg font-black text-white">Merkez Ofisimiz</h3>
            <p className="text-sm text-slate-300">
              Yeşiloba Mah. 46088 Sk. No: 18 B, Seyhan / ADANA
            </p>
          </a>

          <a
            href="tel:+905336779109"
            className="p-7 rounded-3xl bg-[#0b1329] border-2 border-slate-700 hover:border-emerald-400 transition space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center text-xl">
              <i className="fa-solid fa-phone" />
            </div>
            <h3 className="text-lg font-black text-white">Telefon &amp; WhatsApp</h3>
            <p className="text-sm text-slate-300">0533 677 91 09 — Pzt-Cmt 08:30 - 18:00</p>
          </a>

          <a
            href="mailto:info@kuzeydeniziyapi.com.tr"
            className="p-7 rounded-3xl bg-[#0b1329] border-2 border-slate-700 hover:border-amber-400 transition space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center text-xl">
              <i className="fa-solid fa-envelope" />
            </div>
            <h3 className="text-lg font-black text-white">Kurumsal E-Posta</h3>
            <p className="text-sm text-slate-300">
              info@kuzeydeniziyapi.com.tr &bull; ihale@kuzeydeniziyapi.com.tr
            </p>
          </a>
        </div>
      </section>

      {/* 2-Column Form & Map Section */}
      <section className="py-20 bg-[#070d1e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 bg-[#0b1329] p-8 sm:p-10 rounded-3xl border-2 border-slate-700 shadow-2xl">
            <div className="mb-7 space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Proje &amp; Keşif Talep Formu
              </h2>
              <p className="text-sm text-slate-400">
                Gönderilen her form gerçek zamanlı olarak Dashboard &rarr; İletişim Mesajları
                bölümüne düşer.
              </p>
            </div>
            <ContactFormCard
              sourcePage="İletişim Sayfası"
              includeCompanyField
              submitLabel="Teklif Talebini İlet"
            />
          </div>

          <div id="harita" className="lg:col-span-5 space-y-6">
            <div className="bg-[#0b1329] p-6 rounded-3xl border-2 border-slate-700 space-y-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <i className="fa-solid fa-map-location-dot text-blue-400" />
                <span>Ofis Harita Konumu (Adana)</span>
              </h3>
              <div className="rounded-2xl overflow-hidden border border-slate-700 h-[316px]">
                <iframe
                  title="Kuzey Denizi İnşaat Adana Merkez Konum"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=35.2350%2C36.9700%2C35.2710%2C37.0010&layer=mapnik&marker=36.9855%2C35.2530"
                  className="w-full h-full border-0"
                  loading="lazy"
                />
              </div>
              <a
                href="https://maps.google.com/?q=Ye%C5%9Filoba+Mah.+46088+Sk.+No+18+B+Seyhan+Adana"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-extrabold text-blue-400 hover:text-blue-300 transition"
              >
                <i className="fa-solid fa-arrow-up-right-from-square" />
                <span>Google Haritalar&apos;da Yol Tarifi Al</span>
              </a>
              <div className="p-4 rounded-2xl bg-[#070d1e] border border-slate-700 text-xs text-slate-300 space-y-1">
                <div className="font-black text-white">Adres &amp; Vergi Bilgisi</div>
                <p>
                  Yeşiloba Mah. 46088 Sk. No: 18 B, Seyhan / ADANA — Seyhan Vergi Dairesi Müd.
                  (VKN: 2640323020)
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-950/80 to-[#0b1329] p-7 rounded-3xl border-2 border-blue-500/50 space-y-4">
              <div className="text-xs font-black uppercase tracking-widest text-amber-400">
                Acil İhale / Teklif Danışma Hattı
              </div>
              <div className="text-2xl font-black text-white">0533 677 91 09</div>
              <p className="text-xs text-slate-300">
                Kamu şartnameleri, teknik keşif ve acil çatı/yangın müdahale talepleri için doğrudan
                mühendislik koordinasyon hattımıza ulaşabilirsiniz.
              </p>
              <a
                href="tel:+905336779109"
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm py-3.5 rounded-xl border border-blue-300 transition"
              >
                <i className="fa-solid fa-phone-volume" />
                <span>Doğrudan Ara</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};
