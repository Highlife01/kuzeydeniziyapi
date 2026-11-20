import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAbsoluteUrl as buildUrlWithBase,
  buildOrganizationNode,
  buildRouteJsonLd as buildSharedJsonLd,
} from '../src/seo/jsonLdBuilder.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT_DIR, 'src', 'seo', 'seoCatalog.json');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const { site, routes, faqs } = catalog;

const CANONICAL_DOMAIN = 'https://www.kuzeydeniziyapi.com.tr';
const INDEXNOW_KEY = 'cb84f1d92e5a4b7c8f103d2e6a9c4b71';
const TODAY_ISO = new Date().toISOString().split('T')[0];

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildAbsoluteUrl(routePath) {
  return buildUrlWithBase(CANONICAL_DOMAIN, routePath);
}

/**
 * Standard XML Sitemap with Google Image Sitemap extensions (no ?lang= or unreciprocated xhtml:link tags)
 */
function generateCleanSitemapXml() {
  const urlEntries = routes
    .map((r) => {
      const loc = buildAbsoluteUrl(r.path);
      const lastmod = r.lastmod || TODAY_ISO;
      const changefreq = r.changefreq || 'weekly';
      const priority = r.priority || '0.8';
      const imageLines = (r.images || []).flatMap((img) => [
        '    <image:image>',
        `      <image:loc>${escapeXml(buildAbsoluteUrl(img.loc))}</image:loc>`,
        `      <image:title>${escapeXml(img.title)}</image:title>`,
        ...(img.caption ? [`      <image:caption>${escapeXml(img.caption)}</image:caption>`] : []),
        '    </image:image>',
      ]);

      return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
        `    <changefreq>${escapeXml(changefreq)}</changefreq>`,
        `    <priority>${escapeXml(priority)}</priority>`,
        ...imageLines,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    urlEntries,
    '</urlset>',
    '',
  ].join('\n');
}

function generateRobotsTxt() {
  const privateDisallow = [
    'Disallow: /dashboard',
    'Disallow: /dashboard/',
    'Disallow: /panel',
    'Disallow: /admin',
    'Disallow: /yonetim',
    'Disallow: /api',
    'Disallow: /api/',
  ].join('\n');

  return `# ${site.legalName} Robots Directives (${CANONICAL_DOMAIN})
User-agent: *
Allow: /
${privateDisallow}

User-agent: Googlebot
Allow: /
${privateDisallow}

User-agent: Bingbot
Allow: /
${privateDisallow}

User-agent: GPTBot
Allow: /
${privateDisallow}

User-agent: OAI-SearchBot
Allow: /
${privateDisallow}

User-agent: ChatGPT-User
Allow: /
${privateDisallow}

User-agent: PerplexityBot
Allow: /
${privateDisallow}

User-agent: ClaudeBot
Allow: /
${privateDisallow}

User-agent: anthropic-ai
Allow: /
${privateDisallow}

User-agent: Google-Extended
Allow: /
${privateDisallow}

Sitemap: ${CANONICAL_DOMAIN}/sitemap.xml
# LLMs & GEO Context: ${CANONICAL_DOMAIN}/llms.txt
# Extended Reference: ${CANONICAL_DOMAIN}/llms-full.txt
`;
}

function generateEntityJsonLd() {
  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      ...buildOrganizationNode(catalog),
    },
    null,
    2
  );
}

