import React from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/PublicLayout';

export const NotFoundPage: React.FC = () => {
  return (
    <PublicLayout>
      <section className="py-28 bg-slate-50 blueprint-grid-light text-center">
        <div className="max-w-2xl mx-auto px-4 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFF4EC] border border-[#F25C05]/30 text-[#F25C05] text-xs font-black uppercase tracking-widest">
            Hata 404
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-[#042A53]">Aradığınız Sayfa Bulunamadı</h1>
          <p className="text-slate-600 text-base leading-relaxed">
            Ziyaret etmek istediğiniz bağlantı kaldırılmış veya adresi değişmiş olabilir. Aşağıdaki
            bağlantılardan devam edebilirsiniz.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              to="/"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#F7941D] to-[#F25C05] hover:brightness-110 text-white font-black text-sm shadow-md transition"
            >
              Ana Sayfaya Dön
            </Link>
            <Link
              to="/hizmetler"
              className="px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-[#042A53] font-bold text-sm border border-slate-200 transition"
            >
              Faaliyet Alanları
            </Link>
            <Link
              to="/projeler"
              className="px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-[#042A53] font-bold text-sm border border-slate-200 transition"
            >
              Projelerimiz
            </Link>
            <Link
              to="/iletisim"
              className="px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-[#042A53] font-bold text-sm border border-slate-200 transition"
            >
              İletişim
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};
