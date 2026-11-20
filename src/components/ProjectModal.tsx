import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProjectItem } from '../types';

interface ProjectModalProps {
  project: ProjectItem | null;
  onClose: () => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({ project, onClose }) => {
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    setActiveImage(0);
  }, [project]);

  useEffect(() => {
    if (!project) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [project, onClose]);

  if (!project) return null;

  const images =
    project.galleryImages && project.galleryImages.length > 0
      ? project.galleryImages
      : [project.image];
  const currentImg = images[activeImage] || project.image;

  return (
    <div
      id="projectModal"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[#0b1329] border-2 border-slate-600 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Pencereyi Kapat"
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-slate-900/90 hover:bg-blue-600 border border-slate-500 text-white flex items-center justify-center transition"
        >
          <i className="fa-solid fa-xmark text-lg" />
        </button>

        {/* Top Media Header */}
        <div className="relative h-64 sm:h-80 overflow-hidden rounded-t-3xl bg-black">
          <img
            src={currentImg}
            alt={project.title}
            className="w-full h-full object-cover transition duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1329] via-[#0b1329]/40 to-transparent" />
          <div className="absolute bottom-5 left-6 right-16 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-600/90 text-white text-xs font-black uppercase tracking-wider border border-blue-300/60">
                {project.categoryLabel}
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-900/90 text-amber-300 text-xs font-bold border border-slate-600">
                {project.code}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white leading-tight text-glow">
              {project.title}
            </h3>
          </div>
        </div>

        {/* Thumbnail Switcher if multiple images */}
        {images.length > 1 && (
          <div className="px-6 pt-4 flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {images.map((img, idx) => (
              <button
                key={`${img}-${idx}`}
                type="button"
                onClick={() => setActiveImage(idx)}
                className={`h-14 w-24 shrink-0 rounded-xl overflow-hidden border-2 transition ${
                  idx === activeImage
                    ? 'border-blue-400 shadow-lg shadow-blue-500/30'
                    : 'border-slate-700 opacity-65 hover:opacity-100'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* 3-Column Spec Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-[#070d1e] border border-slate-700">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Lokasyon
              </div>
              <div className="text-sm font-black text-white flex items-center gap-2">
                <i className="fa-solid fa-location-dot text-blue-400" />
                {project.location}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-[#070d1e] border border-slate-700">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Proje Alanı
              </div>
              <div className="text-sm font-black text-white flex items-center gap-2">
                <i className="fa-solid fa-ruler-combined text-amber-400" />
                {project.area}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-[#070d1e] border border-slate-700">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Durum
              </div>
              <div className="text-sm font-black text-emerald-400 flex items-center gap-2">
                <i className="fa-solid fa-circle-check" />
                {project.statusBadge}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-blue-300 mb-2">
              Proje Kapsamı &amp; Mühendislik Detayları
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed">{project.description}</p>
          </div>

          {project.highlights.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Teknik Öne Çıkanlar
              </h4>
              <ul className="space-y-2">
                {project.highlights.map((hl, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-200">
                    <i className="fa-solid fa-check text-emerald-400 mt-1" />
                    <span>{hl}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-400 font-semibold">
              İşveren: <span className="text-slate-200">{project.client}</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/iletisim"
                onClick={onClose}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm px-6 py-3 rounded-xl border border-blue-300 transition"
              >
                <i className="fa-solid fa-paper-plane" />
                <span>Bu Proje İçin Teklif Alın</span>
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
