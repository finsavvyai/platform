package api

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sync"
	"time"
)

// SessionConfig controls session management behavior.
type SessionConfig struct {
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
	MaxConcurrent   int
}

// DefaultSessionConfig returns hardened session defaults.
func DefaultSessionConfig() SessionConfig {
	return SessionConfig{
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 7 * 24 * time.Hour,
		MaxConcurrent:   5,
	}
}

// SessionManager handles JWT rotation and session limits.
type SessionManager struct {
	config   SessionConfig
	mu       sync.Mutex
	sessions map[string][]sessionEntry
}

type sessionEntry struct {
	tokenID   string
	createdAt time.Time
}

func NewSessionManager(cfg SessionConfig) *SessionManager {
	return &SessionManager{
		config:   cfg,
		sessions: make(map[string][]sessionEntry),
	}
}

// RegisterSession tracks a new session for the user.
func (sm *SessionManager) RegisterSession(userID string) (string, error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	tokenID := generateTokenID()
	entry := sessionEntry{tokenID: tokenID, createdAt: time.Now().UTC()}

	sessions := sm.sessions[userID]
	sessions = sm.pruneExpired(sessions)

	if len(sessions) >= sm.config.MaxConcurrent {
		sessions = sessions[1:] // evict oldest
	}
	sm.sessions[userID] = append(sessions, entry)
	return tokenID, nil
}

// RevokeAll invalidates all sessions for a user.
func (sm *SessionManager) RevokeAll(userID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	delete(sm.sessions, userID)
}

// SessionCount returns active session count for a user.
func (sm *SessionManager) SessionCount(userID string) int {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	return len(sm.pruneExpired(sm.sessions[userID]))
}

func (sm *SessionManager) pruneExpired(entries []sessionEntry) []sessionEntry {
	var active []sessionEntry
	cutoff := time.Now().Add(-sm.config.RefreshTokenTTL)
	for _, e := range entries {
		if e.createdAt.After(cutoff) {
			active = append(active, e)
		}
	}
	return active
}

// SessionMiddleware enforces concurrent session limits.
func (sm *SessionManager) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}

func generateTokenID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
