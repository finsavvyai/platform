/**
 * Detect the user's OS from a User-Agent string.
 *
 * Pure function — wrap `navigator.userAgent` at the call site. We avoid
 * `userAgentData` (Client Hints) because Safari and most non-Chromium
 * browsers don't implement it yet; UA-string detection covers 100% of
 * traffic with acceptable accuracy for "which install command should we
 * show first?". Wrong guess just expands the alternatives section —
 * never breaks the flow.
 */

export type DetectedOS = 'macos' | 'linux' | 'windows' | 'mobile' | 'unknown';

export function detectOS(userAgent: string | undefined | null): DetectedOS {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();

  // Mobile first — these often contain Linux/Mac substrings that would
  // otherwise mis-classify them as desktop.
  if (/android|iphone|ipad|ipod|mobile/i.test(ua)) return 'mobile';

  if (/mac os x|macintosh|macos/i.test(ua)) return 'macos';
  if (/windows|win32|win64|wow64/i.test(ua)) return 'windows';
  if (/linux|x11|cros/i.test(ua)) return 'linux';

  return 'unknown';
}

/** Human-readable label for UI use. */
export function osLabel(os: DetectedOS): string {
  switch (os) {
    case 'macos': return 'macOS';
    case 'linux': return 'Linux';
    case 'windows': return 'Windows';
    case 'mobile': return 'Mobile';
    case 'unknown': return 'Your OS';
  }
}
