import { $RefParser } from "json-schema-ref-parser";
import * as yaml from "yaml";
import * as lodash from "lodash";
import {
  OpenAPIDocument,
  ParseResult,
  ParseError,
  ParseWarning,
  ParseMetadata,
  ExtractedEndpoint,
  ExtractedSchema,
} from "./types";

export class OpenAPIParser {
  private errors: ParseError[] = [];
  private warnings: ParseWarning[] = [];

  /**
   * Parse OpenAPI specification from string (JSON or YAML)
   */
  async parse(spec: string): Promise<ParseResult> {
    this.errors = [];
    this.warnings = [];

    try {
      // Determine format and parse
      let document: any;
      let format: "json" | "yaml";

      try {
        document = JSON.parse(spec);
        format = "json";
      } catch {
        try {
          document = yaml.parse(spec);
          format = "yaml";
        } catch (e) {
          this.errors.push({
            code: "INVALID_FORMAT",
            message: "Invalid JSON or YAML format",
            path: "",
            severity: "error",
          });
          return this.createResult();
        }
      }

      // Dereference $ref pointers
      const dereferencedDoc = await $RefParser.dereference(document, {
        continueOnError: true,
        dereference: { circular: "ignore" },
      });

      // Validate OpenAPI structure
      const validationResult = this.validateDocument(dereferencedDoc);
      if (!validationResult) {
        return this.createResult();
      }

      // Extract metadata
      const metadata = this.extractMetadata(dereferencedDoc, format);

      return {
        success: true,
        document: dereferencedDoc,
        errors: this.errors,
        warnings: this.warnings,
        metadata,
      };
    } catch (error) {
      this.errors.push({
        code: "PARSE_ERROR",
        message: error instanceof Error ? error.message : "Unknown parsing error",
        path: "",
        severity: "error",
      });
      return this.createResult();
    }
  }

  /**
   * Parse OpenAPI specification from file
   */
  async parseFromFile(filePath: string): Promise<ParseResult> {
    try {
      const fs = await import("fs/promises");
      const spec = await fs.readFile(filePath, "utf-8");
      return this.parse(spec);
    } catch (error) {
      this.errors.push({
        code: "FILE_ERROR",
        message: error instanceof Error ? error.message : "Failed to read file",
        path: filePath,
        severity: "error",
      });
      return this.createResult();
    }
  }

