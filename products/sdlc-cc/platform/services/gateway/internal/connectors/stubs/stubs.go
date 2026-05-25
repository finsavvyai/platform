// Package stubs is DEPRECATED and removed in P2-Day39.
//
// The single shared "Stub" placeholder has been replaced by 10
// per-connector scaffold sub-packages under
// services/gateway/internal/connectors/<name>/. Each carries its own
// SCAFFOLD banner, NOT_IMPLEMENTED.md, and registers itself with
// vendor-specific RBAC scopes.
//
// REMOVE THIS DIRECTORY: `rm -rf services/gateway/internal/connectors/stubs`
// Left in-tree only so existing imports surface a clear compile error
// pointing to the replacement.
package stubs
