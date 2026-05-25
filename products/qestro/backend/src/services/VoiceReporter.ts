/**
 * Voice Reporter — Generate spoken test summaries
 *
 * Uses Voicebox (local TTS) or falls back to text-only reports
 * when no TTS backend is configured. Produces audio files that
 * can be attached to Slack/Discord notifications via OpenClaw bridge.
 *
 * Reference: https://github.com/jamiepine/voicebox
 */

import { logger } from '../utils/logger.js';

export interface TestSummary {
  totalTests: number;
  passed: number;
  failed: number;
  healed: number;
  durationMs: number;
  projectName: string;
  topFailures?: Array<{ testName: string; reason: string }>;
}

export interface VoiceReport {
  text: string;              // Human-readable transcript
  ssml: string;              // SSML for TTS engines that support it
  audioUrl?: string;         // URL to generated audio (if TTS succeeded)
  audioBase64?: string;      // Base64 audio data (for inline embedding)
  durationSeconds?: number;
  voice: string;
}

export interface VoiceConfig {
  /** TTS backend URL (Voicebox or OpenAI-compatible) */
  voiceboxUrl?: string;
  /** Voice to use */
  voice?: string;
  /** Language */
  language?: string;
}

export class VoiceReporter {
  private config: VoiceConfig;

  constructor(config: VoiceConfig = {}) {
    this.config = {
      voiceboxUrl: config.voiceboxUrl || process.env.VOICEBOX_URL,
      voice: config.voice || 'default',
      language: config.language || 'en',
    };
  }

  /**
   * Generate a voice report from a test summary
   */
  async generateReport(summary: TestSummary): Promise<VoiceReport> {
    const text = this.buildTranscript(summary);
    const ssml = this.buildSSML(summary);

    const report: VoiceReport = {
      text,
      ssml,
      voice: this.config.voice!,
    };

    // Try to synthesize audio if Voicebox is configured
    if (this.config.voiceboxUrl) {
      try {
        const audio = await this.synthesize(text);
        report.audioBase64 = audio.base64;
        report.durationSeconds = audio.durationSeconds;
      } catch (err) {
        logger.warn('Voice synthesis failed, returning text-only report', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return report;
  }

  /**
   * Build human-readable transcript
   */
  private buildTranscript(s: TestSummary): string {
    const parts: string[] = [];

    parts.push(`${s.projectName} test run complete.`);

    if (s.totalTests === 0) {
      parts.push('No tests were executed.');
      return parts.join(' ');
    }

    const passRate = Math.round((s.passed / s.totalTests) * 100);
    parts.push(`${s.passed} of ${s.totalTests} tests passed — ${passRate} percent pass rate.`);

    if (s.failed > 0) {
      parts.push(`${s.failed} ${s.failed === 1 ? 'test' : 'tests'} failed.`);
    }

    if (s.healed > 0) {
      parts.push(`${s.healed} ${s.healed === 1 ? 'test was' : 'tests were'} automatically healed.`);
    }

    const duration = Math.round(s.durationMs / 1000);
    if (duration < 60) {
      parts.push(`Total duration: ${duration} seconds.`);
    } else {
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      parts.push(`Total duration: ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}${seconds > 0 ? ` and ${seconds} seconds` : ''}.`);
    }

    if (s.topFailures && s.topFailures.length > 0) {
      parts.push('Top failures:');
      for (const failure of s.topFailures.slice(0, 3)) {
        parts.push(`${failure.testName}: ${failure.reason}.`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Build SSML version for TTS engines that support it
   * Adds pauses and emphasis for better prosody
   */
  private buildSSML(s: TestSummary): string {
    const passRate = s.totalTests > 0 ? Math.round((s.passed / s.totalTests) * 100) : 0;
    const emotion = s.failed === 0 ? 'cheerful' : s.failed > s.passed ? 'sad' : 'neutral';

    return `<speak>
  <voice name="${this.config.voice}">
    <mstts:express-as style="${emotion}">
      ${s.projectName} test run complete. <break time="400ms"/>
      <emphasis level="strong">${s.passed}</emphasis> of ${s.totalTests} tests passed
      — ${passRate} percent pass rate. <break time="300ms"/>
      ${s.failed > 0 ? `<emphasis level="moderate">${s.failed} failed.</emphasis> <break time="200ms"/>` : ''}
      ${s.healed > 0 ? `${s.healed} automatically healed. <break time="200ms"/>` : ''}
    </mstts:express-as>
  </voice>
</speak>`.trim();
  }

  /**
   * Call Voicebox TTS endpoint to synthesize audio
   */
  private async synthesize(text: string): Promise<{ base64: string; durationSeconds: number }> {
    const url = `${this.config.voiceboxUrl}/synthesize`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: this.config.voice,
        language: this.config.language,
        format: 'mp3',
      }),
    });

    if (!response.ok) {
      throw new Error(`Voicebox synthesis failed: ${response.status}`);
    }

    const data = await response.json() as {
      audio: string;
      duration?: number;
    };

    return {
      base64: data.audio,
      durationSeconds: data.duration || 0,
    };
  }
}

export const voiceReporter = new VoiceReporter();
