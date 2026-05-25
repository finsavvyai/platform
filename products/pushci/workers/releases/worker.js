export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1); // strip leading /

    if (!key || key === '/') {
      return new Response('PushCI Release Server\n', { status: 200 });
    }

    const object = await env.BUCKET.get(key);
    if (!object) {
      return new Response('Not Found', { status: 404 });
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  },
};
