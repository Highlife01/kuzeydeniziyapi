import React, { useEffect, useState } from 'react';

interface IntroSplashProps {
  onComplete: () => void;
}

export const IntroSplash: React.FC<IntroSplashProps> = ({ onComplete }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setExiting(true);
    }, 5300);

    const doneTimer = setTimeout(() => {
      onComplete();
    }, 6000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  const handleSkip = () => {
    setExiting(true);
    setTimeout(onComplete, 450);
  };

  return (
    <div
      role="dialog"
      aria-label="Kuzey Deniz İnşaat Giriş İntrosu"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#021B36] via-[#042A53] to-[#011226] overflow-hidden transition-all duration-700 ${
        exiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Animated Architectural Blueprint Grid */}
      <div className="absolute inset-0 blueprint-grid-dark opacity-60 pointer-events-none" />

      {/* Rotating Precision Compass Rings */}
      <div
        className="absolute w-[380px] h-[380px] sm:w-[540px] sm:h-[540px] rounded-full border border-[#0068C9]/30 pointer-events-none"
        style={{ animation: 'kdRingSpin 6s linear infinite' }}
      />
      <div
        className="absolute w-[290px] h-[290px] sm:w-[420px] sm:h-[420px] rounded-full border border-dashed border-[#F7941D]/35 pointer-events-none"
        style={{ animation: 'kdRingSpin 8s linear infinite reverse' }}
      />

      {/* Ambient Glow Halos */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#0068C9]/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#F25C05]/20 blur-3xl pointer-events-none" />

      {/* Top Coordinates & Skip Button */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between text-xs font-mono text-sky-200/70">
        <span className="hidden sm:inline-flex items-center gap-2 tracking-widest">
          <span className="w-2 h-2 rounded-full bg-[#F7941D] animate-pulse" />
          37°02&apos;N 35°16&apos;E • PUSULAMIZ GÜVEN
        </span>
        <button
          type="button"
          onClick={handleSkip}
          className="ml-auto px-4 py-2 rounded-full bg-white/10 hover:bg-[#F25C05] border border-white/20 text-white font-sans font-bold text-xs tracking-wider transition-all backdrop-blur-md"
        >
          İntroyu Geç <i className="fa-solid fa-forward-step ml-1" />
        </button>
      </div>

      {/* Center Stage: Pure White Architectural Logo Showcase */}
      <div className="relative z-10 flex flex-col items-center px-4 text-center">
        <div
          className="relative overflow-hidden bg-white rounded-3xl px-8 py-7 sm:px-14 sm:py-10 shadow-[0_0_90px_rgba(0,104,201,0.45),0_25px_60px_rgba(0,0,0,0.45)] border-2 border-white/90"
          style={{ animation: 'kdCardReveal 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
        >
          {/* Diagonal Glass Shimmer Sweep */}
          <div
            className="absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-sky-200/45 to-transparent pointer-events-none"
            style={{ animation: 'kdShimmerSweep 2.4s ease-in-out 2.1s forwards', transform: 'translateX(-160%)' }}
          />

          <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-7">
            {/* Animated 4-Wing Compass Star Emblem */}
            <svg
              className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0"
              viewBox="0 0 120 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Wing 1: Top Left Blue */}
              <path
                d="M8 64 L76 8 C64 34 59 46 56 54 L8 64 Z"
                fill="url(#introBlueGrad)"
                style={{
                  opacity: 0,
                  animation: 'kdWingTopLeft 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.55s forwards',
                }}
              />
              {/* Wing 2: Top Right Dark Navy */}
              <g
                style={{
                  opacity: 0,
                  animation: 'kdWingTopRight 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.85s forwards',
                }}
              >
                <path d="M79 8 L72 44 C72 49 76 52 112 58 L60 55 L79 8 Z" fill="#042A53" />
                <path d="M79 8 L60 55 L73 46 Z" fill="#0068C9" />
              </g>
              {/* Wing 3: Bottom Left Amber */}
              <path
                d="M9 67 L55 59 L40 112 C45 80 43 72 9 67 Z"
                fill="url(#introAmberGrad)"
                style={{
                  opacity: 0,
                  animation: 'kdWingBottomLeft 0.9s cubic-bezier(0.16, 1, 0.3, 1) 1.15s forwards',
                }}
              />
              {/* Wing 4: Bottom Right Vibrant Orange */}
              <path
                d="M59 59 L111 59 C83 70 69 80 43 113 L59 59 Z"
                fill="url(#introOrangeGrad)"
                style={{
                  opacity: 0,
                  animation: 'kdWingBottomRight 0.9s cubic-bezier(0.16, 1, 0.3, 1) 1.45s forwards',
                }}
              />
              <defs>
                <linearGradient id="introBlueGrad" x1="8" y1="64" x2="76" y2="8" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#0077E6" />
                  <stop offset="100%" stopColor="#0055B3" />
                </linearGradient>
                <linearGradient id="introAmberGrad" x1="9" y1="67" x2="55" y2="112" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FBB03B" />
                  <stop offset="100%" stopColor="#F7941D" />
                </linearGradient>
                <linearGradient id="introOrangeGrad" x1="59" y1="59" x2="43" y2="113" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FF5500" />
                  <stop offset="100%" stopColor="#E04800" />
                </linearGradient>
              </defs>
            </svg>

            {/* Brand Typography Reveal */}
            <div
              className="flex flex-col items-center sm:items-start"
              style={{
                opacity: 0,
                animation: 'kdTextSlide 0.95s cubic-bezier(0.16, 1, 0.3, 1) 1.9s forwards',
              }}
            >
              <span className="font-black text-3xl sm:text-5xl tracking-tight text-[#042A53] leading-none">
                Kuzey Deniz
              </span>
              <div className="flex items-center gap-3 mt-3 w-full justify-center sm:justify-start">
                <span className="h-[3px] w-10 sm:w-14 bg-gradient-to-r from-transparent to-[#F7941D] rounded-full" />
                <span className="font-extrabold text-sm sm:text-lg tracking-[0.42em] text-[#042A53] uppercase leading-none">
                  İNŞAAT
                </span>
                <span className="h-[3px] w-10 sm:w-14 bg-gradient-to-l from-transparent to-[#F25C05] rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Tagline & Architectural Subtitle */}
        <div
          className="mt-8 space-y-3 max-w-lg"
          style={{
            opacity: 0,
            animation: 'kdFadeUp 1s ease-out 2.9s forwards',
          }}
        >
          <div className="text-xs sm:text-sm font-black tracking-[0.28em] uppercase text-[#F7941D]">
            Güvenle Yükselen Modern Yapılar
          </div>
          <p className="text-xs sm:text-sm text-sky-100/80 font-medium">
            www.kuzeydeniziyapi.com.tr • Mühendislik, Konut &amp; Taahhüt
          </p>
        </div>

        {/* Smooth 6-Second Progress Indicator */}
        <div className="mt-8 w-64 sm:w-80 space-y-2">
          <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden p-[1px]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0068C9] via-[#F7941D] to-[#F25C05]"
              style={{ animation: 'kdProgressBar6s 5.6s linear forwards' }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-sky-200/60">
            <span>Mimari &amp; Mühendislik Yükleniyor</span>
            <span>6.0s</span>
          </div>
        </div>
      </div>
    </div>
  );
};