function generateLlmsTxt() {
  const pageLinks = routes
    .map((r) => `- [${r.navLabel}](${buildAbsoluteUrl(r.path)}): ${r.description}`)
    .join('\n');

  return `# ${site.legalName}

> ${site.tagline}. Adana ve Çukurova bölgesinde kamu taahhüt, çatı yenileme, hastane yangın güvenliği sistemleri ve endüstriyel çelik yapı çözümleri.

## Temel Kurumsal Bilgiler
- **Resmi Ticaret Unvanı:** ${site.legalName}
- **Kanonik Web Sitesi:** ${CANONICAL_DOMAIN}/
- **Kuruluş Tarihi:** 04/01/2017
- **Vergi Dairesi / VKN:** ${site.taxOffice} — ${site.taxNumber}
- **Merkez Adres:** ${site.address} (Posta Kodu: ${site.postalCode})
- **Tek Telefon & WhatsApp:** ${site.phoneDisplay} (${site.whatsappUrl})
- **E-Posta:** ${site.email}

## Öne Çıkan Tamamlanan Referans Projeler
- **Adana Adliyesi Çatı Yenileme:** Çatı kaplama yenileme, ısı-su yalıtım katmanları ve yağmur drenaj altyapısı.
- **Pozantı 80. Yıl Devlet Hastanesi Yangın Güvenliği Standartlarının Güçlendirilmesine Yönelik Tadilat ve Bakım Çalışmaları:** Yangın güvenliği standartlarına uygun mekanik ve tesisat tadilatları, söndürme ve algılama sistemlerinin bakımı.

## Sayfalar
${pageLinks}

## Kaynak Dosyalar
- [XML Site Haritası](${CANONICAL_DOMAIN}/sitemap.xml)
- [Genişletilmiş Referans (llms-full.txt)](${CANONICAL_DOMAIN}/llms-full.txt)
- [Kurumsal Entity JSON-LD](${CANONICAL_DOMAIN}/entity.jsonld)
`;
}

function generateLlmsFullTxt() {
  const routeSections = routes
    .map((r) => {
      const lines = [
        `### ${r.h1}`,
        `URL: ${buildAbsoluteUrl(r.path)}`,
        '',
        r.leadSummary,
        '',
      ];
      if (r.highlights?.length) {
        lines.push('Öne Çıkan Detaylar:');
        r.highlights.forEach((h) => lines.push(`- ${h}`));
        lines.push('');
      }
      if (r.sections?.length) {
        r.sections.forEach((s) => {
          lines.push(`#### ${s.heading}`);
          lines.push(s.summary);
          s.bullets.forEach((b) => lines.push(`- ${b}`));
          lines.push('');
        });
      }
      return lines.join('\n');
    })
    .join('\n---\n\n');

  const faqText = (faqs || [])
    .map((f) => `**Soru: ${f.q}**\nYanıt: ${f.a}`)
    .join('\n\n');

  return `# ${site.legalName} — Tam Kurumsal ve Proje Referansı

Web Sitesi: ${CANONICAL_DOMAIN}/
Kuruluş: 04/01/2017 | Vergi Dairesi: ${site.taxOffice} | VKN: ${site.taxNumber}
Adres: ${site.address} (${site.postalCode})
Telefon & WhatsApp: ${site.phoneDisplay} | E-Posta: ${site.email}

---

## Sayfa Bazlı İçerik Özeti

${routeSections}
---

## Sıkça Sorulan Sorular

${faqText}
`;
}

