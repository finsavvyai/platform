/**
 * Cloudflare Pages Worker for UPM Website
 * Serves static HTML pages and proxies API requests to backend
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // API requests - proxy to backend
    if (url.pathname.startsWith('/api/')) {
      return handleAPIRequest(request, env);
    }
    
    // Health check - proxy to backend
    if (url.pathname === '/health' || url.pathname === '/ready') {
      return handleAPIRequest(request, env);
    }
    
    // Static website pages
    return handleWebsiteRequest(request, env);
  }
};

/**
 * Handle API requests - proxy to backend
 */
async function handleAPIRequest(request, env) {
  const backendUrl = env.BACKEND_URL || 'http://34.29.39.106:8040';
  const url = new URL(request.url);
  const backendRequestUrl = `${backendUrl}${url.pathname}${url.search}`;
  
  try {
    const response = await fetch(backendRequestUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Backend unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle website requests - serve HTML pages
 */
async function handleWebsiteRequest(request, env) {
  const url = new URL(request.url);
  let path = url.pathname;
  
  // Default to index.html for root
  if (path === '/') {
    path = '/index.html';
  }
  
  // Remove leading slash
  path = path.replace(/^\//, '');
  
  // Map routes to HTML files
  const routeMap = {
    'index.html': 'index',
    'pricing': 'pricing',
    'docs': 'docs',
    'about': 'about',
    'blog': 'blog',
  };
  
  // Get the template name
  let templateName = routeMap[path] || routeMap[path.replace('.html', '')] || 'index';
  
  // Try to get from KV store (cached templates)
  const cacheKey = `template:${templateName}`;
  let html = await env.UPM_TEMPLATES?.get(cacheKey);
  
  if (!html) {
    // If not in cache, fetch from backend
    const backendUrl = env.BACKEND_URL || 'http://34.29.39.106:8040';
    try {
      const response = await fetch(`${backendUrl}${url.pathname}`);
      if (response.ok) {
        html = await response.text();
        // Cache for 1 hour
        await env.UPM_TEMPLATES?.put(cacheKey, html, { expirationTtl: 3600 });
      }
    } catch (error) {
      // Fallback to default HTML
      html = getDefaultHTML(templateName);
    }
  }
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

/**
 * Default HTML fallback
 */
function getDefaultHTML(page) {
  const pages = {
    index: getIndexHTML(),
    pricing: getPricingHTML(),
    docs: getDocsHTML(),
    about: getAboutHTML(),
    blog: getBlogHTML(),
  };
  
  return pages[page] || pages.index;
}

function getIndexHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UPM - Universal Package Manager</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background: #000; color: #fff; }
        .hero { min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; }
        h1 { font-size: 64px; background: linear-gradient(135deg, #007AFF 0%, #AF52DE 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    </style>
</head>
<body>
    <div class="hero">
        <div>
            <h1>Universal Package Manager</h1>
            <p style="font-size: 24px; color: #8E8E93;">Use Any Library in Any Language</p>
        </div>
    </div>
</body>
</html>`;
}

function getPricingHTML() {
  return getIndexHTML().replace('<h1>Universal Package Manager</h1>', '<h1>Pricing</h1>');
}

function getDocsHTML() {
  return getIndexHTML().replace('<h1>Universal Package Manager</h1>', '<h1>Documentation</h1>');
}

function getAboutHTML() {
  return getIndexHTML().replace('<h1>Universal Package Manager</h1>', '<h1>About UPM</h1>');
}

function getBlogHTML() {
  return getIndexHTML().replace('<h1>Universal Package Manager</h1>', '<h1>UPM Blog</h1>');
}
