# @finsavvyai/auth

Auth primitives. OAuth, JWT, MFA, SAML, SCIM, RBAC.

Exports `StaticRbac`, types: `Subject`, `TokenClaims`, `AuthResult`, `Permission`, `RoleDefinition`, `TokenVerifier`, `RbacEvaluator`.

## Critical paths

- Token verification — 100% coverage required.
- RBAC evaluation — 100% coverage required.
- Audit log on every auth event.
