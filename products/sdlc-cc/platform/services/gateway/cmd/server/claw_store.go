package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database"
)

var errClawMemoryNotFound = errors.New("claw memory not found")

type ClawStore interface {
	EnsureSchema(ctx context.Context) error
	Health(ctx context.Context) error
	RegisterSession(ctx context.Context, session ClawSession) (*ClawSession, error)
	WriteMemory(ctx context.Context, request ClawMemoryWriteRequest) (*ClawMemoryRecord, error)
	SearchMemories(ctx context.Context, request ClawMemorySearchRequest) ([]ClawMemoryRecord, error)
	GetMemory(ctx context.Context, tenantID, userID, memoryID string) (*ClawMemoryRecord, error)
	DeleteMemory(ctx context.Context, tenantID, userID, memoryID string) error
	SearchDocuments(ctx context.Context, request ClawDocumentSearchRequest) ([]ClawDocumentSearchResult, error)
	RAGQuery(ctx context.Context, request ClawRAGQueryRequest) ([]ClawRAGResult, error)
	WriteAudit(ctx context.Context, request ClawAuditWriteRequest) (string, error)
}

type PGClawStore struct {
	db *database.Connection
}

func NewPGClawStore(db *database.Connection) *PGClawStore {
	return &PGClawStore{db: db}
}

func (s *PGClawStore) EnsureSchema(ctx context.Context) error {
	statements := []string{
		`
		CREATE TABLE IF NOT EXISTS claw_sessions (
			session_id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			project_id TEXT NOT NULL,
			adapter TEXT NOT NULL,
			agent_id TEXT,
			metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
		`,
		`CREATE INDEX IF NOT EXISTS idx_claw_sessions_tenant_user ON claw_sessions(tenant_id, user_id, last_seen_at DESC)`,
		`
		CREATE TABLE IF NOT EXISTS claw_memories (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			session_id TEXT,
			agent_id TEXT,
			memory_type TEXT NOT NULL,
			content TEXT NOT NULL,
			source TEXT,
			importance INTEGER NOT NULL DEFAULT 0,
			tags JSONB NOT NULL DEFAULT '[]'::jsonb,
			metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
		`,
		`CREATE INDEX IF NOT EXISTS idx_claw_memories_tenant_user ON claw_memories(tenant_id, user_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_claw_memories_session ON claw_memories(session_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_claw_memories_type ON claw_memories(memory_type, created_at DESC)`,
	}

	for _, statement := range statements {
		if _, err := s.db.Pool.Exec(ctx, statement); err != nil {
			return fmt.Errorf("ensure claw schema: %w", err)
		}
	}

	return nil
}

func (s *PGClawStore) Health(ctx context.Context) error {
	return s.db.Ping(ctx)
}

func (s *PGClawStore) RegisterSession(ctx context.Context, session ClawSession) (*ClawSession, error) {
	metadata, err := json.Marshal(defaultMetadata(session.Metadata))
	if err != nil {
		return nil, fmt.Errorf("marshal session metadata: %w", err)
	}

	const query = `
		INSERT INTO claw_sessions (
			session_id, tenant_id, user_id, project_id, adapter, agent_id, metadata
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
		ON CONFLICT (session_id)
		DO UPDATE SET
			tenant_id = EXCLUDED.tenant_id,
			user_id = EXCLUDED.user_id,
			project_id = EXCLUDED.project_id,
			adapter = EXCLUDED.adapter,
			agent_id = EXCLUDED.agent_id,
			metadata = EXCLUDED.metadata,
			last_seen_at = NOW()
		RETURNING created_at, last_seen_at
	`

	var createdAt time.Time
	var lastSeenAt time.Time
	if err := s.db.Pool.QueryRow(
		ctx,
		query,
		session.SessionID,
		session.TenantID,
		session.UserID,
		session.ProjectID,
		session.Adapter,
		nullIfEmpty(session.AgentID),
		metadata,
	).Scan(&createdAt, &lastSeenAt); err != nil {
		return nil, fmt.Errorf("register claw session: %w", err)
	}

	session.CreatedAt = createdAt
	session.LastSeenAt = lastSeenAt
	return &session, nil
}

