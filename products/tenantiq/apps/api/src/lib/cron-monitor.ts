/**
 * Cron Monitor — dead man's switch via Healthchecks.io.
 * Pings a monitoring endpoint after each successful cron run.
 */

const HEALTHCHECK_BASE = 'https://hc-ping.com';

export async function pingCronSuccess(
	env: { HEALTHCHECK_PING_KEY?: string },
	cronName: string
): Promise<void> {
	if (!env.HEALTHCHECK_PING_KEY) return;
	const url = `${HEALTHCHECK_BASE}/${env.HEALTHCHECK_PING_KEY}/${cronName}`;
	await fetch(url).catch(() => {}); // fire-and-forget
}

export async function pingCronFailure(
	env: { HEALTHCHECK_PING_KEY?: string },
	cronName: string
): Promise<void> {
	if (!env.HEALTHCHECK_PING_KEY) return;
	const url = `${HEALTHCHECK_BASE}/${env.HEALTHCHECK_PING_KEY}/${cronName}/fail`;
	await fetch(url).catch(() => {});
}
