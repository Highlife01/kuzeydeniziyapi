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
    { to: '/', label: 'Ana Sayfa', hasChevron: false },
    { to: '/kurumsal', label: 'Kurumsal', hasChevron: true },
    { to: '/hizmetler', label: 'Faaliyet Alanları', hasChevron: true },
    { to: '/projeler', label: 'Projelerimiz', hasChevron: true },
    { to: '/iletisim', label: 'İletişim', hasChevron: false },
  ];

  return (
    <>
      {/* Top Utility Bar */}
      <div className="bg-[#021B36] py-2.5 border-b border-[#042A53] hidden md:block relative z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 text-xs font-semibold text-slate-300">
          <div className="flex items-center gap-4 xl:gap-6 shrink-0">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <i className="fa-solid fa-location-dot text-[#0068C9]" />
              Seyhan / ADANA
            </span>
            <a
              href="tel:+905336779109"
              className="flex items-center gap-2 hover:text-[#F7941D] transition whitespace-nowrap"
            >
              <i className="fa-solid fa-phone text-[#F7941D]" />
              +90 533 677 91 09
            </a>
            <a
              href="mailto:info@kuzeydeniziyapi.com.tr"
              className="flex items-center gap-2 hover:text-white transition whitespace-nowrap"
            >
              <i className="fa-solid fa-envelope text-[#0068C9]" />
              info@kuzeydeniziyapi.com.tr
            </a>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden xl:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#042A53]/80 border border-[#0068C9]/40 text-sky-200 font-bold whitespace-nowrap">
              <i className="fa-solid fa-shield-halved text-[#F7941D]" />
              TBDY 2018 Deprem ve Kamu Şartname Standartları
            </span>
            <span className="hidden xl:inline-block h-3.5 w-px bg-slate-700" />
            <span className="flex items-center gap-1.5 text-slate-300 whitespace-nowrap">
              <i className="fa-regular fa-clock text-amber-400" />
              Pzt - Cmt: 08:30 - 18:30
            </span>
          </div>
        </div>
      </div>

      {/* Main Sticky Navbar */}
      <header
        id="navbar"
        className={`${
          isHome ? 'fixed top-0 md:top-[41px] left-0 right-0' : 'sticky top-0'
        } z-50 bg-[#042A53]/95 backdrop-blur-2xl border-b border-[#021B36] shadow-2xl transition-all`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-6 xl:px-8">
          <div className="flex items-center justify-between gap-2 xl:gap-4 h-20">
            <Link to="/" aria-label="Kuzey Denizi İnşaat Ana Sayfa" className="shrink-0">
              <BrandLogo light={true} />
            </Link>

            {/* Desktop Center Nav */}
            <nav
              className="hidden lg:flex items-center gap-2.5 xl:gap-6 shrink-0"
              aria-label="Ana Menü"
            >
              {navLinks.map((item) => {
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`group inline-flex items-center gap-1.5 text-xs xl:text-sm font-bold whitespace-nowrap transition ${
                      active
                        ? 'px-3.5 py-2 rounded-xl bg-[#0068C9]/30 border border-[#0068C9] text-white shadow-sm'
                        : 'text-slate-200 hover:text-[#F7941D] py-2'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.hasChevron && (
                      <i className="fa-solid fa-chevron-down text-[10px] opacity-70 group-hover:rotate-180 transition-transform duration-300" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Right CTAs */}
            <div className="hidden lg:flex items-center gap-2.5 xl:gap-3 shrink-0">
              <Link
                to="/dashboard"
                className="relative inline-flex items-center gap-2 px-3 xl:px-4 py-2.5 rounded-xl bg-[#021B36] hover:bg-[#063363] border border-[#0068C9]/60 hover:border-[#F7941D] text-slate-100 text-xs font-extrabold uppercase tracking-wider whitespace-nowrap transition shadow-lg"
              >
                <i className="fa-solid fa-gauge-high text-amber-400" />
                <span className="hidden xl:inline">Dashboard</span>
                <span className="xl:hidden">Panel</span>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-black animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <Link
                to="/iletisim"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#F7941D] to-[#F25C05] hover:brightness-110 text-white font-extrabold text-xs xl:text-sm px-4 xl:px-6 py-2.5 xl:py-3 rounded-xl shadow-xl shadow-orange-500/25 border border-amber-300/40 whitespace-nowrap transform hover:scale-105 transition"
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
                className="relative inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#021B36] border border-[#0068C9] text-xs font-bold text-white"
              >
                <i className="fa-solid fa-gauge-high text-amber-400" />
                <span>Panel</span>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-red-600 text-[10px] font-black">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <button
                id="menu-btn"
                type="button"
                onClick={() => setMobileOpen((prev) => !prev)}
                aria-label="Menüyü Aç/Kapat"
                className="p-2.5 rounded-xl bg-[#021B36] border-2 border-slate-700 text-white hover:border-[#0068C9] transition"
              >
                <i className={`fa-solid ${mobileOpen ? 'fa-xmark' : 'fa-bars'} text-lg`} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        {mobileOpen && (
          <div
            id="mobile-menu"
            className="lg:hidden bg-[#042A53] border-b-2 border-[#021B36] px-6 pt-4 pb-6 space-y-3"
          >
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`block px-4 py-3 rounded-xl font-bold text-sm transition ${
                  isActive(item.to)
                    ? 'bg-[#0068C9]/30 border border-[#0068C9] text-white'
                    : 'text-slate-200 hover:bg-[#021B36]'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/dashboard"
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#021B36] border border-[#0068C9] text-amber-300 font-bold text-sm"
            >
              <span>Yönetim Dashboard&apos;u</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-black">
                  {unreadCount} Yeni Mesaj
                </span>
              )}
            </Link>
            <Link
              to="/iletisim"
              className="block text-center bg-gradient-to-r from-[#F7941D] to-[#F25C05] text-white font-black py-3.5 rounded-xl border border-amber-300 shadow-lg"
            >
              Hemen Teklif Alın
            </Link>
          </div>
        )}
      </header>
    </>
  );
};
