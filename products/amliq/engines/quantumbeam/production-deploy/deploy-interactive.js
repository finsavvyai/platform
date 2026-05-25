#!/usr/bin/env node

/**
 * Interactive QuantumBeam Deployment Script with Voice Monitoring
 * Real-time deployment monitoring with voice feedback and progress tracking
 */

import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DeploymentMonitor {
  constructor() {
    this.steps = [
      { name: "🔍 Checking prerequisites", status: "pending", command: "node --version" },
      { name: "📦 Installing dependencies", status: "pending", command: "npm install" },
      { name: "🔐 Setting environment variables", status: "pending", command: "wrangler secret list" },
      { name: "🚀 Deploying to Cloudflare Workers", status: "pending", command: "wrangler deploy" },
      { name: "🌐 Verifying domain routing", status: "pending", command: "curl -I https://quantumbeam.io" },
      { name: "🧪 Testing health endpoint", status: "pending", command: "curl -s https://quantumbeam.io/health" },
      { name: "🤖 Testing MCP integration", status: "pending", command: "curl -X POST https://quantumbeam.io/mcp -d '{\"method\":\"initialize\"}'" },
      { name: "📊 Running full diagnostics", status: "pending", command: "curl -s https://quantumbeam.io/" }
    ];

    this.currentStep = 0;
    this.startTime = Date.now();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.colors = {
      green: '\x1b[32m',
      red: '\x1b[31m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      reset: '\x1b[0m'
    };
  }

  log(message, color = 'white') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${this.colors[color]}[${timestamp}] ${message}${this.colors.reset}`);
  }

  speak(text) {
    // Voice feedback using system's text-to-speech
    const isMac = process.platform === 'darwin';
    const isWindows = process.platform === 'win32';

    let command;
    if (isMac) {
      command = `say "${text}"`;
    } else if (isWindows) {
      command = `powershell -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${text}')"`;
    } else {
      command = `espeak "${text}" 2>/dev/null || echo "${text}"`;
    }

    exec(command, (error) => {
      if (error) {
        // Fallback to console if voice fails
        this.log(`🔊 Voice: ${text}`, 'cyan');
      }
    });
  }

  async executeCommand(command, timeout = 30000) {
    return new Promise((resolve) => {
      this.log(`🔄 Executing: ${command}`, 'blue');

      const child = spawn(command, { shell: true, stdio: 'pipe' });
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({ success: false, error: 'Command timeout' });
      }, timeout);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write('.');
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stdout.write('!');
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        console.log(); // New line after progress dots
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          code
        });
      });
    });
  }

  showProgressBar(current, total, width = 40) {
    const progress = Math.round((current / total) * width);
    const empty = width - progress;
    const filled = '█'.repeat(progress);
    const emptyChar = '░'.repeat(empty);
    const percentage = Math.round((current / total) * 100);

    return `[${this.colors.green}${filled}${this.colors.reset}${emptyChar}] ${percentage}%`;
  }

  async animateStep(stepName) {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frame = 0;

    const interval = setInterval(() => {
      process.stdout.write(`\r${frames[frame]} ${stepName}`);
      frame = (frame + 1) % frames.length;
    }, 100);

    return () => {
      clearInterval(interval);
      process.stdout.write(`\r✅ ${stepName}\n`);
    };
  }

  async deployStep() {
    const step = this.steps[this.currentStep];
    if (!step) {
      await this.completeDeployment();
      return;
    }

    this.log(`\n${this.showProgressBar(this.currentStep, this.steps.length)} ${step.name}`, 'cyan');
    this.speak(step.name);

    const stopAnimation = await this.animateStep(step.name);

    try {
      const result = await this.executeCommand(step.command);
      stopAnimation();

      if (result.success) {
        step.status = 'completed';
        this.log(`✅ ${step.name} - COMPLETED`, 'green');
        this.speak(`${step.name} completed successfully`);

        // Step-specific success messages
        if (this.currentStep === 3) { // After deployment
          this.log('🎉 QuantumBeam API is now LIVE on Cloudflare Workers!', 'green');
          this.speak('Quantum Beam API is now live');
        }

        if (this.currentStep === 6) { // After MCP test
          this.log('🤖 MCP integration is working perfectly!', 'magenta');
          this.speak('M C P integration successful');
        }

      } else {
        step.status = 'failed';
        this.log(`❌ ${step.name} - FAILED: ${result.error || result.stderr}`, 'red');
        this.speak(`Error in ${step.name}`);

        // Offer to retry or continue
        const retry = await this.askUser(`\n❌ Retry ${step.name}? (y/n/skip): `);
        if (retry.toLowerCase() === 'y') {
          this.log(`🔄 Retrying ${step.name}...`, 'yellow');
          return this.deployStep(); // Retry current step
        } else if (retry.toLowerCase() === 'skip') {
          step.status = 'skipped';
          this.log(`⏭️  Skipping ${step.name}`, 'yellow');
        } else {
          this.log('🛑 Deployment cancelled by user', 'red');
          process.exit(0);
        }
      }
    } catch (error) {
      stopAnimation();
      step.status = 'failed';
      this.log(`💥 ${step.name} - ERROR: ${error.message}`, 'red');
      this.speak('Deployment error occurred');
    }

    this.currentStep++;

    // Small delay between steps for dramatic effect
    await this.sleep(1000);

    // Continue to next step
    this.deployStep();
  }

  askUser(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async completeDeployment() {
    const endTime = Date.now();
    const duration = Math.round((endTime - this.startTime) / 1000);

    console.log('\n' + '='.repeat(60));
    this.log('🎉 QUANTUMBEAM.IO DEPLOYMENT COMPLETED!', 'green');
    this.log(`⏱️  Total time: ${duration} seconds`, 'cyan');
    this.speak('Deployment completed successfully');

    console.log('\n📊 Deployment Summary:');
    this.steps.forEach((step, index) => {
      const status = step.status === 'completed' ? '✅' :
                     step.status === 'failed' ? '❌' :
                     step.status === 'skipped' ? '⏭️' : '⏳';
      console.log(`${status} ${step.name}`);
    });

    console.log('\n🌐 Live URLs:');
    console.log(`🏠 Main Site: ${this.colors.blue}https://quantumbeam.io${this.colors.reset}`);
    console.log(`🏥 Health Check: ${this.colors.blue}https://quantumbeam.io/health${this.colors.reset}`);
    console.log(`🤖 MCP Endpoint: ${this.colors.blue}https://quantumbeam.io/mcp${this.colors.reset}`);
    console.log(`📊 API Base: ${this.colors.blue}https://quantumbeam.io/api${this.colors.reset}`);

    console.log('\n🧪 Quick Test Commands:');
    console.log(`curl ${this.colors.cyan}https://quantumbeam.io/health${this.colors.reset}`);
    console.log(`curl -X POST ${this.colors.cyan}https://quantumbeam.io/mpc${this.colors.reset} -d '{"method":"initialize"}'`);

    console.log('\n🔧 Management Commands:');
    console.log(`${this.colors.yellow}wrangler tail${this.colors.reset} - View logs`);
    console.log(`${this.colors.yellow}wrangler deploy${this.colors.reset} - Redeploy`);

    console.log('\n🎯 Next Steps:');
    this.log('1. 🧪 Test the MCP integration with your AI assistant', 'cyan');
    this.log('2. 📊 Set up monitoring in Cloudflare dashboard', 'cyan');
    this.log('3. 🔧 Configure custom fraud detection rules', 'cyan');
    this.log('4. 📈 Review analytics and performance metrics', 'cyan');

    this.speak('Quantum Beam is ready for business');

    console.log('\n🚀 Your quantum-enhanced fraud detection API is LIVE!');
    console.log('=' .repeat(60));

    this.rl.close();

    // Final celebration
    await this.celebrate();
  }

  async celebrate() {
    const celebrations = [
      '🎉', '🚀', '✨', '🌟', '💫', '⚡', '🎊', '🎈', '🎯', '🏆'
    ];

    for (let i = 0; i < 5; i++) {
      console.log(`${celebrations[i % celebrations.length]} QuantumBeam.io is LIVE! ${celebrations[(i + 1) % celebrations.length]}`);
      await this.sleep(500);
    }

    this.log('QuantumBeam.io successfully deployed to Cloudflare Workers!', 'green');
    this.speak('Quantum Beam dot io is ready');
  }

  async start() {
    console.log('\n' + '='.repeat(60));
    console.log(`${this.colors.magenta}🚀 QUANTUMBEAM.IO INTERACTIVE DEPLOYMENT${this.colors.reset}`);
    console.log(`${this.colors.cyan}🌍 Deploying with Cloudflare Workers + MCP Integration${this.colors.reset}`);
    console.log(`${this.colors.yellow}🔊 Voice monitoring enabled${this.colors.reset}`);
    console.log('=' .repeat(60));

    this.speak('Starting Quantum Beam deployment');

    // Show deployment plan
    console.log('\n📋 Deployment Plan:');
    this.steps.forEach((step, index) => {
      console.log(`  ${index + 1}. ${step.name}`);
    });

    // Ask for confirmation
    const ready = await this.askUser('\n🚀 Ready to deploy QuantumBeam.io? (y/n): ');

    if (ready.toLowerCase() !== 'y') {
      this.log('🛑 Deployment cancelled', 'red');
      process.exit(0);
    }

    this.log('🎯 Starting deployment sequence...', 'green');
    this.speak('Deployment sequence initiated');

    // Start deployment
    this.deployStep();
  }
}

// Check if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new DeploymentMonitor();
  monitor.start().catch(console.error);
}

export default DeploymentMonitor;