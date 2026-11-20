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
  const fullHeightClass =
    size === 'sm'
      ? 'h-10 sm:h-11'
      : size === 'lg'
        ? 'h-20 sm:h-24'
        : 'h-12 sm:h-14';

  const markSizeClass =
    size === 'sm'
      ? 'w-9 h-9'
      : size === 'lg'
        ? 'w-16 h-16'
        : 'w-11 h-11';

  const hasCustomSubtitle = Boolean(subtitle && subtitle !== 'İNŞAAT');

  const content = (
    <div className="inline-flex flex-col items-center select-none">
      {showText ? (
        <img
          src="/images/logo-brand.png"
          alt="Kuzey Deniz İnşaat"
          className={`${fullHeightClass} w-auto object-contain transition-transform duration-300 group-hover:scale-[1.02] ${
            withWhiteBg ? '' : 'mix-blend-multiply'
          }`}
          draggable={false}
        />
      ) : (
        <img
          src="/images/logo-mark.png"
          alt="Kuzey Deniz İnşaat"
          className={`${markSizeClass} object-contain transition-transform duration-300 group-hover:scale-105 ${
            withWhiteBg ? '' : 'mix-blend-multiply'
          }`}
          draggable={false}
        />
      )}
      {showText && hasCustomSubtitle && (
        <span className="mt-1 px-2.5 py-0.5 rounded-full bg-[#042A53]/5 border border-[#042A53]/15 font-extrabold tracking-[0.22em] text-[9px] uppercase text-[#0068C9]">
          {subtitle}
        </span>
      )}
    </div>
  );

  if (withWhiteBg) {
    return (
      <div className="inline-flex items-center justify-center bg-white rounded-2xl px-4 py-2.5 shadow-lg border border-slate-200/90">
        {content}
      </div>
    );
  }

  return content;
};
