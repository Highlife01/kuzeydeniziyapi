import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { ContactFormCard } from '../components/ContactFormCard';
import { ProjectModal } from '../components/ProjectModal';
import { PublicLayout } from '../components/PublicLayout';
import { SEED_PROJECTS } from '../data/seedData';
import { subscribePublicProjects } from '../services/dataService';
import { ProjectItem } from '../types';

interface HeroSlide {
  badgeText: string;
  titleBefore: string;
  titleHighlight: string;
  titleAfter: string;
  subtitle: string;
  worksDone: string[];
  image: string;
  primaryBtnLabel: string;
  primaryBtnHref: string;
  secondaryBtnLabel: string;
  secondaryBtnTo: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    badgeText: 'Lansmana Özel Avantajlar • Çukurova / ADANA',
    titleBefore: 'Geleceğin Yaşam Alanlarını ',
    titleHighlight: 'Güvenle',
    titleAfter: ' İnşa Ediyoruz',
    subtitle:
      'Kuzey Denizi İnşaat mühendislik vizyonuyla; yüksek deprem güvenliği, modern mimari estetik ve yüksek yatırım değerini bir araya getiren prestijli projeler üretiyoruz.',
    worksDone: [
      'Kuzey Panorama Konutları',
      'Poyraz Marin Rezidans',
      'TBDY 2018 Deprem Güvenliği',
      'Akıllı Ev Otomasyonu',
    ],
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1920&q=85',
    primaryBtnLabel: 'Devam Eden Projeler',
    primaryBtnHref: '#proje-vitrini',
    secondaryBtnLabel: 'Tüm Projelerimiz',
    secondaryBtnTo: '/projeler',
  },
  {
    badgeText: 'Üstyapı & Taahhüt Uzmanlığı • www.kuzeydeniziyapi.com.tr',
    titleBefore: 'Güçlü Mühendislik, ',
    titleHighlight: 'Sarsılmaz',
    titleAfter: ' Temeller',
    subtitle:
      'Ticari merkezlerden kamu taahhüt projelerine kadar her metrekarede uluslararası kalite standartları ve zamanında anahtar teslim ilkesiyle çalışıyoruz.',
    worksDone: [
      'Kuzey Yıldızı Ticaret Merkezi',
      'Zemin İyileştirme & Fore Kazık',
      'C35 / C40 Yüksek Dayanımlı Beton',
      'Zamanında Anahtar Teslim',
    ],
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1920&q=85',
    primaryBtnLabel: 'Faaliyet Alanlarımız',
    primaryBtnHref: '/hizmetler',
    secondaryBtnLabel: 'Teklif Talebi Oluştur',
    secondaryBtnTo: '/iletisim',
  },
  {
    badgeText: 'Sürdürülebilir & Akıllı Evler • +90 533 677 91 09',
    titleBefore: 'Aileniz İçin ',
    titleHighlight: 'Huzurlu',
    titleAfter: ' ve Seçkin Mekanlar',
    subtitle:
      'Geniş peyzaj alanları, elektrikli araç şarj altyapısı ve birinci sınıf malzeme işçiliğiyle Kuzey Denizi projelerinde yeni bir yaşam başlıyor.',
    worksDone: [
      'Mavi Ufuk Villaları',
      'Kuzey Park Evleri',
      'Kuzey Vadi Karma Yaşam',
      'Tel: +90 533 677 91 09',
    ],
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1920&q=85',
    primaryBtnLabel: 'Projeleri Keşfet',
    primaryBtnHref: '/projeler',
    secondaryBtnLabel: 'İletişime Geçin',
    secondaryBtnTo: '/iletisim',
  },
];

type AboutTabKey = 'vizyon' | 'misyon' | 'kalite';
type ProjectFilterKey = 'all' | 'devam-ediyor' | 'teslim-edildi' | 'planlama';

