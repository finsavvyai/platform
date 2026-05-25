import { spawnSync } from 'child_process';
import * as path from 'path';

console.log("Starting VS Code Extension CLI execution test...");

// Test spawning the exact command the extension uses
const child = spawnSync('luna', ['--version'], {
    shell: process.platform === 'win32',
    env: process.env,
    encoding: 'utf-8'
});

if (child.error) {
    console.error("Test Failed: Failed to spawn luna CLI. Error:", child.error.message);
    process.exit(1);
}

if (child.status !== 0) {
    console.error("Test Failed: luna returned non-zero status:", child.status);
    console.error(child.stderr);
    process.exit(1);
}

console.log(`Test Passed: CLI is accessible from Node child_process.\nVersion: ${child.stdout.trim()}`);

// Simulate exact spawn command for the agent
console.log("\nSimulating Agent Runner execution...");
const agentChild = spawnSync('luna', ['run', 'code-review'], {
    shell: process.platform === 'win32',
    env: process.env,
    encoding: 'utf-8'
});

console.log("Agent Execution stdout:\n" + agentChild.stdout);
console.log("\nAgent Execution stderr:\n" + agentChild.stderr);
console.log(`\nExit code: ${agentChild.status}`);
