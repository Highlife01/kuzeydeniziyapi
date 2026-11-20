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
  badgeStyle: string;
  badgeIcon: string;
  titleBefore: string;
  titleHighlight: string;
  highlightColor: string;
  titleAfter: string;
  subtitle: string;
  worksDone: string[];
  image: string;
  primaryBtnLabel: string;
  primaryBtnHref: string;
  primaryBtnClass: string;
  primaryBtnIcon: string;
  secondaryBtnLabel: string;
  secondaryBtnTo: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    badgeText: 'Teslim Edilen Kamu Projesi • Yüreğir / ADANA',
    badgeStyle: 'bg-emerald-950/90 border-emerald-400/60 text-emerald-300',
    badgeIcon: 'fa-solid fa-circle-check text-emerald-400',
    titleBefore: 'Adana Adliyesi ',
    titleHighlight: 'Çatı Yenileme',
    highlightColor: 'text-blue-400',
    titleAfter: ' ve İzolasyon',
    subtitle:
      'Adana Adalet Sarayı ana ve ek bloklarında anahtar teslim çatı yenileme projesi tamamlandı.',
    worksDone: [
      'Çatı Kaplama Yenileme',
      'Isı & Su Yalıtım Katmanları',
      'Yağmur Drenaj Altyapısı',
      'Anahtar Teslim Kamu Projesi',
    ],
    image: '/images/adana-adliye-gercek.jpg',
    primaryBtnLabel: 'Proje Dosyasını İncele',
    primaryBtnHref: '#proje-vitrini',
    primaryBtnClass:
      'bg-blue-600 hover:bg-blue-500 text-white border border-blue-300 shadow-blue-600/40',
    primaryBtnIcon: 'fa-solid fa-layer-group',
    secondaryBtnLabel: 'Tüm Projelerimiz',
    secondaryBtnTo: '/projeler',
  },
  {
    badgeText: 'Sağlık Altyapı Taahhüdü • Pozantı / ADANA',
    badgeStyle: 'bg-amber-950/90 border-amber-400/60 text-amber-300',
    badgeIcon: 'fa-solid fa-fire-extinguisher text-amber-400',
    titleBefore: 'Pozantı 80. Yıl Devlet Hastanesi ',
    titleHighlight: 'Yangın Güvenliği',
    highlightColor: 'text-amber-400',
    titleAfter: ' Çalışmaları',
    subtitle:
      'Yangın güvenliği standartlarının güçlendirilmesine yönelik tadilat ve bakım çalışmaları tamamlandı.',
    worksDone: [
      'Yangın Güvenliği Tadilatları',
      'Söndürme & Algılama Bakımı',
      'Tahliye & Güvenlik Standartları',
      'Sağlık Tesisi Altyapısı',
    ],
    image: '/images/pozanti-hastane-gercek.jpg',
    primaryBtnLabel: 'Teknik Detayları Gör',
    primaryBtnHref: '#proje-vitrini',
    primaryBtnClass:
      'bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-200 shadow-amber-500/40',
    primaryBtnIcon: 'fa-solid fa-shield-halved',
    secondaryBtnLabel: 'Yangın & Mekanik Portföy',
    secondaryBtnTo: '/hizmetler/yangin-guvenligi-sistemleri',
  },
  {
    badgeText: '25/02/2016 Kuruluş • Seyhan / ADANA',
    badgeStyle: 'bg-blue-950/90 border-blue-400/60 text-blue-300',
    badgeIcon: 'fa-solid fa-building-columns text-blue-400',
    titleBefore: 'Kuzey Denizi ',
    titleHighlight: 'İnşaat San. ve Tic.',
    highlightColor: 'text-blue-400',
    titleAfter: ' Ltd. Şti.',
    subtitle:
      "2016'dan bu yana Adana merkezli kamu ve özel sektör yapı taahhüt hizmetleri.",
    worksDone: [
      'Kamu Çatı Yenileme',
      'Hastane Yangın Sistemleri',
      'Bina İnşaat & Tadilat',
      'Tel: 0533 677 91 09',
    ],
    image: '/images/insaat-taahhut.jpg',
    primaryBtnLabel: 'Projelerimizi İncele',
    primaryBtnHref: '#proje-vitrini',
    primaryBtnClass:
      'bg-blue-600 hover:bg-blue-500 text-white border border-blue-300 shadow-blue-600/40',
    primaryBtnIcon: 'fa-solid fa-compass-drafting',
    secondaryBtnLabel: 'Teklif Talebi Oluştur',
    secondaryBtnTo: '/iletisim',
  },
  {
    badgeText: 'Endüstriyel & Kurumsal Teknik Çözümler',
    badgeStyle: 'bg-sky-950/90 border-sky-400/60 text-sky-300',
    badgeIcon: 'fa-solid fa-industry text-sky-400',
    titleBefore: 'Çelik Yapı, Çatı ve ',
    titleHighlight: 'Yangın Güvenliği',
    highlightColor: 'text-sky-400',
    titleAfter: ' Uzmanlığı',
    subtitle:
      'Kamu tesisleri ve sanayi yapıları için mühendislik, uygulama ve periyodik bakım çözümleri.',
    worksDone: [
      'Çelik Çatı Konstrüksiyonu',
      'Yangın Söndürme Altyapısı',
      'Isı & Su İzolasyon Sistemleri',
      'Yerinde Keşif & Teklif',
    ],
    image: '/images/celik-yapi.jpg',
    primaryBtnLabel: 'Çelik & Bakım Çözümleri',
    primaryBtnHref: '/hizmetler/celik-yapi-tesis-bakim',
    primaryBtnClass:
      'bg-sky-600 hover:bg-sky-500 text-white border border-sky-300 shadow-sky-600/40',
    primaryBtnIcon: 'fa-solid fa-helmet-safety',
    secondaryBtnLabel: 'Fiyat Teklifi İsteyin',
    secondaryBtnTo: '/iletisim',
  },
];

