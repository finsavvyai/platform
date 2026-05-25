#!/usr/bin/env node

/**
 * Luna Agents Plugin Validation Script
 *
 * This script validates the plugin structure and configuration
 * to ensure compatibility with Claude Code.
 */

const fs = require('fs');
const path = require('path');

const PLUGIN_DIR = __dirname;
const REQUIRED_FILES = [
  'claude-plugin.json',
  'package.json',
  'README.md'
];

const REQUIRED_DIRS = [
  'agents',
  'commands'
];

function validateFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

function validateDirectory(dirPath) {
  try {
    const stats = fs.statSync(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

function validateAgentFiles() {
  const agentsDir = path.join(PLUGIN_DIR, 'agents');
  const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.json'));

  console.log(`\n🤖 Validating ${agentFiles.length} agent files...`);

  for (const file of agentFiles) {
    const filePath = path.join(agentsDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const agent = JSON.parse(content);

      // Validate required fields
      const required = ['name', 'displayName', 'description', 'version', 'category', 'type'];
      for (const field of required) {
        if (!agent[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      console.log(`  ✅ ${agent.displayName} (${agent.name})`);
    } catch (error) {
      console.error(`  ❌ ${file}: ${error.message}`);
      return false;
    }
  }

  return true;
}

function validateCommandFiles() {
  const commandsDir = path.join(PLUGIN_DIR, 'commands');
  const commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));

  console.log(`\n⚡ Validating ${commandFiles.length} command files...`);

  for (const file of commandFiles) {
    const filePath = path.join(commandsDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // Check for frontmatter
      if (!content.startsWith('---')) {
        throw new Error('Missing frontmatter');
      }

      // Extract frontmatter
      const frontmatterEnd = content.indexOf('---', 3);
      if (frontmatterEnd === -1) {
        throw new Error('Incomplete frontmatter');
      }

      const frontmatter = content.substring(3, frontmatterEnd);
      const yaml = require('js-yaml');
      const metadata = yaml.load(frontmatter);

      // Validate required fields
      const required = ['name', 'displayName', 'description', 'agent'];
      for (const field of required) {
        if (!metadata[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      console.log(`  ✅ ${metadata.displayName} (${metadata.name})`);
    } catch (error) {
      console.error(`  ❌ ${file}: ${error.message}`);
      return false;
    }
  }

  return true;
}

function validateConfiguration() {
  console.log('\n📋 Validating plugin configuration...');

  try {
    // Validate claude-plugin.json
    const pluginConfigPath = path.join(PLUGIN_DIR, 'claude-plugin.json');
    const pluginConfig = JSON.parse(fs.readFileSync(pluginConfigPath, 'utf8'));

    const requiredPluginFields = ['name', 'version', 'description', 'type'];
    for (const field of requiredPluginFields) {
      if (!pluginConfig[field]) {
        throw new Error(`Missing plugin field: ${field}`);
      }
    }

    if (pluginConfig.type !== 'plugin') {
      throw new Error('Plugin type must be "plugin"');
    }

    console.log('  ✅ claude-plugin.json');

    // Validate package.json
    const packagePath = path.join(PLUGIN_DIR, 'package.json');
    const packageConfig = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    if (!packageConfig.claude) {
      throw new Error('Missing claude configuration in package.json');
    }

    console.log('  ✅ package.json');

    return true;
  } catch (error) {
    console.error(`  ❌ Configuration error: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('🌙 Luna Agents Plugin Validation');
  console.log('================================');

  let valid = true;

  // Validate required files
  console.log('\n📁 Checking required files...');
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(PLUGIN_DIR, file);
    if (validateFile(filePath)) {
      console.log(`  ✅ ${file}`);
    } else {
      console.error(`  ❌ Missing required file: ${file}`);
      valid = false;
    }
  }

  // Validate required directories
  console.log('\n📂 Checking required directories...');
  for (const dir of REQUIRED_DIRS) {
    const dirPath = path.join(PLUGIN_DIR, dir);
    if (validateDirectory(dirPath)) {
      console.log(`  ✅ ${dir}/`);
    } else {
      console.error(`  ❌ Missing required directory: ${dir}`);
      valid = false;
    }
  }

  // Validate configuration
  if (!validateConfiguration()) {
    valid = false;
  }

  // Validate agent files
  if (!validateAgentFiles()) {
    valid = false;
  }

  // Validate command files
  if (!validateCommandFiles()) {
    valid = false;
  }

  // Final result
  console.log('\n' + '='.repeat(40));
  if (valid) {
    console.log('🎉 Plugin validation PASSED!');
    console.log('✨ Luna Agents plugin is ready for use with Claude Code');
    process.exit(0);
  } else {
    console.log('❌ Plugin validation FAILED!');
    console.log('🔧 Please fix the issues above before using the plugin');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateFile, validateDirectory, validateConfiguration };