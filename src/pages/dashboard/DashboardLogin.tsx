import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../../components/BrandLogo';
import { useAuth } from '../../core/AuthContext';

export const DashboardLogin: React.FC = () => {
  const { loginWithGoogle, loginWithEmail, enterPreviewMode, authError } = useAuth();
  const [email, setEmail] = useState('cebrailkara@gmail.com');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    try {
      await loginWithEmail(email, password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#021B36] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#0068C9]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-[#042A53] border-2 border-[#0068C9]/40 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <BrandLogo size="lg" showText={true} withWhiteBg={true} />
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-[#F7941D]">
              Kurumsal Yönetim Dashboard&apos;u
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1 leading-snug">
              Kuzeydeniz İnşaat Taahhüt Ltd. Şti.
            </h1>
            <p className="text-xs text-sky-200/80 mt-1.5 leading-relaxed">
              ERP, Şantiye Raporları, Finans &amp; İletişim Formu Mesajları
            </p>
          </div>
        </div>

        {authError && (
          <div className="p-4 rounded-2xl bg-red-950/80 border border-red-500/60 text-red-200 text-xs leading-relaxed">
            <i className="fa-solid fa-triangle-exclamation text-red-400 mr-1.5" />
            {authError}
          </div>
        )}

        {/* Kurumsal E-Posta & Şifre ile Giriş */}
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-200 mb-1">
              Yönetici E-Posta
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cebrailkara@gmail.com"
              className="w-full px-4 py-3 rounded-xl bg-[#021B36] border border-[#0068C9]/40 text-sm text-white focus:outline-none focus:border-[#F7941D]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-200 mb-1">
              Yönetici Şifresi
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-[#021B36] border border-[#0068C9]/40 text-sm text-white focus:outline-none focus:border-[#F7941D]"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#F7941D] to-[#F25C05] hover:brightness-110 disabled:opacity-60 text-white font-black text-sm py-3.5 px-6 rounded-xl border border-amber-300/40 shadow-xl shadow-orange-500/25 transition"
          >
            <i className={`fa-solid ${submitting ? 'fa-spinner fa-spin' : 'fa-right-to-bracket'}`} />
            <span>{submitting ? 'Giriş Yapılıyor...' : 'Yönetici Hesabıyla Giriş Yap'}</span>
          </button>
        </form>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-slate-600" />
          <span className="shrink mx-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
            veya
          </span>
          <div className="flex-grow border-t border-slate-600" />
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-2.5 bg-[#021B36] hover:bg-[#063363] text-white font-bold text-xs py-3 px-5 rounded-xl border border-[#0068C9]/60 transition"
          >
            <i className="fa-brands fa-google text-blue-400" />
            <span>Google ile Yönetici Girişi ({email})</span>
          </button>

          <button
            type="button"
            onClick={enterPreviewMode}
            className="w-full flex items-center justify-center gap-2 bg-[#021B36]/80 hover:bg-[#063363] text-amber-300 font-bold text-xs py-3 px-5 rounded-xl border border-amber-400/50 hover:border-amber-400 transition"
          >
            <i className="fa-solid fa-eye" />
            <span>Yerel Çalışma Modu (Önizleme &amp; Test)</span>
          </button>
        </div>

        <div className="text-center pt-1">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-sky-200/80 hover:text-white transition"
          >
            <i className="fa-solid fa-arrow-left" />
            <span>Kurumsal Web Sitesine Dön</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
