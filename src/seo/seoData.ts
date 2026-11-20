import catalog from './seoCatalog.json';
import { buildAbsoluteUrl as buildUrl, buildRouteJsonLd as buildJsonLd } from './jsonLdBuilder.mjs';

export interface SeoRouteConfig {
  id: string;
  kind?: string;
  path: string;
  parentPath?: string;
  projectId?: string;
  navLabel: string;
  title: string;
  description: string;
  keywords: string;
  ogImage?: string;
  ogImageAlt?: string;
  image?: string;
  serviceType?: string;
  location?: string;
  client?: string;
  statusLabel?: string;
  heroBadge: string;
  h1: string;
  leadSummary: string;
  changefreq: string;
  priority: string;
  highlights?: string[];
  sections?: { heading: string; summary: string; bullets: string[] }[];
  relatedPaths?: string[];
}

export const SEO_SITE = catalog.site;
export const SEO_ROUTES = catalog.routes as SeoRouteConfig[];

export function normalizePathname(raw: string): string {
  if (!raw || raw === '/' || raw === '/index.html') return '/';
  return raw.replace(/\.html$/i, '').replace(/\/+$/, '') || '/';
}

export function getSeoRouteByPath(pathname: string): SeoRouteConfig | undefined {
  const norm = normalizePathname(pathname);
  return SEO_ROUTES.find((r) => r.path === norm);
}

export function buildAbsoluteUrl(routePath: string): string {
  return buildUrl(SEO_SITE.url, routePath);
}

export function buildRouteJsonLd(route: SeoRouteConfig): Record<string, unknown> {
  return buildJsonLd(catalog, route);
}
