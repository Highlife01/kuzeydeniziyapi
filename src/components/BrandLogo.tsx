import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  subtitle?: string;
  withWhiteBg?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = true,
  subtitle = 'İNŞAAT',
  withWhiteBg = true,
}) => {
  const iconSize =
    size === 'sm'
      ? 'w-9 h-9'
      : size === 'lg'
        ? 'w-14 h-14'
        : 'w-11 h-11';

  const content = (
    <div className="flex items-center gap-3 select-none">
      <svg
        className={`${iconSize} flex-shrink-0 transition-transform duration-300 group-hover:scale-105`}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Sol Üst Mavi Kanat */}
        <path d="M8 64 L76 8 C64 34 59 46 56 54 L8 64 Z" fill="url(#brandBlueGrad)" />
        {/* Sağ Üst Koyu Lacivert Kanat */}
        <path d="M79 8 L72 44 C72 49 76 52 112 58 L60 55 L79 8 Z" fill="#042A53" />
        <path d="M79 8 L60 55 L73 46 Z" fill="#0068C9" />
        {/* Sol Alt Kehribar/Sarı-Turuncu Kanat */}
        <path d="M9 67 L55 59 L40 112 C45 80 43 72 9 67 Z" fill="url(#brandAmberGrad)" />
        {/* Sağ Alt Canlı Turuncu Kanat */}
        <path d="M59 59 L111 59 C83 70 69 80 43 113 L59 59 Z" fill="url(#brandOrangeGrad)" />
        <defs>
          <linearGradient id="brandBlueGrad" x1="8" y1="64" x2="76" y2="8" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0077E6" />
            <stop offset="100%" stopColor="#0055B3" />
          </linearGradient>
          <linearGradient id="brandAmberGrad" x1="9" y1="67" x2="55" y2="112" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FBB03B" />
            <stop offset="100%" stopColor="#F7941D" />
          </linearGradient>
          <linearGradient id="brandOrangeGrad" x1="59" y1="59" x2="43" y2="113" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF5500" />
            <stop offset="100%" stopColor="#E04800" />
          </linearGradient>
        </defs>
      </svg>
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-black tracking-tight text-[#042A53] ${
              size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg sm:text-xl'
            }`}
          >
            Kuzey Deniz
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="h-[2px] w-4 sm:w-5 bg-gradient-to-r from-transparent to-[#F7941D] rounded-full" />
            <span className="font-bold tracking-[0.34em] text-[9px] sm:text-[10px] uppercase text-[#042A53]">
              {subtitle}
            </span>
            <span className="h-[2px] w-4 sm:w-5 bg-gradient-to-l from-transparent to-[#F25C05] rounded-full" />
          </div>
        </div>
      )}
    </div>
  );

  if (withWhiteBg) {
    return (
      <div className="inline-flex items-center bg-white rounded-2xl px-3.5 py-2 shadow-lg border border-slate-200/90">
        {content}
      </div>
    );
  }

  return content;
};
