/**
 * Log Analyzer Skill
 * Scans container logs for anomalies and suspicious patterns.
 */
const fs = require('node:fs');
const path = require('node:path');
const { parentPort } = require('node:worker_threads');

const SCAN_INTERVAL_MS = 30_000;
const LOG_DIR = '/var/log';

const SUSPICIOUS_PATTERNS = [
  /failed password/i,
  /authentication failure/i,
  /permission denied/i,
  /segfault/i,
  /out of memory/i,
  /connection refused/i,
  /unauthorized/i,
  /suspicious/i,
];

function scanLogFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').slice(-100); // Last 100 lines
    const matches = [];

    for (const line of lines) {
      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(line)) {
          matches.push({ pattern: pattern.source, line: line.trim() });
          break;
        }
      }
    }

    return matches;
  } catch {
    return [];
  }
}

function scanLogs() {
  try {
    const logFiles = fs.readdirSync(LOG_DIR)
      .filter((f) => f.endsWith('.log'))
      .map((f) => path.join(LOG_DIR, f));

    let totalMatches = 0;
    for (const file of logFiles) {
      const matches = scanLogFile(file);
      totalMatches += matches.length;
      if (matches.length > 0 && parentPort) {
        parentPort.postMessage({
          type: 'anomaly',
          file,
          matchCount: matches.length,
          samples: matches.slice(0, 3),
        });
      }
    }

    if (totalMatches > 0) {
      console.log(`[log-analyzer] Found ${totalMatches} suspicious entries`);
    }
  } catch {
    // Log dir may not exist in all environments
  }
}

console.log('[log-analyzer] Started — scanning every 30s');
scanLogs();
setInterval(scanLogs, SCAN_INTERVAL_MS);
