// Package connectors defines the plugin contract every external-data
// integration implements.
//
// Day 39 of the production-ready roadmap.
//
// Each concrete connector (google, microsoft365, slack, github,
// atlassian, notion, salesforce, zendesk, servicenow, hubspot) is a
// sub-package implementing this interface. A central Registry (see
// registry.go) loads built-in connectors at startup and exposes them
// to the marketplace UI (Day 48).
//
// HONESTY NOTE: this file (the framework + interface) is REAL. Every
// connector sub-package is a SCAFFOLD until the per-vendor OAuth app
// is registered and the callback wiring lands. See each connector's
// NOT_IMPLEMENTED.md for the residual work.
package connectors

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Connector is the contract every integration satisfies. The
// Authenticate / ListResources / Fetch / Search / Watch trio
// covers OAuth round-trip, resource enumeration, full-content
// retrieval, full-text query, and incremental sync.
//
// Signature notes:
//   - Authenticate takes the OAuth callback `code` (the gateway has
//     already validated state + PKCE) and stores the resulting token
//     against tenantID.
//   - Watch returns a receive-only channel; cancelling ctx must close it.
type Connector interface {
	// Name is the canonical identifier (e.g. "google_workspace").
	Name() string
	// Authenticate exchanges an OAuth callback code for a stored token.
	Authenticate(ctx context.Context, tenantID uuid.UUID, code string) error
	// ListResources enumerates the connected user's accessible items.
	ListResources(ctx context.Context, tenantID uuid.UUID) ([]Resource, error)
	// Fetch returns the full content + metadata for a single resource.
	Fetch(ctx context.Context, tenantID uuid.UUID, resourceID string) (*Document, error)
	// Search runs a vendor-side query and returns matching resources.
	Search(ctx context.Context, tenantID uuid.UUID, query string) ([]Resource, error)
	// Watch returns a channel of incremental change events; closes on ctx cancel.
	Watch(ctx context.Context, tenantID uuid.UUID) (<-chan ChangeEvent, error)
}

// Resource is the lightweight pointer the marketplace + indexer use.
type Resource struct {
	ID        string
	Type      string // doc | sheet | message | issue | record
	Title     string
	URL       string
	UpdatedAt time.Time
}

// Document is the full Fetch response — body + metadata.
type Document struct {
	Resource
	Body     []byte
	MimeType string
	Author   string
}

// ChangeEvent is one incremental update from Watch.
type ChangeEvent struct {
	Resource
	Op string // create | update | delete
}
