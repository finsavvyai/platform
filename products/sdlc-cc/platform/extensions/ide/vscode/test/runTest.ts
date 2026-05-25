// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Boots a real (headless) VS Code instance via @vscode/test-electron,
// installs this extension, and runs the Mocha suite inside it.
// Required because the extension uses real VS Code APIs (commands,
// configuration, status bar) that can't be unit-tested in isolation.

import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "../..");
  const extensionTestsPath = path.resolve(__dirname, "./suite/index");
  try {
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ["--disable-extensions", "--no-sandbox"],
    });
  } catch (err) {
    console.error("Failed to run tests:", err);
    process.exit(1);
  }
}

void main();
