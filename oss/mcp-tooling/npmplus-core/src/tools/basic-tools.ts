import { z } from "zod";
import { cache, CacheManager } from "../cache.js";
import { httpClient } from "../http-client.js";

// Package Info Schema
const PackageInfoSchema = z.object({
  packageName: z.string().describe("Package name to get information for"),
  version: z.string().optional().describe("Specific version to check (optional)")
});

// Check License Schema  
const CheckLicenseSchema = z.object({
  packageName: z.string().describe("Package name to check license for"),
  version: z.string().optional().describe("Specific version to check (optional)")
});

// Clean Cache Schema
const CleanCacheSchema = z.object({
  cwd: z.string().optional().describe("Working directory (default: current)"),
  global: z.boolean().default(false).describe("Clean global cache instead of local")
});

// Export tools and handlers
export const tools = [
  {
    name: "package_info",
    description: "Get detailed information about an npm package",
    inputSchema: PackageInfoSchema
  },
  {
    name: "check_license", 
    description: "Check the license of a specific package",
    inputSchema: CheckLicenseSchema
  },
  {
    name: "clean_cache",
    description: "Clean the package manager cache to free up space",
    inputSchema: CleanCacheSchema
  }
];

export const handlers = new Map([
  ["package_info", handlePackageInfo],
  ["check_license", handleCheckLicense], 
  ["clean_cache", handleCleanCache]
]);

async function handlePackageInfo(args: unknown) {
  const input = PackageInfoSchema.parse(args);
  
  // Check cache first
  const cacheKey = CacheManager.keys.packageInfo(input.packageName, input.version);
  const cached = await cache.get<any>(cacheKey);
  if (cached) {
    return { content: [{ type: "text", text: cached }] };
  }

  try {
    const url = input.version 
      ? `https://registry.npmjs.org/${input.packageName}/${input.version}`
      : `https://registry.npmjs.org/${input.packageName}`;
      
    const data = await httpClient.get(url);
    
    const packageInfo = {
      name: data.name,
      version: data.version || data['dist-tags']?.latest,
      description: data.description,
      homepage: data.homepage,
      repository: data.repository,
      keywords: data.keywords,
      license: data.license,
      author: data.author,
      maintainers: data.maintainers,
      dependencies: data.dependencies,
      devDependencies: data.devDependencies,
      publishedAt: data.time?.[data.version || data['dist-tags']?.latest],
      downloads: data.downloads
    };

    const result = `Package: ${packageInfo.name}@${packageInfo.version}
Description: ${packageInfo.description || 'No description'}
License: ${packageInfo.license || 'Unknown'}
Homepage: ${packageInfo.homepage || 'None'}
Repository: ${packageInfo.repository?.url || 'None'}
Keywords: ${packageInfo.keywords?.join(', ') || 'None'}
Author: ${packageInfo.author?.name || packageInfo.author || 'Unknown'}
Published: ${packageInfo.publishedAt || 'Unknown'}

Dependencies: ${Object.keys(packageInfo.dependencies || {}).length}
Dev Dependencies: ${Object.keys(packageInfo.devDependencies || {}).length}`;

    // Cache the result
    await cache.set(cacheKey, result);
    
    return { content: [{ type: "text", text: result }] };
  } catch (error: any) {
    return { 
      content: [{ 
        type: "text", 
        text: `Error getting package info: ${error.message}` 
      }] 
    };
  }
}

async function handleCheckLicense(args: unknown) {
  const input = CheckLicenseSchema.parse(args);
  
  try {
    const url = input.version 
      ? `https://registry.npmjs.org/${input.packageName}/${input.version}`
      : `https://registry.npmjs.org/${input.packageName}`;
      
    const data = await httpClient.get(url);
    
    const license = data.license || 'Unknown';
    const licenseFile = data.readme?.match(/## License\n\n([^#]*)/)?.[1];
    
    const result = `Package: ${data.name}@${data.version || data['dist-tags']?.latest}
License: ${license}
${licenseFile ? `\nLicense Details:\n${licenseFile.trim()}` : ''}`;

    return { content: [{ type: "text", text: result }] };
  } catch (error: any) {
    return { 
      content: [{ 
        type: "text", 
        text: `Error checking license: ${error.message}` 
      }] 
    };
  }
}

async function handleCleanCache(args: unknown) {
  const input = CleanCacheSchema.parse(args);
  
  try {
    const { execa } = await import("execa");
    const { detectPackageManager } = await import("../pm-detect.js");
    
    const cwd = input.cwd || process.cwd();
    const pm = await detectPackageManager(cwd);
    
    let command: string[];
    switch (pm) {
      case 'yarn':
        command = input.global ? ['yarn', 'cache', 'clean', '--global'] : ['yarn', 'cache', 'clean'];
        break;
      case 'pnpm':
        command = input.global ? ['pnpm', 'store', 'prune'] : ['pnpm', 'store', 'prune'];
        break;
      default: // npm
        command = input.global ? ['npm', 'cache', 'clean', '--force', '--global'] : ['npm', 'cache', 'clean', '--force'];
    }

    const result = await execa(command[0], command.slice(1), { 
      cwd,
      timeout: 30000 
    });
    
    return { 
      content: [{ 
        type: "text", 
        text: `Cache cleaned successfully using ${pm}\n${result.stdout}` 
      }] 
    };
  } catch (error: any) {
    return { 
      content: [{ 
        type: "text", 
        text: `Error cleaning cache: ${error.message}` 
      }] 
    };
  }
}