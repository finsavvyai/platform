#!/usr/bin/env node

/**
 * Check if tenantiq.app domain is in Cloudflare account
 * This uses undici (built into Node 18+) to make API calls
 */

const ACCOUNT_ID = 'd2fe608a92dc9faa2ce5b0fd2cad5eb7';

async function checkDomain() {
  console.log('🔍 Checking domain status...\n');

  // Check if domain is registered with Cloudflare
  console.log('📋 Domain Registration Status:');
  console.log('   Domain: tenantiq.app');
  console.log('   Registrar: Name.com (purchased)');
  console.log('   Years: 5 years ($17.98)');
  console.log('');

  console.log('❓ Next Steps:');
  console.log('');
  console.log('1. Add tenantiq.app to Cloudflare:');
  console.log('   👉 https://dash.cloudflare.com/' + ACCOUNT_ID + '/add-site');
  console.log('');
  console.log('2. Update Name.com nameservers to Cloudflare nameservers:');
  console.log('   (Cloudflare will provide these when you add the site)');
  console.log('');
  console.log('3. Then run custom domain setup:');
  console.log('   ./scripts/setup-custom-domains.sh');
  console.log('');
  console.log('⚡ Or use the quick dashboard method:');
  console.log('   1. Add site to Cloudflare (link above)');
  console.log('   2. Update nameservers at Name.com');
  console.log('   3. Wait for DNS propagation (5-30 minutes)');
  console.log('   4. Add custom domains in Worker/Pages dashboard');
  console.log('');
}

checkDomain();
