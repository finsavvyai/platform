import { describe, it, expect, beforeEach } from 'vitest';
import { ReleaseManager } from '../src/services/release';

describe('ReleaseManager', () => {
  let manager: ReleaseManager;

  beforeEach(() => {
    manager = new ReleaseManager();
  });

  it('should create a release', () => {
    const release = manager.createRelease('1.0.0', 'Initial release');

    expect(release.version).toBe('1.0.0');
    expect(release.description).toBe('Initial release');
    expect(release.status).toBe('draft');
  });

  it('should reject invalid version format', () => {
    expect(() => manager.createRelease('invalid', 'Description')).toThrow();
    expect(() => manager.createRelease('1.0', 'Description')).toThrow();
  });

  it('should reject duplicate release versions', () => {
    manager.createRelease('1.0.0', 'Initial release');

    expect(() => manager.createRelease('1.0.0', 'Duplicate')).toThrow(
      'Release version already exists: 1.0.0'
    );
  });

  it('should add changelog entries', () => {
    const release = manager.createRelease('1.0.0', 'Initial');

    manager.addChangeLogEntry(release.id, 'Fixed bug #123');
    manager.addChangeLogEntry(release.id, 'Added feature X');

    const updated = manager.getRelease(release.id);
    expect(updated?.changeLog).toHaveLength(2);
  });

  it('should publish a release', () => {
    const release = manager.createRelease('1.0.0', 'Initial');

    const published = manager.publishRelease(release.id);

    expect(published?.status).toBe('released');
    expect(published?.releasedAt).toBeDefined();
  });

  it('should prevent publishing non-draft release', () => {
    const release = manager.createRelease('1.0.0', 'Initial');
    manager.publishRelease(release.id);

    expect(() => manager.publishRelease(release.id)).toThrow();
  });

  it('should rollback a released version', () => {
    const v1 = manager.createRelease('1.0.0', 'Initial');
    manager.publishRelease(v1.id);

    const rolled = manager.rollbackRelease(v1.id, '0.9.0');

    expect(rolled?.status).toBe('rolled-back');
    expect(rolled?.rolledBackAt).toBeDefined();
    expect(manager.getLatestVersion()).toBe('0.9.0');
  });

  it('should reject rollback targets that are not lower than the current release', () => {
    const release = manager.createRelease('1.1.0', 'Release');
    manager.publishRelease(release.id);

    expect(() => manager.rollbackRelease(release.id, '1.1.0')).toThrow(
      'Rollback target 1.1.0 must be lower than released version 1.1.0'
    );
  });

  it('should get release by version', () => {
    manager.createRelease('1.0.0', 'Initial');

    const found = manager.getReleaseByVersion('1.0.0');

    expect(found?.version).toBe('1.0.0');
  });

  it('should list all releases', () => {
    manager.createRelease('1.0.0', 'v1');
    manager.createRelease('1.1.0', 'v1.1');
    manager.createRelease('2.0.0', 'v2');

    const releases = manager.listReleases();
    expect(releases).toHaveLength(3);
  });

  it('should list releases by status', () => {
    const r1 = manager.createRelease('1.0.0', 'v1');
    manager.createRelease('1.1.0', 'v1.1');

    manager.publishRelease(r1.id);

    const draft = manager.listReleases('draft');
    expect(draft).toHaveLength(1);

    const released = manager.listReleases('released');
    expect(released).toHaveLength(1);
  });

  it('should get latest version', () => {
    const r1 = manager.createRelease('1.0.0', 'v1');
    manager.publishRelease(r1.id);

    const r2 = manager.createRelease('1.1.0', 'v1.1');
    manager.publishRelease(r2.id);

    const latest = manager.getLatestVersion();
    expect(latest).toBe('1.1.0');
  });

  it('should compare versions', () => {
    expect(manager.compareVersions('1.0.0', '1.1.0')).toBeLessThan(0);
    expect(manager.compareVersions('1.1.0', '1.0.0')).toBeGreaterThan(0);
    expect(manager.compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(manager.compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
  });
});
