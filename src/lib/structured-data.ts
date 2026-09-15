import { Product } from '@/types';

export function generateProductJsonLd(product: Product, baseUrl: string) {
  const price = product.salePrice || product.originalPrice;
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images?.map((img) => `${baseUrl}${img}`) || [],
    brand: {
      '@type': 'Brand',
      name: 'Ilma Hijab Collection',
    },
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/product/${product.slug}`,
      priceCurrency: 'INR',
      price: price,
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      availability: product.stock > 0 
        ? 'https://schema.org/InStock' 
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'Ilma Hijab Collection',
      },
    },
    aggregateRating: product.reviewCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
      bestRating: 5,
      worstRating: 1,
    } : undefined,
    category: product.category,
    material: product.fabricInfo,
  };
}

export function generateOrganizationJsonLd(baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Ilma Hijab Collection',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: 'Premium Islamic fashion brand offering elegant Abayas, Hijabs, and Naqabs for the modern Muslim woman.',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-9286558531',
      contactType: 'customer service',
      areaServed: 'IN',
      availableLanguage: ['English', 'Hindi', 'Urdu'],
    },
    sameAs: [
      'https://www.instagram.com/ilmahijabcollection',
      'https://www.facebook.com/ilmahijabcollection',
    ],
  };
}

export function generateBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function generateWebsiteJsonLd(baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Ilma Hijab Collection',
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
