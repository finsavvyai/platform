#!/usr/bin/env node
/**
 * HeyGen video producer — takes screenshots + script, sends to HeyGen API.
 *
 * Usage:
 *   HEYGEN_API_KEY=xxx node heygen-produce.js /tmp/lunaos-demo
 *
 * Expects in the input dir:
 *   - *.png screenshots (numbered 01-xx)
 *   - flow.json with narration text per scene
 *
 * Uploads screenshots, creates video via HeyGen v2 API, polls until done.
 */

const fs = require('fs');
const path = require('path');

const API = 'https://api.heygen.com';
const KEY = process.env.HEYGEN_API_KEY;
const INPUT_DIR = process.argv[2] || '/tmp/lunaos-demo';
const AVATAR_ID = process.env.HEYGEN_AVATAR_ID || 'josh_lite3_20230714';
const VOICE_ID = process.env.HEYGEN_VOICE_ID || '1bd001e7e50f421d891986aad5c1e2b9';

if (!KEY) { console.error('Set HEYGEN_API_KEY'); process.exit(1); }

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-api-key': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function uploadAsset(filePath) {
  const buf = fs.readFileSync(filePath);
  const res = await fetch('https://upload.heygen.com/v1/asset', {
    method: 'POST',
    headers: { 'X-API-KEY': KEY, 'Content-Type': 'image/png' },
    body: buf,
  });
  const data = await res.json();
  return data.data?.url || data.data?.asset_id;
}

async function main() {
  // Load flow script
  const flow = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, 'flow.json'), 'utf8'));
  const screenshots = fs.readdirSync(INPUT_DIR)
    .filter(f => f.endsWith('.png'))
    .sort();

  if (screenshots.length === 0) { console.error('No screenshots found'); process.exit(1); }

  console.log(`Found ${screenshots.length} screenshots, ${flow.length} scenes\n`);

  // Upload screenshots
  console.log('Uploading screenshots to HeyGen...');
  const uploadedUrls = [];
  for (const file of screenshots) {
    const url = await uploadAsset(path.join(INPUT_DIR, file));
    uploadedUrls.push(url);
    console.log(`  ${file} → uploaded`);
  }

  // Build video_inputs — one scene per screenshot
  const videoInputs = flow.map((scene, i) => ({
    character: {
      type: 'avatar',
      avatar_id: AVATAR_ID,
      avatar_style: 'normal',
      scale: 0.4,
      offset: { x: 0.35, y: 0.05 },
    },
    voice: {
      type: 'text',
      voice_id: VOICE_ID,
      input_text: scene.voice || scene.narrate || scene.title,
    },
    background: {
      type: 'image',
      url: uploadedUrls[i] || uploadedUrls[uploadedUrls.length - 1],
    },
  }));

  console.log('\nCreating HeyGen video...');
  const createRes = await api('/v2/video/generate', {
    title: 'LunaOS Product Tour',
    video_inputs: videoInputs,
    dimension: { width: 1280, height: 720 },
    caption: true,
  });

  if (createRes.error) {
    console.error('HeyGen error:', createRes.error);
    fs.writeFileSync(path.join(INPUT_DIR, 'heygen-error.json'), JSON.stringify(createRes, null, 2));
    process.exit(1);
  }

  const videoId = createRes.data?.video_id;
  console.log(`Video ID: ${videoId}\n`);
  fs.writeFileSync(path.join(INPUT_DIR, 'heygen-response.json'), JSON.stringify(createRes, null, 2));

  // Poll until complete
  console.log('Waiting for video generation...');
  let status = 'processing';
  while (status === 'processing' || status === 'pending') {
    await new Promise(r => setTimeout(r, 10000));
    const check = await api(`/v1/video_status.get?video_id=${videoId}`);
    status = check.data?.status || 'unknown';
    const pct = check.data?.progress ? `${Math.round(check.data.progress * 100)}%` : '';
    process.stdout.write(`  Status: ${status} ${pct}\r`);

    if (status === 'completed') {
      const videoUrl = check.data.video_url;
      console.log(`\n\nVideo ready: ${videoUrl}`);

      // Download
      const videoRes = await fetch(videoUrl);
      const buf = Buffer.from(await videoRes.arrayBuffer());
      const outPath = path.join(INPUT_DIR, 'heygen-final.mp4');
      fs.writeFileSync(outPath, buf);
      console.log(`Downloaded: ${outPath} (${Math.round(buf.length / 1024 / 1024 * 10) / 10}MB)`);
      break;
    }

    if (status === 'failed') {
      console.error('\nVideo generation failed:', check.data?.error);
      break;
    }
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
