#!/usr/bin/env node

/**
 * Luna Agents Plugin Linker
 * 
 * Automatically creates a symlink from the Luna Agents plugin
 * to Claude's plugin directory based on the operating system
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getClaudeConfigDir() {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  switch (platform) {
    case 'darwin': // macOS
      return path.join(homeDir, 'Library', 'Application Support', 'Claude');
    case 'linux':
      return path.join(homeDir, '.config', 'Claude');
    case 'win32': // Windows
      return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Claude');
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

async function ensureDirectoryExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
    log(`Created directory: ${dirPath}`, 'green');
  }
}

async function createSymlink(source, destination) {
  try {
    // Check if destination already exists
    try {
      const stats = await fs.lstat(destination);
      if (stats.isSymbolicLink()) {
        log('Removing existing symlink...', 'yellow');
        await fs.unlink(destination);
      } else if (stats.isDirectory()) {
        log('Removing existing directory...', 'yellow');
        await fs.rm(destination, { recursive: true, force: true });
      }
    } catch {
      // Destination doesn't exist, which is fine
    }
    
    // Create the symlink
    await fs.symlink(source, destination, 'dir');
    log(`✓ Plugin linked successfully!`, 'green');
    log(`  Source: ${source}`, 'blue');
    log(`  Destination: ${destination}`, 'blue');
    return true;
  } catch (error) {
    log(`✗ Failed to create symlink: ${error.message}`, 'red');
    return false;
  }
}

async function updateClaudeConfig(configPath, mcpServerPath) {
  try {
    let config = {};
    
    // Try to read existing config
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      config = JSON.parse(configContent);
    } catch {
      // Config doesn't exist or is invalid, start fresh
    }
    
    // Ensure mcpServers object exists
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    
    // Add or update luna-nexa-rag server
    config.mcpServers['luna-nexa-rag'] = {
      command: 'node',
      args: [path.join(mcpServerPath, 'index.js')]
    };
    
    // Write config back
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    log(`✓ Updated Claude config with MCP server`, 'green');
    return true;
  } catch (error) {
    log(`⚠ Warning: Could not update Claude config: ${error.message}`, 'yellow');
    log(`  You may need to manually add the MCP server to your config`, 'yellow');
    return false;
  }
}

async function main() {
  try {
    log('\n🌙 Luna Agents Plugin Linker\n', 'blue');
    
    // Get paths
    const projectRoot = path.resolve(__dirname, '..');
    const pluginSource = path.join(projectRoot, '.claude-plugin');
    const mcpServerPath = path.join(projectRoot, 'mcp-servers', 'luna-nexa-rag');
    
    // Verify plugin source exists
    try {
      await fs.access(pluginSource);
    } catch {
      log('✗ Plugin source directory not found!', 'red');
      log(`  Expected: ${pluginSource}`, 'red');
      process.exit(1);
    }
    
    // Get Claude config directory
    let claudeConfigDir;
    try {
      claudeConfigDir = getClaudeConfigDir();
      log(`Found Claude config directory: ${claudeConfigDir}`, 'blue');
    } catch (error) {
      log(`✗ Error: ${error.message}`, 'red');
      process.exit(1);
    }
    
    // Ensure Claude plugins directory exists
    const pluginsDir = path.join(claudeConfigDir, 'plugins');
    await ensureDirectoryExists(pluginsDir);
    
    // Create symlink
    const pluginDestination = path.join(pluginsDir, 'luna-agents');
    const symlinkSuccess = await createSymlink(pluginSource, pluginDestination);
    
    if (!symlinkSuccess) {
      log('\n⚠ Failed to create symlink. You may need to run with elevated permissions.', 'yellow');
      log('  Try running: sudo npm run link:plugin', 'yellow');
      process.exit(1);
    }
    
    // Update Claude config with MCP server
    const configPath = path.join(claudeConfigDir, 'claude_desktop_config.json');
    await updateClaudeConfig(configPath, mcpServerPath);
    
    // Success message
    log('\n' + '='.repeat(50), 'green');
    log('✓ Luna Agents Plugin Installation Complete!', 'green');
    log('='.repeat(50) + '\n', 'green');
    
    log('📝 Next Steps:\n', 'blue');
    log('1. Restart Claude Desktop to load the plugin');
    log('2. Open your project in Claude Code');
    log('3. Type "/" to see Luna commands');
    log('4. Run /luna-requirements to start\n');
    
    log('🔧 Configuration Files:\n', 'blue');
    log(`   Plugin: ${pluginDestination}`);
    log(`   MCP Server: ${mcpServerPath}`);
    log(`   Claude Config: ${configPath}\n`);
    
    log('💡 Tip: Run "npm run configure:mcp" to set up semantic search\n', 'yellow');
    
  } catch (error) {
    log(`\n✗ Unexpected error: ${error.message}`, 'red');
    log(error.stack, 'red');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
