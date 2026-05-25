import { chromium } from 'playwright';

async function debugAPIStudio() {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
        console.log('Navigating to API Studio...');
        await page.goto('http://localhost:3000/api-studio');
        await page.waitForTimeout(2000);

        console.log('Page Title:', await page.title());
        console.log('URL:', page.url());

        const body = await page.innerHTML('body');
        console.log('--- BODY CONTENT START ---');
        console.log(body);
        console.log('--- BODY CONTENT END ---');

        const h3 = await page.$('h3');
        if (h3) {
            console.log('Found h3:', await h3.textContent());
        } else {
            console.log('No h3 found');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }
}

debugAPIStudio();
