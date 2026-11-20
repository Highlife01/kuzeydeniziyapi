export function buildAbsoluteUrl(baseUrl, routePath) {
  const cleanBase = String(baseUrl || '').replace(/\/+$/, '');
  if (!routePath || routePath === '/') return `${cleanBase}/`;
  const cleanPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return `${cleanBase}${cleanPath}`;
}

export function findRoute(catalog, routePath) {
  return (catalog.routes || []).find((r) => r.path === routePath);
}

export function getChildRoutes(catalog, parentPath) {
  return (catalog.routes || []).filter((r) => r.parentPath === parentPath);
}

export function buildOrganizationNode(catalog) {
  const { site } = catalog;
  const node = {
    '@type': ['Organization', 'LocalBusiness', 'GeneralContractor'],
    '@id': `${site.url}/#organization`,
    name: site.legalName,
    alternateName: site.name,
    url: `${site.url}/`,
    logo: {
      '@type': 'ImageObject',
      url: site.logo,
      width: 1024,
      height: 768,
    },
    image: site.ogImage,
    telephone: site.phoneHref,
    email: site.email,
    foundingDate: site.foundingDate,
    taxID: site.taxNumber,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.streetAddress,
      addressLocality: 'Çukurova',
      addressRegion: 'Adana',
      postalCode: site.postalCode,
      addressCountry: 'TR',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: site.geo.lat,
      longitude: site.geo.lng,
    },
    hasMap: site.hasMap,
    areaServed: site.geo.serviceAreas.map((area) => ({
      '@type': 'Place',
      name: area,
    })),
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '08:30',
        closes: '18:00',
      },
    ],
  };
  if (Array.isArray(site.sameAs) && site.sameAs.length > 0) {
    node.sameAs = site.sameAs;
  }
  return node;
}

export function buildRouteJsonLd(catalog, route) {
  const { site, faqs } = catalog;
  const canonicalUrl = buildAbsoluteUrl(site.url, route.path);
  const orgRef = { '@id': `${site.url}/#organization` };
  const routeImage = route.ogImage || site.ogImage;

  const webPageNode = {
    '@type': route.kind === 'project' ? ['WebPage', 'ItemPage'] : 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: route.title,
    description: route.description,
    inLanguage: 'tr-TR',
    isPartOf: { '@id': `${site.url}/#website` },
    about: orgRef,
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: routeImage,
      width: 1024,
      height: 768,
    },
    breadcrumb: { '@id': `${canonicalUrl}#breadcrumb` },
  };

  const websiteNode = {
    '@type': 'WebSite',
    '@id': `${site.url}/#website`,
    url: `${site.url}/`,
    name: site.name,
    inLanguage: 'tr-TR',
    publisher: orgRef,
  };

  const crumbs = [{ name: 'Ana Sayfa', item: `${site.url}/` }];
  if (route.parentPath) {
    const parent = findRoute(catalog, route.parentPath);
    if (parent) {
      crumbs.push({ name: parent.navLabel, item: buildAbsoluteUrl(site.url, parent.path) });
    }
  }
  if (route.path !== '/') {
    crumbs.push({ name: route.navLabel, item: canonicalUrl });
  }
  const breadcrumbNode = {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl}#breadcrumb`,
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.item,
    })),
  };

  const graph = [buildOrganizationNode(catalog), websiteNode, webPageNode, breadcrumbNode];

  if (route.kind === 'service') {
    graph.push({
      '@type': 'Service',
      '@id': `${canonicalUrl}#service`,
      name: route.h1,
      serviceType: route.serviceType || route.navLabel,
      description: route.description,
      url: canonicalUrl,
      image: route.image ? buildAbsoluteUrl(site.url, route.image) : routeImage,
      provider: orgRef,
      areaServed: site.geo.serviceAreas.map((area) => ({ '@type': 'Place', name: area })),
    });
  }

  if (route.kind === 'project') {
    graph.push({
      '@type': 'CreativeWork',
      '@id': `${canonicalUrl}#project`,
      name: route.h1,
      description: route.leadSummary,
      url: canonicalUrl,
      image: route.image ? buildAbsoluteUrl(site.url, route.image) : routeImage,
      creator: orgRef,
      locationCreated: {
        '@type': 'Place',
        name: route.location,
        address: { '@type': 'PostalAddress', addressRegion: 'Adana', addressCountry: 'TR' },
      },
      ...(route.client ? { sourceOrganization: { '@type': 'Organization', name: route.client } } : {}),
      creativeWorkStatus: route.statusLabel,
    });
  }

  const children = getChildRoutes(catalog, route.path);
  if (children.length > 0) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${canonicalUrl}#itemlist`,
      name: route.navLabel,
      itemListElement: children.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.navLabel,
        url: buildAbsoluteUrl(site.url, c.path),
      })),
    });
  }

  if (route.id === 'home' && Array.isArray(faqs) && faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.a,
        },
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}
