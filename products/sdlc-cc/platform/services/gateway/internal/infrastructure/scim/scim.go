// Package scim implements a minimal SCIM 2.0 surface for enterprise
// IdP provisioning (Okta, Azure AD, JumpCloud).
//
// File layout (Day 23 split — every file ≤200 LOC):
//
//	users.go       — User CRUD + Search + Put + Delete
//	users_patch.go — User PATCH semantics + filter helper
//	groups.go      — Group CRUD
//	bulk.go        — /Bulk endpoint
//	etag.go        — If-Match / Version concurrency tokens
//	filter.go      — SCIM filter parser (`eq`, `co`, `sw`, `ew`, `pr`)
//
// Non-goals for this iteration: discovery metadata. That lands when
// the first real IdP integration asks for it.
package scim
