import React from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/PublicLayout';

export const HizmetlerPage: React.FC = () => {
  return (
    <PublicLayout>
      {/* Sub-page Hero */}
      <section className="relative py-20 bg-[#070d1e] border-b-2 border-slate-800 overflow-hidden">
        <div className="absolute inset-0 opacity-30 dot-pattern pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/90 border border-blue-500/40 text-blue-300 text-xs font-black uppercase tracking-widest">
            <i className="fa-solid fa-screwdriver-wrench" />
            <span>Faaliyet Alanlarımız &amp; Mühendislik Hizmetleri</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Uçtan Uca İnşaat, Çatı &amp; Yangın Güvenliği Çözümleri
          </h1>
          <p className="text-slate-300 max-w-3xl text-base sm:text-lg font-medium">
            Kuzey Denizi İnşaat A.Ş. olarak kamu binaları, hastaneler, adliye kompleksleri ve
            endüstriyel tesisler için yüksek standartlı teknik taahhüt hizmetleri sunuyoruz.
          </p>
        </div>
      </section>

      {/* Section 1: Kamu Taahhüt & Çatı Yenileme */}
      <section id="kamu-taahhut" className="py-24 bg-[#030712] border-b-2 border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/80 border border-blue-500/50 text-blue-300 text-xs font-black uppercase tracking-widest">
              01 • Kamu Taahhüt &amp; Çatı Sistemleri
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Adliye &amp; Kamu Binaları Çatı Yenileme ve İzolasyon Taahhütleri
            </h2>
            <p className="text-slate-300 leading-relaxed">
              Adana Yeni Adliye Sarayı Çatı Yenileme projemizde olduğu gibi, aktif hizmet veren kamu
              binalarında kurum işleyişini aksatmadan güvenli iskele, yaşam hattı ve etaplı çatı
              renovasyonu uyguluyoruz.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-[#0b1329] border border-slate-700 space-y-1.5">
                <div className="font-black text-white text-sm">Kenet Çatı &amp; Çelik Aşık</div>
                <p className="text-xs text-slate-400">
                  Gizli klipsli alüminyum/galvaniz kenet sac kaplama ve korozyon korumalı çelik
                  karkas.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-[#0b1329] border border-slate-700 space-y-1.5">
                <div className="font-black text-white text-sm">Isı, Su &amp; Sifonik Drenaj</div>
                <p className="text-xs text-slate-400">
                  Yüksek yoğunluklu taşyünü, TPO/PVC membran ve şiddetli yağışa dayanıklı oluk
                  detayları.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/hizmetler/cati-yenileme-izolasyon"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm px-6 py-3.5 rounded-xl border border-blue-300 transition"
              >
                <span>Detaylı Hizmet Rehberi</span>
                <i className="fa-solid fa-arrow-right" />
              </Link>
              <Link
                to="/iletisim"
                className="inline-flex items-center gap-2 bg-[#0b1329] hover:bg-slate-800 text-slate-100 font-extrabold text-sm px-6 py-3.5 rounded-xl border border-slate-600 transition"
              >
                <span>Çatı &amp; Taahhüt Teklifi İsteyin</span>
                <i className="fa-solid fa-file-signature text-blue-400" />
              </Link>
            </div>
          </div>
          <div className="rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl">
            <img
              src="/images/adana-adliye-gercek.jpg"
              alt="Adana Adliyesi Çatı Yenileme"
              className="w-full h-[440px] object-cover"
            />
          </div>
        </div>
      </section>

      {/* Section 2: Yangın Sistemleri & İleri Mühendislik */}
      <section id="muhendislik" className="py-24 bg-[#070d1e] border-b-2 border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div className="order-2 lg:order-1 rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl">
            <img
              src="/images/yangin-sistemleri.jpg"
              alt="Pozantı Devlet Hastanesi Yangın Pompa İstasyonu"
              className="w-full h-[440px] object-cover"
            />
          </div>
          <div className="order-1 lg:order-2 space-y-6">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-950/80 border border-amber-400/50 text-amber-300 text-xs font-black uppercase tracking-widest">
              02 • Yangın Güvenliği &amp; İleri Mühendislik
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Hastane &amp; Sanayi Tesisleri Yangın Söndürme ve Algılama Sistemleri
            </h2>
            <p className="text-slate-300 leading-relaxed">
              Pozantı Devlet Hastanesi Yangın İşleri referansımızla; hastaneler, AVM&apos;ler ve
              organize sanayi fabrikaları için EN 12845 ve NFPA standartlarında anahtar teslim yangın
              altyapıları kuruyoruz.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-[#0b1329] border border-slate-700 space-y-1.5">
                <div className="font-black text-white text-sm">UL/FM Pompa &amp; Sprinkler</div>
                <p className="text-xs text-slate-400">
                  Elektrikli-dizel yedekli pompa daireleri, ıslak/kuru sprinkler ve dış saha hidrant
                  ağları.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-[#0b1329] border border-slate-700 space-y-1.5">
                <div className="font-black text-white text-sm">Adresli Algılama &amp; Tahliye</div>
                <p className="text-xs text-slate-400">
                  Akıllı duman-ısı algılama panelleri, basınçlandırma fanları ve itfaiye ruhsat
                  kabulleri.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/hizmetler/yangin-guvenligi-sistemleri"
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm px-6 py-3.5 rounded-xl border border-amber-200 transition"
              >
                <span>Detaylı Hizmet Rehberi</span>
                <i className="fa-solid fa-arrow-right" />
              </Link>
              <Link
                to="/iletisim"
                className="inline-flex items-center gap-2 bg-[#0b1329] hover:bg-slate-800 text-slate-100 font-extrabold text-sm px-6 py-3.5 rounded-xl border border-slate-600 transition"
              >
                <span>Yangın Mühendisliği Keşfi Alın</span>
                <i className="fa-solid fa-fire-extinguisher text-amber-400" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Ağır Çelik & Entegre Tesis Bakım */}
      <section id="temizlik" className="py-24 bg-[#030712]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-950/80 border border-sky-400/50 text-sky-300 text-xs font-black uppercase tracking-widest">
              03 • Ağır Çelik &amp; Entegre Tesis Bakım
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Endüstriyel Çelik Yapılar ve Periyodik Teknik Tesis Yönetimi
            </h2>
            <p className="text-slate-300 leading-relaxed">
              Sanayi hangarları ve lojistik antrepoları için S355 çelik konstrüksiyon imalatının
              yanı sıra, teslim sonrası çatı-cephe su yalıtımı ve yangın sistemlerinin aylık
              periyodik bakım sözleşmelerini yürütüyoruz.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-[#0b1329] border border-slate-700 space-y-1.5">
                <div className="font-black text-white text-sm">Geniş Açıklıklı Çelik Hangar</div>
                <p className="text-xs text-slate-400">
                  Vinç kirişli endüstriyel üretim yapıları, sandviç panel cephe ve çatı kaplamaları.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-[#0b1329] border border-slate-700 space-y-1.5">
                <div className="font-black text-white text-sm">7/24 Teknik Müdahale &amp; Bakım</div>
                <p className="text-xs text-slate-400">
                  Kış öncesi çatı dere kontrolü, pompa basınç testleri ve inşaat sonrası teslim
                  hazırlığı.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/hizmetler/celik-yapi-tesis-bakim"
                className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-sm px-6 py-3.5 rounded-xl border border-sky-300 transition"
              >
                <span>Detaylı Hizmet Rehberi</span>
                <i className="fa-solid fa-arrow-right" />
              </Link>
              <Link
                to="/iletisim"
                className="inline-flex items-center gap-2 bg-[#0b1329] hover:bg-slate-800 text-slate-100 font-extrabold text-sm px-6 py-3.5 rounded-xl border border-slate-600 transition"
              >
                <span>Bakım &amp; Çelik Yapı Teklifi Alın</span>
                <i className="fa-solid fa-helmet-safety text-sky-400" />
              </Link>
            </div>
          </div>
          <div className="rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl">
            <img
              src="/images/celik-yapi.jpg"
              alt="Ağır Çelik Konstrüksiyon ve Tesis Yönetimi"
              className="w-full h-[440px] object-cover"
            />
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};