  /**
   * Parse OpenAPI specification from URL
   */
  async parseFromUrl(url: string): Promise<ParseResult> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const spec = await response.text();
      return this.parse(spec);
    } catch (error) {
      this.errors.push({
        code: "URL_ERROR",
        message: error instanceof Error ? error.message : "Failed to fetch URL",
        path: url,
        severity: "error",
      });
      return this.createResult();
    }
  }

  /**
   * Extract endpoints from parsed document
   */
  extractEndpoints(document: OpenAPIDocument): ExtractedEndpoint[] {
    const endpoints: ExtractedEndpoint[] = [];

    if (!document.paths) {
      return endpoints;
    }

    Object.entries(document.paths).forEach(([path, pathItem]) => {
      const methods = ["get", "post", "put", "delete", "patch", "head", "options", "trace"];

      methods.forEach(method => {
        const operation = pathItem[method as keyof typeof pathItem];
        if (operation && typeof operation === "object" && "summary" in operation) {
          const endpoint: ExtractedEndpoint = {
            path,
            method: method.toUpperCase(),
            operationId: operation.operationId,
            summary: operation.summary,
            description: operation.description,
            tags: operation.tags || [],
            parameters: this.extractParameters(operation.parameters || []),
            requestBody: this.extractRequestBody(operation.requestBody),
            responses: this.extractResponses(operation.responses),
            security: this.extractSecurity(operation.security, document),
            deprecated: operation.deprecated || false,
          };

          endpoints.push(endpoint);
        }
      });
    });

    return endpoints;
  }

  /**
   * Extract schemas from parsed document
   */
  extractSchemas(document: OpenAPIDocument): ExtractedSchema[] {
    const schemas: ExtractedSchema[] = [];

    if (document.components?.schemas) {
      Object.entries(document.components.schemas).forEach(([name, schema]) => {
        if (this.isSchema(schema)) {
          const extractedSchema: ExtractedSchema = {
            name,
            type: schema.type || "object",
            properties: schema.properties || {},
            required: schema.required || [],
            description: schema.description,
            example: schema.example,
          };

          schemas.push(extractedSchema);
        }
      });
    }

    return schemas;
  }

  private validateDocument(document: any): boolean {
    if (!document) {
      this.errors.push({
        code: "MISSING_DOCUMENT",
        message: "Document is empty or null",
        path: "",
        severity: "error",
      });
      return false;
    }

    // Check for OpenAPI version
    if (!document.openapi) {
      this.errors.push({
        code: "MISSING_OPENAPI_VERSION",
        message: "Missing 'openapi' field",
        path: "openapi",
        severity: "error",
      });
      return false;
    }

    // Validate OpenAPI version
    if (!this.isValidOpenAPIVersion(document.openapi)) {
      this.warnings.push({
        code: "UNSUPPORTED_VERSION",
        message: `OpenAPI version ${document.openapi} may not be fully supported`,
        path: "openapi",
        severity: "warning",
      });
    }

    // Check required info object
    if (!document.info) {
      this.errors.push({
        code: "MISSING_INFO",
        message: "Missing 'info' object",
        path: "info",
        severity: "error",
      });
      return false;
    }

    if (!document.info.title) {
      this.errors.push({
        code: "MISSING_TITLE",
        message: "Missing 'title' in info object",
        path: "info.title",
        severity: "error",
      });
    }

    if (!document.info.version) {
      this.errors.push({
        code: "MISSING_VERSION",
        message: "Missing 'version' in info object",
        path: "info.version",
        severity: "error",
      });
    }

    // Check paths object
    if (!document.paths) {
      this.warnings.push({
        code: "MISSING_PATHS",
        message: "No paths defined in the specification",
        path: "paths",
        severity: "warning",
      });
    }

    return this.errors.length === 0;
  }

  private isValidOpenAPIVersion(version: string): boolean {
    return /^3\.[0-9]+\.[0-9]+$/.test(version);
  }

  private extractMetadata(document: any, format: "json" | "yaml"): ParseMetadata {
    const baseUrl = this.getBaseUrl(document);
    const endpoints = this.extractEndpoints(document);
    const schemas = this.extractSchemas(document);
    const securitySchemes = this.getSecuritySchemes(document);

    return {
      format,
      version: document.openapi,
      title: document.info?.title || "Untitled API",
      description: document.info?.description,
      baseUrl,
      endpointCount: endpoints.length,
      schemaCount: schemas.length,
      securitySchemes,
      parsedAt: new Date(),
    };
  }

  private getBaseUrl(document: any): string | undefined {
    if (document.servers && document.servers.length > 0) {
      return document.servers[0].url;
    }
    return undefined;
  }

  private getSecuritySchemes(document: any): string[] {
    const schemes: string[] = [];
    if (document.components?.securitySchemes) {
      Object.keys(document.components.securitySchemes).forEach(key => {
        const scheme = document.components.securitySchemes[key];
        if (scheme.type) {
          schemes.push(scheme.type);
        }
      });
    }
    return schemes;
  }

  private extractParameters(parameters: any[]): ExtractedParameter[] {
    return parameters.map(param => ({
      name: param.name,
      in: param.in,
      required: param.required || false,
      type: param.schema?.type || "string",
      format: param.schema?.format,
      description: param.description,
      example: param.example,
    }));
  }

  private extractRequestBody(requestBody: any): any {
    if (!requestBody) return undefined;

    const contentTypes = Object.keys(requestBody.content || {});
    const contentType = contentTypes[0];

    if (contentType && requestBody.content[contentType]) {
      return {
        contentType,
        schema: requestBody.content[contentType].schema,
        required: requestBody.required || false,
        description: requestBody.description,
      };
    }

    return undefined;
  }

  private extractResponses(responses: any): any[] {
    if (!responses) return [];

    return Object.entries(responses).map(([statusCode, response]: [string, any]) => {
      const contentTypes = Object.keys(response.content || {});
      const contentType = contentTypes[0];

      return {
        statusCode,
        description: response.description,
        contentType,
        schema: contentType ? response.content[contentType].schema : undefined,
        example: contentType ? response.content[contentType].example : undefined,
      };
    });
  }

  private extractSecurity(security: any[], document: any): string[] {
    if (!security || security.length === 0) return [];

    const schemes: string[] = [];
    security.forEach(sec => {
      Object.keys(sec).forEach(schemeName => {
        if (document.components?.securitySchemes?.[schemeName]) {
          schemes.push(schemeName);
        }
      });
    });

    return schemes;
  }

  private isSchema(obj: any): obj is any {
    return obj && typeof obj === "object" && (obj.type || obj.properties || obj.$ref);
  }

  private createResult(): ParseResult {
    return {
      success: false,
      errors: this.errors,
      warnings: this.warnings,
      metadata: {
        format: "json",
        version: "unknown",
        title: "Unknown",
        endpointCount: 0,
        schemaCount: 0,
        securitySchemes: [],
        parsedAt: new Date(),
      },
    };
  }
}

// Convenience function for quick parsing
export async function parseOpenAPI(spec: string): Promise<ParseResult> {
  const parser = new OpenAPIParser();
  return parser.parse(spec);
}