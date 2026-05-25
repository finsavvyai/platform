import { loadConfig } from './config.js';
import { ApiClient } from './lib/api-client.js';
import { HealthMonitor } from './monitors/health.js';
import { SecurityMonitor } from './monitors/security.js';
import { FilesystemMonitor } from './monitors/filesystem.js';
import { NetworkMonitor } from './monitors/network.js';
import { Firewall } from './security/firewall.js';
import { ShellAuditor } from './security/shell-audit.js';
import { SkillInstaller } from './skills/installer.js';
import { connectTailscale, isTailscaleInstalled, resolveApiUrl } from './services/tailscale.js';
import { isLlamafileAvailable } from './services/llamafile.js';

const AGENT_VERSION = '0.2.0';

async function main() {
  console.log(`[OpenSyber Agent] v${AGENT_VERSION} starting...`);

  const config = loadConfig();
  console.log(`[OpenSyber Agent] Instance: ${config.instanceId}`);
  console.log(`[OpenSyber Agent] API: ${config.apiBaseUrl}`);

  // Tailscale mesh networking (optional — graceful degradation)
  if (process.env.TAILSCALE_AUTHKEY && await isTailscaleInstalled()) {
    const tsStatus = await connectTailscale({
      authKey: process.env.TAILSCALE_AUTHKEY,
      tailnet: process.env.TAILSCALE_TAILNET ?? '',
      instanceId: config.instanceId,
      apiBaseUrl: config.apiBaseUrl,
    });
    if (tsStatus.connected) {
      const tsApiUrl = resolveApiUrl(config.apiBaseUrl, tsStatus, process.env.TAILSCALE_API_HOST);
      console.log(`[OpenSyber Agent] Tailscale: ${tsStatus.magicDns} → API: ${tsApiUrl}`);
    }
  }

  // llamafile local AI (optional — offline fallback)
  if (await isLlamafileAvailable()) {
    console.log('[OpenSyber Agent] llamafile detected — offline AI triage available');
  }

  const api = new ApiClient(config);
  const skillInstaller = new SkillInstaller(config, api);
  await skillInstaller.ensureSkillsDir();

  // Initialize monitors
  const healthMonitor = new HealthMonitor(config, api, skillInstaller);
  const securityMonitor = new SecurityMonitor(config, api);
  const filesystemMonitor = new FilesystemMonitor(config, api);
  const networkMonitor = new NetworkMonitor(config, api);
  const shellAuditor = new ShellAuditor(api, config.instanceId);
  const firewall = new Firewall(config.apiBaseUrl);

  // Start all monitors
  healthMonitor.start();
  securityMonitor.start();
  await filesystemMonitor.start();
  networkMonitor.start();
  shellAuditor.start();

  // Apply default network policy — allow API + DNS only
  try {
    await firewall.applyNetworkPolicy({
      allowedDomains: [],
      blockedDomains: [],
      allowApiOutbound: true,
    });
  } catch (err) {
    console.warn('[OpenSyber Agent] Firewall not available:', err);
  }

  // Initial skill scan
  try {
    const verifiedSlugs = await api.getVerifiedSkills();
    console.log(`[OpenSyber Agent] Loaded ${verifiedSlugs.length} verified skills`);
    await securityMonitor.scanSkills(verifiedSlugs);
  } catch (error) {
    console.error('[OpenSyber Agent] Failed to load verified skills:', error);
  }

  // Periodic skill re-scan every 5 minutes
  setInterval(async () => {
    try {
      const verifiedSlugs = await api.getVerifiedSkills();
      await securityMonitor.scanSkills(verifiedSlugs);
    } catch (error) {
      console.error('[OpenSyber Agent] Skill re-scan failed:', error);
    }
  }, 5 * 60 * 1000);

  // Graceful shutdown
  const shutdown = () => {
    console.log('[OpenSyber Agent] Shutting down...');
    healthMonitor.stop();
    securityMonitor.stop();
    filesystemMonitor.stop();
    networkMonitor.stop();
    shellAuditor.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('[OpenSyber Agent] Running. Press Ctrl+C to stop.');
}

main().catch((error) => {
  console.error('[OpenSyber Agent] Fatal error:', error);
  process.exit(1);
});
