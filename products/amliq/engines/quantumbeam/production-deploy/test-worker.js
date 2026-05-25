export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Simple test response
    return new Response(
      `🚀 QuantumBeam Worker is LIVE!\n` +
      `URL: ${url.origin}\n` +
      `Path: ${url.pathname}\n` +
      `Time: ${new Date().toISOString()}\n` +
      `Method: ${request.method}\n` +
      `User-Agent: ${request.headers.get('user-agent') || 'Unknown'}\n` +
      `\nYour Cloudflare Worker is working! 🎉`,
      {
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );
  }
};