export const HomePage: React.FC = () => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [projects, setProjects] = useState<ProjectItem[]>(SEED_PROJECTS);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

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

  const flagshipAdliye =
    projects.find((p) => p.id === 'prj-adana-adliye-cati') || SEED_PROJECTS[0];
  const flagshipPozanti =
    projects.find((p) => p.id === 'prj-pozanti-hastane-yangin') || SEED_PROJECTS[1];

  const slideLabel = String(activeSlide + 1).padStart(2, '0');
  const slideTotal = String(HERO_SLIDES.length).padStart(2, '0');

  return (
    <PublicLayout isHome>
      {/* 1. HERO FULL-VIEWPORT SLIDER */}
      <section className="relative h-screen min-h-[680px] bg-black overflow-hidden">
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
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/30" />

              <div className="relative z-20 h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center pt-24 pb-16">
                <div className="hero-content max-w-3xl space-y-4">
                  <div
                    className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full border text-xs font-black uppercase tracking-widest backdrop-blur-md ${slide.badgeStyle}`}
                  >
                    <i className={slide.badgeIcon} />
                    <span>{slide.badgeText}</span>
                  </div>

                  {idx === 0 ? (
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12] text-white text-glow">
                      {slide.titleBefore}
                      <span className={slide.highlightColor}>{slide.titleHighlight}</span>
                      {slide.titleAfter}
                    </h1>
                  ) : (
                    <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12] text-white text-glow">
                      {slide.titleBefore}
                      <span className={slide.highlightColor}>{slide.titleHighlight}</span>
                      {slide.titleAfter}
                    </h2>
                  )}

                  <p className="text-base sm:text-lg text-slate-200 font-semibold leading-snug max-w-2xl">
                    {slide.subtitle}
                  </p>

                  {/* Short Bulleted Works Summary */}
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {slide.worksDone.map((work, wIdx) => (
                      <span
                        key={wIdx}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-600/80 text-xs sm:text-sm font-bold text-slate-100 backdrop-blur-md"
                      >
                        <i className="fa-solid fa-check text-emerald-400 text-xs" />
                        <span>{work}</span>
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    {slide.primaryBtnHref.startsWith('#') ? (
                      <a
                        href={slide.primaryBtnHref}
                        className={`inline-flex items-center gap-2.5 font-black text-sm sm:text-base px-8 py-4 rounded-xl shadow-xl transform hover:scale-105 transition ${slide.primaryBtnClass}`}
                      >
                        <i className={slide.primaryBtnIcon} />
                        <span>{slide.primaryBtnLabel}</span>
                      </a>
                    ) : (
                      <Link
                        to={slide.primaryBtnHref}
                        className={`inline-flex items-center gap-2.5 font-black text-sm sm:text-base px-8 py-4 rounded-xl shadow-xl transform hover:scale-105 transition ${slide.primaryBtnClass}`}
                      >
                        <i className={slide.primaryBtnIcon} />
                        <span>{slide.primaryBtnLabel}</span>
                      </Link>
                    )}

                    <Link
                      to={slide.secondaryBtnTo}
                      className="inline-flex items-center gap-2.5 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border-2 border-white/60 text-white font-bold text-sm sm:text-base px-8 py-4 rounded-xl transition"
                    >
                      <span>{slide.secondaryBtnLabel}</span>
                      <i className="fa-solid fa-arrow-right" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Slider Bottom Controls */}
        <div className="absolute bottom-8 left-0 right-0 z-30">
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
                      ? 'w-10 bg-blue-500 shadow-lg shadow-blue-500/60'
                      : 'w-2.5 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3 mr-16 sm:mr-0">
              <span
                id="slide-number"
                className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-600 font-mono text-xs font-extrabold text-slate-200 backdrop-blur-md"
              >
                {slideLabel} / {slideTotal}
              </span>
              <button
                type="button"
                onClick={prevSlide}
                aria-label="Önceki Slayt"
                className="w-11 h-11 rounded-xl bg-slate-900/90 hover:bg-blue-600 border border-slate-600 text-white flex items-center justify-center transition"
              >
                <i className="fa-solid fa-chevron-left" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                aria-label="Sonraki Slayt"
                className="w-11 h-11 rounded-xl bg-slate-900/90 hover:bg-blue-600 border border-slate-600 text-white flex items-center justify-center transition"
              >
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. KPI / STATS BAR */}
      <section className="bg-[#0b1329] border-y-2 border-slate-700 relative z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border-2 border-blue-500/50 flex items-center justify-center text-blue-400 text-2xl shrink-0">
                <i className="fa-solid fa-calendar-check" />
              </div>
              <div>
                <div className="text-2xl font-black text-white tracking-tight">25/02/2016</div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mt-0.5">
                  Kuruluş &amp; Sektör Geçmişi
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-400/50 flex items-center justify-center text-amber-400 text-2xl shrink-0">
                <i className="fa-solid fa-landmark" />
              </div>
              <div>
                <div className="text-2xl font-black text-white tracking-tight">Adana &amp; Pozantı</div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mt-0.5">
                  Referans Kamu Projeleri
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400/50 flex items-center justify-center text-emerald-400 text-2xl shrink-0">
                <i className="fa-solid fa-file-shield" />
              </div>
              <div>
                <div className="text-2xl font-black text-white tracking-tight">2640323020</div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mt-0.5">
                  Seyhan V.D. Resmi Kayıt
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-sky-500/20 border-2 border-sky-400/50 flex items-center justify-center text-sky-400 text-2xl shrink-0">
                <i className="fa-solid fa-phone-volume" />
              </div>
              <div>
                <div className="text-2xl font-black text-white tracking-tight">0533 677 91 09</div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mt-0.5">
                  Doğrudan İletişim &amp; WhatsApp
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FLAGSHIP SHOWCASE SECTION (matching #proje-videolari layout) */}
      <section
        id="proje-vitrini"
        className="relative py-24 bg-[#030712] border-b-2 border-slate-800 overflow-hidden"
      >
        <div className="absolute inset-0 opacity-30 dot-pattern pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-red-950/70 border border-red-500/50 text-red-300 text-xs font-black uppercase tracking-widest">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span>Öne Çıkan Şantiye &amp; Kamu Projelerimiz</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Gerçekleşen Flagship Mühendislik Projelerimiz
            </h2>
            <p className="text-slate-300 font-medium text-base">
              Adana ve Çukurova bölgesinde teslim ettiğimiz yüksek standartlı kamu çatı yenileme ve
              hastane yangın güvenliği projelerimizi teknik detaylarıyla inceleyin.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-10">
            {[flagshipAdliye, flagshipPozanti].map((item, idx) => (
              <div
                key={item.id}
                className="bg-[#0b1329] rounded-3xl border-2 border-slate-700 hover:border-blue-400 transition overflow-hidden shadow-2xl flex flex-col"
              >
                {/* Top Aspect-Video Showcase Slot */}
                <div
                  onClick={() => setSelectedProject(item)}
                  className="relative aspect-video bg-black overflow-hidden cursor-pointer group"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

                  {/* Floating Top Badges */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
                    <span className="px-3.5 py-1.5 rounded-full bg-slate-950/90 border border-slate-600 text-xs font-extrabold text-white backdrop-blur-md">
                      <i className="fa-solid fa-location-dot text-blue-400 mr-1.5" />
                      {item.location}
                    </span>
                    <span
                      className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border backdrop-blur-md ${
                        idx === 0
                          ? 'bg-emerald-950/90 border-emerald-400/70 text-emerald-300'
                          : 'bg-amber-950/90 border-amber-400/70 text-amber-300'
                      }`}
                    >
                      <i className="fa-solid fa-circle-check mr-1.5" />
                      {item.statusBadge}
                    </span>
                  </div>

                  {/* Center Interactive Inspect CTA */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-blue-600/90 group-hover:bg-blue-500 text-white font-black text-sm border border-blue-300 shadow-2xl transform group-hover:scale-105 transition">
                      <i className="fa-solid fa-magnifying-glass-chart text-lg" />
                      <span>Teknik Dosya &amp; Galeriyi Aç</span>
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-slate-300 font-bold">
                    <span>{item.code}</span>
                    <span>{item.area}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-7 sm:p-8 space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="text-xs font-black uppercase tracking-widest text-blue-400">
                      {item.categoryLabel}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-white leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">{item.description}</p>
                  </div>

                  {/* Thumbnail Gallery Strip */}
                  <div
                    className={`grid ${
                      item.galleryImages.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                    } gap-3 pt-2`}
                  >
                    {item.galleryImages.slice(0, 3).map((thumb, tIdx) => (
                      <button
                        key={tIdx}
                        type="button"
                        onClick={() => setSelectedProject(item)}
                        className="h-20 sm:h-22 rounded-xl overflow-hidden border-2 border-slate-700 hover:border-blue-400 transition group"
                      >
                        <img
                          src={thumb}
                          alt={`${item.shortName} görsel ${tIdx + 1}`}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                        />
                      </button>
                    ))}
                  </div>

                  {/* Footer Row */}
                  <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-extrabold">
                    <Link
                      to={
                        item.id === 'prj-adana-adliye-cati'
                          ? '/projeler/adana-adliyesi-cati-yenileme'
                          : '/projeler/pozanti-devlet-hastanesi-yangin-guvenligi'
                      }
                      className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1.5 transition"
                    >
                      <span>Proje Detay Sayfası</span>
                      <i className="fa-solid fa-up-right-from-square text-[11px]" />
                    </Link>
                    <Link
                      to="/iletisim"
                      className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1.5 transition"
                    >
                      <span>Benzer Proje İçin Teklif Al</span>
                      <i className="fa-solid fa-arrow-right" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. CORPORATE TRUST & ABOUT SECTION */}
      <section className="py-24 bg-[#070d1e] border-b-2 border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-14 items-center">
            {/* Left Image Column */}
            <div className="lg:col-span-5 relative group">
              <div className="relative h-[480px] rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl">
                <img
                  src="/images/kurumsal-muhendis.jpg"
                  alt="Kuzey Denizi İnşaat Saha Mühendisleri"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#02050e] via-[#02050e]/40 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <BrandLogo size="sm" subtitle="Adana / Çukurova Bölge Merkezi" />
                </div>
              </div>

              {/* Overlapping Callout Card */}
              <div className="hidden sm:block absolute -bottom-6 -right-4 bg-blue-600 p-6 rounded-2xl border-2 border-blue-300 shadow-2xl max-w-[210px]">
                <div className="text-3xl font-black text-white">%100 Güvence</div>
                <div className="text-xs font-bold text-blue-100 mt-1">
                  Kamu Şartnamesi &amp; Zamanında Teslim Garantisi
                </div>
              </div>
            </div>

            {/* Right Text Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-950/80 border border-blue-500/40 text-blue-300 text-xs font-black uppercase tracking-widest">
                <i className="fa-solid fa-flag text-blue-400" />
                <span>Kurumsal Güven &amp; Mühendislik</span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                Kuzey Denizi İnşaat A.Ş. ile Kesintisiz Kamu &amp; Endüstriyel Çözümler
              </h2>

              <p className="text-slate-300 text-base leading-relaxed font-medium">
                Adana merkezli şirketimiz; Adalet Bakanlığı ve Sağlık Bakanlığı başta olmak üzere
                kamu kurumlarının ve özel sektör sanayi yatırımlarının çatı yenileme, yangın
                algılama-söndürme sistemleri, statik güçlendirme ve çelik konstrüksiyon işlerini
                yürürlükteki TBDY 2018 ve Binaların Yangından Korunması Yönetmeliği (BYKHY)
                esaslarına tam uygunlukla gerçekleştirir.
              </p>

              <p className="text-slate-400 text-sm leading-relaxed font-medium">
                Adana Adliyesi Çatı Yenileme ve Pozantı 80. Yıl Devlet Hastanesi Yangın Güvenliği
                Standartlarının Güçlendirilmesine Yönelik Tadilat ve Bakım Çalışmaları gibi
                referanslarımızı iş programından taviz vermeden teslim etmenin gururunu taşıyoruz.
              </p>

              <div className="grid sm:grid-cols-2 gap-5 pt-2">
                <div className="p-5 rounded-2xl bg-[#0b1329] border-2 border-slate-700 space-y-2">
                  <div className="flex items-center gap-2.5 text-blue-400 font-black text-sm">
                    <i className="fa-solid fa-file-contract" />
                    <span>Resmi Şartname Uyumu</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    4734 Sayılı Kamu İhale Kanunu, TSE ve EN 12845 standartlarına %100 uygun
                    hakediş ve teknik dosya yönetimi.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#0b1329] border-2 border-slate-700 space-y-2">
                  <div className="flex items-center gap-2.5 text-amber-400 font-black text-sm">
                    <i className="fa-solid fa-fire-flame-curved" />
                    <span>Çatı &amp; Yangın Uzmanlığı</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Kenet metal çatı izolasyonundan UL/FM yangın pompa istasyonlarına kadar uzman
                    mühendis kadrosu.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-3">
                <Link
                  to="/kurumsal"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm px-7 py-3.5 rounded-xl border border-blue-300 shadow-lg shadow-blue-600/30 transition"
                >
                  <span>Kurumsal Profilimizi İnceleyin</span>
                  <i className="fa-solid fa-arrow-right" />
                </Link>
                <Link
                  to="/iletisim"
                  className="inline-flex items-center gap-2 bg-[#0b1329] hover:bg-slate-800 border-2 border-slate-600 text-white font-bold text-sm px-7 py-3.5 rounded-xl transition"
                >
                  <span>Mühendislerimizle İletişime Geçin</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SERVICES GRID SECTION */}
      <section className="py-24 bg-[#0b1329] border-b-2 border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/80 border border-blue-500/40 text-blue-300 text-xs font-black uppercase tracking-widest">
              Faaliyet Alanlarımız
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Uzman Mühendislik &amp; Yapı Hizmetleri
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Service 1 */}
            <div className="bg-[#070d1e] p-8 rounded-3xl border-2 border-slate-700 hover:border-blue-400 glow-hover flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-blue-600/30">
                  <i className="fa-solid fa-building-columns" />
                </div>
                <h3 className="text-2xl font-black text-white">
                  Kamu Taahhüt &amp; Çatı Yenileme
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Adliye, hastane, okul ve kamu binalarında ağır çelik çatı konstrüksiyonu,
                  gizli kenet sac, taşyünü ısı ve TPO/EPDM su yalıtımı çözümleri.
                </p>
                <ul className="space-y-2.5 text-sm font-semibold text-slate-200">
                  <li className="flex items-center gap-2.5">
                    <i className="fa-solid fa-circle-check text-blue-400" />
                    <span>Büyük Açıklıklı Kenet &amp; Membran Çatı</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <i className="fa-solid fa-circle-check text-blue-400" />
                    <span>TBDY 2018 Yapısal Güçlendirme</span>
                  </li>
                </ul>
              </div>
              <Link
                to="/hizmetler/cati-yenileme-izolasyon"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-950/70 hover:bg-blue-600 border border-blue-500/50 text-blue-300 hover:text-white text-xs font-black uppercase tracking-wider transition"
              >
                <span>Detayları İncele</span>
                <i className="fa-solid fa-arrow-right" />
              </Link>
            </div>

            {/* Service 2 */}
            <div className="bg-[#070d1e] p-8 rounded-3xl border-2 border-slate-700 hover:border-amber-400 glow-hover flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/30">
                  <i className="fa-solid fa-fire-extinguisher" />
                </div>
                <h3 className="text-2xl font-black text-white">
                  Yangın Güvenliği &amp; Mekanik Sistemler
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Hastaneler, fabrikalar ve kamu tesisleri için yangın pompa istasyonları,
                  otomatik sprinkler ağları, hidrant hatları ve adresli algılama projeleri.
                </p>
                <ul className="space-y-2.5 text-sm font-semibold text-slate-200">
                  <li className="flex items-center gap-2.5">
                    <i className="fa-solid fa-circle-check text-amber-400" />
                    <span>UL/FM Pompa İstasyonu &amp; Sprinkler</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <i className="fa-solid fa-circle-check text-amber-400" />
                    <span>Duman Tahliye &amp; Adresli İhbar</span>
                  </li>
                </ul>
              </div>
              <Link
                to="/hizmetler/yangin-guvenligi-sistemleri"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-950/70 hover:bg-amber-500 border border-amber-500/50 text-amber-300 hover:text-slate-950 text-xs font-black uppercase tracking-wider transition"
              >
                <span>Detayları İncele</span>
                <i className="fa-solid fa-arrow-right" />
              </Link>
            </div>

            {/* Service 3 */}
            <div className="bg-[#070d1e] p-8 rounded-3xl border-2 border-slate-700 hover:border-sky-400 glow-hover flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-sky-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-sky-600/30">
                  <i className="fa-solid fa-industry" />
                </div>
                <h3 className="text-2xl font-black text-white">
                  Ağır Çelik &amp; Entegre Tesis Bakımı
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  OSB sanayi tesisleri, lojistik depoları ve kamu yerleşkeleri için çelik
                  konstrüksiyon, cephe modernizasyonu ve periyodik teknik bakım hizmetleri.
                </p>
                <ul className="space-y-2.5 text-sm font-semibold text-slate-200">
                  <li className="flex items-center gap-2.5">
                    <i className="fa-solid fa-circle-check text-sky-400" />
                    <span>S355 Çelik Hangar &amp; Depo İmalatı</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <i className="fa-solid fa-circle-check text-sky-400" />
                    <span>Periyodik Yangın &amp; Çatı Bakımı</span>
                  </li>
                </ul>
              </div>
              <Link
                to="/hizmetler/celik-yapi-tesis-bakim"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-950/70 hover:bg-sky-600 border border-sky-500/50 text-sky-300 hover:text-white text-xs font-black uppercase tracking-wider transition"
              >
                <span>Detayları İncele</span>
                <i className="fa-solid fa-arrow-right" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. QUOTE & DISCOVERY FORM SECTION (#teklif-al) */}
      <section id="teklif-al" className="py-24 bg-[#030712] border-t-2 border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#0b1329] rounded-3xl border-2 border-slate-700 overflow-hidden shadow-2xl grid lg:grid-cols-12">
            {/* Left Info Sidebar */}
            <div className="lg:col-span-5 bg-gradient-to-br from-[#070d1e] to-[#0b1329] p-8 sm:p-10 border-b-2 lg:border-b-0 lg:border-r-2 border-slate-700 flex flex-col justify-between space-y-8">
              <div className="space-y-5">
                <BrandLogo />
                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  Projeniz İçin Teklif ve Keşif Alın
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  İletişim formunu doldurduğunuz anda talebiniz doğrudan{' '}
                  <strong className="text-blue-300">Kuzey Denizi Yönetim Dashboard&apos;una</strong>{' '}
                  düşer ve ilgili teknik ekibimize atanır.
                </p>

                <div className="space-y-4 pt-2">
                  <div className="p-4 rounded-2xl bg-[#070d1e] border border-slate-700 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/50 text-blue-400 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-phone" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase text-slate-400">
                        Telefon / WhatsApp
                      </div>
                      <a
                        href="tel:+905336779109"
                        className="text-sm font-black text-white hover:text-blue-400 transition"
                      >
                        0533 677 91 09
                      </a>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#070d1e] border border-slate-700 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-400 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-envelope" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase text-slate-400">
                        İhale &amp; Kurumsal Yazışma
                      </div>
                      <a
                        href="mailto:info@kuzeydeniziyapi.com.tr"
                        className="text-sm font-black text-white hover:text-amber-300 transition"
                      >
                        info@kuzeydeniziyapi.com.tr
                      </a>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#070d1e] border border-slate-700 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-location-dot" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase text-slate-400">Merkez Ofis</div>
                      <div className="text-sm font-bold text-slate-200">
                        Yeşiloba Mah. 46088 Sk. No: 18 B, Seyhan / ADANA
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-slate-400 leading-relaxed">
                <i className="fa-solid fa-shield-halved text-blue-400 mr-1.5" />
                Gönderilen veriler 6698 Sayılı KVKK kapsamında yalnızca keşif ve teklif süreçlerinde
                kullanılır.
              </div>
            </div>

            {/* Right Form Column */}
            <div className="lg:col-span-7 p-8 sm:p-10">
              <ContactFormCard sourcePage="Ana Sayfa" submitLabel="Teklif Talebini Gönder" />
            </div>
          </div>
        </div>
      </section>

      <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
    </PublicLayout>
  );
};
