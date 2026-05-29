#!/usr/bin/env node
// Generate a 256x256 PNG icon with a blue gradient tile, a simple white database cylinder,
// and a small yellow AI spark. No native deps; uses pngjs for pure-JS PNG writing.

const { PNG } = require('pngjs');
const fs = require('fs');

const W = 256, H = 256;
const png = new PNG({ width: W, height: H });

function putPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const idx = (W * y + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

// Background: simple diagonal blue gradient
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const t = (x + y) / (W + H);
    const r = Math.round((0x25 * (1 - t)) + (0x1E * t)); // 0x25->0x1E
    const g = Math.round((0x63 * (1 - t)) + (0x40 * t)); // 0x63->0x40
    const b = Math.round((0xEB * (1 - t)) + (0xAF * t)); // 0xEB->0xAF
    putPixel(x, y, r, g, b, 255);
  }
}

// Helper: draw filled ellipse with AA-lite edge
function fillEllipse(cx, cy, rx, ry, color) {
  const [r, g, b, a] = color;
  for (let y = Math.max(0, cy - ry - 2); y <= Math.min(H - 1, cy + ry + 2); y++) {
    for (let x = Math.max(0, cx - rx - 2); x <= Math.min(W - 1, cx + rx + 2); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d <= 1) {
        putPixel(x, y, r, g, b, a);
      } else if (d <= 1.02) {
        // simple edge smoothing
        const f = Math.max(0, Math.min(1, 1.02 - d) * 50);
        const idx = (W * y + x) << 2;
        const oa = png.data[idx + 3] / 255;
        const na = Math.min(1, oa + (a / 255) * f * 0.25);
        const nr = Math.round((png.data[idx] * oa + r * (na - oa)) / (na || 1));
        const ng = Math.round((png.data[idx + 1] * oa + g * (na - oa)) / (na || 1));
        const nb = Math.round((png.data[idx + 2] * oa + b * (na - oa)) / (na || 1));
        png.data[idx] = nr; png.data[idx + 1] = ng; png.data[idx + 2] = nb; png.data[idx + 3] = Math.round(na * 255);
      }
    }
  }
}

// Helper: fill rectangle
function fillRect(x0, y0, w, h, color) {
  const [r, g, b, a] = color;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      putPixel(x, y, r, g, b, a);
    }
  }
}

// Draw database cylinder
const cx = 128;
fillEllipse(cx, 86, 64, 22, [255, 255, 255, 242]);        // top
fillRect(64, 86, 128, 110, [237, 242, 247, 255]);         // body
fillEllipse(cx, 196, 64, 22, [209, 213, 219, 255]);       // bottom

// Band lines (two subtle horizontal ellipses)
fillEllipse(cx, 116, 64, 12, [200, 205, 212, 90]);
fillEllipse(cx, 146, 64, 12, [200, 205, 212, 90]);

// AI spark (small star) in yellow
function fillCircle(x0, y0, r, color) {
  const [cr, cg, cb, ca] = color;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) putPixel(x0 + x, y0 + y, cr, cg, cb, ca);
    }
  }
}
fillCircle(188, 70, 6, [251, 191, 36, 255]);
fillCircle(188, 70, 3, [245, 158, 11, 255]);

// Simple circuitry nodes
fillCircle(128, 112, 3, [147, 197, 253, 255]);
fillCircle(112, 148, 3, [147, 197, 253, 255]);

// Save
const out = fs.createWriteStream(require('path').join(__dirname, '..', 'resources', 'icon.png'));
png.pack().pipe(out).on('finish', () => {
  console.log('✅ Generated resources/icon.png');
});

