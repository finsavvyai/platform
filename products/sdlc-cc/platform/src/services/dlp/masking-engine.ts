/**
 * MaskingEngine - Data masking with multiple strategies
 */

import crypto from 'crypto';
import {
  DLPConfig,
  ProcessedData,
  MaskingParams,
} from '../../types/dlp';

export class MaskingEngine {
  private config: DLPConfig['masking'];

  constructor(config: DLPConfig['masking']) {
    this.config = config;
  }

  async mask(data: ProcessedData | string, params: MaskingParams): Promise<ProcessedData | string> {
    const method = params.method || 'FULL';

    switch (method) {
      case 'FULL':
        return this.fullMask(data);
      case 'PARTIAL':
        return this.partialMask(data, params);
      case 'TOKENIZATION':
        return this.tokenize(data, params);
      case 'HASH':
        return this.hash(data, params);
      default:
        return data;
    }
  }

  private fullMask(data: ProcessedData | string): ProcessedData | string {
    if (typeof data === 'string') {
      return '*'.repeat(data.length);
    } else if (data.text) {
      return {
        ...data,
        text: '*'.repeat(data.text.length)
      };
    } else if (typeof data === 'object') {
      return this.maskObject(data);
    }

    return '***MASKED***';
  }

  private partialMask(data: ProcessedData | string, params: MaskingParams): ProcessedData | string {
    const preserveFormat = params.preserveFormat || false;
    const visibleChars = params.visibleChars || 4;

    if (typeof data === 'string') {
      if (preserveFormat) {
        return data.substring(0, visibleChars) + '*'.repeat(data.length - visibleChars);
      } else {
        return '*'.repeat(data.length - visibleChars) + data.substring(data.length - visibleChars);
      }
    } else if (data.text) {
      const text = data.text;
      const masked = preserveFormat
        ? text.substring(0, visibleChars) + '*'.repeat(text.length - visibleChars)
        : '*'.repeat(text.length - visibleChars) + text.substring(text.length - visibleChars);

      return { ...data, text: masked };
    }

    return data;
  }

  private tokenize(data: ProcessedData | string, params: MaskingParams): ProcessedData | string {
    if (typeof data === 'string') {
      return `TOKEN_${crypto.createHash('sha256').update(data).digest('hex').substring(0, 16)}`;
    }

    return data;
  }

  private hash(data: ProcessedData | string, params: MaskingParams): ProcessedData | string {
    if (typeof data === 'string') {
      return crypto.createHash('sha256').update(data).digest('hex');
    }

    return data;
  }

  private maskObject(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map(item => this.maskObject(item));
    } else if (obj && typeof obj === 'object') {
      const masked: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          masked[key] = '*'.repeat(value.length);
        } else if (typeof value === 'object') {
          masked[key] = this.maskObject(value);
        } else {
          masked[key] = value;
        }
      }
      return masked;
    }

    return obj;
  }
}
