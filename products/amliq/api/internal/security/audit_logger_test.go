package security

import (
	"context"
	"sync"
	"testing"
	"time"
)

// MockAuditStore implements AuditStore for testing.
type MockAuditStore struct {
	mu      sync.Mutex
	entries []AuditEntry
	saveErr error
}

func (m *MockAuditStore) Save(
	ctx context.Context, entry AuditEntry,
) error {
	if m.saveErr != nil {
		return m.saveErr
	}
	m.mu.Lock()
	m.entries = append(m.entries, entry)
	m.mu.Unlock()
	return nil
}

func (m *MockAuditStore) Query(
	ctx context.Context, filter AuditFilter,
) ([]AuditEntry, error) {
	return nil, nil
}

func (m *MockAuditStore) Purge(
	ctx context.Context, before time.Time,
) (int64, error) {
	return 0, nil
}

func (m *MockAuditStore) GetSavedEntries() []AuditEntry {
	m.mu.Lock()
	defer m.mu.Unlock()
	copied := make([]AuditEntry, len(m.entries))
	copy(copied, m.entries)
	return copied
}

func TestAuditLoggerWithStore(t *testing.T) {
	tests := []struct {
		name            string
		setupStore      bool
		logMethod       func(*AuditLogger)
		expectedAction  string
		expectedTenant  string
		expectedDetails map[string]string
	}{
		{
			name:           "LogScreening with store",
			setupStore:     true,
			expectedAction: "SCREENING",
			expectedTenant: "tenant-123",
			logMethod: func(al *AuditLogger) {
				al.LogScreening("tenant-123", "John Doe", 2, 150)
			},
			expectedDetails: map[string]string{
				"entity":      "John Doe",
				"matches":     "2",
				"duration_ms": "150",
			},
		},
		{
			name:           "LogLogin success with store",
			setupStore:     true,
			expectedAction: "LOGIN",
			expectedTenant: "",
			logMethod: func(al *AuditLogger) {
				al.LogLogin("user-456", "192.168.1.1", true)
			},
			expectedDetails: map[string]string{
				"user_id": "user-456",
				"result":  "success",
			},
		},
		{
			name:           "LogLogin failure with store",
			setupStore:     true,
			expectedAction: "LOGIN",
			expectedTenant: "",
			logMethod: func(al *AuditLogger) {
				al.LogLogin("user-789", "10.0.0.1", false)
			},
			expectedDetails: map[string]string{
				"user_id": "user-789",
				"result":  "failure",
			},
		},
		{
			name:           "LogAPIKeyUsage with store",
			setupStore:     true,
			expectedAction: "API_KEY_USE",
			expectedTenant: "",
			logMethod: func(al *AuditLogger) {
				al.LogAPIKeyUsage("abc123hash", "/screen", "203.0.113.5")
			},
			expectedDetails: map[string]string{
				"key_hash": "abc123hash",
				"endpoint": "/screen",
			},
		},
		{
			name:           "LogRateLimitHit with store",
			setupStore:     true,
			expectedAction: "RATE_LIMIT_HIT",
			expectedTenant: "tenant-555",
			logMethod: func(al *AuditLogger) {
				al.LogRateLimitHit("tenant-555", "/screen", "pro")
			},
			expectedDetails: map[string]string{
				"endpoint": "/screen",
				"tier":     "pro",
			},
		},
		{
			name:           "LogConfigChange with store",
			setupStore:     true,
			expectedAction: "CONFIG_CHANGE",
			expectedTenant: "tenant-666",
			logMethod: func(al *AuditLogger) {
				al.LogConfigChange("tenant-666", "admin-1", "webhook_url",
					"old.example.com", "new.example.com")
			},
			expectedDetails: map[string]string{
				"user_id":   "admin-1",
				"field":     "webhook_url",
				"old_value": "old.example.com",
				"new_value": "new.example.com",
			},
		},
		{
			name:           "LogDataExport with store",
			setupStore:     true,
			expectedAction: "DATA_EXPORT",
			expectedTenant: "tenant-777",
			logMethod: func(al *AuditLogger) {
				al.LogDataExport("tenant-777", "user-export", "entities")
			},
			expectedDetails: map[string]string{
				"user_id":   "user-export",
				"data_type": "entities",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var store *MockAuditStore
			if tt.setupStore {
				store = &MockAuditStore{}
			}
			logger := NewAuditLogger(store)
			tt.logMethod(logger)

			time.Sleep(50 * time.Millisecond)

			if store != nil {
				entries := store.GetSavedEntries()
				if len(entries) == 0 {
					t.Fatal("no entries saved to store")
				}
				entry := entries[0]
				if entry.Action != tt.expectedAction {
					t.Errorf("action: got %q, want %q",
						entry.Action, tt.expectedAction)
				}
				if entry.TenantID != tt.expectedTenant {
					t.Errorf("tenant_id: got %q, want %q",
						entry.TenantID, tt.expectedTenant)
				}
				for k, v := range tt.expectedDetails {
					if entry.Details[k] != v {
						t.Errorf("details[%s]: got %q, want %q",
							k, entry.Details[k], v)
					}
				}
			}
		})
	}
}

func TestAuditLoggerWithoutStore(t *testing.T) {
	tests := []struct {
		name      string
		logMethod func(*AuditLogger)
	}{
		{
			name: "LogScreening without store",
			logMethod: func(al *AuditLogger) {
				al.LogScreening("tenant-1", "Entity1", 1, 100)
			},
		},
		{
			name: "LogLogin without store",
			logMethod: func(al *AuditLogger) {
				al.LogLogin("user-1", "127.0.0.1", true)
			},
		},
		{
			name: "LogAPIKeyUsage without store",
			logMethod: func(al *AuditLogger) {
				al.LogAPIKeyUsage("key1", "/api", "127.0.0.1")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			logger := NewAuditLogger(nil)
			tt.logMethod(logger)

			logger.mu.Lock()
			if len(logger.entries) == 0 {
				t.Fatal("no in-memory entries recorded")
			}
			logger.mu.Unlock()
		})
	}
}

func TestAuditLoggerInMemoryFallback(t *testing.T) {
	store := &MockAuditStore{}
	logger := NewAuditLogger(store)

	logger.LogScreening("tenant-100", "Entity", 5, 200)
	time.Sleep(50 * time.Millisecond)

	logger.mu.Lock()
	inMemory := len(logger.entries)
	logger.mu.Unlock()

	if inMemory != 1 {
		t.Errorf("in-memory entries: got %d, want 1", inMemory)
	}

	saved := store.GetSavedEntries()
	if len(saved) != 1 {
		t.Errorf("saved entries: got %d, want 1", len(saved))
	}
}
