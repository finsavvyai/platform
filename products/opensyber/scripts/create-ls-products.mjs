#!/usr/bin/env node

/**
 * Create OpenSyber + TokenForge products in LemonSqueezy via Playwright
 *
 * The LemonSqueezy API doesn't support POST /products, so we automate the dashboard.
 * The browser opens, you log in manually, then the script creates everything.
 *
 * Usage:
 *   npx playwright install chromium   # first time only
 *   node scripts/create-ls-products.mjs
 */

import { chromium } from 'playwright';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';

const CONFIG_FILE = new URL('../.lemonsqueezy-config.json', import.meta.url).pathname;
const LS_BASE = 'https://app.lemonsqueezy.com';
const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID || '214097';

const PRODUCTS = [
  {
    name: 'OpenSyber',
    description: 'Secure AI agent hosting platform — deploy, monitor, and protect AI agents with real-time security.',
    variants: [
      { name: 'OpenSyber Personal', price: '49', interval: 'monthly' },
      { name: 'OpenSyber Pro', price: '149', interval: 'monthly' },
      { name: 'OpenSyber Team', price: '399', interval: 'monthly' },
    ],
  },
  {
    name: 'TokenForge',
    description: 'Device-bound session security — cryptographic request signing, trust scoring, and session hijack prevention.',
    variants: [
      { name: 'TokenForge Pro', price: '49', interval: 'monthly' },
      { name: 'TokenForge Team', price: '199', interval: 'monthly' },
      { name: 'TokenForge Enterprise', price: '999', interval: 'monthly' },
    ],
  },
];

function loadConfig() {
  if (existsSync(CONFIG_FILE)) {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  }
  return { storeId: STORE_ID, products: {}, webhooks: {}, discount: null };
}

