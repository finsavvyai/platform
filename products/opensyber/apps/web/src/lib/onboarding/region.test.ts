import { describe, it, expect } from 'vitest';
import { inferRegion } from './region';

describe('inferRegion', () => {
  it('uses country_hint when present (US → us-east)', () => {
    expect(inferRegion({ country_hint: 'US' })).toBe('us-east');
  });

  it('country_hint beats conflicting timezone', () => {
    expect(inferRegion({ country_hint: 'US', timezone: 'Europe/Berlin' })).toBe('us-east');
  });

  it('country_hint is case-insensitive', () => {
    expect(inferRegion({ country_hint: 'jp' })).toBe('ap-southeast');
  });

  it('unknown country_hint falls through to timezone', () => {
    expect(inferRegion({ country_hint: 'ZZ', timezone: 'Europe/Paris' })).toBe('eu-central');
  });

  it('timezone Europe/* → eu-central', () => {
    expect(inferRegion({ timezone: 'Europe/Berlin' })).toBe('eu-central');
  });

  it('timezone Africa/* → eu-central (closest geo)', () => {
    expect(inferRegion({ timezone: 'Africa/Cairo' })).toBe('eu-central');
  });

  it('timezone America/Los_Angeles → us-west', () => {
    expect(inferRegion({ timezone: 'America/Los_Angeles' })).toBe('us-west');
  });

  it('timezone America/New_York → us-east', () => {
    expect(inferRegion({ timezone: 'America/New_York' })).toBe('us-east');
  });

  it('timezone America/Argentina/* → us-east (specific match before generic)', () => {
    expect(inferRegion({ timezone: 'America/Argentina/Buenos_Aires' })).toBe('us-east');
  });

  it('timezone Asia/Tokyo → ap-southeast', () => {
    expect(inferRegion({ timezone: 'Asia/Tokyo' })).toBe('ap-southeast');
  });

  it('timezone Asia/Jerusalem → eu-central (falls through Asia/ generic)', () => {
    expect(inferRegion({ timezone: 'Asia/Jerusalem' })).toBe('eu-central');
  });

  it('timezone Australia/* → ap-southeast', () => {
    expect(inferRegion({ timezone: 'Australia/Sydney' })).toBe('ap-southeast');
  });

  it('locale country code applied when no tz match', () => {
    expect(inferRegion({ locale: 'en-AU' })).toBe('ap-southeast');
  });

  it('locale without country code → default region', () => {
    expect(inferRegion({ locale: 'en' })).toBe('eu-central');
  });

  it('no signals → default region eu-central (GDPR-safe)', () => {
    expect(inferRegion({})).toBe('eu-central');
  });
});
