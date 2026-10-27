---
name: seo
description: "Implement SEO meta tags, structured data (JSON-LD), sitemaps, and Open Graph tags. Use when adding SEO, meta tags, sitemaps, or structured data. Also triggers on: 'Add SEO'."
next_skill: null
required_gate: null
skill_id: SK-033
context_budget:
  load_kb: 30
  scope: task
version: 1.0.4
dependencies:
  required: [build]
  optional: [analytics]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# 🔍 SEO Skill - Search Engine Optimization

> **Purpose**: World-class SEO implementation for maximum discoverability
> **Output**: Meta components, structured data, sitemap, robots.txt

---

## 🚨 Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## 1. Meta Tags (Next.js App Router)

### Base Metadata
```typescript
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://example.com'),
  title: {
    default: 'Site Name',
    template: '%s | Site Name',
  },
  description: 'Site description for search engines',
  keywords: ['keyword1', 'keyword2', 'keyword3'],
  authors: [{ name: 'Author Name' }],
  creator: 'Company Name',
  robots: {
    index: true,
    follow: true,
  },
};
```

### Page-Specific Metadata
```typescript
// app/products/[id]/page.tsx
export async function generateMetadata({ 
  params 
}: { 
  params: { id: string } 
}): Promise<Metadata> {
  const product = await getProduct(params.id);
  
  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      images: [{ url: product.image, width: 1200, height: 630 }],
    },
  };
}
```

---

## 2. Open Graph & Twitter Cards

### Template
```typescript
// lib/seo/generateOG.ts
export const generateOGMetadata = (page: {
  title: string;
  description: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
}) => ({
  openGraph: {
    title: page.title,
    description: page.description,
    type: page.type || 'website',
    images: page.image ? [{ url: page.image, width: 1200, height: 630 }] : [],
    siteName: 'Site Name',
  },
  twitter: {
    card: 'summary_large_image',
    title: page.title,
    description: page.description,
    images: page.image ? [page.image] : [],
  },
});
```

### Image Dimensions
| Platform | Recommended Size |
|----------|-----------------|
| Open Graph | 1200 x 630 px |
| Twitter | 1200 x 628 px |
| LinkedIn | 1200 x 627 px |

---

## 3. Structured Data (JSON-LD)

### Organization
```typescript
// components/seo/OrganizationSchema.tsx
export const OrganizationSchema = () => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Company Name',
        url: 'https://example.com',
        logo: 'https://example.com/logo.png',
        sameAs: [
          'https://twitter.com/company',
          'https://linkedin.com/company/company',
        ],
      }),
    }}
  />
);
```

### Product Schema
```typescript
export const ProductSchema = ({ product }: { product: Product }) => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        image: product.image,
        offers: {
          '@type': 'Offer',
          price: product.price,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
      }),
    }}
  />
);
```

### Breadcrumb Schema
```typescript
export const BreadcrumbSchema = ({ items }: { 
  items: { name: string; url: string }[] 
}) => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }),
    }}
  />
);
```

---

## 4. Sitemap Generation

### Next.js App Router
```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://example.com';
  
  // Static pages
  const staticPages = ['', '/about', '/contact', '/pricing'].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1 : 0.8,
  }));
  
  // Dynamic pages (e.g., products)
  const products = await getProducts();
  const productPages = products.map((product) => ({
    url: `${baseUrl}/products/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));
  
  return [...staticPages, ...productPages];
}
```

---

## 5. Robots.txt

```typescript
// app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/private/'],
      },
    ],
    sitemap: 'https://example.com/sitemap.xml',
  };
}
```

---

## 6. SEO Checklist

| Item | Status |
|------|--------|
| Title tags (unique per page) | ☐ |
| Meta descriptions (unique per page) | ☐ |
| Open Graph tags | ☐ |
| Twitter Card tags | ☐ |
| Canonical URLs | ☐ |
| Structured data (JSON-LD) | ☐ |
| Sitemap.xml | ☐ |
| Robots.txt | ☐ |
| Alt text for images | ☐ |
| Semantic HTML (h1, h2, etc.) | ☐ |

---

## Rules Integration

> Claude Code auto-loads these rules when editing matching files:
> - `.claude/rules/frontend-rules.md` — accessibility, semantic HTML
> - `.claude/rules/ui-engineering-rules.md` — image dimensions, meta tags, performance

## Suggested Next Actions
1. Generate base metadata
2. Add structured data for key pages
3. Create sitemap

## Next Step
Proceed to the next skill in the workflow as indicated in the YAML frontmatter.
