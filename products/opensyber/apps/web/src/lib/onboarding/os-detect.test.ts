import { describe, it, expect } from 'vitest';
import { detectOS, osLabel } from './os-detect';

describe('detectOS', () => {
  it('macos Safari', () => {
    expect(detectOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605'))
      .toBe('macos');
  });

  it('macos Chrome', () => {
    expect(detectOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) Chrome/120.0.0.0'))
      .toBe('macos');
  });

  it('windows', () => {
    expect(detectOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'))
      .toBe('windows');
  });

  it('linux', () => {
    expect(detectOS('Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0'))
      .toBe('linux');
  });

  it('chrome os reported as linux', () => {
    expect(detectOS('Mozilla/5.0 (X11; CrOS x86_64) Chrome/120.0.0.0'))
      .toBe('linux');
  });

  it('iphone → mobile (not macos)', () => {
    expect(detectOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148'))
      .toBe('mobile');
  });

  it('ipad → mobile', () => {
    expect(detectOS('Mozilla/5.0 (iPad; CPU OS 17_0) Mobile')).toBe('mobile');
  });

  it('android → mobile (not linux)', () => {
    expect(detectOS('Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0'))
      .toBe('mobile');
  });

  it('empty string → unknown', () => {
    expect(detectOS('')).toBe('unknown');
  });

  it('undefined → unknown', () => {
    expect(detectOS(undefined)).toBe('unknown');
  });

  it('null → unknown', () => {
    expect(detectOS(null)).toBe('unknown');
  });

  it('osLabel covers every os value', () => {
    expect(osLabel('macos')).toBe('macOS');
    expect(osLabel('linux')).toBe('Linux');
    expect(osLabel('windows')).toBe('Windows');
    expect(osLabel('mobile')).toBe('Mobile');
    expect(osLabel('unknown')).toBe('Your OS');
  });
});
