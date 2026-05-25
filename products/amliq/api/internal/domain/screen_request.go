package domain

import (
	"fmt"
	"time"
)

type TransactionContext struct {
	Amount   float64
	Currency string
	Country  string
	Purpose  string
}

type ScreenRequest struct {
	ID                 string
	TenantID           TenantID
	Entity             Entity
	TransactionContext *TransactionContext
	Options            map[string]interface{}
	RequestedAt        time.Time
}

func NewScreenRequest(
	tenantID TenantID,
	entity Entity,
) (ScreenRequest, error) {
	if tenantID.IsZero() {
		return ScreenRequest{}, fmt.Errorf("tenant id required")
	}
	return ScreenRequest{
		ID:          "scr_" + fmt.Sprintf("%d", time.Now().UnixNano()),
		TenantID:    tenantID,
		Entity:      entity,
		Options:     make(map[string]interface{}),
		RequestedAt: time.Now().UTC(),
	}, nil
}

func (sr ScreenRequest) String() string {
	return sr.ID
}
