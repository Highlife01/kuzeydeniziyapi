import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { PublicLayout } from '../components/PublicLayout';
import { SEO_ROUTES, SEO_SITE } from '../seo/seoData';
import { NotFoundPage } from './NotFoundPage';

export const HizmetDetayPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const targetPath = `/hizmetler/${slug || ''}`;
  const route = SEO_ROUTES.find((r) => r.kind === 'service' && r.path === targetPath);

  if (!route) {
    return <NotFoundPage />;
  }

  const related = (route.relatedPaths || [])
    .map((p) => SEO_ROUTES.find((r) => r.path === p))
    .filter(Boolean);
  const otherServices = SEO_ROUTES.filter(
    (r) => r.kind === 'service' && r.path !== route.path
  );

  return (
    <PublicLayout>
      <section className="relative py-16 sm:py-20 bg-[#070d1e] border-b-2 border-slate-800 overflow-hidden">
        <div className="absolute inset-0 opacity-30 dot-pattern pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
          <nav aria-label="İçerik Yolu" className="text-xs font-bold text-slate-400 flex items-center gap-2 flex-wrap">
            <Link to="/" className="hover:text-blue-400 transition">Ana Sayfa</Link>
            <span>/</span>
            <Link to="/hizmetler" className="hover:text-blue-400 transition">Faaliyet Alanları</Link>
            <span>/</span>
            <span className="text-blue-300">{route.navLabel}</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/90 border border-blue-500/40 text-blue-300 text-xs font-black uppercase tracking-widest">
            <i className="fa-solid fa-screwdriver-wrench" />
            <span>{route.heroBadge}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white max-w-4xl leading-tight">
            {route.h1}
          </h1>
          <p className="text-slate-300 max-w-3xl text-base sm:text-lg leading-relaxed font-medium">
            {route.leadSummary}
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-[#030712]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-8">
            {route.image && (
              <div className="rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl">
                <img
                  src={route.image}
                  alt={route.ogImageAlt || route.h1}
                  className="w-full h-[380px] object-cover"
                />
              </div>
            )}

            {route.highlights && route.highlights.length > 0 && (
              <div className="p-8 rounded-3xl bg-[#0b1329] border-2 border-slate-700 space-y-4">
                <h2 className="text-2xl font-black text-white">Teknik Kapsam ve Standartlar</h2>
                <ul className="space-y-3">
                  {route.highlights.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-200 leading-relaxed">
                      <i className="fa-solid fa-circle-check text-blue-400 mt-1 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(route.sections || []).map((sec, idx) => (
              <div key={idx} className="p-8 rounded-3xl bg-[#070d1e] border-2 border-slate-800 space-y-4">
                <h2 className="text-xl sm:text-2xl font-black text-white">{sec.heading}</h2>
                <p className="text-sm text-slate-300 leading-relaxed">{sec.summary}</p>
                <ul className="space-y-2.5">
                  {sec.bullets.map((b, bi) => (
                    <li key={bi} className="flex items-start gap-2.5 text-sm text-slate-200">
                      <i className="fa-solid fa-angle-right text-amber-400 mt-1 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <aside className="lg:col-span-5 space-y-6">
            <div className="p-7 rounded-3xl bg-gradient-to-br from-blue-950/90 to-[#0b1329] border-2 border-blue-500/50 space-y-4">
              <div className="text-xs font-black uppercase tracking-widest text-amber-400">
                Teknik Keşif &amp; Teklif
              </div>
              <h2 className="text-2xl font-black text-white">Projeniz İçin Teklif Alın</h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                {SEO_SITE.geo.serviceAreas.join(', ')} bölgelerinde yerinde keşif ve şartname
                incelemesi için mühendislik ekibimize doğrudan ulaşabilirsiniz.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  to="/iletisim"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm px-5 py-3.5 rounded-xl border border-blue-300 transition"
                >
                  <span>Teklif Formu</span>
                  <i className="fa-solid fa-arrow-right" />
                </Link>
                <a
                  href={`tel:${SEO_SITE.phoneHref}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm px-5 py-3.5 rounded-xl border border-slate-600 transition"
                >
                  <i className="fa-solid fa-phone" />
                  <span>{SEO_SITE.phoneDisplay}</span>
                </a>
              </div>
            </div>

            {related.length > 0 && (
              <div className="p-6 rounded-3xl bg-[#0b1329] border-2 border-slate-700 space-y-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400">
                  İlgili Referans Projeler
                </h3>
                {related.map((rel) => rel && (
                  <Link
                    key={rel.path}
                    to={rel.path}
                    className="block p-4 rounded-2xl bg-[#070d1e] border border-slate-700 hover:border-emerald-400 transition space-y-1"
                  >
                    <div className="text-sm font-black text-white">{rel.navLabel}</div>
                    <p className="text-xs text-slate-400 line-clamp-2">{rel.description}</p>
                  </Link>
                ))}
              </div>
            )}

            <div className="p-6 rounded-3xl bg-[#0b1329] border-2 border-slate-700 space-y-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-blue-400">
                Diğer Faaliyet Alanları
              </h3>
              <div className="space-y-2">
                {otherServices.map((srv) => (
                  <Link
                    key={srv.path}
                    to={srv.path}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#070d1e] border border-slate-800 hover:border-blue-400 text-sm font-bold text-slate-200 transition"
                  >
                    <span>{srv.navLabel}</span>
                    <i className="fa-solid fa-chevron-right text-xs text-blue-400" />
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </PublicLayout>
  );
};
