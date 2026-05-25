/** Single source of truth for the gateway version string.
 *
 * Read from package.json at build time would require bundler config; for a
 * Worker we keep this synced manually with package.json. The static audit
 * test enforces parity.
 */

export const GATEWAY_VERSION = '1.1.0';
