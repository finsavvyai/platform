package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/port"
)

const poolTTL = 30 * time.Minute

type AdapterFactory func(dsn string) (port.DatabasePort, error)

type poolEntry struct {
	adapter   port.DatabasePort
	createdAt time.Time
}

type PoolManager struct {
	mu             sync.RWMutex
	pools          map[string]*poolEntry
	connService    *ConnectionService
	defaultAdapter port.DatabasePort
	factory        AdapterFactory
}

func NewPoolManager(
	connService *ConnectionService,
	defaultAdapter port.DatabasePort,
	factory AdapterFactory,
) *PoolManager {
	pm := &PoolManager{
		pools:          make(map[string]*poolEntry),
		connService:    connService,
		defaultAdapter: defaultAdapter,
		factory:        factory,
	}

	go pm.cleanupLoop()
	return pm
}

func (pm *PoolManager) GetAdapter(ctx context.Context, userID, databaseID string) (port.DatabasePort, error) {
	if databaseID == "" || databaseID == "default" {
		return pm.defaultAdapter, nil
	}

	pm.mu.RLock()
	key := userID + ":" + databaseID
	entry, exists := pm.pools[key]
	pm.mu.RUnlock()

	if exists && time.Since(entry.createdAt) < poolTTL {
		return entry.adapter, nil
	}

	return pm.createPool(ctx, userID, databaseID, key)
}

func (pm *PoolManager) createPool(ctx context.Context, userID, databaseID, key string) (port.DatabasePort, error) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if entry, exists := pm.pools[key]; exists && time.Since(entry.createdAt) < poolTTL {
		return entry.adapter, nil
	}

	conn, err := pm.connService.GetByID(ctx, userID, databaseID)
	if err != nil {
		return nil, fmt.Errorf("connection %s not found: %w", databaseID, err)
	}

	password, err := pm.connService.DecryptPassword(conn.EncryptedPassword)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt credentials: %w", err)
	}

	dsn := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		conn.Username, password, conn.Host, conn.Port, conn.Database, conn.SSLMode,
	)

	dbAdapter, err := pm.factory(dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to %s: %w", conn.Name, err)
	}

	if old, exists := pm.pools[key]; exists {
		old.adapter.Close()
	}

	pm.pools[key] = &poolEntry{adapter: dbAdapter, createdAt: time.Now()}
	return dbAdapter, nil
}

func (pm *PoolManager) Close() {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	for key, entry := range pm.pools {
		entry.adapter.Close()
		delete(pm.pools, key)
	}
}

func (pm *PoolManager) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		pm.mu.Lock()
		for key, entry := range pm.pools {
			if time.Since(entry.createdAt) > poolTTL {
				entry.adapter.Close()
				delete(pm.pools, key)
			}
		}
		pm.mu.Unlock()
	}
}
