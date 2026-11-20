import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { PublicLayout } from '../components/PublicLayout';

export const KurumsalPage: React.FC = () => {
  return (
    <PublicLayout>
      {/* Sub-Page Hero */}
      <section className="relative py-20 bg-[#042A53] border-b-4 border-[#F25C05] overflow-hidden text-white">
        <div className="absolute inset-0 blueprint-grid-dark opacity-40 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-[#F7941D] text-xs font-black uppercase tracking-widest">
            <i className="fa-solid fa-compass" />
            <span>Kuzey Deniz İnşaat Ltd. Şti. Yönetim &amp; Profil</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Kurumsal Güç ve Mühendislik Disiplini
          </h1>
          <p className="text-slate-200 max-w-3xl text-base sm:text-lg font-medium leading-relaxed">
            Konut, rezidans, ticari merkez, kentsel dönüşüm ve kamu/özel sektör yapı
            taahhütlerinde şehrin silüetine değer katan güvenli eserler üretiyoruz.
          </p>
        </div>
      </section>

      {/* #hakkimizda */}
      <section id="hakkimizda" className="py-24 bg-slate-50 blueprint-grid-light border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-14 items-stretch">
          <div className="lg:col-span-6 space-y-6 flex flex-col justify-center">
            <span className="text-xs font-black uppercase tracking-widest text-[#0068C9]">
              Hakkımızda &amp; Saha Tecrübemiz
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#042A53] leading-tight">
              Pusulamız Güven: Depreme Dayanıklı Modern Yapılar
            </h2>
            <p className="text-slate-700 leading-relaxed text-base">
              <strong>Kuzeydeniz İnşaat Taahhüt Sanayi ve Ticaret Limited Şirketi</strong> (Kuzey
              Denizi İnşaat), 04 Ocak 2017 tarihinden bu yana Çukurova / Adana merkezli olarak modern
              konut projeleri, A+ ticari plazalar, büyük çaplı yapı yenileme/revizyon ve taahhüt
              projeleri inşa etmektedir. Logomuzdaki kuzey yıldızı pusulası; doğruluğu, mühendislik
              hassasiyetini ve geleceğe yön veren yenilikçi vizyonumuzu simgeler.
            </p>
            <p className="text-slate-600 leading-relaxed text-sm">
              Ziyapaşa Vergi Dairesi Müd. (VKN: 6010491372) mükellefi olan firmamız; bünyesindeki
              inşaat, mimarlık ve mühendislik ekipleriyle zemin etüdünden anahtar teslime, şantiye
              planlamasından dijital ERP yönetimine kadar tüm süreçleri şeffaf ve uluslararası
              standartlara tam uyumlu olarak yönetmektedir.
            </p>

            <div className="grid grid-cols-2 gap-5 pt-2">
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="text-2xl sm:text-3xl font-black text-[#F25C05]">04/01/2017</div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">
                  Resmi İşe Başlama Tarihi
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="text-2xl sm:text-3xl font-black text-[#0068C9]">6010491372</div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">
                  Ziyapaşa Vergi Dairesi VKN
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Link
                to="/projeler"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#F7941D] to-[#F25C05] hover:brightness-110 text-white font-extrabold text-sm px-7 py-3.5 rounded-xl shadow-lg transition"
              >
                <span>Projelerimizi İnceleyin</span>
                <i className="fa-solid fa-arrow-right" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6 relative rounded-3xl overflow-hidden border-4 border-white shadow-2xl min-h-[420px]">
            <img
              src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1000&q=85"
              alt="Kuzey Deniz İnşaat Mühendislik Ekibi"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#021B36]/80 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-center justify-between gap-4">
              <BrandLogo size="sm" withWhiteBg={true} />
            </div>
          </div>
        </div>
      </section>

      {/* #vizyon-misyon */}
      <section id="vizyon-misyon" className="py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-8">
          <div className="p-10 rounded-3xl bg-slate-50 border border-slate-200 space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-[#0068C9] text-white flex items-center justify-center text-2xl shadow-md">
              <i className="fa-solid fa-eye" />
            </div>
            <h3 className="text-2xl font-black text-[#042A53]">Vizyonumuz</h3>
            <p className="text-slate-600 leading-relaxed text-sm">
              Türkiye&apos;nin yapı ve taahhüt sektöründe yenilikçi inşaat teknolojilerini en üst
              seviyede kullanarak; çevreye duyarlı, enerji verimliliği yüksek ve nesiller boyu
              güvenle yaşanacak simge projelere imza atmak.
            </p>
          </div>

          <div className="p-10 rounded-3xl bg-slate-50 border border-slate-200 space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F7941D] to-[#F25C05] text-white flex items-center justify-center text-2xl shadow-md">
              <i className="fa-solid fa-bullseye" />
            </div>
            <h3 className="text-2xl font-black text-[#042A53]">Misyonumuz</h3>
            <p className="text-slate-600 leading-relaxed text-sm">
              İnsan hayatını ve yapı güvenliğini her şeyin üzerinde tutarak; şeffaf proje yönetimi,
              yüksek malzeme kalitesi (C35/C40 beton &amp; B420C çelik) ve zamanında teslim
              prensibiyle yatırımcılarımıza yüksek katma değer sunmak.
            </p>
          </div>
        </div>
      </section>

      {/* #kalite-isg */}
      <section id="kalite-isg" className="py-24 bg-[#021B36] text-white blueprint-grid-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-[#F7941D]">
              Kurumsal İlkeler
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Kalite, Çevre ve İş Güvenliği Politikamız
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 space-y-3">
              <div className="text-[#0068C9] text-2xl">
                <i className="fa-solid fa-award" />
              </div>
              <h3 className="text-xl font-black text-white">Zemin Etüdü &amp; Radye Temel</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Jeofizik ve jeoteknik etüt raporlarına göre fore kazık zemin iyileştirmeleri ve
                radye jeneral temel sistemleri eksiksiz uygulanır.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 space-y-3">
              <div className="text-emerald-400 text-2xl">
                <i className="fa-solid fa-leaf" />
              </div>
              <h3 className="text-xl font-black text-white">Isı, Ses &amp; Su Yalıtımı</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Temelden çatıya bohçalama su yalıtımı, taşyünü dış cephe mantolama ve katlar arası
                akustik ses izolasyonu standarttır.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 space-y-3">
              <div className="text-[#F7941D] text-2xl">
                <i className="fa-solid fa-helmet-safety" />
              </div>
              <h3 className="text-xl font-black text-white">İş Sağlığı ve Güvenliği</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Tüm şantiyelerimiz yapı denetim kuruluşları ve uzman İSG mühendislerimiz tarafından
                7/24 denetlenmektedir.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};
