#!/usr/bin/env node

/**
 * Social Media Image Generator
 * Generates og-image.png, twitter-image.png, and investor-og-image.png
 * Uses Canvas API to create professional social media preview images
 */

const fs = require('fs');
const path = require('path');

// Check if canvas is available, if not provide instructions
try {
  const { createCanvas, registerFont } = require('canvas');

  console.log('🎨 Generating social media images...\n');

  // Configuration
  const OUTPUT_DIR = path.join(__dirname, '../../web-app/landing');

  // Image dimensions
  const OG_WIDTH = 1200;
  const OG_HEIGHT = 630;
  const TWITTER_WIDTH = 1200;
  const TWITTER_HEIGHT = 675;

  // Colors
  const GRADIENT_START = '#667eea';
  const GRADIENT_END = '#764ba2';
  const TEXT_COLOR = '#ffffff';
  const STAT_COLOR = '#f0f0f0';

  /**
   * Create gradient background
   */
  function createGradient(ctx, width, height) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, GRADIENT_START);
    gradient.addColorStop(0.5, '#8b5cf6');
    gradient.addColorStop(1, GRADIENT_END);
    return gradient;
  }

  /**
   * Draw rounded rectangle
   */
  function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Generate Open Graph image (1200x630)
   */
  function generateOGImage() {
    const canvas = createCanvas(OG_WIDTH, OG_HEIGHT);
    const ctx = canvas.getContext('2d');

    // Background gradient
    ctx.fillStyle = createGradient(ctx, OG_WIDTH, OG_HEIGHT);
    ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);

    // Add subtle pattern
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 30; i++) {
      for (let j = 0; j < 30; j++) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(i * 50, j * 50, 2, 2);
      }
    }
    ctx.globalAlpha = 1.0;

    // Main title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SDLC.ai', OG_WIDTH / 2, 150);

    // Subtitle
    ctx.font = '32px sans-serif';
    ctx.fillStyle = STAT_COLOR;
    ctx.fillText('Enterprise AI Compliance Middleware', OG_WIDTH / 2, 210);

    // Stats cards
    const stats = [
      { value: '90%', label: 'F500 Blocked' },
      { value: '$50B', label: 'Market Size' },
      { value: '100%', label: 'Test Coverage' }
    ];

    const cardWidth = 300;
    const cardHeight = 140;
    const cardSpacing = 50;
    const totalWidth = (cardWidth * 3) + (cardSpacing * 2);
    const startX = (OG_WIDTH - totalWidth) / 2;
    const startY = 320;

    stats.forEach((stat, index) => {
      const x = startX + (index * (cardWidth + cardSpacing));

      // Card background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      drawRoundedRect(ctx, x, startY, cardWidth, cardHeight, 15);
      ctx.fill();

      // Stat value
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = 'bold 56px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(stat.value, x + cardWidth / 2, startY + 70);

      // Stat label
      ctx.font = '24px sans-serif';
      ctx.fillStyle = STAT_COLOR;
      ctx.fillText(stat.label, x + cardWidth / 2, startY + 110);
    });

    // CTA text
    ctx.font = '28px sans-serif';
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.fillText('5-Minute Integration • HIPAA/GDPR Compliant', OG_WIDTH / 2, 550);

    // Save image
    const buffer = canvas.toBuffer('image/png');
    const outputPath = path.join(OUTPUT_DIR, 'og-image.png');
    fs.writeFileSync(outputPath, buffer);
    console.log('✅ Generated: og-image.png (1200x630)');
  }

  /**
   * Generate Twitter Card image (1200x675)
   */
  function generateTwitterImage() {
    const canvas = createCanvas(TWITTER_WIDTH, TWITTER_HEIGHT);
    const ctx = canvas.getContext('2d');

    // Background gradient
    ctx.fillStyle = createGradient(ctx, TWITTER_WIDTH, TWITTER_HEIGHT);
    ctx.fillRect(0, 0, TWITTER_WIDTH, TWITTER_HEIGHT);

    // Add subtle pattern
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 30; i++) {
      for (let j = 0; j < 30; j++) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(i * 50, j * 50, 2, 2);
      }
    }
    ctx.globalAlpha = 1.0;

    // Main title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 76px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SDLC.ai', TWITTER_WIDTH / 2, 160);

    // Subtitle
    ctx.font = '30px sans-serif';
    ctx.fillStyle = STAT_COLOR;
    ctx.fillText('Enterprise AI Compliance Middleware', TWITTER_WIDTH / 2, 220);

    // Key features
    const features = [
      '• One-line ChatGPT/Claude integration',
      '• Automatic PII redaction (12+ types)',
      '• Complete audit trails',
      '• HIPAA/GDPR/PCI-DSS compliant'
    ];

    ctx.font = '28px sans-serif';
    ctx.textAlign = 'left';
    features.forEach((feature, index) => {
      ctx.fillText(feature, 150, 330 + (index * 55));
    });

    // Bottom CTA
    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.fillText('$50B Market • Production Ready • 100% Test Coverage', TWITTER_WIDTH / 2, 600);

    // Save image
    const buffer = canvas.toBuffer('image/png');
    const outputPath = path.join(OUTPUT_DIR, 'twitter-image.png');
    fs.writeFileSync(outputPath, buffer);
    console.log('✅ Generated: twitter-image.png (1200x675)');
  }

  /**
   * Generate Investor OG image (1200x630)
   */
  function generateInvestorImage() {
    const canvas = createCanvas(OG_WIDTH, OG_HEIGHT);
    const ctx = canvas.getContext('2d');

    // Background gradient (darker for investor page)
    const gradient = ctx.createLinearGradient(0, 0, OG_WIDTH, OG_HEIGHT);
    gradient.addColorStop(0, '#4f46e5');
    gradient.addColorStop(0.5, '#6366f1');
    gradient.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);

    // Add subtle pattern
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 30; i++) {
      for (let j = 0; j < 30; j++) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(i * 50, j * 50, 2, 2);
      }
    }
    ctx.globalAlpha = 1.0;

    // Main title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 68px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SDLC.ai Investment Opportunity', OG_WIDTH / 2, 140);

    // Funding amount
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('$500K - $1M Seed Round', OG_WIDTH / 2, 220);

    // Key metrics
    const metrics = [
      { value: '$50B+', label: 'Market TAM (25% CAGR)' },
      { value: '100%', label: 'Test Coverage' },
      { value: '2 Weeks', label: 'Alpha to Production' }
    ];

    const cardWidth = 320;
    const cardHeight = 150;
    const cardSpacing = 40;
    const totalWidth = (cardWidth * 3) + (cardSpacing * 2);
    const startX = (OG_WIDTH - totalWidth) / 2;
    const startY = 310;

    metrics.forEach((metric, index) => {
      const x = startX + (index * (cardWidth + cardSpacing));

      // Card background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      drawRoundedRect(ctx, x, startY, cardWidth, cardHeight, 15);
      ctx.fill();

      // Metric value
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = 'bold 52px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(metric.value, x + cardWidth / 2, startY + 70);

      // Metric label
      ctx.font = '22px sans-serif';
      ctx.fillStyle = STAT_COLOR;
      ctx.fillText(metric.label, x + cardWidth / 2, startY + 110);
    });

    // Bottom text
    ctx.font = '26px sans-serif';
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.fillText('Compliance Middleware for Enterprise AI', OG_WIDTH / 2, 550);

    // Save image
    const buffer = canvas.toBuffer('image/png');
    const outputPath = path.join(OUTPUT_DIR, 'investor-og-image.png');
    fs.writeFileSync(outputPath, buffer);
    console.log('✅ Generated: investor-og-image.png (1200x630)');
  }

  // Generate all images
  generateOGImage();
  generateTwitterImage();
  generateInvestorImage();

  console.log('\n✨ All social media images generated successfully!');
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log('\n📋 Next steps:');
  console.log('1. Review the generated images');
  console.log('2. Run: npm run deploy:landing');
  console.log('3. Test previews at:');
  console.log('   - Facebook: https://developers.facebook.com/tools/debug/');
  console.log('   - Twitter: https://cards-dev.twitter.com/validator');

} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('📦 Canvas module not found. Installing...\n');
    console.log('Run these commands:\n');
    console.log('  npm install canvas');
    console.log('  node scripts/seo/generate-social-images.js\n');
    console.log('Or use the online image generator:');
    console.log('  1. Go to https://canva.com');
    console.log('  2. Create 1200x630px canvas');
    console.log('  3. Use purple/blue gradient background');
    console.log('  4. Add text: "SDLC.ai - Enterprise AI Compliance"');
    console.log('  5. Add stats: "90% F500 Blocked | $50B Market | 100% Test Coverage"');
    console.log('  6. Save as: og-image.png, twitter-image.png, investor-og-image.png');
    console.log('  7. Upload to /web-app/landing/\n');
  } else {
    console.error('Error generating images:', error);
  }
}
