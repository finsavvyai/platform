#!/usr/bin/env node
/**
 * LunaOS Product Tour — automated video recording.
 *
 * Uses Playwright to screenshot each product, OpenAI TTS for narration,
 * and ffmpeg to combine into a single video with accurate timing.
 *
 * Key fixes:
 *   - Local HTML slides for bot-protected pages (npm, raw JSON)
 *   - Measures actual TTS audio duration → matches video length exactly
 *   - Higher-quality screenshots with wait for fonts
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const env = fs.readFileSync(path.join(__dirname, '../../.env'), 'utf-8');
const OPENAI_KEY = env.match(/OPEN_AI_KEY=(.+)/)?.[1]?.trim();

if (!OPENAI_KEY) {
  console.error('OPEN_AI_KEY not found in .env');
  process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, 'output');
const SLIDES_DIR = path.join(__dirname, 'slides');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Tour script — each step: url (or local HTML), narration
// Duration will be calculated from actual TTS audio length.
const TOUR = [
  {
    url: 'https://lunaos.ai',
    narration:
      'LunaOS is an AI agent platform for developers. Six products, one unified experience. Let me show you each one.',
    label: '1. Marketing',
  },
  {
    url: 'https://agents.lunaos.ai',
    narration:
      'The dashboard is where users manage their agents, chains, billing, and execution history. Sign up for free and you land here.',
    label: '2. Dashboard',
  },
  {
    url: 'https://studio.lunaos.ai',
    narration:
      'The visual studio lets you drag and drop to build agent workflows. Like n8n, but every node is an AI agent.',
    label: '3. Studio',
  },
  {
    url: 'https://docs.lunaos.ai',
    narration:
      'Documentation covers the API, CLI, and all twenty eight agents with copy-paste examples for every feature.',
    label: '4. Docs',
  },
  {
    // Local HTML slide — avoids raw JSON from /health endpoint
    url: 'file://' + path.join(SLIDES_DIR, 'api.html'),
    narration:
      'The engine is a Cloudflare Workers API with over fifty endpoints. Today we shipped parallel agent swarm with race, consensus, and vote strategies.',
    label: '5. API Engine',
  },
  {
    // Local HTML slide — avoids npm CAPTCHA
    url: 'file://' + path.join(SLIDES_DIR, 'npm.html'),
    narration:
      'And the CLI, published on npm as luna-agents. Two hundred thirty two commands, twenty eight agents, install globally in one command.',
    label: '6. CLI',
  },
];

/** Generate TTS audio, return path. */
async function generateNarration(text, outputPath) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'tts-1-hd',
      voice: 'onyx',
      input: text,
      speed: 1.0,
    });
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/audio/speech',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          let err = '';
          res.on('data', (chunk) => (err += chunk));
          res.on('end', () => reject(new Error(`TTS ${res.statusCode}: ${err}`)));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          fs.writeFileSync(outputPath, Buffer.concat(chunks));
          resolve();
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Get duration in seconds from an audio file using ffprobe. */
function getAudioDuration(audioPath) {
  const output = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
    { encoding: 'utf-8' },
  );
  return parseFloat(output.trim());
}

/** Record a step: navigate, screenshot, TTS, build clip with precise timing. */
async function recordStep(page, step, index) {
  const stepDir = path.join(OUTPUT_DIR, `step_${index}`);
  fs.mkdirSync(stepDir, { recursive: true });

  console.log(`\n[${index + 1}/${TOUR.length}] ${step.label}`);
  console.log(`  → Navigating to ${step.url}`);

  try {
    await page.goto(step.url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (err) {
    console.log(`  ⚠ Timeout, continuing: ${err.message.slice(0, 60)}`);
  }

  // Wait for fonts + rendering
  await page.waitForTimeout(2000);
  try {
    await page.evaluate(() => (document.fonts && document.fonts.ready) || Promise.resolve());
  } catch {}
  await page.waitForTimeout(500);

  // Screenshot
  const screenshotPath = path.join(stepDir, 'screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`  ✓ Screenshot saved`);

  // Generate narration first so we can measure duration
  const audioPath = path.join(stepDir, 'narration.mp3');
  await generateNarration(step.narration, audioPath);
  const actualDuration = getAudioDuration(audioPath);
  // Add 1 second of silence at the end for breathing room
  const clipDuration = actualDuration + 1.0;
  console.log(`  ✓ Narration: ${actualDuration.toFixed(1)}s (clip: ${clipDuration.toFixed(1)}s)`);

  // Build video clip: image + audio + trailing silence
  const videoPath = path.join(stepDir, 'step.mp4');

  execSync(
    `ffmpeg -y -loop 1 -i "${screenshotPath}" ` +
    `-i "${audioPath}" ` +
    `-af "apad=pad_dur=1.0" ` +
    `-c:v libx264 -tune stillimage -c:a aac -b:a 192k ` +
    `-pix_fmt yuv420p -t ${clipDuration.toFixed(2)} ` +
    `-vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" ` +
    `"${videoPath}" 2>&1`,
    { stdio: 'pipe' },
  );
  console.log(`  ✓ Video clip saved`);

  return { videoPath, duration: clipDuration };
}

/** Combine all step videos into one (re-encode for A/V sync). */
function combineVideos(videoPaths, outputPath) {
  console.log('\n[combine] Joining all clips...');
  const listPath = path.join(OUTPUT_DIR, 'concat.txt');
  const listContent = videoPaths.map((p) => `file '${p}'`).join('\n');
  fs.writeFileSync(listPath, listContent);
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${listPath}" ` +
    `-c:v libx264 -c:a aac -b:a 192k "${outputPath}" 2>&1`,
    { stdio: 'pipe' },
  );
  console.log(`✓ Final video: ${outputPath}`);
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  LunaOS Product Tour — Video Recording');
  console.log('═══════════════════════════════════════════');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const results = [];
  let total = 0;
  for (let i = 0; i < TOUR.length; i++) {
    const result = await recordStep(page, TOUR[i], i);
    results.push(result);
    total += result.duration;
  }

  await browser.close();

  const finalPath = path.join(OUTPUT_DIR, 'lunaos-tour.mp4');
  combineVideos(results.map((r) => r.videoPath), finalPath);

  const stats = fs.statSync(finalPath);
  console.log(`\n  Size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Duration: ${total.toFixed(1)}s`);
  console.log('\n═══════════════════════════════════════════');
  console.log('  open scripts/demo/output/lunaos-tour.mp4');
  console.log('═══════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
