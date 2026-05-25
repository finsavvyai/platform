/**
 * OpenSyber domain redirect worker.
 * Routes alternate domains to opensyber.cloud with path preservation.
 *
 * opensyber.dev  → opensyber.cloud/docs (developer hub)
 * opensyber.com  → opensyber.cloud/enterprise (corporate)
 * opensyber.io   → opensyber.cloud (catch-all)
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const host = url.hostname;
    const path = url.pathname + url.search;

    const routes = {
      'opensyber.dev': path === '/' ? '/docs' : path,
      'www.opensyber.dev': path === '/' ? '/docs' : path,
      'opensyber.com': path === '/' ? '/enterprise' : path,
      'www.opensyber.com': path === '/' ? '/enterprise' : path,
      'opensyber.io': path,
      'www.opensyber.io': path,
    };

    const target = routes[host];
    if (target !== undefined) {
      return Response.redirect(`https://opensyber.cloud${target}`, 301);
    }

    return new Response('Not found', { status: 404 });
  },
};
