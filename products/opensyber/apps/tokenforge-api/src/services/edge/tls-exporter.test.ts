import { describe, it, expect } from 'vitest';
import { readTlsExporter, TLS_EXPORTER_HEADER } from './tls-exporter.js';

function getter(value: string | undefined | null) {
  return (name: string) => (name === TLS_EXPORTER_HEADER ? value : undefined);
}

describe('readTlsExporter', () => {
  it('returns null + channelBoundHeader=0 when header is absent', () => {
    expect(readTlsExporter(getter(undefined))).toEqual({
      exporter: null, channelBoundHeader: '0',
    });
  });

  it('returns null when header value is the empty string', () => {
    expect(readTlsExporter(getter(''))).toEqual({
      exporter: null, channelBoundHeader: '0',
    });
  });

  it('returns null when header value is null', () => {
    expect(readTlsExporter(getter(null))).toEqual({
      exporter: null, channelBoundHeader: '0',
    });
  });

  it('rejects non-hex characters', () => {
    const r = readTlsExporter(getter('not-hex-chars-zzz-but-32-long-x'));
    expect(r.exporter).toBeNull();
    expect(r.channelBoundHeader).toBe('0');
  });

  it('rejects values shorter than 32 hex chars (16 bytes RFC 9266 floor)', () => {
    const tooShort = 'abcd1234abcd1234'; // 16 chars / 8 bytes
    const r = readTlsExporter(getter(tooShort));
    expect(r.exporter).toBeNull();
  });

  it('rejects values longer than 256 hex chars (header bloat guard)', () => {
    const tooLong = 'a'.repeat(257);
    const r = readTlsExporter(getter(tooLong));
    expect(r.exporter).toBeNull();
  });

  it('accepts a 32-hex-char minimum-length value and lower-cases it', () => {
    const valid = 'ABCDEF0123456789ABCDEF0123456789';
    const r = readTlsExporter(getter(valid));
    expect(r).toEqual({
      exporter: 'abcdef0123456789abcdef0123456789',
      channelBoundHeader: '1',
    });
  });

  it('accepts a 64-hex-char (32-byte) value — typical TLS 1.3 exporter', () => {
    const valid = '0123456789abcdef'.repeat(4); // 64 chars
    const r = readTlsExporter(getter(valid));
    expect(r.exporter).toBe(valid);
    expect(r.channelBoundHeader).toBe('1');
  });

  it('accepts 256-hex-char upper bound (128-byte exporter)', () => {
    const max = 'a'.repeat(256);
    expect(readTlsExporter(getter(max)).channelBoundHeader).toBe('1');
  });

  it('trims whitespace before validating', () => {
    const valid = '  abcdef0123456789abcdef0123456789  ';
    const r = readTlsExporter(getter(valid));
    expect(r.exporter).toBe('abcdef0123456789abcdef0123456789');
    expect(r.channelBoundHeader).toBe('1');
  });

  it('exposes the header name as TLS_EXPORTER_HEADER constant', () => {
    expect(TLS_EXPORTER_HEADER).toBe('X-TF-Channel-Exporter');
  });
});
