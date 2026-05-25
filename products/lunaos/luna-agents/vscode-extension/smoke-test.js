
// This script needs to be compiled or run with ts-node
import { spawn } from 'child_process';

const runnerPath = './src/agent-runner';

// We can't easily import the class directly without compiling, so let's just test CLI presence
// explicitly using the same logic as the class
console.log('Testing Luna CLI presence...');

const check = spawn('luna', ['--version'], {
    shell: process.platform === 'win32',
    env: process.env
});

check.on('error', (err) => {
    console.error('❌ Failed to spawn CLI:', err);
    process.exit(1);
});

check.stdout.on('data', (data) => {
    console.log('✅ CLI version:', data.toString().trim());
});

check.on('close', (code) => {
    if (code === 0) {
        console.log('✅ CLI check passed (exit code 0)');
    } else {
        console.error('❌ CLI check failed (exit code ' + code + ')');
        process.exit(1);
    }
});
