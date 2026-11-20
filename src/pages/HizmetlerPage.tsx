import React from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/PublicLayout';

export const HizmetlerPage: React.FC = () => {
  const services = [
    {
      id: 'konut-rezidans',
      badge: 'Faaliyet Alanı 01',
      title: 'Konut & Rezidans Projeleri',
      icon: 'fa-solid fa-building',
      color: 'from-[#F7941D] to-[#F25C05]',
      desc: 'Aileniz için huzurlu, geniş peyzaj alanlarına, kapalı otoparka, akıllı ev sistemlerine ve elektrikli araç şarj altyapısına sahip yüksek deprem güvenli konut ve rezidans projeleri üretiyoruz.',
      bullets: [
        'Akıllı Ev Otomasyonu & Yerden Isıtma',
        'C35 / C40 Yüksek Dayanımlı Beton & Radye Temel',
        'Geniş Sosyal Donatılar, Havuz & Kapalı Otopark',
      ],
    },
    {
      id: 'ticari-plaza',
      badge: 'Faaliyet Alanı 02',
      title: 'Ticari İş Merkezleri & Plazalar',
      icon: 'fa-solid fa-briefcase',
      color: 'from-[#0068C9] to-[#042A53]',
      desc: 'İş dünyasının prestijini yükselten A+ ofis blokları, cadde mağazaları, modüler iş merkezleri ve kurumsal şirket merkezlerini yüksek mühendislik standartlarıyla hayata geçiriyoruz.',
      bullets: [
        'Modüler A+ Ofis Katları & Yüksek Tavan Mimarisi',
        'Tam Yedekli Jeneratör & VRF İklimlendirme',
        'Yüksek Hızlı Asansörler ve VIP Otopark Yönetimi',
      ],
    },
    {
      id: 'insaat-taahhut',
      badge: 'Faaliyet Alanı 03',
      title: 'Kamu & Özel Sektör İnşaat Taahhüt',
      icon: 'fa-solid fa-trowel-bricks',
      color: 'from-[#F7941D] to-[#F25C05]',
      desc: 'Kamu kurumları ve özel sektör yatırımlarında teknik şartnamelere tam uyumlu, güçlü makine parkuru ve uzman mühendis kadromuzla anahtar teslim üstyapı ve altyapı taahhüt hizmetleri sunuyoruz.',
      bullets: [
        '4734 Sayılı Kamu İhale & TBDY 2018 Tam Uyumu',
        'Çelik Konstrüksiyon, Çatı & Cephe Sistemleri',
        'Kesintisiz Şantiye Planlama & Zamanında Teslim',
      ],
    },
    {
      id: 'kentsel-donusum',
      badge: 'Faaliyet Alanı 04',
      title: 'Kentsel Dönüşüm & Kat Karşılığı Arsa',
      icon: 'fa-solid fa-arrows-rotate',
      color: 'from-[#0068C9] to-[#042A53]',
      desc: 'Riskli yapıların modern ve depreme dayanıklı yapılara dönüştürülmesi ile arsa sahiplerine şeffaf, güvenilir kat karşılığı paylaşım ve geliştirme modelleri sunuyoruz.',
      bullets: [
        'Ücretsiz Zemin & Riskli Yapı Değerlendirme',
        'Şeffaf Kat Karşılığı Paylaşım Sözleşmesi',
        'Yüksek Yatırım ve Kira Getirisi Değeri',
      ],
    },
  ];

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative py-20 bg-[#042A53] border-b-4 border-[#F25C05] overflow-hidden text-white">
        <div className="absolute inset-0 blueprint-grid-dark opacity-40 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-[#F7941D] text-xs font-black uppercase tracking-widest">
            <i className="fa-solid fa-screwdriver-wrench" />
            <span>Faaliyet Alanlarımız &amp; Mühendislik Hizmetleri</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Bütüncül Mühendislik ve İnşaat Çözümleri
          </h1>
          <p className="text-slate-200 max-w-3xl text-base sm:text-lg font-medium">
            Arsa geliştirmeden mimari projelendirmeye, anahtar teslim konut üretiminden büyük ölçekli
            kamu ve özel sektör taahhüt işlerine kadar uzman çözümler.
          </p>
        </div>
      </section>

      {/* Services List */}
      <section className="py-20 bg-slate-50 blueprint-grid-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {services.map((srv) => (
            <div
              key={srv.id}
              id={srv.id}
              className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 grid lg:grid-cols-12 gap-8 items-center shadow-lg hover:shadow-2xl transition"
            >
              <div className="lg:col-span-7 space-y-4">
                <span className="inline-block px-3.5 py-1 rounded-full bg-[#FFF4EC] text-[#F25C05] text-xs font-black uppercase tracking-widest">
                  {srv.badge}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[#042A53]">{srv.title}</h2>
                <p className="text-slate-600 leading-relaxed text-sm sm:text-base">{srv.desc}</p>
                <div className="pt-2 flex flex-wrap gap-4">
                  <Link
                    to="/iletisim"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#F7941D] to-[#F25C05] hover:brightness-110 text-white font-bold text-sm transition shadow-md"
                  >
                    <span>Teklif &amp; Keşif İste</span>
                    <i className="fa-solid fa-arrow-right" />
                  </Link>
                  <Link
                    to="/projeler"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#042A53] hover:bg-[#0068C9] text-white font-bold text-sm transition shadow-md"
                  >
                    <span>Örnek Projeleri Gör</span>
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5 bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${srv.color} text-white flex items-center justify-center text-2xl shadow-lg`}>
                  <i className={srv.icon} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-wider text-[#0068C9]">
                  Teknik Standartlar &amp; Avantajlar
                </h3>
                <ul className="space-y-3">
                  {srv.bullets.map((b, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-[#042A53] font-medium">
                      <i className="fa-solid fa-circle-check text-[#F25C05] mt-1 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
};
