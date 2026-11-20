import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './core/AuthContext';
import { HomePage } from './pages/HomePage';
import { getSeoRouteByPath, normalizePathname } from './seo/seoData';
import { useDocumentSeo } from './seo/useDocumentSeo';

const KurumsalPage = lazy(() =>
  import('./pages/KurumsalPage').then((m) => ({ default: m.KurumsalPage }))
);
const HizmetlerPage = lazy(() =>
  import('./pages/HizmetlerPage').then((m) => ({ default: m.HizmetlerPage }))
);
const HizmetDetayPage = lazy(() =>
  import('./pages/HizmetDetayPage').then((m) => ({ default: m.HizmetDetayPage }))
);
const ProjelerPage = lazy(() =>
  import('./pages/ProjelerPage').then((m) => ({ default: m.ProjelerPage }))
);
const ProjeDetayPage = lazy(() =>
  import('./pages/ProjeDetayPage').then((m) => ({ default: m.ProjeDetayPage }))
);
const IletisimPage = lazy(() =>
  import('./pages/IletisimPage').then((m) => ({ default: m.IletisimPage }))
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);
const DashboardPage = lazy(() =>
  import('./erp/ErpDashboardShell').then((m) => ({ default: m.ErpDashboardShell }))
);

const PageLoader: React.FC = () => (
  <div className="min-h-screen bg-[#030712] flex items-center justify-center text-white">
    <div className="text-center space-y-3">
      <i className="fa-solid fa-circle-notch fa-spin text-2xl text-blue-400" />
      <div className="text-xs font-bold text-slate-400">Yükleniyor...</div>
    </div>
  </div>
);

const ScrollAndSeoManager: React.FC = () => {
  const { pathname, hash } = useLocation();
  const norm = normalizePathname(pathname);
  const isPrivate = ['/dashboard', '/panel', '/admin', '/yonetim'].some(
    (p) => norm === p || norm.startsWith(`${p}/`)
  );
  const route = getSeoRouteByPath(norm);
  const isNotFound = !isPrivate && !route;

  useDocumentSeo({ route, isPrivatePanel: isPrivate, isNotFound });

  useEffect(() => {
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [pathname, hash]);

  return null;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollAndSeoManager />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/index.html" element={<HomePage />} />

            <Route path="/kurumsal" element={<KurumsalPage />} />
            <Route path="/kurumsal.html" element={<KurumsalPage />} />

            <Route path="/hizmetler" element={<HizmetlerPage />} />
            <Route path="/hizmetler.html" element={<HizmetlerPage />} />
            <Route path="/hizmetler/:slug" element={<HizmetDetayPage />} />

            <Route path="/projeler" element={<ProjelerPage />} />
            <Route path="/projeler.html" element={<ProjelerPage />} />
            <Route path="/projeler/:slug" element={<ProjeDetayPage />} />

            <Route path="/iletisim" element={<IletisimPage />} />
            <Route path="/iletisim.html" element={<IletisimPage />} />

            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/panel" element={<DashboardPage />} />
            <Route path="/admin" element={<DashboardPage />} />
            <Route path="/yonetim" element={<DashboardPage />} />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
