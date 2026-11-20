import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/PublicLayout';
import { SERVICES_CATALOG, SERVICE_CATEGORIES } from '../data/servicesData';

export const HizmetlerPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredServices = useMemo(() => {
    return SERVICES_CATALOG.filter((srv) => {
      const matchCat = selectedCategory === 'all' || srv.category === selectedCategory;
      if (!matchCat) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const inTitle = srv.title.toLowerCase().includes(q);
      const inDesc = srv.shortDesc.toLowerCase().includes(q);
      const inItems = srv.items.some((it) => it.toLowerCase().includes(q));
      return inTitle || inDesc || inItems;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative py-20 bg-[#042A53] border-b-4 border-[#F25C05] overflow-hidden text-white">
        <div className="absolute inset-0 blueprint-grid-dark opacity-40 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-[#F7941D] text-xs font-black uppercase tracking-widest">
            <i className="fa-solid fa-shapes" />
            <span>15 Mühendislik Disiplini &amp; Kamu Müteahhitliği</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white max-w-4xl leading-tight">
            Anahtar Teslim İnşaat, Kamu Taahhüt &amp; Altyapı Çözümleri
          </h1>
          <p className="text-slate-200 max-w-3xl text-base sm:text-lg font-medium leading-relaxed">
            4734 Sayılı Kamu İhale Kanunu kapsamındaki kamu müteahhitliğinden endüstriyel fabrikalara,
            bina ve konut inşaatlarından altyapı, enerji santralleri ve saha betonlarına kadar 15 ana
            mühendislik disiplininde sıfır hata prensibiyle hizmet veriyoruz.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/15">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-2xl sm:text-3xl font-black text-[#F7941D] block">15</span>
              <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">Hizmet Disiplini</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-2xl sm:text-3xl font-black text-sky-400 block">200+</span>
              <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">İmalat &amp; İş Kalemi</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 block">4734 KİK</span>
              <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">Kamu İhale &amp; EKAP</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-2xl sm:text-3xl font-black text-[#F25C05] block">TBDY 2018</span>
              <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">Deprem Yönetmeliği</span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter and Services Section */}
      <section className="py-16 sm:py-20 bg-slate-50 blueprint-grid-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          {/* Controls: Search + Category Tabs */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {SERVICE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all shadow-xs ${
                      selectedCategory === cat.id
                        ? 'bg-[#042A53] text-white shadow-md'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <i className={cat.icon} />
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative min-w-[260px] md:w-80">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                <input
                  type="text"
                  placeholder="Hizmet veya imalat kalemi ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-[#F25C05] shadow-xs"
                />
              </div>
            </div>

            <div className="text-xs text-slate-500 font-semibold flex items-center justify-between">
              <span>Toplam {filteredServices.length} hizmet disiplini listeleniyor.</span>
              {(selectedCategory !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                  }}
                  className="text-[#F25C05] hover:underline font-bold"
                >
                  Filtreleri Temizle
                </button>
              )}
            </div>
          </div>

          {/* Service Cards Grid */}
          <div className="space-y-8">
            {filteredServices.map((srv) => {
              const isExpanded = !!expandedIds[srv.id];
              return (
                <article
                  key={srv.id}
                  id={srv.id}
                  className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-lg hover:shadow-2xl transition-all"
                >
                  <div className="grid lg:grid-cols-12 gap-8 items-start">
                    {/* Left: Main info */}
                    <div className="lg:col-span-7 space-y-4">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-block px-3.5 py-1 rounded-full bg-[#FFF4EC] text-[#F25C05] text-xs font-black uppercase tracking-widest">
                          {srv.badge}
                        </span>
                        <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-bold">
                          {srv.count}
                        </span>
                      </div>

                      <h2 className="text-2xl sm:text-3xl font-black text-[#042A53] leading-snug">
                        {srv.title}
                      </h2>

                      <p className="text-slate-600 leading-relaxed text-sm sm:text-base font-normal">
                        {srv.shortDesc}
                      </p>

                      <p className="text-slate-700 leading-relaxed text-xs sm:text-sm bg-slate-50 border border-slate-200/80 p-4 rounded-2xl">
                        {srv.detailedText}
                      </p>

                      <div className="pt-2 flex flex-wrap gap-3 items-center">
                        <Link
                          to={`/iletisim?hizmet=${encodeURIComponent(srv.title)}`}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#F7941D] to-[#F25C05] hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider transition shadow-md"
                        >
                          <span>Teklif &amp; Keşif İste</span>
                          <i className="fa-solid fa-arrow-right" />
                        </Link>
                        
                        <button
                          type="button"
                          onClick={() => toggleExpand(srv.id)}
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#042A53] hover:bg-[#0068C9] text-white font-bold text-xs uppercase tracking-wider transition shadow-md"
                        >
                          <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-list-check'}`} />
                          <span>{isExpanded ? 'Kalemleri Kapat' : `Tüm İmalat Kalemlerini Gör (${srv.items.length})`}</span>
                        </button>
                      </div>
                    </div>

                    {/* Right: Technical Highlights Box */}
                    <div className="lg:col-span-5 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200/90 space-y-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${srv.color} text-white flex items-center justify-center text-xl shadow-md`}
                        >
                          <i className={srv.icon} />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                            MÜHENDİSLİK STANDARDI
                          </span>
                          <h3 className="text-sm font-black text-[#042A53] uppercase tracking-wide">
                            Teknik Standartlar &amp; Şartname
                          </h3>
                        </div>
                      </div>

                      <ul className="space-y-2.5 pt-1">
                        {srv.bullets.map((b, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#042A53] font-medium leading-relaxed">
                            <i className="fa-solid fa-circle-check text-[#F25C05] mt-1 shrink-0 text-sm" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Expandable Items Section */}
                  {isExpanded && (
                    <div className="mt-8 pt-6 border-t border-slate-200 space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-widest text-[#042A53] flex items-center gap-2">
                          <i className="fa-solid fa-layer-group text-[#F25C05]" />
                          <span>Bu Disiplin Kapsamındaki İmalat ve Taahhüt Kalemleri:</span>
                        </h4>
                        <span className="text-xs font-mono font-bold text-slate-500">{srv.items.length} Kalem</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                        {srv.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-white border border-slate-200/90 hover:border-[#F25C05] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 flex items-center gap-2 transition shadow-xs"
                          >
                            <i className="fa-solid fa-check text-emerald-500 text-[10px] shrink-0" />
                            <span className="truncate">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}

            {filteredServices.length === 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
                <i className="fa-solid fa-circle-question text-4xl text-slate-400" />
                <h3 className="text-lg font-bold text-[#042A53]">Aradığınız kriterlere uygun hizmet bulunamadı.</h3>
                <p className="text-sm text-slate-500">Lütfen arama teriminizi değiştirin veya tüm kategorileri görüntüleyin.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#042A53] text-white text-xs font-bold uppercase tracking-wider"
                >
                  Tüm Hizmetleri Göster
                </button>
              </div>
            )}
          </div>

          {/* Bottom CTA */}
          <div className="bg-gradient-to-br from-[#042A53] via-[#06376B] to-[#021B36] rounded-3xl p-8 sm:p-12 text-white border-2 border-[#F25C05]/40 shadow-2xl space-y-6 text-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#F25C05] text-white text-xs font-black uppercase tracking-widest">
              7/24 Şantı̇ye &amp; Teklif Hattı
            </span>
            <h2 className="text-2xl sm:text-4xl font-black max-w-3xl mx-auto leading-tight">
              Kamu veya Özel Sektör Projeniz İçin Teknik Keşif ve Fiyat Teklifi Alın
            </h2>
            <p className="text-slate-300 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              Mühendis kadromuz, şartnamenizi ve metraj cetvelinizi inceleyerek en uygun birim fiyat,
              iş programı ve mühendislik planlamasını aynı gün hazırlar.
            </p>
            <div className="flex flex-wrap gap-4 justify-center items-center pt-2">
              <Link
                to="/iletisim"
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#F7941D] to-[#F25C05] hover:brightness-110 text-white font-black text-sm uppercase tracking-wider shadow-lg transition"
              >
                Online Teklif Formu
              </Link>
              <a
                href="https://wa.me/905336779109?text=Merhaba,%20kamu/özel%20sektör%20inşaat%20hizmetleriniz%20hakkında%20bilgi%20ve%20teklif%20almak%20istiyorum."
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider shadow-lg transition inline-flex items-center gap-2"
              >
                <i className="fa-brands fa-whatsapp text-lg" />
                <span>WhatsApp ile Hızlı Ulaşın</span>
              </a>
            </div>
          </div>

        </div>
      </section>
    </PublicLayout>
  );
};
