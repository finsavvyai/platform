/** Share helper — builds prefilled share content for pipe.shareSavings(). */

export type ShareChannel = 'twitter' | 'slack' | 'email' | 'url';

export interface ShareResult {
  url: string;
  message: string;
  savings: number;
}

const LANDING = 'https://clawpipe.ai';

/** Deterministic project ref hash — SHA-256 of the API key, hex, 12 chars. */
export async function refHash(apiKey: string): Promise<string> {
  const buf = new TextEncoder().encode(apiKey);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 12);
}

function shareUrl(ref: string): string {
  return `${LANDING}/?ref=${ref}`;
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Build share payload for the chosen channel. */
export async function buildShare(
  channel: ShareChannel,
  apiKey: string,
  thisMonthSavings: number,
): Promise<ShareResult> {
  const ref = await refHash(apiKey);
  const link = shareUrl(ref);
  const amount = fmtUsd(thisMonthSavings);

  switch (channel) {
    case 'twitter': {
      const body =
        `I just saved ${amount} on AI costs this month with @clawpipe — the only gateway that skips LLM calls entirely. ${link}`;
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(body)}`;
      return { url, message: body, savings: thisMonthSavings };
    }
    case 'slack': {
      const message =
        `*ClawPipe savings update*\n` +
        `I just saved *${amount}* on AI costs this month with <${LANDING}|ClawPipe> — ` +
        `the only gateway that skips LLM calls entirely.\n` +
        `<${link}|Try ClawPipe>`;
      return { url: link, message, savings: thisMonthSavings };
    }
    case 'email': {
      const subject = `I saved ${amount} on AI costs with ClawPipe`;
      const body =
        `Hey,\n\nI just saved ${amount} on AI costs this month using ClawPipe — ` +
        `the only gateway that skips LLM calls entirely (Booster + Cache + Smart Router).\n\n` +
        `If you're spending on OpenAI / Anthropic / etc., it's worth a look:\n${link}\n`;
      const url =
        `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      return { url, message: body, savings: thisMonthSavings };
    }
    case 'url':
    default: {
      return { url: link, message: link, savings: thisMonthSavings };
    }
  }
}
