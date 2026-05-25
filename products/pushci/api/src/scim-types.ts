// SCIM 2.0 type definitions and schema URI constants.

export interface ScimUser {
  schemas: string[];
  id: string;
  userName: string;
  name?: { givenName?: string; familyName?: string };
  displayName?: string;
  emails?: Array<{ value: string; primary?: boolean; type?: string }>;
  active: boolean;
  meta: {
    resourceType: "User";
    created: string;
    lastModified: string;
    location?: string;
  };
}

export const SCHEMA_USER = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCHEMA_LIST = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
export const SCHEMA_ERROR = "urn:ietf:params:scim:api:messages:2.0:Error";
export const SCHEMA_SPC = "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig";
