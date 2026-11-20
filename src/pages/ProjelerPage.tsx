import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProjectModal } from '../components/ProjectModal';
import { PublicLayout } from '../components/PublicLayout';
import { SEED_PROJECTS } from '../data/seedData';
import { SEO_ROUTES } from '../seo/seoData';
import { subscribePublicProjects } from '../services/dataService';
import { ProjectItem } from '../types';

type FilterType =
  | 'all'
  | 'teslim-edildi'
  | 'devam-ediyor'
  | 'kamu'
  | 'saglik-yangin'
  | 'ticari-sanayi';

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'Tüm Projeler' },
  { id: 'teslim-edildi', label: 'Teslim Edilenler' },
  { id: 'devam-ediyor', label: 'Devam Edenler' },
  { id: 'kamu', label: 'Kamu & Çatı Taahhütleri' },
  { id: 'saglik-yangin', label: 'Hastane & Yangın İşleri' },
  { id: 'ticari-sanayi', label: 'Ticari & Sanayi' },
];

export const ProjelerPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectItem[]>(SEED_PROJECTS);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selected, setSelected] = useState<ProjectItem | null>(null);

  useEffect(() => {
    const unsub = subscribePublicProjects((items) => {
      if (items.length > 0) setProjects(items);
    });
    return () => unsub();
  }, []);

  const filtered = projects.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'teslim-edildi') return p.status === 'teslim-edildi';
    if (filter === 'devam-ediyor')
      return p.status === 'devam-ediyor' || p.status === 'test-kabul' || p.status === 'planlama';
    return p.category === filter;
  });

  return (
    <PublicLayout>
      {/* Sub-page Hero */}
      <section className="relative py-20 bg-[#070d1e] border-b-2 border-slate-800 overflow-hidden">
        <div className="absolute inset-0 opacity-30 dot-pattern pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/90 border border-blue-500/40 text-blue-300 text-xs font-black uppercase tracking-widest">
            <i className="fa-solid fa-diagram-project" />
            <span>Referans Portföyümüz</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            İnşaat Projelerimiz &amp; Teknik Taahhüt Galerisi
          </h1>
          <p className="text-slate-300 max-w-3xl text-base sm:text-lg font-medium">
            Adana Yeni Adliye Sarayı Çatı Yenileme, Pozantı Devlet Hastanesi Yangın İşleri ve
            bölgesel endüstriyel yapı projelerimiz. Dashboard Proje Yönetimi modülünden
            yayınlanan tüm projeler burada anlık görüntülenir.
          </p>
        </div>
      </section>

      {/* Filter Bar & 3-Column Grid */}
      <section className="py-20 bg-[#030712]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Interactive Filter Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition ${
                    active
                      ? 'bg-blue-600 text-white border border-blue-300 shadow-lg shadow-blue-600/30'
                      : 'bg-[#0b1329] border-2 border-slate-700 text-slate-100 hover:border-blue-400'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* 3-Col Grid */}
          <div id="projectsGrid" className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((project) => (
              <article
                key={project.id}
                onClick={() => setSelected(project)}
                className="project-card group bg-[#0b1329] rounded-3xl border-2 border-slate-700 hover:border-emerald-400 cursor-pointer overflow-hidden shadow-xl flex flex-col justify-between transition duration-300"
              >
                <div>
                  <div className="relative h-64 overflow-hidden bg-black">
                    <img
                      src={project.image}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b1329] via-transparent to-black/40" />

                    <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border backdrop-blur-md ${
                          project.status === 'teslim-edildi'
                            ? 'bg-emerald-950/90 border-emerald-400/70 text-emerald-300'
                            : 'bg-amber-950/90 border-amber-400/70 text-amber-300'
                        }`}
                      >
                        {project.statusBadge}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950/90 border border-slate-600 text-[11px] font-bold text-slate-200">
                        %{project.progress}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 space-y-3">
                    <div className="text-[11px] font-black uppercase tracking-widest text-blue-400">
                      {project.categoryLabel}
                    </div>
                    <h3 className="text-xl font-black text-white leading-snug group-hover:text-blue-300 transition">
                      {project.title}
                    </h3>
                    <p className="text-sm text-slate-300 line-clamp-3 leading-relaxed">
                      {project.description}
                    </p>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <i className="fa-solid fa-location-dot text-blue-400" />
                    {project.location}
                  </span>
                  <div className="flex items-center gap-3">
                    {SEO_ROUTES.find((r) => r.projectId === project.id) && (
                      <Link
                        to={SEO_ROUTES.find((r) => r.projectId === project.id)!.path}
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 transition"
                      >
                        <span>Proje Sayfası</span>
                        <i className="fa-solid fa-up-right-from-square text-[10px]" />
                      </Link>
                    )}
                    <span className="text-emerald-400 group-hover:translate-x-1 transition inline-flex items-center gap-1.5">
                      <span>Hızlı İncele</span>
                      <i className="fa-solid fa-arrow-right" />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ProjectModal project={selected} onClose={() => setSelected(null)} />
    </PublicLayout>
  );
};