func (s *PGClawStore) WriteMemory(ctx context.Context, request ClawMemoryWriteRequest) (*ClawMemoryRecord, error) {
	memoryID := "mem_" + uuid.NewString()
	metadata, err := json.Marshal(defaultMetadata(request.Metadata))
	if err != nil {
		return nil, fmt.Errorf("marshal memory metadata: %w", err)
	}

	tags, err := json.Marshal(defaultTags(request.Tags))
	if err != nil {
		return nil, fmt.Errorf("marshal memory tags: %w", err)
	}

	const query = `
		INSERT INTO claw_memories (
			id, tenant_id, user_id, session_id, agent_id, memory_type, content,
			source, importance, tags, metadata
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
		RETURNING created_at, updated_at
	`

	var createdAt time.Time
	var updatedAt time.Time
	if err := s.db.Pool.QueryRow(
		ctx,
		query,
		memoryID,
		request.TenantID,
		request.UserID,
		nullIfEmpty(request.SessionID),
		nullIfEmpty(request.AgentID),
		request.Type,
		request.Content,
		nullIfEmpty(request.Source),
		request.Importance,
		tags,
		metadata,
	).Scan(&createdAt, &updatedAt); err != nil {
		return nil, fmt.Errorf("write claw memory: %w", err)
	}

	return &ClawMemoryRecord{
		ID:         memoryID,
		TenantID:   request.TenantID,
		UserID:     request.UserID,
		SessionID:  request.SessionID,
		AgentID:    request.AgentID,
		Type:       request.Type,
		Content:    request.Content,
		Source:     request.Source,
		Importance: request.Importance,
		Tags:       defaultTags(request.Tags),
		Metadata:   defaultMetadata(request.Metadata),
		CreatedAt:  createdAt,
		UpdatedAt:  updatedAt,
	}, nil
}

