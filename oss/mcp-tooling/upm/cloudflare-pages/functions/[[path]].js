/**
 * Cloudflare Pages Function to handle routing
 * Serves HTML files for routes without .html extension
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Skip if it's already an HTML file or has extension
  if (path.endsWith('.html') || path.includes('.')) {
    return context.next();
  }
  
  // Map routes to HTML files
  const routeMap = {
    '/pricing': 'pricing.html',
    '/docs': 'docs.html',
    '/about': 'about.html',
    '/blog': 'blog.html',
  };
  
  // Check if we have a mapping for this route
  if (routeMap[path]) {
    // Fetch the HTML file directly from the public directory
    const htmlFile = routeMap[path];
    const htmlUrl = new URL(`/${htmlFile}`, request.url);
    
    // Fetch the HTML content
    const response = await fetch(htmlUrl, {
      method: 'GET',
      headers: request.headers,
    });
    
    if (response.ok) {
      // Return the HTML content with proper headers
      const html = await response.text();
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  }
  
  // Continue with normal routing
  return context.next();
}
