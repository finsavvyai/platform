package cache

import (
	"sync"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/bradfitz/gomemcache/memcache"
	"github.com/sirupsen/logrus"
)

// MemcachedAdapter implements DatabaseAdapter for Memcached using the
// bradfitz/gomemcache client. The implementation is split across:
//
//   memcached_connect.go : Connect / Disconnect / Test / Ping / HealthCheck
//   memcached_exec.go    : ExecuteQuery + parseOperation + executeGet/Set/Delete
//   memcached_stream.go  : Stream (chunked GetMulti — no server-side cursor)
//   memcached_admin.go   : GetSchema / GetTableInfo / executeStats / executeFlush
//   memcached_health.go  : GetMetrics / BeginTransaction / toColumnInfo helper
//   memcached_errors.go  : sentinel taxonomy + classifyMemcachedError + allowlist
//
// All files keep the 200-line cap per portfolio CLAUDE rules.
type MemcachedAdapter struct {
	conn   *entities.Connection
	client *memcache.Client
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Compile-time guard against canonical Phase 1 types.DatabaseAdapter.
var _ types.DatabaseAdapter = (*MemcachedAdapter)(nil)

// MemcachedOperation represents a Memcached op parsed from JSON or simple text.
type MemcachedOperation struct {
	Type       string      `json:"type"` // get | set | delete | stats | flush
	Key        string      `json:"key,omitempty"`
	Value      interface{} `json:"value,omitempty"`
	Expiration int32       `json:"expiration,omitempty"` // TTL seconds
}
