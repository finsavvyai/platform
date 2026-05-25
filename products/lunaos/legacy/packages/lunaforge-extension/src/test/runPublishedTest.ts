import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { runTests } from "@vscode/test-electron";

/**
 * Post-Publish Test Runner
 * 
 * Tests the PUBLISHED extension from the VS Code Marketplace.
 * Uses the user's actual extensions directory to load the published extension.
 * 
 * Prerequisites:
 * 1. Extension must be installed from Marketplace: `code --install-extension FinsavvyTechnologies.lunaforge-extension`
 * 2. Run this script: `npm run test:published`
 */
async function main() {
    try {
        const extensionTestsPath = path.resolve(__dirname, "./suite");

        // Create an empty temp directory as dummy extensionDevelopmentPath
        const emptyExtPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vsc-luna-empty-'));

        // Use the user's actual VS Code extensions directory
        const homeDir = os.homedir();
        const extensionsPath = path.join(homeDir, '.vscode', 'extensions');

        console.log("🧪 Running tests against PUBLISHED extension from Marketplace...");
        console.log("📦 Extension directory:", extensionsPath);
        console.log("📦 Make sure the extension is installed: code --install-extension FinsavvyTechnologies.lunaforge-extension");

        await runTests({
            extensionDevelopmentPath: emptyExtPath,
            extensionTestsPath,
            version: '1.93.0',
            launchArgs: [
                '--disable-gpu',
                '--no-sandbox',
                '--disable-dev-shm-usage',
                // Short user data dir to avoid IPC path length issues
                '--user-data-dir=/tmp/vsc-pub',
                // Use system extensions directory
                `--extensions-dir=${extensionsPath}`,
                '--enable-proposed-api=finsavvytechnologies.lunaforge-extension'
            ]
        });

        // Cleanup
        fs.rmSync(emptyExtPath, { recursive: true });

        console.log("✅ All post-publish tests passed!");
    } catch (err) {
        console.error("❌ Post-publish tests failed:", err);
        process.exit(1);
    }
}

main();
