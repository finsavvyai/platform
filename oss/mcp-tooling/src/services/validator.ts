export interface Tool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface Resource {
  name: string;
  mimeType: string;
  uri: string;
}

export interface MCPManifest {
  name: string;
  version: string;
  description: string;
  tools?: Tool[];
  resources?: Resource[];
  capabilities?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class MCPValidator {
  public validate(manifest: MCPManifest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!manifest.name) errors.push('Manifest must have a name');
    if (!manifest.version) errors.push('Manifest must have a version');
    if (!manifest.description) errors.push('Manifest must have a description');

    // Validate version format
    if (manifest.version && !this.isValidVersion(manifest.version)) {
      errors.push('Version must follow semver format (e.g., 1.0.0)');
    }

    // Validate tools
    if (manifest.tools) {
      manifest.tools.forEach((tool, idx) => {
        if (!tool.name) errors.push(`Tool ${idx}: missing name`);
        if (!tool.description) warnings.push(`Tool ${idx}: missing description`);
      });
    }

    // Validate resources
    if (manifest.resources) {
      manifest.resources.forEach((res, idx) => {
        if (!res.name) errors.push(`Resource ${idx}: missing name`);
        if (!res.uri) errors.push(`Resource ${idx}: missing uri`);
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  public isValidVersion(version: string): boolean {
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/;
    return semverRegex.test(version);
  }

  public validateTool(tool: Tool): boolean {
    return !!(tool.name && tool.description);
  }

  public validateResource(resource: Resource): boolean {
    return !!(resource.name && resource.uri);
  }
}
