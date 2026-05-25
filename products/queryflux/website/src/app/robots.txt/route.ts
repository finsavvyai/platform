import { MetadataRoute } from "next";

export const dynamic = "force-static";

export function GET(): Response {
  const robotsTxt = `User-agent: *
Allow: /

# Disallow sensitive routes
Disallow: /api/
Disallow: /admin/
Disallow: /_next/
Disallow: /private/
Disallow: /settings/
Disallow: /profile/

# Allow crawling of important content
Allow: /docs/
Allow: /blog/
Allow: /downloads/
Allow: /about/
Allow: /contact/

# Special rules for AI-generated content
Crawl-delay: 1

# Sitemap location
Sitemap: ${process.env.NEXT_PUBLIC_SITE_URL || "https://queryflux.com"}/sitemap.xml

# Contact information for robots
# Please respect our robots.txt and contact us if you have questions.
# Contact: support@queryflux.com`;

  return new Response(robotsTxt, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
