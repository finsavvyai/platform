// Release management: versioning, changelog, rollback
export interface Release {
  id: string;
  version: string;
  description: string;
  changeLog: string[];
  createdAt: Date;
  releasedAt?: Date;
  rolledBackAt?: Date;
  status: 'draft' | 'released' | 'rolled-back';
}

export interface ReleaseCandidate {
  version: string;
  candidate: number;
  notes: string;
}

let releaseCounter = 0;

export class ReleaseManager {
  private releases: Map<string, Release> = new Map();
  private versions: string[] = [];

  createRelease(version: string, description: string): Release {
    this.validateVersion(version);
    if (this.getReleaseByVersion(version)) {
      throw new Error(`Release version already exists: ${version}`);
    }

    const release: Release = {
      id: `rel_${Date.now()}_${++releaseCounter}`,
      version,
      description,
      changeLog: [],
      createdAt: new Date(),
      status: 'draft',
    };

    this.releases.set(release.id, release);
    return release;
  }

  private validateVersion(version: string): void {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    if (!semverRegex.test(version)) {
      throw new Error(`Invalid version format: ${version}. Expected semver (major.minor.patch)`);
    }
  }

  addChangeLogEntry(releaseId: string, entry: string): Release | undefined {
    const release = this.releases.get(releaseId);
    if (!release) return undefined;
    release.changeLog.push(entry);
    return release;
  }

  publishRelease(releaseId: string): Release | undefined {
    const release = this.releases.get(releaseId);
    if (!release) return undefined;
    if (release.status !== 'draft') {
      throw new Error(`Cannot publish release with status: ${release.status}`);
    }

    release.status = 'released';
    release.releasedAt = new Date();
    this.upsertReleasedVersion(release.version);
    return release;
  }

  rollbackRelease(releaseId: string, previousVersion: string): Release | undefined {
    this.validateVersion(previousVersion);
    const release = this.releases.get(releaseId);
    if (!release || release.status !== 'released') return undefined;
    if (this.compareVersions(previousVersion, release.version) >= 0) {
      throw new Error(
        `Rollback target ${previousVersion} must be lower than released version ${release.version}`
      );
    }

    release.status = 'rolled-back';
    release.rolledBackAt = new Date();
    this.versions = this.versions.filter((v) => v !== release.version);
    this.upsertReleasedVersion(previousVersion);

    return release;
  }

  getRelease(id: string): Release | undefined {
    return this.releases.get(id);
  }

  getReleaseByVersion(version: string): Release | undefined {
    return Array.from(this.releases.values()).find((r) => r.version === version);
  }

  listReleases(status?: Release['status']): Release[] {
    return Array.from(this.releases.values())
      .filter((r) => !status || r.status === status)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getLatestVersion(): string | undefined {
    return this.versions[this.versions.length - 1];
  }

  compareVersions(v1: string, v2: string): number {
    const [maj1, min1, patch1] = v1.split('.').map(Number);
    const [maj2, min2, patch2] = v2.split('.').map(Number);

    if (maj1 !== maj2) return maj1 - maj2;
    if (min1 !== min2) return min1 - min2;
    return patch1 - patch2;
  }

  getReleasedVersions(): string[] {
    return [...this.versions];
  }

  private upsertReleasedVersion(version: string): void {
    if (!this.versions.includes(version)) {
      this.versions.push(version);
    }

    this.versions.sort((left, right) => this.compareVersions(left, right));
  }
}
