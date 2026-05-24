export type BasicSubject = {
  readonly kind: "basic";
  readonly id: string;
  readonly email: string;
  readonly roles: readonly string[];
};

export type MultiTenantSubject = {
  readonly kind: "multitenant";
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly orgId: string;
  readonly tenantIds: readonly string[];
  readonly roles: readonly string[];
};

export type Subject = BasicSubject | MultiTenantSubject;

export const isMultiTenant = (s: Subject): s is MultiTenantSubject =>
  s.kind === "multitenant";

export type AuthMethod = "oauth" | "jwt" | "api_key" | "mfa" | "saml" | "scim";

export type Algorithm = "RS256" | "HS256";

export type TokenClaims = {
  readonly sub: string;
  readonly iss: string;
  readonly aud: string;
  readonly exp: number;
  readonly iat: number;
  readonly jti?: string;
  readonly email?: string;
  readonly name?: string;
  readonly orgId?: string;
  readonly tenantIds?: readonly string[];
  readonly roles?: readonly string[];
};

export type AuthError =
  | "invalid_token"
  | "expired_token"
  | "revoked_token"
  | "mfa_required"
  | "unauthorized"
  | "tenant_mismatch"
  | "missing_token"
  | "unknown_user";

export type AuthResult =
  | { readonly ok: true; readonly subject: Subject; readonly method: AuthMethod }
  | { readonly ok: false; readonly error: AuthError };

export type Permission = `${string}:${string}`;

export type RoleDefinition = {
  readonly name: string;
  readonly permissions: readonly Permission[];
};

export type OAuthProvider =
  | "google"
  | "github"
  | "linkedin"
  | "microsoft"
  | "apple";

export type ApiKeyMetadata = {
  readonly prefix: string;
  readonly hash: string;
  readonly subjectId: string;
  readonly scopes: readonly string[];
  readonly createdAt: number;
  readonly expiresAt: number | undefined;
};

export type WebAuthnCredential = {
  readonly credentialId: string;
  readonly publicKey: string;
  readonly counter: number;
  readonly transports: readonly string[];
};

export type WebAuthnChallenge = {
  readonly challenge: string;
  readonly userId: string;
  readonly createdAt: number;
  readonly expiresAt: number;
};

export interface TokenVerifier {
  verify(token: string): Promise<AuthResult>;
}

export interface RbacEvaluator {
  can(subject: Subject, permission: Permission): boolean;
}
