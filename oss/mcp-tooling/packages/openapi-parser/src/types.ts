export interface OpenAPIDocument {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: OpenAPIPaths;
  components?: OpenAPIComponents;
  security?: OpenAPISecurityRequirement[];
  tags?: OpenAPITag[];
  externalDocs?: OpenAPIExternalDocumentation;
}

export interface OpenAPIInfo {
  title: string;
  description?: string;
  version: string;
  termsOfService?: string;
  contact?: OpenAPIContact;
  license?: OpenAPILicense;
}

export interface OpenAPIContact {
  name?: string;
  url?: string;
  email?: string;
}

export interface OpenAPILicense {
  name: string;
  url?: string;
}

export interface OpenAPIServer {
  url: string;
  description?: string;
  variables?: { [key: string]: OpenAPIServerVariable };
}

export interface OpenAPIServerVariable {
  enum?: string[];
  default: string;
  description?: string;
}

export interface OpenAPIPaths {
  [path: string]: OpenAPIPathItem;
}

export interface OpenAPIPathItem {
  summary?: string;
  description?: string;
  get?: OpenAPIOperation;
  put?: OpenAPIOperation;
  post?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  options?: OpenAPIOperation;
  head?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  trace?: OpenAPIOperation;
  parameters?: OpenAPIParameter[];
}

export interface OpenAPIOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: OpenAPIExternalDocumentation;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: OpenAPIResponses;
  callbacks?: { [key: string]: OpenAPICallback };
  deprecated?: boolean;
  security?: OpenAPISecurityRequirement[];
  servers?: OpenAPIServer[];
}

export interface OpenAPIParameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema: OpenAPISchema;
  example?: any;
  examples?: { [key: string]: OpenAPIExample };
}

export interface OpenAPIRequestBody {
  description?: string;
  content: { [contentType: string]: OpenAPIMediaType };
  required?: boolean;
}

export interface OpenAPIResponses {
  [code: string]: OpenAPIResponse | OpenAPIReference;
}

export interface OpenAPIResponse {
  description: string;
  headers?: { [header: string]: OpenAPIHeader };
  content?: { [contentType: string]: OpenAPIMediaType };
  links?: { [link: string]: OpenAPILink | OpenAPIReference };
}

export interface OpenAPIMediaType {
  schema?: OpenAPISchema;
  example?: any;
  examples?: { [key: string]: OpenAPIExample };
  encoding?: { [contentType: string]: OpenAPIEncoding };
}

export interface OpenAPIEncoding {
  contentType?: string;
  headers?: { [header: string]: OpenAPIHeader };
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

export interface OpenAPIExample {
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
}

export interface OpenAPIHeader {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema: OpenAPISchema;
  example?: any;
  examples?: { [key: string]: OpenAPIExample };
}

export interface OpenAPILink {
  operationRef?: string;
  operationId?: string;
  parameters?: { [parameter: string]: any };
  requestBody?: any;
  description?: string;
  server?: OpenAPIServer;
}

export interface OpenAPICallback {
  [callbackUrl: string]: OpenAPIPathItem;
}

export interface OpenAPIComponents {
  schemas?: { [key: string]: OpenAPISchema };
  responses?: { [key: string]: OpenAPIResponse };
  parameters?: { [key: string]: OpenAPIParameter };
  examples?: { [key: string]: OpenAPIExample };
  requestBodies?: { [key: string]: OpenAPIRequestBody };
  headers?: { [key: string]: OpenAPIHeader };
  securitySchemes?: { [key: string]: OpenAPISecurityScheme };
  links?: { [key: string]: OpenAPILink };
  callbacks?: { [key: string]: OpenAPICallback };
}

export interface OpenAPISchema {
  title?: string;
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: boolean;
  minimum?: number;
  exclusiveMinimum?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  enum?: any[];
  type?: string | string[];
  allOf?: (OpenAPISchema | OpenAPIReference)[];
  oneOf?: (OpenAPISchema | OpenAPIReference)[];
  anyOf?: (OpenAPISchema | OpenAPIReference)[];
  not?: OpenAPISchema | OpenAPIReference;
  items?: OpenAPISchema | OpenAPIReference;
  properties?: { [key: string]: OpenAPISchema | OpenAPIReference };
  additionalProperties?: boolean | OpenAPISchema | OpenAPIReference;
  description?: string;
  format?: string;
  default?: any;
  nullable?: boolean;
  discriminator?: OpenAPIDiscriminator;
  readOnly?: boolean;
  writeOnly?: boolean;
  xml?: OpenAPIXML;
  externalDocs?: OpenAPIExternalDocumentation;
  example?: any;
  deprecated?: boolean;
}

export interface OpenAPIDiscriminator {
  propertyName: string;
  mapping?: { [key: string]: string };
}

export interface OpenAPIXML {
  name?: string;
  namespace?: string;
  prefix?: string;
  attribute?: boolean;
  wrapped?: boolean;
}

export interface OpenAPIReference {
  $ref: string;
}

export interface OpenAPISecurityScheme {
  type: "apiKey" | "http" | "oauth2" | "openIdConnect" | "mutualTLS";
  description?: string;
  name?: string;
  in?: "query" | "header" | "cookie";
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: { [scope: string]: string };
}

export interface OpenAPISecurityRequirement {
  [name: string]: string[];
}

export interface OpenAPITag {
  name: string;
  description?: string;
  externalDocs?: OpenAPIExternalDocumentation;
}

export interface OpenAPIExternalDocumentation {
  description?: string;
  url: string;
}

// Parser Result Types
export interface ParseResult {
  success: boolean;
  document?: OpenAPIDocument;
  errors: ParseError[];
  warnings: ParseWarning[];
  metadata: ParseMetadata;
}

export interface ParseError {
  code: string;
  message: string;
  path: string;
  severity: "error";
}

export interface ParseWarning {
  code: string;
  message: string;
  path: string;
  severity: "warning";
}

export interface ParseMetadata {
  format: "json" | "yaml";
  version: string;
  title: string;
  description?: string;
  baseUrl?: string;
  endpointCount: number;
  schemaCount: number;
  securitySchemes: string[];
  parsedAt: Date;
}

// Validator Types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  severity: "error" | "warning" | "info";
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
  details?: any;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
  details?: any;
}

// Extracted Data Types
export interface ExtractedEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: ExtractedParameter[];
  requestBody?: ExtractedRequestBody;
  responses: ExtractedResponse[];
  security: string[];
  deprecated: boolean;
}

export interface ExtractedParameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  required: boolean;
  type: string;
  format?: string;
  description?: string;
  example?: any;
}

export interface ExtractedRequestBody {
  contentType: string;
  schema: any;
  required: boolean;
  description?: string;
}

export interface ExtractedResponse {
  statusCode: string;
  description: string;
  contentType?: string;
  schema?: any;
  example?: any;
}

export interface ExtractedSchema {
  name: string;
  type: string;
  properties: { [key: string]: any };
  required: string[];
  description?: string;
  example?: any;
}