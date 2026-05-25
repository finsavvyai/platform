package sdln

import (
	"sync"
	"time"
)

// Pools manages connection pools for different services
type Pools struct {
	mu       sync.RWMutex
	pools    map[string]interface{}
	settings map[string]*PoolSettings
}

// PoolSettings represents connection pool settings
type PoolSettings struct {
	MaxOpenConns    int           `json:"max_open_conns"`
	MaxIdleConns    int           `json:"max_idle_conns"`
	ConnMaxLifetime time.Duration `json:"conn_max_lifetime"`
	ConnMaxIdleTime time.Duration `json:"conn_max_idle_time"`
}

// NewPools creates a new connection pool manager
func NewPools() *Pools {
	return &Pools{
		pools:    make(map[string]interface{}),
		settings: make(map[string]*PoolSettings),
	}
}

// SetPool sets a connection pool for a service
func (p *Pools) SetPool(name string, pool interface{}, settings *PoolSettings) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.pools[name] = pool
	if settings != nil {
		p.settings[name] = settings
	}
}

// GetPool gets a connection pool for a service
func (p *Pools) GetPool(name string) (interface{}, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	pool, exists := p.pools[name]
	return pool, exists
}

// GetSettings gets pool settings for a service
func (p *Pools) GetSettings(name string) *PoolSettings {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.settings[name]
}
