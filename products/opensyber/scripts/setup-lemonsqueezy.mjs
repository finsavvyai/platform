#!/usr/bin/env node

/**
 * OpenSyber + TokenForge — LemonSqueezy Setup Automation
 *
 * Products/variants must be created in the LemonSqueezy dashboard (API is read-only).
 * This script automates everything else:
 *   - Detects products and variants from your store
 *   - Creates webhook endpoints for both APIs
 *   - Creates a 100% test discount coupon
 *   - Outputs all env vars ready for Cloudflare
 *   - Optionally sets Worker secrets via wrangler
 *
 * Usage:
 *   # Load env vars from .env, then run:
 *   source .env && node scripts/setup-lemonsqueezy.mjs setup
 *
 * Commands:
 *   setup      — Full setup (detect products + webhooks + coupon)
 *   products   — Guide for creating products in dashboard + detect IDs
 *   webhooks   — Create webhook endpoints only
 *   coupon     — Create 100% test discount only
 *   status     — Show current store state
 *   env        — Output env vars from saved config
 *   wrangler   — Set Worker secrets via wrangler CLI
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';

const API_KEY = process.env.LEMONSQUEEZY_API_KEY;
const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID;
const BASE_URL = 'https://api.lemonsqueezy.com/v1';
const CONFIG_FILE = new URL('../.lemonsqueezy-config.json', import.meta.url).pathname;

if (!API_KEY || !STORE_ID) {
  console.error('Missing required env vars:');
  console.error('  LEMONSQUEEZY_API_KEY  — from app.lemonsqueezy.com → Settings → API Keys');
  console.error('  LEMONSQUEEZY_STORE_ID — numeric store ID (yours is probably 214097)');
  console.error('\nTip: put them in .env and run: source .env && node scripts/setup-lemonsqueezy.mjs setup');
  process.exit(1);
}

// ─── Readline for interactive prompts ─────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

// ─── API Client ───────────────────────────────────────────────

async function lsApi(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LS API ${method} ${path} → ${res.status}: ${err}`);
  }

  return res.json();
}

// ─── Config Persistence ───────────────────────────────────────

function loadConfig() {
  if (existsSync(CONFIG_FILE)) {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  }
  return { storeId: STORE_ID, products: {}, webhooks: {}, discount: null, createdAt: null };
}

function saveConfig(config) {
  config.updatedAt = new Date().toISOString();
  if (!config.createdAt) config.createdAt = config.updatedAt;
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ─── Store Check ──────────────────────────────────────────────

async function checkStore() {
  console.log('\n--- Store Check ---');
  const res = await lsApi('GET', `/stores/${STORE_ID}`);
  const store = res.data.attributes;
  console.log(`  Store:    ${store.name}`);
  console.log(`  URL:      ${store.url}`);
  console.log(`  Currency: ${store.currency}`);
  console.log(`  Country:  ${store.country_nicename}`);
  return store;
}

// ─── Detect Products & Variants ───────────────────────────────

async function listAllProducts() {
  const res = await lsApi('GET', `/stores/${STORE_ID}/products`);
  return res.data;
}

async function getVariantsForProduct(productId) {
  const res = await lsApi('GET', `/products/${productId}/variants`);
  return res.data;
}

async function detectProducts(config) {
  console.log('\n--- Detecting Products & Variants ---');

  const products = await listAllProducts();

  if (products.length === 0) {
    console.log('\n  No products found in your store!');
    printProductCreationGuide();
    return false;
  }

  console.log(`\n  Found ${products.length} products:\n`);
  for (const p of products) {
    console.log(`  [${p.id}] ${p.attributes.name} (${p.attributes.status})`);
  }

  // Find OpenSyber product
  let opensyberProduct = products.find((p) =>
    p.attributes.name.toLowerCase().includes('opensyber')
  );

  // Find TokenForge product
  let tokenforgeProduct = products.find((p) =>
    p.attributes.name.toLowerCase().includes('tokenforge')
  );

  if (!opensyberProduct || !tokenforgeProduct) {
    console.log('\n  Could not auto-detect OpenSyber and/or TokenForge products.');
    console.log('  Products in store:');
    products.forEach((p, i) => console.log(`    ${i + 1}. [${p.id}] ${p.attributes.name}`));

    if (!opensyberProduct) {
      const idx = await ask('\n  Enter number for OpenSyber product (or 0 to skip): ');
      if (idx !== '0' && products[parseInt(idx) - 1]) {
        opensyberProduct = products[parseInt(idx) - 1];
      }
    }

    if (!tokenforgeProduct) {
      const idx = await ask('  Enter number for TokenForge product (or 0 to skip): ');
      if (idx !== '0' && products[parseInt(idx) - 1]) {
        tokenforgeProduct = products[parseInt(idx) - 1];
      }
    }
  }

  // Get variants for OpenSyber
  if (opensyberProduct) {
    console.log(`\n  OpenSyber product: ${opensyberProduct.attributes.name} (ID: ${opensyberProduct.id})`);
    const variants = await getVariantsForProduct(opensyberProduct.id);
    console.log(`  Variants:`);

    const osVariants = {};
    for (const v of variants) {
      const name = v.attributes.name.toLowerCase();
      const price = v.attributes.price;
      console.log(`    [${v.id}] ${v.attributes.name} — $${(price / 100).toFixed(0)}/${v.attributes.interval || 'once'}`);

      if (name.includes('personal')) osVariants.personal = v.id;
      else if (name.includes('pro')) osVariants.pro = v.id;
      else if (name.includes('team')) osVariants.team = v.id;
    }

    // Interactive mapping if auto-detect fails
    if (!osVariants.personal || !osVariants.pro || !osVariants.team) {
      console.log('\n  Could not auto-map all variants. Manual mapping:');
      const vList = variants.map((v) => `${v.id}: ${v.attributes.name} ($${(v.attributes.price / 100).toFixed(0)})`);
      console.log('  Available:', vList.join(', '));

      if (!osVariants.personal) {
        osVariants.personal = (await ask('  Personal variant ID: ')).trim();
      }
      if (!osVariants.pro) {
        osVariants.pro = (await ask('  Pro variant ID: ')).trim();
      }
      if (!osVariants.team) {
        osVariants.team = (await ask('  Team variant ID: ')).trim();
      }
    }

    config.products.opensyber = { productId: opensyberProduct.id, variants: osVariants };
    console.log(`  Mapped: Personal=${osVariants.personal}, Pro=${osVariants.pro}, Team=${osVariants.team}`);
  }

  // Get variants for TokenForge
  if (tokenforgeProduct) {
    console.log(`\n  TokenForge product: ${tokenforgeProduct.attributes.name} (ID: ${tokenforgeProduct.id})`);
    const variants = await getVariantsForProduct(tokenforgeProduct.id);
    console.log(`  Variants:`);

    const tfVariants = {};
    for (const v of variants) {
      const name = v.attributes.name.toLowerCase();
      const price = v.attributes.price;
      console.log(`    [${v.id}] ${v.attributes.name} — $${(price / 100).toFixed(0)}/${v.attributes.interval || 'once'}`);

      if (name.includes('pro')) tfVariants.pro = v.id;
      else if (name.includes('team')) tfVariants.team = v.id;
      else if (name.includes('enterprise')) tfVariants.enterprise = v.id;
    }

    if (!tfVariants.pro || !tfVariants.team || !tfVariants.enterprise) {
      console.log('\n  Could not auto-map all variants. Manual mapping:');
      const vList = variants.map((v) => `${v.id}: ${v.attributes.name} ($${(v.attributes.price / 100).toFixed(0)})`);
      console.log('  Available:', vList.join(', '));

      if (!tfVariants.pro) tfVariants.pro = (await ask('  Pro variant ID: ')).trim();
      if (!tfVariants.team) tfVariants.team = (await ask('  Team variant ID: ')).trim();
      if (!tfVariants.enterprise) tfVariants.enterprise = (await ask('  Enterprise variant ID: ')).trim();
    }

    config.products.tokenforge = { productId: tokenforgeProduct.id, variants: tfVariants };
    console.log(`  Mapped: Pro=${tfVariants.pro}, Team=${tfVariants.team}, Enterprise=${tfVariants.enterprise}`);
  }

  saveConfig(config);
  return !!(config.products.opensyber && config.products.tokenforge);
}

function printProductCreationGuide() {
  console.log(`
${'='.repeat(60)}
  CREATE PRODUCTS IN LEMONSQUEEZY DASHBOARD
${'='.repeat(60)}

Go to: https://app.lemonsqueezy.com/products

PRODUCT 1: "OpenSyber"
  Create product → Name: "OpenSyber", Status: Published
  Add 3 variants:
    1. "OpenSyber Personal"  — $49/month  (subscription, monthly)
    2. "OpenSyber Pro"       — $149/month (subscription, monthly)
    3. "OpenSyber Team"      — $399/month (subscription, monthly)

PRODUCT 2: "TokenForge"
  Create product → Name: "TokenForge", Status: Published
  Add 3 variants:
    1. "TokenForge Pro"        — $49/month  (subscription, monthly)
    2. "TokenForge Team"       — $199/month (subscription, monthly)
    3. "TokenForge Enterprise" — $999/month (subscription, monthly)

After creating both products, run this script again:
  source .env && node scripts/setup-lemonsqueezy.mjs setup

The script will auto-detect your products and variant IDs.
${'='.repeat(60)}
`);
}

// ─── Create Webhooks ──────────────────────────────────────────

async function setupWebhooks(config) {
  console.log('\n--- Setting Up Webhooks ---');

  const webhookSecret = config.webhooks.secret || randomBytes(32).toString('hex');
  config.webhooks.secret = webhookSecret;

  const events = [
    'subscription_created',
    'subscription_updated',
    'subscription_cancelled',
    'subscription_expired',
    'subscription_payment_success',
    'subscription_payment_failed',
  ];

  const endpoints = [
    { name: 'opensyber-api', url: 'https://api.opensyber.cloud/webhooks/lemonsqueezy' },
    { name: 'tokenforge-api', url: 'https://tokenforge-api.opensyber.cloud/webhooks/lemonsqueezy' },
  ];

  for (const ep of endpoints) {
    try {
      const res = await lsApi('POST', '/webhooks', {
        data: {
          type: 'webhooks',
          attributes: {
            url: ep.url,
            events,
            secret: webhookSecret,
          },
          relationships: {
            store: { data: { type: 'stores', id: STORE_ID } },
          },
        },
      });

      const webhookId = res.data.id;
      config.webhooks[ep.name] = { id: webhookId, url: ep.url };
      console.log(`  Created: ${ep.name} → ${ep.url} (ID: ${webhookId})`);
    } catch (err) {
      if (err.message.includes('422') || err.message.includes('already')) {
        console.log(`  Skipped: ${ep.name} — webhook may already exist for ${ep.url}`);
      } else {
        console.error(`  FAILED: ${ep.name} — ${err.message}`);
      }
    }
  }

  console.log(`\n  Webhook secret: ${webhookSecret.slice(0, 8)}...${webhookSecret.slice(-4)}`);
  console.log('  (saved to .lemonsqueezy-config.json)');
  saveConfig(config);
}

// ─── Create 100% Test Discount ────────────────────────────────

async function setupCoupon(config) {
  console.log('\n--- Creating Test Coupon (100% off) ---');

  const code = 'OPENSYBER_TEST_100';

  try {
    const res = await lsApi('POST', '/discounts', {
      data: {
        type: 'discounts',
        attributes: {
          name: 'OpenSyber Test — 100% Off',
          code,
          amount: 100,
          amount_type: 'percent',
          is_limited_to_products: false,
          max_redemptions: 50,
          starts_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          duration: 'forever',
        },
        relationships: {
          store: { data: { type: 'stores', id: STORE_ID } },
        },
      },
    });

    const discountId = res.data.id;
    config.discount = { id: discountId, code, maxRedemptions: 50 };
    console.log(`  Created: ${code} — 100% off, 50 uses, 90-day expiry (ID: ${discountId})`);
    saveConfig(config);
  } catch (err) {
    if (err.message.includes('422')) {
      console.log(`  Coupon "${code}" may already exist. Check dashboard.`);
      config.discount = { code, note: 'possibly pre-existing' };
      saveConfig(config);
    } else {
      console.error(`  FAILED: ${err.message}`);
      console.error('  Create manually: Dashboard → Discounts → New → 100% off, code: OPENSYBER_TEST_100');
    }
  }
}

// ─── Show Status ──────────────────────────────────────────────

async function showStatus() {
  await checkStore();

  console.log('\n--- Products ---');
  const products = await listAllProducts();
  for (const p of products) {
    console.log(`  [${p.id}] ${p.attributes.name} (${p.attributes.status})`);
    const variants = await getVariantsForProduct(p.id);
    for (const v of variants) {
      console.log(`    [${v.id}] ${v.attributes.name} — $${(v.attributes.price / 100).toFixed(0)}/${v.attributes.interval || 'once'}`);
    }
  }

  console.log('\n--- Webhooks ---');
  try {
    const whRes = await lsApi('GET', `/stores/${STORE_ID}/webhooks`);
    if (whRes.data.length === 0) console.log('  None configured');
    for (const wh of whRes.data) {
      console.log(`  [${wh.id}] ${wh.attributes.url}`);
    }
  } catch {
    console.log('  Could not fetch webhooks');
  }

  console.log('\n--- Discounts ---');
  try {
    const dcRes = await lsApi('GET', `/stores/${STORE_ID}/discounts`);
    if (dcRes.data.length === 0) console.log('  None created');
    for (const dc of dcRes.data) {
      console.log(`  [${dc.id}] ${dc.attributes.code} — ${dc.attributes.amount}% off (${dc.attributes.status})`);
    }
  } catch {
    console.log('  Could not fetch discounts');
  }

  const config = loadConfig();
  if (config.products.opensyber || config.products.tokenforge) {
    console.log('\n--- Saved Config ---');
    console.log(JSON.stringify(config.products, null, 2));
  }
}

// ─── Output Env Vars ──────────────────────────────────────────

function outputEnvVars() {
  const config = loadConfig();

  if (!config.products.opensyber && !config.products.tokenforge) {
    console.error('\nNo saved config. Run `setup` first to detect products.');
    process.exit(1);
  }

  const os = config.products.opensyber;
  const tf = config.products.tokenforge;
  const secret = config.webhooks.secret || '<run webhooks command first>';
  const coupon = config.discount?.code || '';

  console.log(`
${'='.repeat(60)}
  ENVIRONMENT VARIABLES — Copy to Cloudflare
${'='.repeat(60)}
`);

  if (os) {
    console.log(`--- OpenSyber Web (apps/web — Cloudflare Pages) ---
NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID=finsavvy
NEXT_PUBLIC_OPENSYBER_LS_VARIANT_PERSONAL=${os.variants.personal}
NEXT_PUBLIC_OPENSYBER_LS_VARIANT_PRO=${os.variants.pro}
NEXT_PUBLIC_OPENSYBER_LS_VARIANT_TEAM=${os.variants.team}
${coupon ? `NEXT_PUBLIC_LS_TEST_COUPON=${coupon}` : '# NEXT_PUBLIC_LS_TEST_COUPON= (run coupon command)'}

--- OpenSyber API (apps/api — Cloudflare Worker) ---
LEMONSQUEEZY_API_KEY=<your-full-api-key>
LEMONSQUEEZY_WEBHOOK_SECRET=${secret}
OPENSYBER_LS_PRODUCT_ID=${os.productId}
OPENSYBER_LS_VARIANT_PERSONAL=${os.variants.personal}
OPENSYBER_LS_VARIANT_PRO=${os.variants.pro}
OPENSYBER_LS_VARIANT_TEAM=${os.variants.team}
`);
  }

  if (tf) {
    console.log(`--- TokenForge Web (apps/tokenforge-web — Cloudflare Pages) ---
${coupon ? `NEXT_PUBLIC_LS_TEST_COUPON=${coupon}` : '# NEXT_PUBLIC_LS_TEST_COUPON= (run coupon command)'}

--- TokenForge API (apps/tokenforge-api — Cloudflare Worker) ---
LEMONSQUEEZY_API_KEY=<your-full-api-key>
LEMONSQUEEZY_WEBHOOK_SECRET=${secret}
TF_LS_PRODUCT_ID=${tf.productId}
TF_LS_VARIANT_PRO=${tf.variants.pro}
TF_LS_VARIANT_TEAM=${tf.variants.team}
TF_LS_VARIANT_ENTERPRISE=${tf.variants.enterprise}
`);
  }

  console.log(`${'='.repeat(60)}
Next steps:
  1. Set NEXT_PUBLIC_* vars in Cloudflare Pages dashboard (build-time)
  2. Run: source .env && node scripts/setup-lemonsqueezy.mjs wrangler
  3. Redeploy: pnpm deploy (all apps)
${'='.repeat(60)}
`);
}

// ─── Set Secrets via Wrangler ─────────────────────────────────

async function setWranglerSecrets() {
  const config = loadConfig();
  if (!config.products.opensyber) {
    console.error('No saved config. Run `setup` first.');
    process.exit(1);
  }

  const { execSync } = await import('node:child_process');
  const os = config.products.opensyber;
  const tf = config.products.tokenforge;
  const secret = config.webhooks.secret;

  const root = new URL('..', import.meta.url).pathname;

  const setSecret = (dir, name, value) => {
    try {
      execSync(`echo "${value}" | npx wrangler secret put ${name}`, {
        cwd: dir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      console.log(`  SET ${name}`);
    } catch (err) {
      console.error(`  FAIL ${name}: ${err.stderr?.toString().trim() || err.message}`);
    }
  };

  if (os) {
    const apiDir = `${root}apps/api`;
    console.log('\n--- Setting OpenSyber API Secrets ---');
    setSecret(apiDir, 'LEMONSQUEEZY_API_KEY', API_KEY);
    setSecret(apiDir, 'LEMONSQUEEZY_WEBHOOK_SECRET', secret);
    setSecret(apiDir, 'OPENSYBER_LS_PRODUCT_ID', os.productId);
    setSecret(apiDir, 'OPENSYBER_LS_VARIANT_PERSONAL', os.variants.personal);
    setSecret(apiDir, 'OPENSYBER_LS_VARIANT_PRO', os.variants.pro);
    setSecret(apiDir, 'OPENSYBER_LS_VARIANT_TEAM', os.variants.team);
  }

  if (tf) {
    const tfApiDir = `${root}apps/tokenforge-api`;
    console.log('\n--- Setting TokenForge API Secrets ---');
    setSecret(tfApiDir, 'LEMONSQUEEZY_API_KEY', API_KEY);
    setSecret(tfApiDir, 'LEMONSQUEEZY_WEBHOOK_SECRET', secret);
    setSecret(tfApiDir, 'TF_LS_PRODUCT_ID', tf.productId);
    setSecret(tfApiDir, 'TF_LS_VARIANT_PRO', tf.variants.pro);
    setSecret(tfApiDir, 'TF_LS_VARIANT_TEAM', tf.variants.team);
    setSecret(tfApiDir, 'TF_LS_VARIANT_ENTERPRISE', tf.variants.enterprise);
  }

  const coupon = config.discount?.code;
  console.log(`
NOTE: NEXT_PUBLIC_* vars must be set in Cloudflare Pages dashboard
(they are build-time, not runtime secrets).

Set in Cloudflare Pages → Settings → Environment Variables → Production:

  OpenSyber Web:
    NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID=finsavvy
    NEXT_PUBLIC_OPENSYBER_LS_VARIANT_PERSONAL=${os?.variants.personal || '?'}
    NEXT_PUBLIC_OPENSYBER_LS_VARIANT_PRO=${os?.variants.pro || '?'}
    NEXT_PUBLIC_OPENSYBER_LS_VARIANT_TEAM=${os?.variants.team || '?'}
    ${coupon ? `NEXT_PUBLIC_LS_TEST_COUPON=${coupon}` : ''}

  TokenForge Web:
    ${coupon ? `NEXT_PUBLIC_LS_TEST_COUPON=${coupon}` : ''}
`);
}

// ─── CLI ──────────────────────────────────────────────────────

const command = process.argv[2];

if (!command) {
  console.log(`
OpenSyber + TokenForge — LemonSqueezy Setup

Usage: source .env && node scripts/setup-lemonsqueezy.mjs <command>

Commands:
  setup      Full setup: detect products + create webhooks + test coupon
  products   Guide for dashboard product creation + detect variant IDs
  webhooks   Create webhook endpoints for both APIs
  coupon     Create 100% test discount coupon
  status     Show all products, webhooks, discounts in store
  env        Output all env vars from saved config
  wrangler   Set Worker secrets via wrangler CLI

Your .env needs:
  LEMONSQUEEZY_API_KEY=xxx
  LEMONSQUEEZY_STORE_ID=214097
`);
  process.exit(0);
}

try {
  const config = loadConfig();

  switch (command) {
    case 'setup': {
      await checkStore();
      const found = await detectProducts(config);
      if (!found) {
        console.log('\nCreate products in the dashboard first, then re-run this command.');
        rl.close();
        process.exit(0);
      }
      await setupWebhooks(config);
      await setupCoupon(config);
      rl.close();
      console.log('\n--- Setup Complete ---');
      outputEnvVars();
      break;
    }
    case 'products': {
      await checkStore();
      const found = await detectProducts(config);
      rl.close();
      if (found) outputEnvVars();
      else printProductCreationGuide();
      break;
    }
    case 'webhooks':
      await setupWebhooks(config);
      rl.close();
      outputEnvVars();
      break;
    case 'coupon':
      await setupCoupon(config);
      rl.close();
      outputEnvVars();
      break;
    case 'status':
      await showStatus();
      rl.close();
      break;
    case 'env':
      outputEnvVars();
      rl.close();
      break;
    case 'wrangler':
      await setWranglerSecrets();
      rl.close();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      rl.close();
      process.exit(1);
  }
} catch (err) {
  console.error(`\nFailed: ${err.message}`);
  rl.close();
  process.exit(1);
}