function buildSemanticCrawlableBody(route) {
  const topNavRoutes = routes.filter((r) => !r.parentPath);
  const navLinks = topNavRoutes
    .map((r) => `<li><a href="${escapeHtml(r.path)}">${escapeHtml(r.navLabel)}</a></li>`)
    .join('');

  const highlightsHtml = route.highlights?.length
    ? `<section aria-label="Öne Çıkanlar"><h2>Öne Çıkan Detaylar</h2><ul>${route.highlights
        .map((h) => `<li>${escapeHtml(h)}</li>`)
        .join('')}</ul></section>`
    : '';

  const sectionsHtml = (route.sections || [])
    .map(
      (s) =>
        `<section><h2>${escapeHtml(s.heading)}</h2><p>${escapeHtml(s.summary)}</p><ul>${s.bullets
          .map((b) => `<li>${escapeHtml(b)}</li>`)
          .join('')}</ul></section>`
    )
    .join('');

  const childRoutes = routes.filter((r) => r.parentPath === route.path);
  const childLinksHtml = childRoutes.length
    ? `<section aria-label="Alt Sayfalar"><h2>Detay Sayfaları</h2><ul>${childRoutes
        .map((c) => `<li><a href="${escapeHtml(c.path)}">${escapeHtml(c.navLabel)}</a> — ${escapeHtml(c.description)}</li>`)
        .join('')}</ul></section>`
    : '';

  const faqHtml =
    route.id === 'home' && faqs?.length
      ? `<section aria-label="Sıkça Sorulan Sorular"><h2>Sıkça Sorulan Sorular</h2>${faqs
          .map((f) => `<article><h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p></article>`)
          .join('')}</section>`
      : '';

  return [
    '<div class="seo-prerender" style="max-width:960px;margin:0 auto;padding:32px 20px;font-family:system-ui,sans-serif;color:#e2e8f0;background:#030712;">',
    `<header><p><strong>${escapeHtml(site.legalName)}</strong> — ${escapeHtml(site.tagline)}</p><nav aria-label="Site Bağlantıları"><ul>${navLinks}</ul></nav></header>`,
    `<main><article><p><strong>${escapeHtml(route.heroBadge)}</strong></p><h1>${escapeHtml(route.h1)}</h1><p>${escapeHtml(route.leadSummary)}</p>${highlightsHtml}${sectionsHtml}${childLinksHtml}${faqHtml}</article></main>`,
    `<footer><p>© ${new Date().getFullYear()} ${escapeHtml(site.legalName)} (${escapeHtml(CANONICAL_DOMAIN)}) | Adres: ${escapeHtml(site.address)} | Tel: ${escapeHtml(site.phoneDisplay)} | E-Posta: ${escapeHtml(site.email)}</p></footer>`,
    '</div>',
  ].join('');
}

