// Helper script to extract resource IDs from wrangler commands
// Run this after completing the setup to update your wrangler.toml

const fs = require('fs');
const { execSync } = require('child_process');

console.log('Extracting resource IDs...');

// D1 Database IDs
const d1Databases = [
    'finsavvy-billing-us',
    'finsavvy-billing-eu',
    'finsavvy-compliance-us',
    'finsavvy-compliance-eu',
    'finsavvy-intelligence-us',
    'finsavvy-intelligence-eu',
    'finsavvy-risk-us',
    'finsavvy-risk-eu'
];

// KV Namespace IDs
const kvNamespaces = [
    'CACHE_KV',
    'SESSIONS_KV',
    'AGENT_MEMORY_KV',
    'RATE_LIMITS_KV',
    'USER_PREFERENCES_KV'
];

console.log('Please manually update your wrangler.toml with the actual IDs from:');
console.log('1. wrangler d1 list');
console.log('2. wrangler kv namespace list');
console.log('3. Vectorize and Queue IDs from Cloudflare Dashboard');
