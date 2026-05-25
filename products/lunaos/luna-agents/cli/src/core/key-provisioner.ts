import chalk from 'chalk';
import { chromium, type Browser, type Page } from 'playwright-core';
import { BaseExtractor } from './extractors/base.js';

export class KeyProvisioner {
    static async provision(extractor: BaseExtractor): Promise<string | null> {
        console.log(`\n${chalk.cyan('→')} Starting automated API key setup for ${chalk.white.bold(extractor.name)}...`);
        console.log(chalk.dim('  Opening browser... Please log in when prompted.'));
        console.log(chalk.yellow('  ⚠ Do not close the browser! We will extract the key automatically.'));

        let executablePath = '';
        const platform = process.platform;

        if (platform === 'darwin') {
            executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        } else if (platform === 'win32') {
            executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        } else {
            executablePath = '/usr/bin/google-chrome';
        }

        let browser: Browser | null = null;
        try {
            browser = await chromium.launch({
                headless: false,
                executablePath,
                args: ['--disable-blink-features=AutomationControlled']
            });

            const context = await browser.newContext({
                viewport: { width: 1280, height: 800 },
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            });

            const page = await context.newPage();

            console.log(chalk.dim(`  Navigating to ${extractor.loginUrl}...`));
            await page.goto(extractor.loginUrl, { waitUntil: 'domcontentloaded' });

            console.log(chalk.cyan(`  Waiting for user to log in...`));

            const key = await extractor.extract(page);

            if (key) {
                console.log(`\n${chalk.green('✓')} Successfully extracted ${extractor.name} API key!`);
                return key;
            } else {
                console.log(`\n${chalk.red('✗')} Failed to extract key. You may need to generate it manually.`);
                return null;
            }

        } catch (error: any) {
            console.log(`\n${chalk.red('✗')} Automation failed: ${error.message}`);
            if (error.message.includes('executablePath')) {
                console.log(chalk.yellow(`  Could not find Chrome at ${executablePath}. Please install Chrome or enter key manually.`));
            }
            return null;
        } finally {
            if (browser) {
                console.log(chalk.dim('  Closing browser...'));
                await browser.close();
            }
        }
    }
}
