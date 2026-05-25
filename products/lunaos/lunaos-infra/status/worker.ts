/**
 * LunaOS Status Page Worker — status.lunaos.ai
 *
 * Checks all subdomains every 60s, serves a beautiful status page,
 * and sends email/webhook alerts when a service goes down.
 *
 * Deployed as a Cloudflare Worker with:
 * - Cron Trigger: runs every minute
 * - KV: stores check results + incident history
 * - Sends alerts via Resend email API
 */

export interface Env {
    STATUS_KV: KVNamespace;
    RESEND_API_KEY?: string;
    ALERT_EMAIL?: string;
    ALERT_WEBHOOK?: string;
}

// ─── Services to monitor ─────────────────────────────────────────────────────

interface ServiceCheck {
    name: string;
    url: string;
    expectedStatus?: number;
    timeout?: number;
}

const SERVICES: ServiceCheck[] = [
    { name: 'API', url: 'https://api.lunaos.ai/health', expectedStatus: 200 },
    { name: 'Dashboard', url: 'https://agents.lunaos.ai', expectedStatus: 200 },
    { name: 'Docs', url: 'https://docs.lunaos.ai', expectedStatus: 200 },
    { name: 'Marketing', url: 'https://lunaos.ai', expectedStatus: 200 },
    { name: 'Studio', url: 'https://studio.lunaos.ai', expectedStatus: 200 },
];

interface CheckResult {
    name: string;
    url: string;
    status: 'up' | 'down' | 'degraded';
    statusCode: number | null;
    responseTime: number;
    checkedAt: string;
    error?: string;
}

interface StatusData {
    overall: 'operational' | 'degraded' | 'outage';
    services: CheckResult[];
    checkedAt: string;
    uptimePercent: Record<string, number>;
}

// ─── Health Check Logic ──────────────────────────────────────────────────────

async function checkService(service: ServiceCheck): Promise<CheckResult> {
    const start = Date.now();
    const timeout = service.timeout || 10000;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(service.url, {
            method: 'GET',
            signal: controller.signal,
            headers: { 'User-Agent': 'LunaOS-StatusChecker/1.0' },
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - start;
        const expectedStatus = service.expectedStatus || 200;

        let status: 'up' | 'down' | 'degraded' = 'up';
        if (response.status !== expectedStatus) {
            status = response.status >= 500 ? 'down' : 'degraded';
        } else if (responseTime > 5000) {
            status = 'degraded';
        }

        return {
            name: service.name,
            url: service.url,
            status,
            statusCode: response.status,
            responseTime,
            checkedAt: new Date().toISOString(),
        };
    } catch (err: any) {
        return {
            name: service.name,
            url: service.url,
            status: 'down',
            statusCode: null,
            responseTime: Date.now() - start,
            checkedAt: new Date().toISOString(),
            error: err.name === 'AbortError' ? 'Timeout' : err.message,
        };
    }
}

async function runAllChecks(): Promise<CheckResult[]> {
    return Promise.all(SERVICES.map(checkService));
}

// ─── Uptime Tracking ─────────────────────────────────────────────────────────

async function updateUptime(env: Env, results: CheckResult[]): Promise<Record<string, number>> {
    const uptimeData: Record<string, number> = {};

    for (const result of results) {
        const key = `uptime:${result.name}`;
        const stored = await env.STATUS_KV.get(key, 'json') as { checks: number; up: number } | null;
        const current = stored || { checks: 0, up: 0 };

        current.checks++;
        if (result.status === 'up') current.up++;

        // Keep rolling 24h window (1440 checks at 1/min)
        if (current.checks > 1440) {
            current.checks = 1440;
            current.up = Math.round(current.up * (1440 / (current.checks + 1)));
        }

        await env.STATUS_KV.put(key, JSON.stringify(current), { expirationTtl: 86400 });
        uptimeData[result.name] = Math.round((current.up / current.checks) * 10000) / 100;
    }

    return uptimeData;
}

// ─── Alerting ────────────────────────────────────────────────────────────────

async function sendAlerts(env: Env, results: CheckResult[]): Promise<void> {
    const downServices = results.filter(r => r.status === 'down');
    if (downServices.length === 0) return;

    // Check if we already alerted recently (cooldown: 5 minutes)
    const lastAlert = await env.STATUS_KV.get('last_alert_time');
    if (lastAlert) {
        const elapsed = Date.now() - parseInt(lastAlert);
        if (elapsed < 5 * 60 * 1000) return; // 5-minute cooldown
    }

    const serviceNames = downServices.map(s => s.name).join(', ');
    const message = `🚨 LunaOS Service Down: ${serviceNames}\n\n` +
        downServices.map(s => `• ${s.name}: ${s.error || `HTTP ${s.statusCode}`} (${s.responseTime}ms)`).join('\n') +
        `\n\nChecked at: ${new Date().toISOString()}` +
        `\nStatus page: https://status.lunaos.ai`;

    // Send email via Resend
    if (env.RESEND_API_KEY && env.ALERT_EMAIL) {
        try {
            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: 'LunaOS Status <status@lunaos.ai>',
                    to: env.ALERT_EMAIL,
                    subject: `🚨 LunaOS Outage: ${serviceNames}`,
                    text: message,
                }),
            });
        } catch (err) {
            console.error('Failed to send email alert:', err);
        }
    }

    // Send webhook
    if (env.ALERT_WEBHOOK) {
        try {
            await fetch(env.ALERT_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'outage',
                    services: downServices.map(s => ({
                        name: s.name,
                        url: s.url,
                        error: s.error || `HTTP ${s.statusCode}`,
                    })),
                    timestamp: new Date().toISOString(),
                }),
            });
        } catch (err) {
            console.error('Failed to send webhook alert:', err);
        }
    }

    await env.STATUS_KV.put('last_alert_time', Date.now().toString());
}

