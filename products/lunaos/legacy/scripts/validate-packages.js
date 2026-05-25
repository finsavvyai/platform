const fs = require('fs');
const path = require('path');

console.log('📋 Validating Package Metadata');
console.log('==============================\n');

let errors = 0;

// Check root package.json
const rootPkg = require('../package.json');
console.log(`✓ Root package: ${rootPkg.name}`);

// Check all workspace packages
const packagesDir = path.join(__dirname, '../packages');
const packages = fs.readdirSync(packagesDir).filter(f =>
    fs.statSync(path.join(packagesDir, f)).isDirectory()
);

packages.forEach(pkg => {
    // Skip non-package directories
    if (pkg === 'lunaforge-worker' || pkg.startsWith('.')) {
        return;
    }

    const pkgPath = path.join(packagesDir, pkg, 'package.json');

    if (!fs.existsSync(pkgPath)) {
        console.error(`✗ Missing package.json in ${pkg}`);
        errors++;
        return;
    }

    try {
        const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

        // Validate required fields
        const required = ['name', 'version'];
        required.forEach(field => {
            if (!pkgJson[field]) {
                console.error(`✗ ${pkg}: Missing ${field}`);
                errors++;
            }
        });

        // Check version consistency for extension
        if (pkg === 'lunaforge-extension') {
            if (pkgJson.version !== '2.4.0') {
                console.error(`✗ ${pkg}: Version should be 2.4.0, got ${pkgJson.version}`);
                errors++;
            } else {
                console.log(`✓ ${pkg}: v${pkgJson.version}`);
            }
        } else {
            console.log(`✓ ${pkg}: v${pkgJson.version}`);
        }

        // Validate scripts
        if (pkgJson.scripts) {
            if (!pkgJson.scripts.build) {
                console.warn(`⚠ ${pkg}: No build script`);
            }
        }

    } catch (error) {
        console.error(`✗ ${pkg}: Invalid JSON - ${error.message}`);
        errors++;
    }
});

// Check worker package
const workerPkg = path.join(__dirname, '../workers/agent-brain/package.json');
if (fs.existsSync(workerPkg)) {
    const workerJson = JSON.parse(fs.readFileSync(workerPkg, 'utf8'));
    console.log(`✓ Worker: ${workerJson.name} v${workerJson.version}`);
} else {
    console.error('✗ Worker package.json missing');
    errors++;
}

console.log('\n==============================');
if (errors === 0) {
    console.log('✓ All packages validated successfully!');
    process.exit(0);
} else {
    console.error(`✗ ${errors} validation error(s) found`);
    process.exit(1);
}
