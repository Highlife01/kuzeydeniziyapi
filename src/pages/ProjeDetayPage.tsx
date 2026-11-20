import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PublicLayout } from '../components/PublicLayout';
import { SEED_PROJECTS } from '../data/seedData';
import { SEO_ROUTES, SEO_SITE } from '../seo/seoData';
import { subscribePublicProjects } from '../services/dataService';
import { ProjectItem } from '../types';
import { NotFoundPage } from './NotFoundPage';

export const ProjeDetayPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const targetPath = `/projeler/${slug || ''}`;
  const route = SEO_ROUTES.find((r) => r.kind === 'project' && r.path === targetPath);

  const [projects, setProjects] = useState<ProjectItem[]>(SEED_PROJECTS);

  useEffect(() => {
    const unsub = subscribePublicProjects((items) => {
      if (items.length > 0) setProjects(items);
    });
    return () => unsub();
  }, []);

  if (!route) {
    return <NotFoundPage />;
  }

  const liveProject =
    projects.find((p) => p.id === route.projectId) ||
    SEED_PROJECTS.find((p) => p.id === route.projectId);

  const gallery = Array.from(
    new Set([
      ...(liveProject?.image ? [liveProject.image] : []),
      ...(liveProject?.galleryImages || []),
      ...(route.image ? [route.image] : []),
    ])
  );

  const related = (route.relatedPaths || [])
    .map((p) => SEO_ROUTES.find((r) => r.path === p))
    .filter(Boolean);

  return (
    <PublicLayout>
      <section className="relative py-16 sm:py-20 bg-[#070d1e] border-b-2 border-slate-800 overflow-hidden">
        <div className="absolute inset-0 opacity-30 dot-pattern pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
          <nav aria-label="İçerik Yolu" className="text-xs font-bold text-slate-400 flex items-center gap-2 flex-wrap">
            <Link to="/" className="hover:text-blue-400 transition">Ana Sayfa</Link>
            <span>/</span>
            <Link to="/projeler" className="hover:text-blue-400 transition">Projelerimiz</Link>
            <span>/</span>
            <span className="text-emerald-300">{route.navLabel}</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs font-black uppercase tracking-widest">
            <i className="fa-solid fa-circle-check" />
            <span>{route.heroBadge}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white max-w-5xl leading-tight">
            {liveProject?.title || route.h1}
          </h1>
          <p className="text-slate-300 max-w-3xl text-base sm:text-lg leading-relaxed font-medium">
            {liveProject?.description || route.leadSummary}
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-[#030712]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-8">
            {gallery.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-4">
                {gallery.map((src, idx) => (
                  <div
                    key={src}
                    className={`rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl ${
                      idx === 0 ? 'sm:col-span-2' : ''
                    }`}
                  >
                    <img
                      src={src}
                      alt={`${liveProject?.title || route.h1} — Görsel ${idx + 1}`}
                      className={`w-full object-cover ${idx === 0 ? 'h-[400px]' : 'h-56'}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {liveProject?.highlights && liveProject.highlights.length > 0 && (
              <div className="p-8 rounded-3xl bg-[#0b1329] border-2 border-slate-700 space-y-4">
                <h2 className="text-2xl font-black text-white">Proje Kapsamında Yapılan İşler</h2>
                <ul className="space-y-3">
                  {liveProject.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-200 leading-relaxed">
                      <i className="fa-solid fa-circle-check text-emerald-400 mt-1 shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {liveProject?.milestones && liveProject.milestones.length > 0 && (
              <div className="p-8 rounded-3xl bg-[#070d1e] border-2 border-slate-800 space-y-4">
                <h2 className="text-xl sm:text-2xl font-black text-white">Uygulama Aşamaları</h2>
                <div className="space-y-3">
                  {liveProject.milestones.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-[#0b1329] border border-slate-700"
                    >
                      <span className="text-sm font-bold text-slate-200">{m.title}</span>
                      <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-xs font-black shrink-0">
                        {m.done ? 'Tamamlandı' : 'Devam Ediyor'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="lg:col-span-5 space-y-6">
            <div className="p-7 rounded-3xl bg-[#0b1329] border-2 border-slate-700 space-y-4">
              <h2 className="text-lg font-black text-white">Proje Künyesi</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-slate-800 pb-2">
                  <dt className="text-slate-400 font-semibold">Proje Kodu</dt>
                  <dd className="text-white font-black">{liveProject?.code || 'Referans'}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-slate-800 pb-2">
                  <dt className="text-slate-400 font-semibold">Kurum / İşveren</dt>
                  <dd className="text-white font-bold text-right">{liveProject?.client || route.client}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-slate-800 pb-2">
                  <dt className="text-slate-400 font-semibold">Konum</dt>
                  <dd className="text-white font-bold">{liveProject?.location || route.location}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-slate-800 pb-2">
                  <dt className="text-slate-400 font-semibold">Uzmanlık Alanı</dt>
                  <dd className="text-blue-300 font-bold text-right">{liveProject?.area || route.heroBadge}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400 font-semibold">Durum</dt>
                  <dd className="text-emerald-400 font-black">{liveProject?.statusBadge || route.statusLabel} (%{liveProject?.progress ?? 100})</dd>
                </div>
              </dl>
            </div>

            {related.length > 0 && (
              <div className="p-6 rounded-3xl bg-[#0b1329] border-2 border-slate-700 space-y-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-blue-400">
                  İlgili Faaliyet Alanı
                </h3>
                {related.map((rel) => rel && (
                  <Link
                    key={rel.path}
                    to={rel.path}
                    className="block p-4 rounded-2xl bg-[#070d1e] border border-slate-700 hover:border-blue-400 transition space-y-1"
                  >
                    <div className="text-sm font-black text-white">{rel.navLabel}</div>
                    <p className="text-xs text-slate-400">{rel.description}</p>
                  </Link>
                ))}
              </div>
            )}

            <div className="p-7 rounded-3xl bg-gradient-to-br from-blue-950/90 to-[#0b1329] border-2 border-blue-500/50 space-y-4">
              <div className="text-xs font-black uppercase tracking-widest text-amber-400">
                Benzer Projeniz Mi Var?
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Keşif, metraj ve ihale hazırlığı için bizimle iletişime geçebilirsiniz.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/iletisim"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm px-5 py-3.5 rounded-xl border border-blue-300 transition"
                >
                  <span>İletişim &amp; Teklif</span>
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
          </aside>
        </div>
      </section>
    </PublicLayout>
  );
};
