import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { getUnreadCountLocal, subscribeLocalTopic } from '../services/dataService';

interface NavbarProps {
  isHome?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ isHome = false }) => {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(() => getUnreadCountLocal());

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    setUnreadCount(getUnreadCountLocal());
    return subscribeLocalTopic('messages', () => {
      setUnreadCount(getUnreadCountLocal());
    });
  }, []);

  const isActive = (target: string) => {
    if (target === '/') return pathname === '/' || pathname === '/index.html';
    return pathname === target || pathname === `${target}.html`;
  };

  const navLinks = [
    { to: '/', label: 'Ana Sayfa' },
    { to: '/kurumsal', label: 'Kurumsal' },
    { to: '/hizmetler', label: 'Faaliyet Alanları' },
    { to: '/projeler', label: 'Projelerimiz' },
    { to: '/iletisim', label: 'İletişim' },
  ];

  return (
    <>
      {/* Top Utility Bar */}
      <div className="bg-[#021B36] py-2.5 border-b border-[#042A53] hidden md:block relative z-50 text-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 text-xs font-semibold">
          <div className="flex items-center gap-4 xl:gap-6 shrink-0">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <i className="fa-solid fa-location-dot text-[#F7941D]" />
              Çukurova / ADANA
            </span>
            <a
              href="tel:+905336779109"
              className="flex items-center gap-2 hover:text-[#F7941D] transition whitespace-nowrap"
            >
              <i className="fa-solid fa-phone text-[#F7941D]" />
              +90 533 677 91 09
            </a>
            <a
              href="mailto:info@kuzeydenizinsaat.com.tr"
              className="flex items-center gap-2 hover:text-white transition whitespace-nowrap"
            >
              <i className="fa-solid fa-envelope text-[#0068C9]" />
              info@kuzeydenizinsaat.com.tr
            </a>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden xl:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#042A53] border border-[#0068C9]/50 text-sky-200 font-bold whitespace-nowrap">
              <i className="fa-solid fa-shield-halved text-[#F7941D]" />
              www.kuzeydenizinsaat.com.tr
            </span>
            <span className="hidden xl:inline-block h-3.5 w-px bg-slate-700" />
            <span className="flex items-center gap-1.5 text-slate-300 whitespace-nowrap">
              <i className="fa-regular fa-clock text-[#F7941D]" />
              Pzt - Cmt: 08:30 - 18:30
            </span>
          </div>
        </div>
      </div>

      {/* Main Sticky Crisp White Architectural Navbar */}
      <header
        id="navbar"
        className={`${
          isHome ? 'fixed top-0 md:top-[41px] left-0 right-0' : 'sticky top-0'
        } z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm transition-all`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 xl:gap-4 h-20">
            {/* Logo natively on crisp white surface */}
            <Link to="/" aria-label="Kuzey Deniz İnşaat Ana Sayfa" className="shrink-0 group">
              <BrandLogo withWhiteBg={false} />
            </Link>

            {/* Desktop Center Nav */}
            <nav
              className="hidden lg:flex items-center gap-1.5 xl:gap-2 shrink-0"
              aria-label="Ana Menü"
            >
              {navLinks.map((item) => {
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`px-3.5 xl:px-4 py-2 rounded-xl text-xs xl:text-sm font-bold whitespace-nowrap transition ${
                      active
                        ? 'bg-[#E6F1FB] text-[#0068C9] shadow-sm'
                        : 'text-[#042A53] hover:text-[#F25C05] hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Right CTAs */}
            <div className="hidden lg:flex items-center gap-2.5 xl:gap-3 shrink-0">
              <Link
                to="/dashboard"
                className="relative inline-flex items-center gap-2 px-3.5 xl:px-4 py-2.5 rounded-xl bg-[#042A53] hover:bg-[#021B36] text-white text-xs font-extrabold uppercase tracking-wider whitespace-nowrap transition shadow-md"
              >
                <i className="fa-solid fa-gauge-high text-[#F7941D]" />
                <span className="hidden xl:inline">Dashboard</span>
                <span className="xl:hidden">Panel</span>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#F25C05] text-white text-[10px] font-black animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <Link
                to="/iletisim"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#F7941D] to-[#F25C05] hover:brightness-110 text-white font-extrabold text-xs xl:text-sm px-4 xl:px-5 py-2.5 xl:py-3 rounded-xl shadow-lg shadow-orange-500/25 whitespace-nowrap transform hover:scale-[1.02] transition"
              >
                <i className="fa-solid fa-paper-plane" />
                <span className="hidden xl:inline">Teklif &amp; Keşif Al</span>
                <span className="xl:hidden">Teklif Al</span>
              </Link>
            </div>

            {/* Mobile Menu Toggle */}
            <div className="flex lg:hidden items-center gap-2">
              <Link
                to="/dashboard"
                className="relative inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#042A53] text-xs font-bold text-white shadow-sm"
              >
                <i className="fa-solid fa-gauge-high text-[#F7941D]" />
                <span>Panel</span>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-[#F25C05] text-white text-[10px] font-black">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <button
                id="menu-btn"
                type="button"
                onClick={() => setMobileOpen((prev) => !prev)}
                aria-label="Menüyü Aç/Kapat"
                className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-[#042A53] hover:bg-[#E6F1FB] transition"
              >
                <i className={`fa-solid ${mobileOpen ? 'fa-xmark' : 'fa-bars-staggered'} text-lg`} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        {mobileOpen && (
          <div
            id="mobile-menu"
            className="lg:hidden bg-white border-t border-slate-200 px-6 pt-4 pb-6 space-y-2.5 shadow-2xl"
          >
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`block px-4 py-3 rounded-xl font-bold text-sm transition ${
                  isActive(item.to)
                    ? 'bg-[#E6F1FB] text-[#0068C9]'
                    : 'text-[#042A53] hover:bg-slate-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/dashboard"
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#042A53] text-white font-bold text-sm"
            >
              <span>Yönetim Dashboard&apos;u</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#F25C05] text-white text-xs font-black">
                  {unreadCount} Yeni Mesaj
                </span>
              )}
            </Link>
            <Link
              to="/iletisim"
              className="block text-center bg-gradient-to-r from-[#F7941D] to-[#F25C05] text-white font-black py-3.5 rounded-xl shadow-lg"
            >
              Hemen Teklif Alın
            </Link>
          </div>
        )}
      </header>
    </>
  );
};
