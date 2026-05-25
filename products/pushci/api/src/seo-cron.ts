// SEO Cron — automatically pings search engines and verifies AI endpoints.
// Triggered by Cloudflare scheduled event (weekly).

const SITEMAP = "https://pushci.dev/sitemap.xml";
const URLS_TO_INDEX = [
  "https://pushci.dev/",
  "https://pushci.dev/why",
  "https://pushci.dev/ai",
  "https://pushci.dev/vs/github-actions",
  "https://pushci.dev/vs/gitlab-ci",
  "https://pushci.dev/vs/circleci",
  "https://pushci.dev/vs/jenkins",
  "https://pushci.dev/tools/cost-calculator",
  "https://pushci.dev/llms.txt",
  "https://pushci.dev/llms-full.txt",
];

export async function handleScheduled(): Promise<void> {
  // Ping Google & Bing
  await fetch(`https://www.google.com/ping?sitemap=${SITEMAP}`).catch(() => {});
  await fetch(`https://www.bing.com/ping?sitemap=${SITEMAP}`).catch(() => {});

  // IndexNow (Bing, Yandex, Seznam, Naver)
  await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host: "pushci.dev",
      key: "pushci-indexnow-key",
      urlList: URLS_TO_INDEX,
    }),
  }).catch(() => {});

  // Verify AI discovery files
  const checks = [
    "https://pushci.dev/llms.txt",
    "https://pushci.dev/.well-known/ai-plugin.json",
    "https://pushci.dev/.well-known/mcp.json",
    "https://pushci.dev/openapi.json",
  ];
  for (const url of checks) {
    const resp = await fetch(url).catch(() => null);
    if (!resp || !resp.ok) {
      console.error(`SEO check failed: ${url} returned ${resp?.status}`);
    }
  }
}