// ─── Status Page HTML ────────────────────────────────────────────────────────

function renderStatusPage(data: StatusData): string {
    const statusColors: Record<string, string> = {
        up: '#10b981',
        degraded: '#f59e0b',
        down: '#ef4444',
    };

    const overallColors: Record<string, string> = {
        operational: '#10b981',
        degraded: '#f59e0b',
        outage: '#ef4444',
    };

    const overallLabels: Record<string, string> = {
        operational: 'All Systems Operational',
        degraded: 'Partial System Degradation',
        outage: 'Major Outage Detected',
    };

    const serviceRows = data.services.map(s => `
        <div class="service-row">
            <div class="service-info">
                <span class="status-dot" style="background: ${statusColors[s.status]}"></span>
                <span class="service-name">${s.name}</span>
            </div>
            <div class="service-meta">
                <span class="response-time">${s.responseTime}ms</span>
                <span class="uptime-badge">${data.uptimePercent[s.name]?.toFixed(2) || '100.00'}%</span>
                <span class="status-label status-${s.status}">${s.status.toUpperCase()}</span>
            </div>
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LunaOS Status</title>
    <meta name="description" content="Real-time status of all LunaOS services. Monitor API, Dashboard, Docs, and more.">
    <meta http-equiv="refresh" content="60">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background: #0a0a1a;
            color: #e0e0e0;
            min-height: 100vh;
        }
        .container { max-width: 720px; margin: 0 auto; padding: 40px 20px; }
        .header {
            text-align: center;
            margin-bottom: 48px;
        }
        .logo {
            font-size: 28px;
            font-weight: 800;
            background: linear-gradient(135deg, #a855f7, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 16px;
        }
        .overall-status {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 12px 24px;
            border-radius: 9999px;
            font-weight: 600;
            font-size: 16px;
            border: 1px solid ${overallColors[data.overall]}33;
            background: ${overallColors[data.overall]}11;
            color: ${overallColors[data.overall]};
        }
        .overall-dot {
            width: 10px; height: 10px;
            border-radius: 50%;
            background: ${overallColors[data.overall]};
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .services {
            background: #111128;
            border-radius: 16px;
            border: 1px solid #1e1e3a;
            overflow: hidden;
        }
        .services-header {
            padding: 16px 24px;
            border-bottom: 1px solid #1e1e3a;
            font-size: 13px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .service-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            border-bottom: 1px solid #1e1e3a0a;
            transition: background 0.2s;
        }
        .service-row:hover { background: #1a1a3a; }
        .service-row:last-child { border-bottom: none; }
        .service-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .status-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .service-name { font-weight: 500; font-size: 15px; }
        .service-meta {
            display: flex;
            align-items: center;
            gap: 16px;
            font-size: 13px;
        }
        .response-time { color: #888; }
        .uptime-badge {
            color: #10b981;
            font-weight: 600;
            font-variant-numeric: tabular-nums;
        }
        .status-label {
            padding: 2px 10px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .status-up { background: #10b98122; color: #10b981; }
        .status-degraded { background: #f59e0b22; color: #f59e0b; }
        .status-down { background: #ef444422; color: #ef4444; }
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #555;
            font-size: 13px;
        }
        .footer a { color: #a855f7; text-decoration: none; }
        .footer a:hover { text-decoration: underline; }
        .last-checked {
            text-align: center;
            margin-top: 16px;
            color: #555;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🌙 LunaOS Status</div>
            <div class="overall-status">
                <span class="overall-dot"></span>
                ${overallLabels[data.overall]}
            </div>
        </div>
        <div class="services">
            <div class="services-header">Services</div>
            ${serviceRows}
        </div>
        <div class="last-checked">
            Last checked: ${new Date(data.checkedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC
            <br>Auto-refreshes every 60 seconds
        </div>
        <div class="footer">
            <a href="https://lunaos.ai">LunaOS</a> · <a href="https://docs.lunaos.ai">Docs</a> · <a href="https://agents.lunaos.ai">Dashboard</a>
        </div>
    </div>
</body>
</html>`;
}

// ─── Worker Entry ────────────────────────────────────────────────────────────

export default {
    // HTTP handler — serves the status page
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // API endpoint for JSON status
        if (url.pathname === '/api/status') {
            const cached = await env.STATUS_KV.get('latest_status', 'json') as StatusData | null;
            if (cached) {
                return new Response(JSON.stringify(cached), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'public, max-age=30',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            }
            return new Response(JSON.stringify({ error: 'No data yet' }), { status: 503 });
        }

        // Health check for the status page itself
        if (url.pathname === '/health') {
            return new Response(JSON.stringify({ status: 'ok', service: 'status-page' }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Serve the HTML status page
        const cached = await env.STATUS_KV.get('latest_status', 'json') as StatusData | null;

        if (!cached) {
            // First run — do a live check
            const results = await runAllChecks();
            const uptimePercent = await updateUptime(env, results);
            const allUp = results.every(r => r.status === 'up');
            const anyDown = results.some(r => r.status === 'down');
            const data: StatusData = {
                overall: anyDown ? 'outage' : allUp ? 'operational' : 'degraded',
                services: results,
                checkedAt: new Date().toISOString(),
                uptimePercent,
            };
            await env.STATUS_KV.put('latest_status', JSON.stringify(data), { expirationTtl: 120 });
            return new Response(renderStatusPage(data), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
        }

        return new Response(renderStatusPage(cached), {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=30',
            },
        });
    },

    // Cron trigger — runs every minute to check services
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        const results = await runAllChecks();
        const uptimePercent = await updateUptime(env, results);

        const allUp = results.every(r => r.status === 'up');
        const anyDown = results.some(r => r.status === 'down');

        const data: StatusData = {
            overall: anyDown ? 'outage' : allUp ? 'operational' : 'degraded',
            services: results,
            checkedAt: new Date().toISOString(),
            uptimePercent,
        };

        // Store latest status
        await env.STATUS_KV.put('latest_status', JSON.stringify(data), { expirationTtl: 120 });

        // Store history (last 100 checks)
        const historyKey = `history:${new Date().toISOString().split('T')[0]}`;
        const history = await env.STATUS_KV.get(historyKey, 'json') as CheckResult[][] | null;
        const checks = history || [];
        checks.push(results);
        if (checks.length > 1440) checks.shift(); // Keep 24h of minutely checks
        await env.STATUS_KV.put(historyKey, JSON.stringify(checks), { expirationTtl: 172800 });

        // Send alerts for down services
        ctx.waitUntil(sendAlerts(env, results));
    },
};