function saveConfig(config) {
  config.updatedAt = new Date().toISOString();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

async function waitForLogin(page) {
  console.log('\n  Waiting for you to log in to LemonSqueezy...');
  console.log('  (the browser window is open — sign in manually)\n');

  // Wait until we're on a dashboard page (not login)
  await page.waitForURL('**/dashboard/**', { timeout: 300_000 });
  console.log('  Logged in successfully!\n');
  // Small pause to let dashboard fully load
  await page.waitForTimeout(2000);
}

async function createProduct(page, product) {
  console.log(`--- Creating product: ${product.name} ---`);

  // Navigate to new product page
  await page.goto(`${LS_BASE}/products/new`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Fill product name
  const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
  await nameInput.waitFor({ state: 'visible', timeout: 10000 });
  await nameInput.fill(product.name);
  console.log(`  Name: ${product.name}`);

  // Fill description if field exists
  try {
    const descField = page.locator('textarea[name="description"], [data-placeholder*="description" i], .ProseMirror, textarea').first();
    await descField.waitFor({ state: 'visible', timeout: 3000 });
    await descField.fill(product.description);
    console.log(`  Description: set`);
  } catch {
    console.log(`  Description: field not found, skipping`);
  }

  // Select "Subscription" pricing type if there's a choice
  try {
    const subscriptionOption = page.locator('text=Subscription').first();
    if (await subscriptionOption.isVisible({ timeout: 2000 })) {
      await subscriptionOption.click();
      console.log(`  Type: Subscription selected`);
      await page.waitForTimeout(500);
    }
  } catch {
    // May not have this selector
  }

  // Set price for default variant
  try {
    const priceInput = page.locator('input[name="price"], input[placeholder*="price" i], input[type="number"]').first();
    if (await priceInput.isVisible({ timeout: 2000 })) {
      await priceInput.fill(product.variants[0].price);
      console.log(`  Default price: $${product.variants[0].price}`);
    }
  } catch {
    // Price might be set per-variant
  }

  // Save/publish the product
  const saveBtn = page.locator('button:has-text("Save"), button:has-text("Publish"), button:has-text("Create")').first();
  await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
  await saveBtn.click();
  console.log(`  Saving product...`);

  // Wait for redirect to product page
  await page.waitForURL('**/products/**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Extract product ID from URL
  const productUrl = page.url();
  const productIdMatch = productUrl.match(/products\/(\d+)/);
  const productId = productIdMatch ? productIdMatch[1] : null;
  console.log(`  Product created! ID: ${productId || 'unknown'} URL: ${productUrl}`);

  return productId;
}

async function createVariant(page, productId, variant, isFirst) {
  console.log(`  Creating variant: ${variant.name} — $${variant.price}/mo`);

  if (isFirst) {
    // Edit the default variant instead of creating new
    try {
      const editBtn = page.locator('a:has-text("Edit"), button:has-text("Edit")').first();
      if (await editBtn.isVisible({ timeout: 3000 })) {
        await editBtn.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
      }
    } catch {
      // Navigate directly
      await page.goto(`${LS_BASE}/products/${productId}/variants`);
      await page.waitForLoadState('networkidle');
    }
  } else {
    // Click "Add variant" button
    try {
      const addBtn = page.locator('a:has-text("Add variant"), button:has-text("Add variant"), a:has-text("New variant")').first();
      await addBtn.waitFor({ state: 'visible', timeout: 5000 });
      await addBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    } catch (err) {
      console.log(`    Could not find "Add variant" button: ${err.message}`);
      return null;
    }
  }

  // Fill variant name
  try {
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.clear();
    await nameInput.fill(variant.name);
  } catch {
    console.log(`    Name field not found`);
  }

  // Fill price
  try {
    const priceInput = page.locator('input[name="price"], input[placeholder*="price" i]').first();
    await priceInput.waitFor({ state: 'visible', timeout: 3000 });
    await priceInput.clear();
    await priceInput.fill(variant.price);
  } catch {
    console.log(`    Price field not found`);
  }

  // Select monthly billing interval
  try {
    const monthlyOption = page.locator('select option[value="month"], text=Monthly, label:has-text("Monthly")').first();
    if (await monthlyOption.isVisible({ timeout: 2000 })) {
      await monthlyOption.click();
    }
  } catch {
    // May already be set
  }

  // Enable subscription if toggle exists
  try {
    const subToggle = page.locator('text=Subscription, input[name*="subscription"]').first();
    if (await subToggle.isVisible({ timeout: 1000 })) {
      await subToggle.click();
    }
  } catch {
    // May not exist
  }

  // Save variant
  const saveBtn = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Update")').first();
  await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
  await saveBtn.click();
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle');

  // Try to get variant ID from URL
  const variantUrl = page.url();
  const variantIdMatch = variantUrl.match(/variants\/(\d+)/);
  const variantId = variantIdMatch ? variantIdMatch[1] : null;

  console.log(`    Variant saved! ID: ${variantId || 'will detect later'}`);
  return variantId;
}

async function main() {
  console.log('='.repeat(50));
  console.log('  LemonSqueezy Product Creator (Playwright)');
  console.log('='.repeat(50));
  console.log(`\n  Will create ${PRODUCTS.length} products with ${PRODUCTS.reduce((a, p) => a + p.variants.length, 0)} total variants.`);
  console.log('  A browser will open — log in to LemonSqueezy manually.\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  try {
    // Navigate to LemonSqueezy login
    await page.goto(`${LS_BASE}/login`);
    await waitForLogin(page);

    const config = loadConfig();
    const createdProducts = {};

    for (const product of PRODUCTS) {
      const key = product.name.toLowerCase().replace(/\s+/g, '');

      // Create the product
      const productId = await createProduct(page, product);

      if (!productId) {
        console.log(`  WARNING: Could not get product ID for ${product.name}`);
        console.log(`  You may need to map it manually later with: node scripts/setup-lemonsqueezy.mjs products`);
        continue;
      }

      // Navigate to product's variant page
      await page.goto(`${LS_BASE}/products/${productId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const variants = {};

      // Create variants
      for (let i = 0; i < product.variants.length; i++) {
        const variant = product.variants[i];
        const variantId = await createVariant(page, productId, variant, i === 0);
        const planKey = variant.name.split(' ').pop().toLowerCase();
        if (variantId) variants[planKey] = variantId;

        // Go back to product page for next variant
        if (i < product.variants.length - 1) {
          await page.goto(`${LS_BASE}/products/${productId}`);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);
        }
      }

      createdProducts[key] = { productId, variants };
      console.log(`\n  ${product.name} done! Product: ${productId}, Variants: ${JSON.stringify(variants)}\n`);
    }

    // Save to config
    if (createdProducts.opensyber) config.products.opensyber = createdProducts.opensyber;
    if (createdProducts.tokenforge) config.products.tokenforge = createdProducts.tokenforge;
    saveConfig(config);

    console.log('='.repeat(50));
    console.log('  Products created! Config saved.');
    console.log('='.repeat(50));
    console.log('\nNext steps:');
    console.log('  1. Verify products in LemonSqueezy dashboard');
    console.log('  2. Run: source .env && node scripts/setup-lemonsqueezy.mjs setup');
    console.log('     (to detect IDs, create webhooks, coupon, and output env vars)');
    console.log('');

    // Keep browser open for manual verification
    console.log('Browser staying open for 30 seconds so you can verify...');
    await page.waitForTimeout(30000);

  } catch (err) {
    console.error(`\nError: ${err.message}`);
    console.log('\nThe browser will stay open. You can:');
    console.log('  1. Create the products manually in the open browser');
    console.log('  2. Then run: source .env && node scripts/setup-lemonsqueezy.mjs products');
    console.log('     (to auto-detect the product/variant IDs)\n');

    // Take screenshot for debugging
    await page.screenshot({ path: '/tmp/ls-error.png' });
    console.log('Screenshot saved to /tmp/ls-error.png');

    // Keep browser open for manual completion
    await page.waitForTimeout(120000);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
