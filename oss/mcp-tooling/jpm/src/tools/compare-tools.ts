import { z } from "zod";
import { httpClient } from "../http-client.js";
import { cache, CacheManager } from "../cache.js";
import { CACHE_SETTINGS } from "../constants.js";
import {
  createSuccessResponse,
  createErrorResponse
} from "../utils/index.js";

const ComparePackagesSchema = z.object({
  packages: z.array(z.string()).min(2).max(5).describe("Array of 2-5 package names to compare"),
});

// Export tools and handlers
export const tools = [
  {
    name: "compare_packages",
    description: "Compare multiple npm packages side-by-side (size, downloads, maintenance, dependencies). Great for choosing between alternatives like 'moment vs dayjs' or 'express vs fastify vs hono'.",
    inputSchema: ComparePackagesSchema
  }
];

export const handlers = new Map([
  ["compare_packages", handleComparePackages]
]);

interface PackageData {
  name: string;
  version: string;
  description: string;
  license: string;
  weeklyDownloads: number;
  unpackedSize: number | null;
  fileCount: number | null;
  dependencies: number;
  lastPublish: string;
  maintainers: number;
  hasTypes: boolean;
  engines: Record<string, string> | null;
  repository: string | null;
  gzipSize: number | null;
}

async function fetchPackageData(name: string): Promise<PackageData> {
  const registryData: any = await httpClient.npmRegistry(`/${encodeURIComponent(name)}`);
  const latestVersion = registryData['dist-tags']?.latest;
  const versionData = registryData.versions?.[latestVersion] || {};
  const dist = versionData.dist || {};

  // Fetch weekly download count
  let weeklyDownloads = 0;
  try {
    const statsData: any = await httpClient.request(
      `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`
    );
    weeklyDownloads = statsData.downloads || 0;
  } catch {
    // downloads API may fail for scoped/new packages
  }

  // Try bundlephobia for gzip size
  let gzipSize: number | null = null;
  try {
    const bundleData: any = await httpClient.request(
      `https://bundlephobia.com/api/size?package=${encodeURIComponent(name)}@${latestVersion}`
    );
    gzipSize = bundleData.gzip || null;
  } catch {
    // bundlephobia may not have data for all packages
  }

  const deps = versionData.dependencies || {};
  const hasTypes = !!(versionData.types || versionData.typings ||
    registryData['dist-tags']?.latest && registryData.versions?.[latestVersion]?.devDependencies?.['typescript']);

  const repoUrl = typeof registryData.repository === 'string'
    ? registryData.repository
    : registryData.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '') || null;

  return {
    name,
    version: latestVersion || 'unknown',
    description: registryData.description || 'No description',
    license: versionData.license || registryData.license || 'Unknown',
    weeklyDownloads,
    unpackedSize: dist.unpackedSize || null,
    fileCount: dist.fileCount || null,
    dependencies: Object.keys(deps).length,
    lastPublish: registryData.time?.[latestVersion] || 'unknown',
    maintainers: (registryData.maintainers || []).length,
    hasTypes,
    engines: versionData.engines || null,
    repository: repoUrl,
    gzipSize,
  };
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return 'N/A';
  const kb = bytes / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;
}

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

function timeSince(dateStr: string): string {
  if (dateStr === 'unknown') return 'unknown';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${(days / 365).toFixed(1)}y ago`;
}

function pickWinner(packages: PackageData[], key: keyof PackageData, higher: boolean = true): string {
  let best = packages[0];
  for (const pkg of packages.slice(1)) {
    const a = best[key] as number | null;
    const b = pkg[key] as number | null;
    if (a === null && b !== null) { best = pkg; continue; }
    if (b === null) continue;
    if (higher ? b > a! : b < a!) best = pkg;
  }
  return best.name;
}

async function handleComparePackages(args: unknown) {
  const input = ComparePackagesSchema.parse(args);
  const packageNames = input.packages;

  const cacheKey = `compare:${packageNames.sort().join(':')}`;
  const cached = await cache.get<string>(cacheKey);
  if (cached) {
    return createSuccessResponse(cached);
  }

  try {
    const results = await Promise.allSettled(
      packageNames.map(name => fetchPackageData(name))
    );

    const packages: PackageData[] = [];
    const errors: string[] = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        packages.push(result.value);
      } else {
        errors.push(`Failed to fetch ${packageNames[i]}: ${result.reason?.message || 'unknown error'}`);
      }
    });

    if (packages.length < 2) {
      return createErrorResponse(
        new Error(`Need at least 2 packages to compare. Errors: ${errors.join('; ')}`),
        'Comparison failed'
      );
    }

    // Build comparison output
    const lines: string[] = [];
    lines.push(`⚖️  Package Comparison: ${packages.map(p => p.name).join(' vs ')}\n`);

    // Description row
    lines.push(`---`);
    for (const pkg of packages) {
      lines.push(`📦 **${pkg.name}** v${pkg.version}`);
      lines.push(`   ${pkg.description}`);
      lines.push('');
    }

    // Comparison table
    const col = (label: string, fn: (p: PackageData) => string) => {
      const vals = packages.map(fn);
      return `| ${label.padEnd(18)} | ${vals.map(v => v.padEnd(20)).join(' | ')} |`;
    };

    const header = `| ${'Metric'.padEnd(18)} | ${packages.map(p => p.name.padEnd(20)).join(' | ')} |`;
    const divider = `|${'-'.repeat(20)}|${packages.map(() => '-'.repeat(22)).join('|')}|`;

    lines.push(header);
    lines.push(divider);
    lines.push(col('Weekly Downloads', p => formatDownloads(p.weeklyDownloads)));
    lines.push(col('Gzip Size', p => formatSize(p.gzipSize)));
    lines.push(col('Unpacked Size', p => formatSize(p.unpackedSize)));
    lines.push(col('Dependencies', p => p.dependencies.toString()));
    lines.push(col('License', p => p.license));
    lines.push(col('TypeScript', p => p.hasTypes ? '✅ Yes' : '❌ No'));
    lines.push(col('Last Publish', p => timeSince(p.lastPublish)));
    lines.push(col('Maintainers', p => p.maintainers.toString()));
    lines.push(col('Files', p => p.fileCount?.toString() || 'N/A'));

    // Verdicts
    lines.push('');
    lines.push(`🏆 **Quick Verdicts:**`);
    lines.push(`  • Most popular: **${pickWinner(packages, 'weeklyDownloads', true)}**`);
    lines.push(`  • Smallest bundle: **${pickWinner(packages, 'gzipSize', false)}**`);
    lines.push(`  • Fewest deps: **${pickWinner(packages, 'dependencies', false)}**`);
    lines.push(`  • Most recently updated: **${pickWinner(packages, 'lastPublish', true)}**`);

    if (errors.length > 0) {
      lines.push('');
      lines.push(`⚠️  Warnings: ${errors.join('; ')}`);
    }

    const output = lines.join('\n');
    await cache.set(cacheKey, output, CACHE_SETTINGS.SHORT_TTL);
    return createSuccessResponse(output);

  } catch (error: any) {
    return createErrorResponse(error, 'Failed to compare packages');
  }
}
