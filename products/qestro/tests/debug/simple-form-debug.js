/**
 * Simple Form State Debugger
 * Quick validation of form state and button status
 */

const puppeteer = require('puppeteer');

async function debugForm() {
  console.log('🔍 Simple Form State Debugger');
  console.log('=============================');

  const browser = await puppeteer.launch({ headless: false });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    console.log('\n📱 Loading login page...');
    await page.goto('https://qestro.app/login');

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if we're on the right page
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);

    // Look for form elements
    const elements = await page.evaluate(() => {
      const emailInput = document.querySelector('input[type="email"]');
      const passwordInput = document.querySelector('input[type="password"]');
      const submitButton = document.querySelector('button[type="submit"]');

      return {
        emailInput: !!emailInput,
        passwordInput: !!passwordInput,
        submitButton: !!submitButton,
        buttonDisabled: submitButton ? submitButton.disabled : null,
        buttonText: submitButton ? submitButton.textContent.trim() : null,
        buttonClasses: submitButton ? submitButton.getAttribute('class') : null
      };
    });

    console.log('\n🔍 Form Elements Found:');
    console.log(`   Email Input: ${elements.emailInput ? '✅' : '❌'}`);
    console.log(`   Password Input: ${elements.passwordInput ? '✅' : '❌'}`);
    console.log(`   Submit Button: ${elements.submitButton ? '✅' : '❌'}`);

    if (!elements.submitButton) {
      console.log('❌ Submit button not found!');
      return;
    }

    console.log('\n🔘 Initial Button State:');
    console.log(`   Disabled: ${elements.buttonDisabled}`);
    console.log(`   Text: "${elements.buttonText}"`);
    console.log(`   Classes: ${elements.buttonClasses}`);

    // Try to fill the form
    console.log('\n📝 Filling form fields...');

    // Fill email
    await page.type('input[type="email"]', 'test@questro.io');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Fill password
    await page.type('input[type="password"]', 'testpassword123');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check state after filling
    const afterFill = await page.evaluate(() => {
      const submitButton = document.querySelector('button[type="submit"]');
      return {
        buttonDisabled: submitButton ? submitButton.disabled : null,
        buttonText: submitButton ? submitButton.textContent.trim() : null,
        emailValue: document.querySelector('input[type="email"]').value,
        passwordValue: document.querySelector('input[type="password"]').value
      };
    });

    console.log('\n🔘 State After Filling:');
    console.log(`   Button Disabled: ${afterFill.buttonDisabled}`);
    console.log(`   Button Text: "${afterFill.buttonText}"`);
    console.log(`   Email Value: "${afterFill.emailValue}"`);
    console.log(`   Password Value: "${afterFill.passwordValue}"`);

    // Check for validation errors
    const validationErrors = await page.evaluate(() => {
      const errorElements = document.querySelectorAll('[class*="text-error"]');
      const errors = [];
      errorElements.forEach(el => {
        errors.push(el.textContent.trim());
      });
      return errors;
    });

    console.log(`\n❌ Validation Errors: ${validationErrors.length}`);
    validationErrors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });

    // Try to click the button
    console.log('\n🖱️ Attempting to click button...');

    try {
      await page.click('button[type="submit"]');
      console.log('✅ Button clicked successfully');

      // Wait for any response
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check final state
      const finalState = await page.evaluate(() => {
        const submitButton = document.querySelector('button[type="submit"]');
        return {
          buttonDisabled: submitButton ? submitButton.disabled : null,
          buttonText: submitButton ? submitButton.textContent.trim() : null
        };
      });

      console.log('\n🎯 Final State After Click:');
      console.log(`   Button Disabled: ${finalState.buttonDisabled}`);
      console.log(`   Button Text: "${finalState.buttonText}"`);

    } catch (clickError) {
      console.log(`❌ Button click failed: ${clickError.message}`);
    }

    console.log('\n🎯 ANALYSIS:');

    if (elements.buttonDisabled) {
      console.log('❌ ISSUE: Button is disabled from the start');
      console.log('   This suggests React Hook Form validation state is not updating');
      console.log('   Possible causes:');
      console.log('   - useForm configuration issue');
      console.log('   - JavaScript error preventing validation');
      console.log('   - Form state not properly initialized');
    } else if (afterFill.buttonDisabled) {
      console.log('❌ ISSUE: Button becomes disabled after filling');
      console.log('   This suggests validation logic is rejecting valid input');
      console.log('   Possible causes:');
      console.log('   - Validation rules too strict');
      console.log('   - Form state management issue');
      console.log('   - Error state interfering with validation');
    } else {
      console.log('✅ Button appears to be enabled');
      console.log('   The issue might be:');
      console.log('   - Network request blocking');
      console.log('   - Loading state management');
      console.log('   - Component state issue');
    }

  } catch (error) {
    console.error(`❌ Debug failed: ${error.message}`);
  } finally {
    await browser.close();
  }
}

debugForm().catch(console.error);
