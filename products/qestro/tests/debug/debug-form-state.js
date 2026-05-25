/**
 * Debug Form State Script
 * Tests the actual form validation state on the production site
 */

const puppeteer = require('puppeteer');

async function debugFormState() {
  console.log('🔍 Debugging Form Validation State');
  console.log('=================================');

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    // Enable console logging
    page.on('console', (msg) => {
      console.log(`📱 Browser: ${msg.text()}`);
    });

    // Log any errors
    page.on('pageerror', (error) => {
      console.log(`❌ Page Error: ${error.message}`);
    });

    console.log('\n📱 Navigating to login page...');
    await page.goto('https://qestro.app/login', { waitUntil: 'networkidle2' });

    // Wait for page to load completely
    await page.waitForTimeout(2000);

    console.log('\n🔍 Checking form elements...');

    // Check if elements are present
    const emailInput = await page.$('input[type="email"]');
    const passwordInput = await page.$('input[type="password"]');
    const submitButton = await page.$('button[type="submit"]');

    if (!emailInput || !passwordInput || !submitButton) {
      console.log('❌ Form elements not found');
      return;
    }

    console.log('✅ All form elements found');

    // Check initial button state
    const initialButtonDisabled = await page.evaluate((button) => {
      return button.disabled;
    }, submitButton);

    console.log(`\n🔘 Initial button state:`);
    console.log(`   Disabled: ${initialButtonDisabled}`);

    // Get initial button text
    const initialButtonText = await page.evaluate((button) => {
      return button.textContent?.trim();
    }, submitButton);

    console.log(`   Text: "${initialButtonText}"`);

    // Check for validation errors initially
    const initialEmailError = await page.evaluate(() => {
      const errorElement = document.querySelector('[data-testid="email"] + ~ .text-error-600');
      return errorElement ? errorElement.textContent?.trim() : null;
    });

    const initialPasswordError = await page.evaluate(() => {
      const errorElement = document.querySelector('[data-testid="password"] + ~ .text-error-600');
      return errorElement ? errorElement.textContent?.trim() : null;
    });

    console.log(`\n❌ Initial validation errors:`);
    console.log(`   Email error: ${initialEmailError || 'None'}`);
    console.log(`   Password error: ${initialPasswordError || 'None'}`);

    // Fill in the form step by step
    console.log('\n📝 Filling in the form...');

    // Fill email
    console.log('   📧 Filling email: test@questro.io');
    await page.type('input[type="email"]', 'test@questro.io');
    await page.waitForTimeout(500);

    // Check email validation after filling
    const emailAfterFill = await page.evaluate(() => {
      return document.querySelector('input[type="email"]').value;
    });

    const emailErrorAfterFill = await page.evaluate(() => {
      const errorElement = document.querySelector('input[type="email"]')?.nextElementSibling;
      return errorElement && errorElement.classList.contains('text-error-600')
        ? errorElement.textContent?.trim()
        : null;
    });

    console.log(`   Email value: "${emailAfterFill}"`);
    console.log(`   Email error: ${emailErrorAfterFill || 'None'}`);

    // Fill password
    console.log('   🔒 Filling password: testpassword123');
    await page.type('input[type="password"]', 'testpassword123');
    await page.waitForTimeout(500);

    // Check password validation after filling
    const passwordAfterFill = await page.evaluate(() => {
      return document.querySelector('input[type="password"]').value;
    });

    const passwordErrorAfterFill = await page.evaluate(() => {
      const errorElement = document.querySelector('input[type="password"]')?.nextElementSibling;
      return errorElement && errorElement.classList.contains('text-error-600')
        ? errorElement.textContent?.trim()
        : null;
    });

    console.log(`   Password value: "${passwordAfterFill}"`);
    console.log(`   Password error: ${passwordErrorAfterFill || 'None'}`);

    // Check button state after filling form
    const buttonDisabledAfterFill = await page.evaluate((button) => {
      return button.disabled;
    }, submitButton);

    const buttonTextAfterFill = await page.evaluate((button) => {
      return button.textContent?.trim();
    }, submitButton);

    console.log(`\n🔘 Button state after filling form:`);
    console.log(`   Disabled: ${buttonDisabledAfterFill}`);
    console.log(`   Text: "${buttonTextAfterFill}"`);

    // Check if there are any hidden validation states
    const buttonClasses = await page.evaluate((button) => {
      return button.getAttribute('class');
    }, submitButton);

    console.log(`\n🎨 Button classes: ${buttonClasses}`);

    // Try to manually trigger form validation
    console.log('\n🔄 Triggering form validation...');

    // Try to trigger change events
    await page.evaluate(() => {
      const emailInput = document.querySelector('input[type="email"]');
      const passwordInput = document.querySelector('input[type="password"]');

      if (emailInput) {
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        emailInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (passwordInput) {
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await page.waitForTimeout(1000);

    // Check button state after triggering validation
    const buttonDisabledAfterValidation = await page.evaluate((button) => {
      return button.disabled;
    }, submitButton);

    console.log(`\n🔘 Button state after validation trigger:`);
    console.log(`   Disabled: ${buttonDisabledAfterValidation}`);

    // Try clicking the button directly
    console.log('\n🖱️ Attempting to click button directly...');

    try {
      await submitButton.click();
      console.log('✅ Button clicked successfully');

      // Wait a moment to see what happens
      await page.waitForTimeout(2000);

      // Check final button state
      const finalButtonState = await page.evaluate((button) => {
        return {
          disabled: button.disabled,
          text: button.textContent?.trim(),
          classes: button.getAttribute('class')
        };
      }, submitButton);

      console.log(`\n🎯 Final button state:`);
      console.log(`   Disabled: ${finalButtonState.disabled}`);
      console.log(`   Text: "${finalButtonState.text}"`);
      console.log(`   Classes: ${finalButtonState.classes}`);

      // Check for any alerts or errors
      const alerts = await page.evaluate(() => {
        const alerts = [];
        document.querySelectorAll('[role="alert"]').forEach(alert => {
          alerts.push(alert.textContent?.trim());
        });
        return alerts;
      });

      if (alerts.length > 0) {
        console.log(`\n🚨 Alerts found:`);
        alerts.forEach((alert, index) => {
          console.log(`   ${index + 1}. ${alert}`);
        });
      }

    } catch (clickError) {
      console.log(`❌ Button click failed: ${clickError.message}`);
    }

    console.log('\n🎯 DIAGNOSIS:');

    if (initialButtonDisabled) {
      console.log('❌ Button is initially disabled - this indicates a form state issue');
    } else if (buttonDisabledAfterFill) {
      console.log('❌ Button becomes disabled after filling form - validation logic issue');
    } else if (buttonDisabledAfterValidation) {
      console.log('❌ Button becomes disabled after validation trigger - form state management issue');
    } else {
      console.log('✅ Button appears to be enabled - the issue might be elsewhere');
    }

  } catch (error) {
    console.error(`❌ Debug failed: ${error.message}`);
  } finally {
    await browser.close();
  }
}

// Run the debug script
debugFormState().catch(console.error);
