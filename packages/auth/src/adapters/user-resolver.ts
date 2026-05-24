import type { Subject, TokenClaims } from "../types.js";

export type ResolveByTokenInput = {
  readonly claims: TokenClaims;
  readonly raw: string;
};

export type ResolveByApiKeyInput = {
  readonly plaintext: string;
  readonly hash: string;
};

export interface UserResolver {
  resolveByToken(input: ResolveByTokenInput): Promise<Subject | undefined>;
  resolveByApiKey?(input: ResolveByApiKeyInput): Promise<Subject | undefined>;
}

export const subjectFromClaims = (claims: TokenClaims): Subject => {
  if (claims.orgId !== undefined && claims.tenantIds !== undefined) {
    return {
      kind: "multitenant",
      id: claims.sub,
      email: claims.email ?? "",
      name: claims.name ?? "",
      orgId: claims.orgId,
      tenantIds: claims.tenantIds,
      roles: claims.roles ?? [],
    };
  }
  return {
    kind: "basic",
    id: claims.sub,
    email: claims.email ?? "",
    roles: claims.roles ?? [],
  };
};

export class ClaimsOnlyResolver implements UserResolver {
  async resolveByToken({ claims }: ResolveByTokenInput): Promise<Subject> {
    return subjectFromClaims(claims);
  }
}
