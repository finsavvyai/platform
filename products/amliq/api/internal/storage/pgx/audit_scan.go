package pgx

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanAuditFromRows(rows *sql.Rows) (*domain.AuditEntry, error) {
	var (
		id, tenantID, action, actorID, resourceType, resourceID string
		details, previousHash, hash                             []byte
		createdAt                                               time.Time
	)

	err := rows.Scan(&id, &tenantID, &action, &actorID, &resourceType,
		&resourceID, &details, &previousHash, &hash, &createdAt)
	if err != nil {
		return nil, fmt.Errorf("scan audit: %w", err)
	}

	tid, err := domain.NewTenantID(tenantID)
	if err != nil {
		return nil, err
	}

	var detailsMap map[string]interface{}
	if len(details) > 0 {
		json.Unmarshal(details, &detailsMap)
	} else {
		detailsMap = make(map[string]interface{})
	}

	actionVal, _ := domain.ParseAuditAction(action)

	entry := domain.AuditEntry{
		ID:           id,
		TenantID:     tid,
		Timestamp:    createdAt,
		Action:       actionVal,
		ActorID:      actorID,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Details:      detailsMap,
		PreviousHash: string(previousHash),
		Hash:         string(hash),
	}
	return &entry, nil
}
