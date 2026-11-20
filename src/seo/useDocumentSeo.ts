import { useEffect } from 'react';
import {
  SEO_SITE,
  SeoRouteConfig,
  buildAbsoluteUrl,
  buildRouteJsonLd,
} from './seoData';

interface DocumentSeoOptions {
  route?: SeoRouteConfig;
  isPrivatePanel?: boolean;
  isNotFound?: boolean;
}

function upsertMeta(attrName: 'name' | 'property', attrValue: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string, extra?: Record<string, string>) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => el!.setAttribute(k, v));
    }
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useDocumentSeo({ route, isPrivatePanel, isNotFound }: DocumentSeoOptions) {
  useEffect(() => {
    if (isNotFound) {
      document.title = `Sayfa Bulunamadı (404) | ${SEO_SITE.name}`;
      upsertMeta('name', 'robots', 'noindex, follow');
      upsertMeta(
        'name',
        'description',
        'Aradığınız sayfa bulunamadı. Ana sayfa, faaliyet alanları veya referans projelerimizden devam edebilirsiniz.'
      );
      document.head.querySelector('link[rel="canonical"]')?.remove();
      const jsonLdEl = document.getElementById('seo-jsonld');
      if (jsonLdEl) jsonLdEl.textContent = '{}';
      return;
    }

    if (isPrivatePanel) {
      document.title = `Yönetim Dashboard'u — ${SEO_SITE.legalName}`;
      upsertMeta('name', 'robots', 'noindex, nofollow');
      upsertMeta(
        'name',
        'description',
        `${SEO_SITE.legalName} kurumsal proje yönetimi, muhasebe, mail kontrol ve iletişim mesajları paneli.`
      );
      upsertLink('canonical', `${SEO_SITE.url}/dashboard`);
      return;
    }

    if (!route) return;

    const canonicalUrl = buildAbsoluteUrl(route.path);
    const routeImage = route.ogImage || SEO_SITE.ogImage;
    const routeImageAlt = route.ogImageAlt || SEO_SITE.ogImageAlt || route.title;

    document.title = route.title;
    upsertMeta('name', 'description', route.description);
    upsertMeta('name', 'keywords', route.keywords);
    upsertMeta(
      'name',
      'robots',
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    );
    upsertMeta('name', 'geo.region', SEO_SITE.geo.region);
    upsertMeta('name', 'geo.placename', SEO_SITE.geo.placename);
    upsertMeta('name', 'geo.position', `${SEO_SITE.geo.lat};${SEO_SITE.geo.lng}`);
    upsertMeta('name', 'ICBM', `${SEO_SITE.geo.lat}, ${SEO_SITE.geo.lng}`);

    upsertLink('canonical', canonicalUrl);
    upsertLink('sitemap', `${SEO_SITE.url}/sitemap.xml`, {
      type: 'application/xml',
      title: 'Sitemap',
    });

    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', SEO_SITE.legalName);
    upsertMeta('property', 'og:locale', SEO_SITE.locale);
    upsertMeta('property', 'og:title', route.title);
    upsertMeta('property', 'og:description', route.description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:image', routeImage);
    upsertMeta('property', 'og:image:width', '1200');
    upsertMeta('property', 'og:image:height', '630');
    upsertMeta('property', 'og:image:alt', routeImageAlt);

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:domain', SEO_SITE.domain);
    upsertMeta('name', 'twitter:title', route.title);
    upsertMeta('name', 'twitter:description', route.description);
    upsertMeta('name', 'twitter:image', routeImage);

    const jsonLd = buildRouteJsonLd(route);
    let script = document.getElementById('seo-jsonld') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'seo-jsonld';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);
  }, [route?.id, route?.path, isPrivatePanel, isNotFound]);
}
