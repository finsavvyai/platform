/**
 * SCIM 2.0 Types
 *
 * RFC 7643 (Core Schema) + RFC 7644 (Protocol)
 */
export interface ScimUser {
  schemas: string[];
  id: string;
  userName: string;
  name?: { givenName?: string; familyName?: string };
  emails?: { value: string; primary?: boolean; type?: string }[];
  active: boolean;
  externalId?: string;
  meta?: ScimMeta;
}

export interface ScimGroup {
  schemas: string[];
  id: string;
  displayName: string;
  members?: { value: string; display?: string }[];
  meta?: ScimMeta;
}

export interface ScimMeta {
  resourceType: string;
  created: string;
  lastModified: string;
  location?: string;
}

export interface ScimListResponse<T> {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: T[];
}

export interface ScimError {
  schemas: string[];
  detail: string;
  status: string;
}

export const SCIM_SCHEMAS = {
  user: 'urn:ietf:params:scim:schemas:core:2.0:User',
  group: 'urn:ietf:params:scim:schemas:core:2.0:Group',
  listResponse: 'urn:ietf:params:scim:api:messages:2.0:ListResponse',
  error: 'urn:ietf:params:scim:api:messages:2.0:Error',
} as const;
