/**
 * GitHub Integration Skill
 * Monitors GitHub repos for security events and activity.
 */
const POLL_INTERVAL_MS = 60_000;

async function fetchRepoEvents(token) {
  const res = await fetch('https://api.github.com/notifications', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }
  return res.json();
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('[github-integration] GITHUB_TOKEN not set');
    process.exit(1);
  }

  console.log('[github-integration] Started — polling every 60s');

  const poll = async () => {
    try {
      const events = await fetchRepoEvents(token);
      if (events.length > 0) {
        console.log(`[github-integration] ${events.length} notifications`);
      }
    } catch (err) {
      console.error('[github-integration] Poll error:', err.message);
    }
  };

  await poll();
  setInterval(poll, POLL_INTERVAL_MS);
}

main();
