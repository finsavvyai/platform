import { buildDeepLink, buildWebLink, parseDeepLink, routeFromDeepLink } from '../../lib/deepLinks';

describe('deepLinks', () => {
  it('buildDeepLink creates qestro:// URL', () => {
    expect(buildDeepLink('runs/abc')).toBe('qestro://runs/abc');
  });

  it('buildWebLink creates https URL', () => {
    expect(buildWebLink('cases/123')).toBe('https://app.qestro.io/cases/123');
  });

  it('parseDeepLink extracts screen and id from scheme URL', () => {
    const result = parseDeepLink('qestro://runs/abc');
    expect(result).toEqual({ screen: 'runs', id: 'abc' });
  });

  it('parseDeepLink extracts from web URL', () => {
    const result = parseDeepLink('https://app.qestro.io/cases/xyz');
    expect(result).toEqual({ screen: 'cases', id: 'xyz' });
  });

  it('parseDeepLink returns null for invalid URL', () => {
    expect(parseDeepLink('qestro://invalid')).toBeNull();
  });

  it('routeFromDeepLink maps runs to route', () => {
    expect(routeFromDeepLink('qestro://runs/abc')).toBe('/runs/abc');
  });

  it('routeFromDeepLink maps cases to route', () => {
    expect(routeFromDeepLink('qestro://cases/123')).toBe('/cases/123');
  });

  it('routeFromDeepLink maps recording to route with query param', () => {
    expect(routeFromDeepLink('qestro://recording/r1')).toBe('/recording/active?id=r1');
  });

  it('routeFromDeepLink returns null for unknown screen', () => {
    expect(routeFromDeepLink('qestro://unknown/id')).toBeNull();
  });
});
