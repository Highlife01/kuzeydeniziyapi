import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#021B36] pt-16 pb-12 border-t-4 border-[#F25C05] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 pb-12 border-b border-[#042A53]">
          {/* Col 1: Brand Summary */}
          <div className="space-y-5">
            <BrandLogo withWhiteBg={true} />
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              Kuzey Denizi İnşaat; deprem güvenliği yüksek modern konutlar, ticari merkezler,
              kamu taahhütleri ve endüstriyel yapılarda üstün mühendislik standartlarıyla
              geleceğin sağlam yapılarını inşa eder.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1.5 rounded-lg bg-[#042A53] border border-[#0068C9]/40 text-xs font-bold text-sky-300">
                04/01/2017 Kuruluşlu
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-[#042A53] border border-[#F7941D]/40 text-[11px] font-bold text-amber-300">
                VKN: 6010491372 • Ziyapaşa V.D.
              </span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-[#F7941D] mb-5">
              Hızlı Bağlantılar
            </h4>
            <ul className="space-y-3 text-sm font-semibold text-slate-300">
              <li>
                <Link to="/" className="hover:text-[#0068C9] transition flex items-center gap-2">
                  <i className="fa-solid fa-angle-right text-[#0068C9] text-xs" />
                  Ana Sayfa
                </Link>
              </li>
              <li>
                <Link
                  to="/kurumsal"
                  className="hover:text-[#0068C9] transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-angle-right text-[#0068C9] text-xs" />
                  Kurumsal &amp; Kalite Politikamız
                </Link>
              </li>
              <li>
                <Link
                  to="/projeler"
                  className="hover:text-[#0068C9] transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-angle-right text-[#0068C9] text-xs" />
                  Projelerimiz
                </Link>
              </li>
              <li>
                <Link
                  to="/iletisim"
                  className="hover:text-[#0068C9] transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-angle-right text-[#0068C9] text-xs" />
                  İletişim &amp; Keşif Talebi
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard"
                  className="hover:text-amber-400 text-amber-300/90 transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-gauge-high text-amber-400 text-xs" />
                  Yönetim Dashboard&apos;u
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Services */}
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-[#F7941D] mb-5">
              Faaliyet Alanları
            </h4>
            <ul className="space-y-3 text-sm font-semibold text-slate-300">
              <li>
                <Link
                  to="/hizmetler"
                  className="hover:text-[#0068C9] transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-city text-[#0068C9] text-xs" />
                  Konut &amp; Yaşam Projeleri
                </Link>
              </li>
              <li>
                <Link
                  to="/hizmetler"
                  className="hover:text-[#0068C9] transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-building text-[#0068C9] text-xs" />
                  Ticari İş Merkezleri &amp; Plazalar
                </Link>
              </li>
              <li>
                <Link
                  to="/hizmetler"
                  className="hover:text-[#0068C9] transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-industry text-[#0068C9] text-xs" />
                  Endüstriyel Yapılar &amp; Tesisler
                </Link>
              </li>
              <li>
                <Link
                  to="/hizmetler"
                  className="hover:text-[#0068C9] transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-building-columns text-[#0068C9] text-xs" />
                  Kamu Taahhüt &amp; Altyapı
                </Link>
              </li>
              <li>
                <Link
                  to="/hizmetler"
                  className="hover:text-[#0068C9] transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-shield-halved text-[#0068C9] text-xs" />
                  Deprem Güçlendirme &amp; Kentsel Dönüşüm
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact */}
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-[#F7941D] mb-5">
              Merkez İletişim
            </h4>
            <div className="space-y-4 text-sm text-slate-300 font-medium">
              <p className="flex items-start gap-3">
                <i className="fa-solid fa-location-dot text-[#0068C9] mt-1" />
                <span>Güzelyalı Mah. 81178 Sk. Yalı 2 Apt No: 6 İç Kapı No: 02, Çukurova / ADANA</span>
              </p>
              <p className="flex items-center gap-3">
                <i className="fa-solid fa-phone text-[#F7941D]" />
                <a href="tel:+905336779109" className="hover:text-[#F7941D] transition">
                  +90 533 677 91 09
                </a>
              </p>
              <p className="flex items-center gap-3">
                <i className="fa-solid fa-envelope text-[#0068C9]" />
                <a
                  href="mailto:info@kuzeydeniziyapi.com.tr"
                  className="hover:text-white transition"
                >
                  info@kuzeydeniziyapi.com.tr
                </a>
              </p>
              <p className="flex items-center gap-3">
                <i className="fa-solid fa-globe text-[#0068C9]" />
                <a
                  href="https://www.kuzeydeniziyapi.com.tr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition"
                >
                  www.kuzeydeniziyapi.com.tr
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-400">
          <p>© 2026 Kuzeydeniz İnşaat Taahhüt Sanayi ve Ticaret Limited Şirketi Tüm Hakları Saklıdır.</p>
          <div className="flex items-center gap-6">
            <Link to="/kurumsal" className="hover:text-slate-200 transition">
              Gizlilik Politikası
            </Link>
            <Link to="/kurumsal" className="hover:text-slate-200 transition">
              KVKK Aydınlatma Metni
            </Link>
            <Link to="/dashboard" className="hover:text-[#F7941D] text-slate-400 transition">
              Yönetim Paneli
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
