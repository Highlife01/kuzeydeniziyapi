import React from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/PublicLayout';

export const NotFoundPage: React.FC = () => {
  return (
    <PublicLayout>
      <section className="py-28 bg-[#030712] text-center">
        <div className="max-w-2xl mx-auto px-4 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-black uppercase tracking-widest">
            Hata 404
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white">Aradığınız Sayfa Bulunamadı</h1>
          <p className="text-slate-300 text-base leading-relaxed">
            Ziyaret etmek istediğiniz bağlantı kaldırılmış veya adresi değişmiş olabilir. Aşağıdaki
            bağlantılardan devam edebilirsiniz.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              to="/"
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm border border-blue-300 transition"
            >
              Ana Sayfaya Dön
            </Link>
            <Link
              to="/hizmetler"
              className="px-6 py-3 rounded-xl bg-[#0b1329] hover:bg-slate-800 text-slate-100 font-bold text-sm border border-slate-600 transition"
            >
              Faaliyet Alanları
            </Link>
            <Link
              to="/projeler"
              className="px-6 py-3 rounded-xl bg-[#0b1329] hover:bg-slate-800 text-slate-100 font-bold text-sm border border-slate-600 transition"
            >
              Projelerimiz
            </Link>
            <Link
              to="/iletisim"
              className="px-6 py-3 rounded-xl bg-[#0b1329] hover:bg-slate-800 text-slate-100 font-bold text-sm border border-slate-600 transition"
            >
              İletişim
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};
