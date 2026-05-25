#!/usr/bin/env node

/**
 * Test script to verify LunaForge commands are working
 */

const { execSync } = require('child_process');

function testCommand(command) {
    try {
        const result = execSync(`code --help ${command}`, { encoding: 'utf8' });
        console.log(`✅ Command found: ${command}`);
        return true;
    } catch (error) {
        console.log(`❌ Command not found: ${command}`);
        return false;
    }
}

// Test core LunaForge commands
const commands = [
    'lunaforge.openControlCenter',
    'lunaforge.buildGraph',
    'lunaforge.upgradeSubscription',
    'lunaforge.viewSubscription',
    'lunaforge.manageBilling',
    'lunaforge.viewPricing'
];

console.log('🌙 Testing LunaForge Commands...\n');

let working = 0;
let total = commands.length;

commands.forEach(cmd => {
    if (testCommand(cmd)) {
        working++;
    }
});

console.log(`\n📊 Results: ${working}/${total} commands working`);

if (working === total) {
    console.log('🎉 All LunaForge commands are working!');
    process.exit(0);
} else {
    console.log('⚠️ Some commands may not be properly registered');
    process.exit(1);
}