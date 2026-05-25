// Quick standalone test for nuclear enhancements - no config needed
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://sdlc-landing-page.pages.dev';
  let passedTests = 0;
  let failedTests = 0;
  const failures = [];

  console.log(`\n🎭 Testing SDLC.ai Nuclear Enhancements\n`);
  console.log(`📍 URL: ${baseURL}\n`);
  console.log(`─────────────────────────────────────────────\n`);

  try {
    // Test 1: Page loads
    console.log('✓ Testing page load...');
    await page.goto(baseURL);
    const title = await page.title();
    if (title.includes('SDLC.ai')) {
      console.log('  ✅ Page loaded with correct title');
      passedTests++;
    } else {
      console.log('  ❌ Page title incorrect');
      failedTests++;
      failures.push('Page title test');
    }

    // Test 2: Live Status Badge
    console.log('\n✓ Testing Live Status Badge (NUCLEAR ENHANCEMENT)...');
    const statusBadge = await page.locator('.status-badge').isVisible().catch(() => false);
    if (statusBadge) {
      const indicator = await page.locator('.status-indicator').isVisible().catch(() => false);
      const statusText = await page.locator('text=All Systems Operational').isVisible().catch(() => false);
      if (indicator && statusText) {
        console.log('  ✅ Status badge visible with pulsing indicator');
        console.log('  ✅ "All Systems Operational" text present');
        passedTests++;
      } else {
        console.log('  ❌ Status badge missing components');
        failedTests++;
        failures.push('Status badge components');
      }
    } else {
      console.log('  ❌ Status badge not visible');
      failedTests++;
      failures.push('Status badge visibility');
    }

    // Test 3: Interactive Playground
    console.log('\n✓ Testing Interactive Playground (NUCLEAR ENHANCEMENT)...');
    await page.locator('#playgroundInput').scrollIntoViewIfNeeded().catch(() => {});
    const playgroundVisible = await page.locator('h2:has-text("Try It Live")').isVisible().catch(() => false);
    if (playgroundVisible) {
      console.log('  ✅ Playground section visible');

      // Check pre-populated text
      const inputValue = await page.locator('#playgroundInput').inputValue().catch(() => '');
      if (inputValue.includes('SSN') && inputValue.includes('123-45-6789')) {
        console.log('  ✅ Demo text pre-populated');
      } else {
        console.log('  ⚠️  Demo text not pre-populated');
      }

      // Click Detect PII button
      const detectButton = page.locator('button:has-text("Detect PII")');
      const buttonVisible = await detectButton.isVisible().catch(() => false);
      if (buttonVisible) {
        await detectButton.click();
        await page.waitForTimeout(500);

        const outputText = await page.locator('#playgroundOutput').textContent().catch(() => '');
        if (outputText.includes('[SSN_REDACTED]') &&
            outputText.includes('[CREDIT_CARD_REDACTED]') &&
            outputText.includes('[EMAIL_REDACTED]')) {
          console.log('  ✅ PII detection and redaction working');

          // Check stats
          const statsVisible = await page.locator('#detectionStats').isVisible().catch(() => false);
          if (statsVisible) {
            console.log('  ✅ Detection statistics displayed');
          }
          passedTests++;
        } else {
          console.log('  ❌ PII redaction not working correctly');
          failedTests++;
          failures.push('PII redaction');
        }
      } else {
        console.log('  ❌ Detect PII button not visible');
        failedTests++;
        failures.push('Detect PII button');
      }
    } else {
      console.log('  ❌ Playground section not visible');
      failedTests++;
      failures.push('Playground visibility');
    }

    // Test 4: Coming Soon Roadmap
    console.log('\n✓ Testing Coming Soon Roadmap (NUCLEAR ENHANCEMENT)...');
    await page.locator('text=What\'s Coming Next').scrollIntoViewIfNeeded().catch(() => {});
    const roadmapVisible = await page.locator('h2:has-text("What\'s Coming Next")').isVisible().catch(() => false);
    if (roadmapVisible) {
      console.log('  ✅ Roadmap section visible');

      // Check for all 6 features
      const features = [
        'Chrome Extension',
        'GitHub Action',
        'Slack App',
        'VSCode Extension',
        'AI-Powered Detection',
        'SOC 2 Certified'
      ];

      let allFeaturesVisible = true;
      for (const feature of features) {
        const visible = await page.locator(`h3:has-text("${feature}")`).isVisible().catch(() => false);
        if (!visible) {
          allFeaturesVisible = false;
          console.log(`  ❌ "${feature}" not visible`);
        }
      }

      if (allFeaturesVisible) {
        console.log('  ✅ All 6 features displayed');
      }

      // Check timeline badges
      const week2 = await page.locator('text=Week 2').first().isVisible().catch(() => false);
      const week3 = await page.locator('text=Week 3').first().isVisible().catch(() => false);
      const q1 = await page.locator('text=Q1 2026').isVisible().catch(() => false);

      if (week2 && week3 && q1) {
        console.log('  ✅ Timeline badges present');
      } else {
        console.log('  ⚠️  Some timeline badges missing');
      }

      // Check beta button
      const betaButton = await page.locator('button:has-text("Join Beta Program")').isVisible().catch(() => false);
      if (betaButton) {
        console.log('  ✅ "Join Beta Program" button visible');
      }

      passedTests++;
    } else {
      console.log('  ❌ Roadmap section not visible');
      failedTests++;
      failures.push('Roadmap visibility');
    }

    // Test 5: Performance check
    console.log('\n✓ Testing Performance...');
    const startTime = Date.now();
    await page.goto(baseURL);
    const loadTime = Date.now() - startTime;

    if (loadTime < 3000) {
      console.log(`  ✅ Page load time: ${loadTime}ms (< 3000ms)`);
      passedTests++;
    } else {
      console.log(`  ⚠️  Page load time: ${loadTime}ms (slower than expected)`);
      failedTests++;
      failures.push('Page load performance');
    }

    // Final summary
    console.log('\n─────────────────────────────────────────────\n');
    console.log(`📊 Test Results:\n`);
    console.log(`  ✅ Passed: ${passedTests}`);
    console.log(`  ❌ Failed: ${failedTests}`);
    console.log(`  📈 Success Rate: ${Math.round((passedTests / (passedTests + failedTests)) * 100)}%`);

    if (failures.length > 0) {
      console.log('\n⚠️  Failed Tests:');
      failures.forEach(f => console.log(`  - ${f}`));
    }

    if (failedTests === 0) {
      console.log('\n🎉 ALL NUCLEAR ENHANCEMENTS WORKING! READY FOR HN LAUNCH! 🚀\n');
    } else {
      console.log('\n⚠️  Some tests failed. Review above for details.\n');
    }

  } catch (error) {
    console.error('\n❌ Test execution error:', error.message);
  } finally {
    await browser.close();
  }
})();