export const HomePage: React.FC = () => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [projects, setProjects] = useState<ProjectItem[]>(SEED_PROJECTS);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [aboutTab, setAboutTab] = useState<AboutTabKey>('vizyon');
  const [projectFilter, setProjectFilter] = useState<ProjectFilterKey>('all');

  useEffect(() => {
    const unsub = subscribePublicProjects((items) => {
      if (items.length > 0) setProjects(items);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6500);
    return () => clearInterval(timer);
  }, []);

  const prevSlide = () =>
    setActiveSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  const nextSlide = () => setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);

  const visibleProjects = projects.filter((p) => {
    if (projectFilter === 'all') return true;
    return p.status === projectFilter;
  });

  const slideLabel = String(activeSlide + 1).padStart(2, '0');
  const slideTotal = String(HERO_SLIDES.length).padStart(2, '0');

  return (
    <PublicLayout isHome>
      {/* 1. HERO FULL-VIEWPORT ARCHITECTURAL SLIDER */}
      <section className="relative h-[660px] sm:h-[740px] lg:h-[820px] bg-[#021B36] overflow-hidden">
        {HERO_SLIDES.map((slide, idx) => {
          const isActive = idx === activeSlide;
          return (
            <div key={idx} className={`hero-slide ${isActive ? 'active' : ''}`}>
              <img
                src={slide.image}
                alt={slide.titleBefore + slide.titleHighlight}
                loading={idx === 0 ? 'eager' : 'lazy'}
                decoding={idx === 0 ? 'sync' : 'async'}
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#021B36]/95 via-[#042A53]/80 to-[#021B36]/35" />

              <div className="relative z-20 h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center pt-24 pb-20">
                <div className="hero-content max-w-3xl space-y-5">
                  <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-extrabold uppercase tracking-wider text-[#F7941D]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F7941D] animate-pulse" />
                    <span>{slide.badgeText}</span>
                  </div>

                  {idx === 0 ? (
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12] text-white">
                      {slide.titleBefore}
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F7941D] to-[#F25C05]">
                        {slide.titleHighlight}
                      </span>
                      {slide.titleAfter}
                    </h1>
                  ) : (
                    <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12] text-white">
                      {slide.titleBefore}
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F7941D] to-[#F25C05]">
                        {slide.titleHighlight}
                      </span>
                      {slide.titleAfter}
                    </h2>
                  )}

                  <p className="text-base sm:text-lg text-slate-200 font-medium leading-relaxed max-w-2xl">
                    {slide.subtitle}
                  </p>

                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {slide.worksDone.map((work, wIdx) => (
                      <span
                        key={wIdx}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs sm:text-sm font-bold text-white backdrop-blur-md"
                      >
                        <i className="fa-solid fa-check text-[#F7941D] text-xs" />
                        <span>{work}</span>
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-3">
                    {slide.primaryBtnHref.startsWith('#') ? (
                      <a
                        href={slide.primaryBtnHref}
                        className="inline-flex items-center gap-2.5 bg-gradient-to-r from-[#F7941D] to-[#F25C05] hover:brightness-110 text-white font-extrabold text-sm sm:text-base px-8 py-4 rounded-2xl shadow-xl shadow-orange-500/30 transform hover:scale-[1.02] transition"
                      >
                        <span>{slide.primaryBtnLabel}</span>
                        <i className="fa-solid fa-building-circle-arrow-right" />
                      </a>
                    ) : (
                      <Link
                        to={slide.primaryBtnHref}
                        className="inline-flex items-center gap-2.5 bg-gradient-to-r from-[#F7941D] to-[#F25C05] hover:brightness-110 text-white font-extrabold text-sm sm:text-base px-8 py-4 rounded-2xl shadow-xl shadow-orange-500/30 transform hover:scale-[1.02] transition"
                      >
                        <span>{slide.primaryBtnLabel}</span>
                        <i className="fa-solid fa-arrow-right" />
                      </Link>
                    )}

                    <Link
                      to={slide.secondaryBtnTo}
                      className="inline-flex items-center gap-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/30 text-white font-bold text-sm sm:text-base px-8 py-4 rounded-2xl transition"
                    >
                      <span>{slide.secondaryBtnLabel}</span>
                      <i className="fa-solid fa-arrow-right text-[#F7941D]" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Slider Bottom Controls */}
        <div className="absolute bottom-20 sm:bottom-24 left-0 right-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div id="slider-dots" className="flex items-center gap-2.5">
              {HERO_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveSlide(idx)}
                  aria-label={`Slayt ${idx + 1}`}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    idx === activeSlide
                      ? 'w-10 bg-[#F25C05] shadow-lg'
                      : 'w-2.5 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3 mr-12 sm:mr-0">
              <span
                id="slide-number"
                className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 font-mono text-xs font-extrabold text-white backdrop-blur-md"
              >
                {slideLabel} / {slideTotal}
              </span>
              <button
                type="button"
                onClick={prevSlide}
                aria-label="Önceki Slayt"
                className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-[#F25C05] border border-white/20 text-white flex items-center justify-center backdrop-blur-md transition"
              >
                <i className="fa-solid fa-chevron-left" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                aria-label="Sonraki Slayt"
                className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-[#F25C05] border border-white/20 text-white flex items-center justify-center backdrop-blur-md transition"
              >
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FLOATING WHITE ARCHITECTURAL KPI RIBBON */}
      <section className="relative z-30 -mt-12 sm:-mt-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-10 grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#042A53] via-[#0068C9] to-[#F25C05]" />

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#E6F1FB] text-[#0068C9] flex items-center justify-center text-2xl shrink-0">
              <i className="fa-solid fa-calendar-check" />
            </div>
            <div>
              <div className="font-black text-xl sm:text-2xl text-[#042A53]">04/01/2017</div>
              <div className="text-xs sm:text-sm font-semibold text-slate-500">Resmi Kuruluş Tarihi</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF4EC] text-[#F25C05] flex items-center justify-center text-2xl shrink-0">
              <i className="fa-solid fa-file-shield" />
            </div>
            <div>
              <div className="font-black text-xl sm:text-2xl text-[#042A53]">6010491372</div>
              <div className="text-xs sm:text-sm font-semibold text-slate-500">Ziyapaşa V.D. Resmi Kayıt</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#E6F1FB] text-[#042A53] flex items-center justify-center text-2xl shrink-0">
              <i className="fa-solid fa-city" />
            </div>
            <div>
              <div className="font-black text-xl sm:text-2xl text-[#042A53]">Çukurova / Adana</div>
              <div className="text-xs sm:text-sm font-semibold text-slate-500">Güzelyalı Merkez Ofis</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF4EC] text-[#F7941D] flex items-center justify-center text-2xl shrink-0">
              <i className="fa-solid fa-phone-volume" />
            </div>
            <div>
              <div className="font-black text-xl sm:text-2xl text-[#042A53]">0533 677 91 09</div>
              <div className="text-xs sm:text-sm font-semibold text-slate-500">Doğrudan Hat &amp; WhatsApp</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CORPORATE IDENTITY & INTERACTIVE TABS (BLUEPRINT LIGHT) */}
      <section className="py-20 sm:py-28 blueprint-grid-light bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Architectural Visual */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                <img
                  src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1000&q=85"
                  alt="Kuzey Denizi İnşaat Mühendislik Ekibi"
                  loading="lazy"
                  className="w-full h-[380px] sm:h-[480px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#042A53]/80 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-center justify-between gap-4">
                  <BrandLogo size="sm" withWhiteBg={true} />
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-4 bg-[#042A53] text-white p-5 rounded-2xl shadow-2xl absolute -bottom-6 -right-6 max-w-xs border-b-4 border-[#F25C05]">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F7941D] to-[#F25C05] flex items-center justify-center text-xl shrink-0">
                  <i className="fa-solid fa-award" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Pusulamız Güven</h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Son deprem yönetmeliğine %100 uyumlu yüksek mühendislik çözümleri.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Interactive Content */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E6F1FB] text-[#0068C9] font-bold text-xs uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-[#F25C05]" />
                <span>Kurumsal Hakkımızda</span>
              </div>

              <h2 className="font-black text-3xl sm:text-4xl text-[#042A53] leading-tight">
                Estetik Mimari ve <span className="text-[#0068C9]">Mühendislik Disiplinini</span> Buluşturuyoruz
              </h2>

              <p className="text-slate-600 leading-relaxed">
                <strong>Kuzey Denizi İnşaat</strong> olarak, kuruluşumuzdan bu yana konut, ticari
                merkez, kentsel dönüşüm ve altyapı/üstyapı taahhüt projelerinde şehrin silüetine
                değer katan kalıcı eserler üretiyoruz. Logomuzdaki kuzey yıldızı pusulası; doğruluğu,
                mühendislik hassasiyetini ve geleceğe yön veren vizyonumuzu simgeler.
              </p>

              {/* Interactive Vizyon / Misyon / Kalite Tabs */}
              <div className="bg-white rounded-2xl p-2.5 shadow-sm border border-slate-200">
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {(
                    [
                      { id: 'vizyon', label: 'Vizyonumuz' },
                      { id: 'misyon', label: 'Misyonumuz' },
                      { id: 'kalite', label: 'Kalite Politikamız' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAboutTab(t.id)}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        aboutTab === t.id
                          ? 'bg-[#042A53] text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="px-4 pb-3 text-sm text-slate-600 leading-relaxed min-h-[76px]">
                  {aboutTab === 'vizyon' && (
                    <p>
                      Türkiye&apos;nin yapı ve taahhüt sektöründe yenilikçi inşaat teknolojilerini en
                      üst seviyede kullanarak; çevreye duyarlı, enerji verimliliği yüksek ve nesiller
                      boyu güvenle yaşanacak simge projelere imza atmak.
                    </p>
                  )}
                  {aboutTab === 'misyon' && (
                    <p>
                      İnsan hayatını ve yapı güvenliğini her şeyin üzerinde tutarak; şeffaf proje
                      yönetimi, yüksek malzeme kalitesi ve zamanında teslim prensibiyle
                      yatırımcılarımıza yüksek katma değer sunmak.
                    </p>
                  )}
                  {aboutTab === 'kalite' && (
                    <p>
                      Zemin etüdünden mimari tasarıma, C35/C40 sınıfı betonarme uygulamalardan satış
                      sonrası teknik desteğe kadar tüm süreçlerde sıfır hata ve maksimum iş sağlığı
                      güvenliği ile üretim gerçekleştirmek.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                {[
                  { text: 'Zemin Etüdü & Radye Temel', iconCls: 'bg-[#FFF4EC] text-[#F25C05]' },
                  { text: 'A Sınıfı Enerji Kimlik Belgesi', iconCls: 'bg-[#E6F1FB] text-[#0068C9]' },
                  { text: '1. Sınıf İç Mimari & İşçilik', iconCls: 'bg-[#E6F1FB] text-[#0068C9]' },
                  { text: 'Yüksek Yatırım Geri Dönüşü', iconCls: 'bg-[#FFF4EC] text-[#F25C05]' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.iconCls}`}>
                      <i className="fa-solid fa-check text-xs" />
                    </span>
                    <span className="text-sm font-bold text-[#042A53]">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. INTERACTIVE FILTERABLE PORTFOLIO SECTION (CRISP WHITE) */}
      <section id="proje-vitrini" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFF4EC] text-[#F25C05] font-bold text-xs uppercase tracking-wider">
                <i className="fa-solid fa-compass" />
                <span>Seçkin Portföyümüz</span>
              </div>
              <h2 className="font-black text-3xl sm:text-4xl text-[#042A53]">
                İmzamızı Taşıyan <span className="text-[#F25C05]">Prestijli Projeler</span>
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Devam eden, tamamlanan ve çok yakında lansmana çıkacak konut, rezidans ve ticari
                projelerimizi detaylı inceleyin.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl self-start lg:self-auto">
              {(
                [
                  { id: 'all', label: 'Tümü' },
                  { id: 'devam-ediyor', label: 'Devam Edenler' },
                  { id: 'teslim-edildi', label: 'Tamamlananlar' },
                  { id: 'planlama', label: 'Gelecek Projeler' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setProjectFilter(f.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    projectFilter === f.id
                      ? 'bg-[#042A53] text-white shadow-sm'
                      : 'text-slate-600 hover:text-[#042A53]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {visibleProjects.map((project) => (
              <article
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className="group bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-2xl cursor-pointer transition-all duration-300 flex flex-col"
              >
                <div className="relative h-64 overflow-hidden bg-slate-900">
                  <img
                    src={project.image}
                    alt={project.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#021B36]/80 via-transparent to-transparent" />

                  <span
                    className={`absolute top-4 left-4 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-md ${
                      project.status === 'teslim-edildi'
                        ? 'bg-[#0068C9] text-white'
                        : project.status === 'planlama'
                          ? 'bg-[#042A53] text-[#F7941D]'
                          : 'bg-[#F25C05] text-white'
                    }`}
                  >
                    {project.statusBadge}
                  </span>

                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white text-xs">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <i className="fa-solid fa-location-dot text-[#F7941D]" />
                      {project.location}
                    </span>
                    <span className="font-mono font-bold text-slate-200">{project.code}</span>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-wider text-[#0068C9] mb-1">
                      {project.categoryLabel}
                    </div>
                    <h3 className="font-bold text-xl text-[#042A53] group-hover:text-[#0068C9] transition-colors">
                      {project.title}
                    </h3>
                    <p className="text-slate-500 text-sm mt-2 line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>

                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Proje Alanı:</span>
                        <span className="font-bold text-[#042A53]">{project.area}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Durum:</span>
                        <span className="font-bold text-[#F25C05]">{project.statusBadge}</span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span className="text-slate-500">İnşaat İlerlemesi</span>
                        <span className="text-[#042A53]">%{project.progress}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#0068C9] to-[#F25C05]"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedProject(project)}
                    className="w-full py-3.5 rounded-2xl bg-slate-100 group-hover:bg-[#042A53] text-[#042A53] group-hover:text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <span>Proje Detaylarını İncele</span>
                    <i className="fa-solid fa-arrow-right text-xs" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 5. SERVICES & EARTHQUAKE ENGINEERING (DEEP MARITIME NAVY CONTRAST) */}
      <section className="py-20 sm:py-28 bg-[#021B36] text-white relative overflow-hidden blueprint-grid-dark">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#0068C9]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[#F25C05]/15 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-20">
          <div>
            <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-[#F7941D] font-bold text-xs uppercase tracking-wider border border-white/10">
                Faaliyet Alanlarımız
              </div>
              <h2 className="font-extrabold text-3xl sm:text-4xl lg:text-5xl">
                Bütüncül Mühendislik ve <span className="text-[#F7941D]">İnşaat Çözümleri</span>
              </h2>
              <p className="text-slate-300 text-sm sm:text-base">
                Arsa geliştirmeden mimari projelendirmeye, anahtar teslim konut üretiminden büyük
                ölçekli kamu ve özel sektör taahhüt işlerine kadar geniş uzmanlık.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: 'Konut & Rezidans',
                  desc: 'Sosyal donatı alanları, kapalı otopark, akıllı ev sistemleri ve geniş peyzaja sahip nitelikli yaşam projeleri.',
                  tag: 'YÜKSEK KONFOR',
                  icon: 'fa-solid fa-building',
                  iconBg: 'bg-gradient-to-br from-[#F7941D] to-[#F25C05]',
                  tagColor: 'text-[#F7941D]',
                },
                {
                  title: 'Ticari & Plaza Yapıları',
                  desc: 'İş dünyasının prestijini yükselten modern ofis blokları, cadde mağazaları, lojistik ve endüstriyel tesisler.',
                  tag: 'PRESTİJLİ İŞ MERKEZLERİ',
                  icon: 'fa-solid fa-briefcase',
                  iconBg: 'bg-[#0068C9]',
                  tagColor: 'text-sky-400',
                },
                {
                  title: 'İnşaat Taahhüt',
                  desc: 'Kamu ve özel sektör üstyapı-altyapı projelerinde teknik şartnamelere tam uyumlu, güçlü makine parkuru ile taahhüt.',
                  tag: 'ZAMANINDA TESLİM',
                  icon: 'fa-solid fa-trowel-bricks',
                  iconBg: 'bg-gradient-to-br from-[#F7941D] to-[#F25C05]',
                  tagColor: 'text-[#F7941D]',
                },
                {
                  title: 'Kentsel Dönüşüm',
                  desc: 'Riskli yapıların yenilenmesi ve arsa sahiplerine şeffaf, güvenilir kat karşılığı paylaşım modelleriyle çözümler.',
                  tag: 'GÜVENLİ DÖNÜŞÜM',
                  icon: 'fa-solid fa-arrows-rotate',
                  iconBg: 'bg-[#0068C9]',
                  tagColor: 'text-sky-400',
                },
              ].map((srv, idx) => (
                <Link
                  key={idx}
                  to="/hizmetler"
                  className="group bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-[#F7941D]/60 rounded-3xl p-7 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <div
                      className={`w-14 h-14 rounded-2xl ${srv.iconBg} text-white flex items-center justify-center text-2xl mb-6 shadow-lg group-hover:scale-110 transition-transform`}
                    >
                      <i className={srv.icon} />
                    </div>
                    <h3 className="font-bold text-xl text-white mb-3">{srv.title}</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">{srv.desc}</p>
                  </div>
                  <div
                    className={`mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-bold ${srv.tagColor}`}
                  >
                    <span>{srv.tag}</span>
                    <i className="fa-solid fa-arrow-up-right-from-square" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Earthquake Engineering Highlight Banner */}
          <div className="bg-gradient-to-br from-[#042A53] via-[#06376B] to-[#021B36] rounded-3xl p-8 sm:p-12 lg:p-14 border border-white/15 shadow-2xl relative overflow-hidden">
            <svg
              className="absolute -right-16 -bottom-16 w-80 h-80 opacity-10 pointer-events-none"
              viewBox="0 0 120 120"
              fill="none"
            >
              <path d="M8 64 L76 8 L60 55 L112 58 L43 113 L55 59 Z" fill="#FFFFFF" />
            </svg>

            <div className="grid lg:grid-cols-12 gap-10 items-center relative z-10">
              <div className="lg:col-span-5 space-y-5">
                <span className="inline-block px-3.5 py-1.5 rounded-full bg-[#F25C05] text-white text-xs font-bold uppercase tracking-wider">
                  Kuzey Denizi Yapı Standartları
                </span>
                <h3 className="font-extrabold text-3xl sm:text-4xl leading-tight">
                  Depreme Dayanıklı, Uzun Ömürlü Mühendislik
                </h3>
                <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
                  Görünmeyen detaylara en az görünen estetik kadar önem veriyoruz. Tüm şantiyelerimiz
                  yapı denetim kuruluşları ve uzman saha mühendislerimiz tarafından 7/24
                  denetlenmektedir.
                </p>
                <div className="pt-2">
                  <Link
                    to="/iletisim"
                    className="inline-flex items-center gap-3 bg-gradient-to-r from-[#F7941D] to-[#F25C05] px-6 py-3.5 rounded-2xl font-bold text-sm shadow-lg hover:brightness-110 transition-all"
                  >
                    <span>Teknik Şartname &amp; Bilgi Al</span>
                    <i className="fa-solid fa-chevron-right text-xs" />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-7 grid sm:grid-cols-2 gap-5">
                <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <i className="fa-solid fa-layer-group text-[#F7941D] text-xl" />
                    <h4 className="font-bold text-lg">Zemin İyileştirme &amp; Fore Kazık</h4>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    Jeofizik ve jeoteknik etüt raporlarına göre gerekli zemin iyileştirmeleri ve
                    radye jeneral temel sistemleri eksiksiz uygulanır.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <i className="fa-solid fa-cubes text-sky-400 text-xl" />
                    <h4 className="font-bold text-lg">C35 / C40 Yüksek Dayanımlı Beton</h4>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    Laboratuvar testlerinden geçmiş yüksek mukavemetli beton ve B420C nervürlü yapı
                    çeliği ile maksimum taşıyıcı güvenlik.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <i className="fa-solid fa-temperature-arrow-down text-sky-400 text-xl" />
                    <h4 className="font-bold text-lg">Isı, Ses ve Su Yalıtımı</h4>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    Temelden çatıya bohçalama su yalıtımı, taşyünü dış cephe mantolama ve katlar
                    arası akustik ses izolasyonu.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <i className="fa-solid fa-house-signal text-[#F7941D] text-xl" />
                    <h4 className="font-bold text-lg">Akıllı Ev &amp; Elektrikli Şarj</h4>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    Uzaktan iklimlendirme, güvenlik kontrolü ve kapalı otoparklarda elektrikli araç
                    şarj istasyonu altyapısı.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CONTACT & QUOTE FORM SECTION (CRISP LIGHT ARCHITECTURAL) */}
      <section id="teklif-al" className="py-20 sm:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-start">
            {/* Left Contact Info */}
            <div className="lg:col-span-5 space-y-7">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E6F1FB] text-[#0068C9] font-bold text-xs uppercase tracking-wider">
                  İletişim &amp; Satış Ofisi
                </div>
                <h2 className="font-extrabold text-3xl sm:text-4xl text-[#042A53]">
                  Yeni Yaşamınıza <span className="text-[#F25C05]">Birlikte Yön Verelim</span>
                </h2>
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                  Formu doldurduğunuz anda mesajınız doğrudan{' '}
                  <strong className="text-[#042A53]">Kuzey Denizi Yönetim Dashboard&apos;una</strong>{' '}
                  düşer ve ilgili ekibimize atanır.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-[#042A53] text-[#F7941D] flex items-center justify-center text-lg shrink-0">
                    <i className="fa-solid fa-location-dot" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#042A53]">Merkez Ofis &amp; Showroom</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Güzelyalı Mah. 81178 Sk. Yalı 2 Apt No: 6 İç Kapı No: 02, Çukurova / ADANA
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-[#0068C9] text-white flex items-center justify-center text-lg shrink-0">
                    <i className="fa-solid fa-phone-volume" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#042A53]">Telefon &amp; WhatsApp</h4>
                    <a
                      href="tel:+905336779109"
                      className="text-sm font-bold text-[#0068C9] hover:text-[#F25C05] transition block mt-1"
                    >
                      +90 533 677 91 09
                    </a>
                    <p className="text-xs text-[#F25C05] font-semibold mt-0.5">
                      Haftanın 6 Günü Satış Ofisimiz Açıktır
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F7941D] to-[#F25C05] text-white flex items-center justify-center text-lg shrink-0">
                    <i className="fa-solid fa-envelope-open-text" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#042A53]">Kurumsal E-Posta &amp; Web</h4>
                    <a
                      href="mailto:info@kuzeydeniziyapi.com.tr"
                      className="text-sm font-semibold text-slate-700 hover:text-[#0068C9] block mt-1"
                    >
                      info@kuzeydeniziyapi.com.tr
                    </a>
                    <p className="text-xs text-slate-500 mt-0.5">www.kuzeydeniziyapi.com.tr</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Clean Light Form Card */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0068C9] via-[#042A53] to-[#F25C05]" />
              <h3 className="font-bold text-2xl text-[#042A53] mb-1">Bilgi &amp; Teklif Formu</h3>
              <p className="text-slate-500 text-sm mb-6">
                Formu doldurun, danışmanlarımız ve teknik ekibimiz en kısa sürede size dönüş yapsın.
              </p>
              <ContactFormCard sourcePage="Ana Sayfa" submitLabel="Teklif Talebini Gönder" />
            </div>
          </div>
        </div>
      </section>

      <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
    </PublicLayout>
  );
};