function replaceMetaTag(html, attr, key, value) {
  const escapedKey = key.replace('.', '\\.');
  const re = new RegExp(`<meta\\s+[^>]*${attr}="${escapedKey}"[^>]*\\/?>`, 'i');
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function replaceLinkTag(html, rel, href) {
  const re = new RegExp(`<link\\s+[^>]*rel="${rel}"[^>]*\\/?>`, 'i');
  const tag = `<link rel="${rel}" href="${escapeHtml(href)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function renderStaticHtmlForRoute(templateHtml, route) {
  const canonicalUrl = buildAbsoluteUrl(route.path);
  const routeImage = route.ogImage || site.ogImage;
  const routeImageAlt = route.ogImageAlt || site.ogImageAlt || route.title;
  const jsonLd = JSON.stringify(buildSharedJsonLd(catalog, route)).replace(/</g, '\\u003c');
  const crawlableBody = buildSemanticCrawlableBody(route);

  let html = templateHtml;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(route.title)}</title>`);
  html = replaceMetaTag(html, 'name', 'description', route.description);
  html = replaceMetaTag(html, 'name', 'keywords', route.keywords);
  html = replaceLinkTag(html, 'canonical', canonicalUrl);

  html = replaceMetaTag(html, 'property', 'og:title', route.title);
  html = replaceMetaTag(html, 'property', 'og:description', route.description);
  html = replaceMetaTag(html, 'property', 'og:url', canonicalUrl);
  html = replaceMetaTag(html, 'property', 'og:image', routeImage);
  html = replaceMetaTag(html, 'property', 'og:image:alt', routeImageAlt);

  html = replaceMetaTag(html, 'name', 'twitter:title', route.title);
  html = replaceMetaTag(html, 'name', 'twitter:description', route.description);
  html = replaceMetaTag(html, 'name', 'twitter:image', routeImage);

  html = html.replace(
    /<script id="seo-jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/i,
    `<script id="seo-jsonld" type="application/ld+json">${jsonLd}</script>`
  );
  html = html.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${crawlableBody}</div>`
  );

  return html;
}

function renderStaticNotFoundHtml(templateHtml) {
  let html = templateHtml;
  const title = `Sayfa Bulunamadı (404) | ${site.name}`;
  const desc = 'Aradığınız sayfa bulunamadı. Ana sayfa, faaliyet alanları veya referans projelerimizden devam edebilirsiniz.';

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceMetaTag(html, 'name', 'robots', 'noindex, follow');
  html = replaceMetaTag(html, 'name', 'description', desc);
  html = html.replace(/<link\s+[^>]*rel="canonical"[^>]*\/?>/i, '');
  html = html.replace(
    /<script id="seo-jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/i,
    ''
  );
  const body404 =
    '<div class="seo-prerender" style="max-width:720px;margin:64px auto;padding:32px 20px;font-family:system-ui,sans-serif;color:#e2e8f0;background:#030712;">' +
    '<h1>404 — Sayfa Bulunamadı</h1>' +
    `<p>${escapeHtml(desc)}</p>` +
    '<ul><li><a href="/">Ana Sayfa</a></li><li><a href="/hizmetler">Faaliyet Alanları</a></li><li><a href="/projeler">Projelerimiz</a></li><li><a href="/iletisim">İletişim</a></li></ul>' +
    '</div>';
  html = html.replace(/<div id="root"><\/div>/, `<div id="root">${body404}</div>`);
  return html;
}

function writeFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
}

function prerenderStaticSeo() {
  console.log('[Prerender] Canonical SEO varlıkları üretiliyor:', CANONICAL_DOMAIN);

  const sitemapXml = generateCleanSitemapXml();
  const robotsTxt = generateRobotsTxt();
  const llmsTxt = generateLlmsTxt();
  const llmsFullTxt = generateLlmsFullTxt();
  const entityJsonLd = generateEntityJsonLd();

  writeFile(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapXml);
  writeFile(path.join(PUBLIC_DIR, 'robots.txt'), robotsTxt);
  writeFile(path.join(PUBLIC_DIR, 'llms.txt'), llmsTxt);
  writeFile(path.join(PUBLIC_DIR, 'llms-full.txt'), llmsFullTxt);
  writeFile(path.join(PUBLIC_DIR, 'entity.jsonld'), entityJsonLd);

  const distIndexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(distIndexPath)) {
    console.log('[Prerender] dist/ bulunamadı, yalnızca public/ dosyaları güncellendi.');
    return;
  }

  writeFile(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml);
  writeFile(path.join(DIST_DIR, 'robots.txt'), robotsTxt);
  writeFile(path.join(DIST_DIR, 'llms.txt'), llmsTxt);
  writeFile(path.join(DIST_DIR, 'llms-full.txt'), llmsFullTxt);
  writeFile(path.join(DIST_DIR, 'entity.jsonld'), entityJsonLd);

  const keyFile = `${INDEXNOW_KEY}.txt`;
  if (fs.existsSync(path.join(PUBLIC_DIR, keyFile))) {
    fs.copyFileSync(path.join(PUBLIC_DIR, keyFile), path.join(DIST_DIR, keyFile));
  }

  const templateHtml = fs.readFileSync(distIndexPath, 'utf8');
  let prerenderCount = 0;

  for (const route of routes) {
    const renderedHtml = renderStaticHtmlForRoute(templateHtml, route);
    if (route.path === '/') {
      writeFile(distIndexPath, renderedHtml);
      prerenderCount++;
    } else {
      const cleanSlug = route.path.replace(/^\/+|\/+$/g, '');
      writeFile(path.join(DIST_DIR, cleanSlug, 'index.html'), renderedHtml);
      writeFile(path.join(DIST_DIR, `${cleanSlug}.html`), renderedHtml);
      prerenderCount++;
    }
  }

  writeFile(path.join(DIST_DIR, '404.html'), renderStaticNotFoundHtml(templateHtml));

  console.log(
    `[Prerender] ${prerenderCount} rota dist/ altında statik HTML olarak ve 404.html üretildi.`
  );
}

prerenderStaticSeo();
