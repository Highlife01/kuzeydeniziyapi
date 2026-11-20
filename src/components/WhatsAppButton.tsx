import React from 'react';

export const WhatsAppButton: React.FC = () => {
  const phone = '905336779109';
  const message = encodeURIComponent(
    'Merhaba, Kuzey Denizi İnşaat (kuzeydeniziyapi.com.tr) hakkında bilgi ve teklif almak istiyorum.'
  );
  const whatsappUrl = `https://wa.me/${phone}?text=${message}`;

  return (
    <aside
      aria-label="WhatsApp Canlı Destek"
      className="fixed bottom-6 right-6 z-50 flex items-center group pointer-events-auto"
    >
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp Canlı Destek Hattı (+90 533 677 91 09)"
        className="relative flex items-center gap-3 bg-[#25D366] hover:bg-[#20ba5a] text-white pl-4 pr-5 py-3.5 rounded-full shadow-2xl hover:shadow-[0_10px_30px_rgba(37,211,102,0.5)] transition-all duration-300 transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-green-400/40"
      >
        {/* Pulse Effect */}
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white" />
        </span>

        {/* WhatsApp Icon */}
        <i className="fa-brands fa-whatsapp text-2xl leading-none" />

        {/* Text */}
        <div className="flex flex-col text-left">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100 leading-none">
            WhatsApp Destek
          </span>
          <span className="text-sm font-extrabold tracking-tight leading-tight">
            +90 533 677 91 09
          </span>
        </div>
      </a>
    </aside>
  );
};
