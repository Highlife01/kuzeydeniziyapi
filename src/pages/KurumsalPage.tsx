import React from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/PublicLayout';

export const KurumsalPage: React.FC = () => {
  return (
    <PublicLayout>
      {/* Sub-Page Hero */}
      <section className="relative py-20 bg-[#070d1e] border-b-2 border-slate-800 overflow-hidden">
        <div className="absolute inset-0 opacity-30 dot-pattern pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/90 border border-blue-500/40 text-blue-300 text-xs font-black uppercase tracking-widest">
            <i className="fa-solid fa-building-shield" />
            <span>Kuzey Denizi İnşaat A.Ş. Yönetim &amp; Profil</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Kurumsal Güç ve Mühendislik Disiplini
          </h1>
          <p className="text-slate-300 max-w-3xl text-base sm:text-lg font-medium leading-relaxed">
            Adana ve Çukurova havzasında kamu yapı taahhütleri, büyük ölçekli çatı renovasyonları
            ve yangın güvenliği mühendisliğinde güvenilir çözüm ortağınız.
          </p>
        </div>
      </section>

      {/* #hakkimizda */}
      <section id="hakkimizda" className="py-24 bg-[#030712] border-b-2 border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-14 items-stretch">
          <div className="lg:col-span-6 space-y-6 flex flex-col justify-center">
            <span className="text-xs font-black uppercase tracking-widest text-blue-400">
              Hakkımızda &amp; Saha Tecrübemiz
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
              Kamu Şartnamelerine Tam Uyumlu Anahtar Teslim Yapı Yönetimi
            </h2>
            <p className="text-slate-300 leading-relaxed text-base">
              <strong>Kuzey Denizi İnşaat Sanayi ve Ticaret A.Ş.</strong>, 25 Şubat
              2016 tarihinden bu yana Adana Seyhan merkezli olarak kamu kurumlarının ve özel sektör
              tesislerinin yapı taahhüt, çatı yenileme ve yangın güvenliği süreçlerini yürütmektedir.
              Adana Adliyesi Çatı Yenileme ve Pozantı 80. Yıl Devlet Hastanesi Yangın İşleri gibi
              yüksek hassasiyet gerektiren projeleri hizmet kesintisi yaşatmadan başarıyla teslim
              etmiştir.
            </p>
            <p className="text-slate-400 leading-relaxed text-sm">
              Seyhan Vergi Dairesi Müd. (VKN: 2640323020) mükellefi olan firmamız; bünyesindeki
              inşaat, makine ve elektrik mühendisleri ile şantiye planlamasından hakediş
              kontrolüne, malzeme sertifikasyonundan kesin kabule kadar her aşamayı şeffaf dijital
              sistemlerle yönetir.
            </p>

            <div className="grid grid-cols-2 gap-5 pt-2">
              <div className="p-6 rounded-2xl bg-[#0b1329] border-2 border-slate-700">
                <div className="text-2xl sm:text-3xl font-black text-blue-400">25/02/2016</div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mt-1">
                  Resmi Kuruluş Tarihi
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-[#0b1329] border-2 border-slate-700">
                <div className="text-2xl sm:text-3xl font-black text-emerald-400">2640323020</div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mt-1">
                  Seyhan Vergi Dairesi VKN
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Link
                to="/projeler"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm px-7 py-3.5 rounded-xl border border-blue-300 transition"
              >
                <span>Referans Projelerimizi İnceleyin</span>
                <i className="fa-solid fa-arrow-right" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6 relative rounded-3xl overflow-hidden border-2 border-slate-700 min-h-[420px]">
            <img
              src="/images/kurumsal-muhendis.jpg"
              alt="Kuzey Denizi Mühendislik Ekibi"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#02050e] via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 p-6 rounded-2xl glass-panel">
              <div className="text-xs font-black uppercase tracking-widest text-amber-400 mb-1">
                Kalite Taahhüdü
              </div>
              <div className="text-lg font-black text-white">
                Zamanında ve Eksiksiz Teslim Güvencesi
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* #vizyon-misyon */}
      <section id="vizyon-misyon" className="py-24 bg-[#070d1e] border-b-2 border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-8">
          <div className="p-10 rounded-3xl bg-[#0b1329] border-2 border-slate-700 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl">
              <i className="fa-solid fa-eye" />
            </div>
            <h3 className="text-2xl font-black text-white">Vizyonumuz</h3>
            <p className="text-slate-300 leading-relaxed text-sm">
              Adana ve Akdeniz Bölgesi başta olmak üzere Türkiye genelinde kamu yapılarının çatı,
              yangın güvenliği ve yapısal güçlendirme projelerinde mühendislik kalitesiyle ilk
              akla gelen öncü taahhüt firması olmak.
            </p>
          </div>

          <div className="p-10 rounded-3xl bg-[#0b1329] border-2 border-slate-700 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-2xl">
              <i className="fa-solid fa-bullseye" />
            </div>
            <h3 className="text-2xl font-black text-white">Misyonumuz</h3>
            <p className="text-slate-300 leading-relaxed text-sm">
              Modern mühendislik yazılımları, sertifikalı yapı-yangın malzemeleri ve disiplinli
              şantiye organizasyonu ile can ve mal güvenliğini en üst düzeye çıkaran, uzun ömürlü
              ve ekonomik yapılar inşa etmek.
            </p>
          </div>
        </div>
      </section>

      {/* #kalite-isg */}
      <section id="kalite-isg" className="py-24 bg-[#030712]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
              Kurumsal İlkeler
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Kalite, Çevre ve İş Güvenliği Politikamız
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-[#0b1329] border-2 border-slate-700 space-y-3">
              <div className="text-blue-400 text-2xl">
                <i className="fa-solid fa-award" />
              </div>
              <h3 className="text-xl font-black text-white">Kalite Kontrol Süreçleri</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Her imalat kalemi malzeme giriş onayından saha test tutanaklarına kadar izlenebilir
                kalite kontrol süreçlerinden geçer.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-[#0b1329] border-2 border-slate-700 space-y-3">
              <div className="text-emerald-400 text-2xl">
                <i className="fa-solid fa-leaf" />
              </div>
              <h3 className="text-xl font-black text-white">Çevre ve Atık Yönetimi</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Çatı sökümü ve şantiye atıklarında çevre mevzuatına uygun ayrıştırma ve geri
                dönüşüm prensipleri uygulanır.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-[#0b1329] border-2 border-slate-700 space-y-3">
              <div className="text-amber-400 text-2xl">
                <i className="fa-solid fa-helmet-safety" />
              </div>
              <h3 className="text-xl font-black text-white">İş Sağlığı ve Güvenliği</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Yüksekte çalışma (çatı) ve basınçlı mekanik hat montajlarında tam yaşam hattı,
                kişisel koruyucu donanım ve sıfır kaza disiplini esastır.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};
