import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProjectModal } from '../components/ProjectModal';
import { PublicLayout } from '../components/PublicLayout';
import { SEED_PROJECTS } from '../data/seedData';
import { subscribePublicProjects } from '../services/dataService';
import { ProjectItem } from '../types';

type FilterType =
  | 'all'
  | 'devam-ediyor'
  | 'teslim-edildi'
  | 'planlama'
  | 'kamu'
  | 'ticari-sanayi';

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'Tüm Projeler' },
  { id: 'devam-ediyor', label: 'Devam Edenler' },
  { id: 'teslim-edildi', label: 'Tamamlananlar' },
  { id: 'planlama', label: 'Gelecek / Lansman' },
  { id: 'kamu', label: 'Konut & Villa' },
  { id: 'ticari-sanayi', label: 'Ticari & Rezidans' },
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
    if (filter === 'devam-ediyor') return p.status === 'devam-ediyor' || p.status === 'test-kabul';
    if (filter === 'planlama') return p.status === 'planlama';
    return p.category === filter;
  });

  return (
    <PublicLayout>
      {/* Sub-page Hero */}
      <section className="relative py-20 bg-[#042A53] border-b-4 border-[#F25C05] overflow-hidden text-white">
        <div className="absolute inset-0 blueprint-grid-dark opacity-40 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-[#F7941D] text-xs font-black uppercase tracking-widest">
            <i className="fa-solid fa-compass" />
            <span>Seçkin Portföyümüz</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            İmzamızı Taşıyan Prestijli Projeler
          </h1>
          <p className="text-slate-200 max-w-3xl text-base sm:text-lg font-medium">
            Devam eden, tamamlanan ve çok yakında lansmana çıkacak konut, rezidans ve ticari plaza
            projelerimizi detaylı inceleyin. Yönetim Dashboard&apos;undan yayınlanan tüm projeler
            burada anlık görüntülenir.
          </p>
        </div>
      </section>

      {/* Filter Bar & 3-Column Grid */}
      <section className="py-20 bg-slate-50 blueprint-grid-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-fit">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition ${
                    active
                      ? 'bg-[#042A53] text-white shadow-md'
                      : 'text-slate-600 hover:text-[#042A53] hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div id="projectsGrid" className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((project) => (
              <article
                key={project.id}
                onClick={() => setSelected(project)}
                className="project-card group bg-white rounded-3xl border border-slate-200 hover:border-[#0068C9] cursor-pointer overflow-hidden shadow-sm hover:shadow-2xl flex flex-col justify-between transition duration-300"
              >
                <div>
                  <div className="relative h-64 overflow-hidden bg-slate-900">
                    <img
                      src={project.image}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#021B36]/80 via-transparent to-black/20" />

                    <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-md ${
                          project.status === 'teslim-edildi'
                            ? 'bg-[#0068C9] text-white'
                            : project.status === 'planlama'
                              ? 'bg-[#042A53] text-[#F7941D]'
                              : 'bg-[#F25C05] text-white'
                        }`}
                      >
                        {project.statusBadge}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-white/95 text-[#042A53] text-[11px] font-black shadow">
                        %{project.progress}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 space-y-3">
                    <div className="text-[11px] font-black uppercase tracking-widest text-[#0068C9]">
                      {project.categoryLabel}
                    </div>
                    <h3 className="text-xl font-black text-[#042A53] leading-snug group-hover:text-[#0068C9] transition">
                      {project.title}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                      {project.description}
                    </p>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <i className="fa-solid fa-location-dot text-[#F25C05]" />
                    {project.location}
                  </span>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/iletisim"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[#0068C9] hover:text-[#F25C05] inline-flex items-center gap-1 transition"
                    >
                      <span>Teklif İste</span>
                    </Link>
                    <span className="text-[#F25C05] group-hover:translate-x-1 transition inline-flex items-center gap-1.5">
                      <span>İncele</span>
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