func (s *PGClawStore) SearchMemories(ctx context.Context, request ClawMemorySearchRequest) ([]ClawMemoryRecord, error) {
	limit := normalizeLimit(request.Limit, 10, 100)
	var rows interface {
		Close()
		Next() bool
		Scan(dest ...any) error
		Err() error
	}

	var err error
	if strings.TrimSpace(request.Query) == "" {
		rows, err = s.db.Pool.Query(
			ctx,
			`
			SELECT id, tenant_id, user_id, COALESCE(session_id, ''), COALESCE(agent_id, ''), memory_type,
			       content, COALESCE(source, ''), importance, tags, metadata, created_at, updated_at
			FROM claw_memories
			WHERE tenant_id = $1
			  AND user_id = $2
			  AND ($3 = '' OR session_id = $3)
			  AND ($4 = '' OR memory_type = $4)
			ORDER BY importance DESC, created_at DESC
			LIMIT $5
			`,
			request.TenantID,
			request.UserID,
			strings.TrimSpace(request.SessionID),
			strings.TrimSpace(request.Type),
			limit,
		)
	} else {
		rows, err = s.db.Pool.Query(
			ctx,
			`
			SELECT id, tenant_id, user_id, COALESCE(session_id, ''), COALESCE(agent_id, ''), memory_type,
			       content, COALESCE(source, ''), importance, tags, metadata, created_at, updated_at
			FROM claw_memories
			WHERE tenant_id = $1
			  AND user_id = $2
			  AND ($3 = '' OR session_id = $3)
			  AND ($4 = '' OR memory_type = $4)
			  AND content ILIKE '%' || $5 || '%'
			ORDER BY importance DESC, created_at DESC
			LIMIT $6
			`,
			request.TenantID,
			request.UserID,
			strings.TrimSpace(request.SessionID),
			strings.TrimSpace(request.Type),
			strings.TrimSpace(request.Query),
			limit,
		)
	}
	if err != nil {
		return nil, fmt.Errorf("search claw memories: %w", err)
	}
	defer rows.Close()

	memories := make([]ClawMemoryRecord, 0)
	for rows.Next() {
		memory, scanErr := scanMemoryRow(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		if len(request.Tags) > 0 && !containsAllTags(memory.Tags, request.Tags) {
			continue
		}
		memories = append(memories, memory)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate claw memories: %w", err)
	}

	return memories, nil
}

func (s *PGClawStore) GetMemory(ctx context.Context, tenantID, userID, memoryID string) (*ClawMemoryRecord, error) {
	rows, err := s.db.Pool.Query(
		ctx,
		`
		SELECT id, tenant_id, user_id, COALESCE(session_id, ''), COALESCE(agent_id, ''), memory_type,
		       content, COALESCE(source, ''), importance, tags, metadata, created_at, updated_at
		FROM claw_memories
		WHERE id = $1 AND tenant_id = $2 AND user_id = $3
		LIMIT 1
		`,
		memoryID,
		tenantID,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("get claw memory: %w", err)
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, errClawMemoryNotFound
	}

	memory, err := scanMemoryRow(rows)
	if err != nil {
		return nil, err
	}
	return &memory, nil
}

func (s *PGClawStore) DeleteMemory(ctx context.Context, tenantID, userID, memoryID string) error {
	tag, err := s.db.Pool.Exec(
		ctx,
		`DELETE FROM claw_memories WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
		memoryID,
		tenantID,
		userID,
	)
	if err != nil {
		return fmt.Errorf("delete claw memory: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return errClawMemoryNotFound
	}
	return nil
}

func (s *PGClawStore) SearchDocuments(ctx context.Context, request ClawDocumentSearchRequest) ([]ClawDocumentSearchResult, error) {
	tenantID, err := uuid.Parse(strings.TrimSpace(request.TenantID))
	if err != nil {
		return nil, fmt.Errorf("tenant_id must be a UUID: %w", err)
	}

	limit := normalizeLimit(request.Limit, 10, 100)
	rows, err := s.db.Pool.Query(
		ctx,
		`
		SELECT id::text, original_filename, content_type, classification, processing_status, created_at
		FROM documents
		WHERE tenant_id = $1
		  AND ($2 = '' OR original_filename ILIKE '%' || $2 || '%' OR content_type ILIKE '%' || $2 || '%')
		  AND ($3 = '' OR classification = $3)
		  AND ($4 = '' OR processing_status = $4)
		ORDER BY created_at DESC
		LIMIT $5
		`,
		tenantID,
		strings.TrimSpace(request.Query),
		strings.TrimSpace(request.Classification),
		strings.TrimSpace(request.Status),
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("search documents: %w", err)
	}
	defer rows.Close()

	results := make([]ClawDocumentSearchResult, 0)
	for rows.Next() {
		var item ClawDocumentSearchResult
		if err := rows.Scan(
			&item.DocumentID,
			&item.Filename,
			&item.ContentType,
			&item.Classification,
			&item.ProcessingStatus,
			&item.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan document search result: %w", err)
		}
		results = append(results, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate document search results: %w", err)
	}
	return results, nil
}

func (s *PGClawStore) RAGQuery(ctx context.Context, request ClawRAGQueryRequest) ([]ClawRAGResult, error) {
	tenantID, err := uuid.Parse(strings.TrimSpace(request.TenantID))
	if err != nil {
		return nil, fmt.Errorf("tenant_id must be a UUID: %w", err)
	}
	query := strings.TrimSpace(request.Query)
	if query == "" {
		return nil, fmt.Errorf("query is required")
	}

	limit := normalizeLimit(request.Limit, 5, 20)
	rows, err := s.db.Pool.Query(
		ctx,
		`
		SELECT
			dc.id::text,
			dc.document_id::text,
			d.original_filename,
			dc.chunk_index,
			LEFT(dc.content, 1000),
			ts_rank_cd(to_tsvector('english', dc.content), plainto_tsquery('english', $2)) AS score,
			dc.metadata
		FROM document_chunks dc
		INNER JOIN documents d ON d.id = dc.document_id
		WHERE dc.tenant_id = $1
		  AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', $2)
		ORDER BY score DESC, dc.chunk_index ASC
		LIMIT $3
		`,
		tenantID,
		query,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("rag query: %w", err)
	}
	defer rows.Close()

	results := make([]ClawRAGResult, 0)
	for rows.Next() {
		var item ClawRAGResult
		var metadataBytes []byte
		if err := rows.Scan(
			&item.ChunkID,
			&item.DocumentID,
			&item.DocumentTitle,
			&item.ChunkIndex,
			&item.Content,
			&item.Score,
			&metadataBytes,
		); err != nil {
			return nil, fmt.Errorf("scan rag result: %w", err)
		}
		item.Metadata = decodeJSONMap(metadataBytes)
		results = append(results, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate rag results: %w", err)
	}
	return results, nil
}

func (s *PGClawStore) WriteAudit(ctx context.Context, request ClawAuditWriteRequest) (string, error) {
	tenantID, err := uuid.Parse(strings.TrimSpace(request.TenantID))
	if err != nil {
		return "", fmt.Errorf("tenant_id must be a UUID: %w", err)
	}

	if !isAllowedAuditAction(request.Action) {
		return "", fmt.Errorf("unsupported audit action %q", request.Action)
	}

	details, err := json.Marshal(defaultMetadata(request.Details))
	if err != nil {
		return "", fmt.Errorf("marshal audit details: %w", err)
	}
	metadata, err := json.Marshal(defaultMetadata(request.Metadata))
	if err != nil {
		return "", fmt.Errorf("marshal audit metadata: %w", err)
	}
	tags, err := json.Marshal(defaultTags(request.ComplianceTags))
	if err != nil {
		return "", fmt.Errorf("marshal audit compliance tags: %w", err)
	}

	userID, err := parseOptionalUUID(request.UserID)
	if err != nil {
		return "", fmt.Errorf("user_id must be a UUID when provided: %w", err)
	}
	resourceID, err := parseOptionalUUID(request.ResourceID)
	if err != nil {
		return "", fmt.Errorf("resource_id must be a UUID when provided: %w", err)
	}
	sessionID, err := parseOptionalUUID(request.SessionID)
	if err != nil {
		return "", fmt.Errorf("session_id must be a UUID when provided: %w", err)
	}
	requestID, err := parseOptionalUUID(request.RequestID)
	if err != nil {
		return "", fmt.Errorf("request_id must be a UUID when provided: %w", err)
	}

	var auditID string
	if err := s.db.Pool.QueryRow(
		ctx,
		`
		INSERT INTO audit_logs (
			tenant_id, user_id, action, resource_type, resource_id, details, ip_address,
			user_agent, session_id, request_id, response_status, processing_time_ms, metadata, compliance_tags
		)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb)
		RETURNING id::text
		`,
		tenantID,
		userID,
		request.Action,
		request.ResourceType,
		resourceID,
		details,
		nullIfEmpty(request.IPAddress),
		nullIfEmpty(request.UserAgent),
		sessionID,
		requestID,
		nullableInt(request.ResponseStatus),
		nullableInt(request.ProcessingTimeMs),
		metadata,
		tags,
	).Scan(&auditID); err != nil {
		return "", fmt.Errorf("write audit log: %w", err)
	}

	return auditID, nil
}

type memoryClawStore struct {
	mutex    sync.RWMutex
	memories map[string]ClawMemoryRecord
	sessions map[string]ClawSession
}

func newMemoryClawStore() *memoryClawStore {
	return &memoryClawStore{
		memories: make(map[string]ClawMemoryRecord),
		sessions: make(map[string]ClawSession),
	}
}

func (s *memoryClawStore) EnsureSchema(context.Context) error { return nil }
func (s *memoryClawStore) Health(context.Context) error       { return nil }

func (s *memoryClawStore) RegisterSession(_ context.Context, session ClawSession) (*ClawSession, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	now := time.Now().UTC()
	if existing, ok := s.sessions[session.SessionID]; ok {
		session.CreatedAt = existing.CreatedAt
	} else {
		session.CreatedAt = now
	}
	session.LastSeenAt = now
	session.Metadata = defaultMetadata(session.Metadata)
	s.sessions[session.SessionID] = session
	return &session, nil
}

func (s *memoryClawStore) WriteMemory(_ context.Context, request ClawMemoryWriteRequest) (*ClawMemoryRecord, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	now := time.Now().UTC()
	record := ClawMemoryRecord{
		ID:         "mem_" + uuid.NewString(),
		TenantID:   request.TenantID,
		UserID:     request.UserID,
		SessionID:  request.SessionID,
		AgentID:    request.AgentID,
		Type:       request.Type,
		Content:    request.Content,
		Source:     request.Source,
		Importance: request.Importance,
		Tags:       defaultTags(request.Tags),
		Metadata:   defaultMetadata(request.Metadata),
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	s.memories[record.ID] = record
	return &record, nil
}

func (s *memoryClawStore) SearchMemories(_ context.Context, request ClawMemorySearchRequest) ([]ClawMemoryRecord, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	results := make([]ClawMemoryRecord, 0)
	query := strings.ToLower(strings.TrimSpace(request.Query))
	limit := normalizeLimit(request.Limit, 10, 100)

	for _, memory := range s.memories {
		if memory.TenantID != request.TenantID || memory.UserID != request.UserID {
			continue
		}
		if request.SessionID != "" && memory.SessionID != request.SessionID {
			continue
		}
		if request.Type != "" && memory.Type != request.Type {
			continue
		}
		if query != "" && !strings.Contains(strings.ToLower(memory.Content), query) {
			continue
		}
		if len(request.Tags) > 0 && !containsAllTags(memory.Tags, request.Tags) {
			continue
		}
		results = append(results, memory)
	}

	sortClawMemories(results)
	if len(results) > limit {
		results = results[:limit]
	}
	return results, nil
}

func (s *memoryClawStore) GetMemory(_ context.Context, tenantID, userID, memoryID string) (*ClawMemoryRecord, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	memory, ok := s.memories[memoryID]
	if !ok || memory.TenantID != tenantID || memory.UserID != userID {
		return nil, errClawMemoryNotFound
	}
	return &memory, nil
}

func (s *memoryClawStore) DeleteMemory(_ context.Context, tenantID, userID, memoryID string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	memory, ok := s.memories[memoryID]
	if !ok || memory.TenantID != tenantID || memory.UserID != userID {
		return errClawMemoryNotFound
	}
	delete(s.memories, memoryID)
	return nil
}

func (s *memoryClawStore) SearchDocuments(context.Context, ClawDocumentSearchRequest) ([]ClawDocumentSearchResult, error) {
	return []ClawDocumentSearchResult{}, nil
}

func (s *memoryClawStore) RAGQuery(context.Context, ClawRAGQueryRequest) ([]ClawRAGResult, error) {
	return []ClawRAGResult{}, nil
}

func (s *memoryClawStore) WriteAudit(context.Context, ClawAuditWriteRequest) (string, error) {
	return "audit_" + uuid.NewString(), nil
}

func scanMemoryRow(rows interface{ Scan(dest ...any) error }) (ClawMemoryRecord, error) {
	var record ClawMemoryRecord
	var tagsBytes []byte
	var metadataBytes []byte
	if err := rows.Scan(
		&record.ID,
		&record.TenantID,
		&record.UserID,
		&record.SessionID,
		&record.AgentID,
		&record.Type,
		&record.Content,
		&record.Source,
		&record.Importance,
		&tagsBytes,
		&metadataBytes,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return ClawMemoryRecord{}, fmt.Errorf("scan claw memory row: %w", err)
	}
	record.Tags = decodeJSONStringArray(tagsBytes)
	record.Metadata = decodeJSONMap(metadataBytes)
	return record, nil
}

func defaultMetadata(value map[string]any) map[string]any {
	if value == nil {
		return map[string]any{}
	}
	return value
}

func defaultTags(tags []string) []string {
	if tags == nil {
		return []string{}
	}
	return tags
}

func decodeJSONMap(data []byte) map[string]any {
	if len(data) == 0 {
		return map[string]any{}
	}
	decoded := make(map[string]any)
	if err := json.Unmarshal(data, &decoded); err != nil {
		return map[string]any{}
	}
	return decoded
}

func decodeJSONStringArray(data []byte) []string {
	if len(data) == 0 {
		return []string{}
	}
	var decoded []string
	if err := json.Unmarshal(data, &decoded); err != nil {
		return []string{}
	}
	return decoded
}

func containsAllTags(memoryTags []string, requested []string) bool {
	tagSet := make(map[string]struct{}, len(memoryTags))
	for _, tag := range memoryTags {
		tagSet[strings.ToLower(tag)] = struct{}{}
	}
	for _, tag := range requested {
		if _, ok := tagSet[strings.ToLower(tag)]; !ok {
			return false
		}
	}
	return true
}

func sortClawMemories(memories []ClawMemoryRecord) {
	for i := 0; i < len(memories); i++ {
		for j := i + 1; j < len(memories); j++ {
			if memories[j].Importance > memories[i].Importance ||
				(memories[j].Importance == memories[i].Importance && memories[j].CreatedAt.After(memories[i].CreatedAt)) {
				memories[i], memories[j] = memories[j], memories[i]
			}
		}
	}
}

func normalizeLimit(value, fallback, max int) int {
	if value <= 0 {
		return fallback
	}
	if value > max {
		return max
	}
	return value
}

func nullIfEmpty(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func nullableInt(value int) any {
	if value == 0 {
		return nil
	}
	return value
}

func parseOptionalUUID(value string) (any, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil
	}
	parsed, err := uuid.Parse(trimmed)
	if err != nil {
		return nil, err
	}
	return parsed, nil
}

func isAllowedAuditAction(action string) bool {
	switch action {
	case "create", "read", "update", "delete", "login", "logout", "access_denied":
		return true
	default:
		return false
	}
}
