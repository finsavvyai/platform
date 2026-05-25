package storage

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNoopGate_AllowsAll(t *testing.T) {
	ctx := context.Background()
	g := NoopGate{}
	assert.NoError(t, g.AllowQuery(ctx, "GetCurrentUsage", "SELECT 1", nil))
	assert.NoError(t, g.AllowQuery(ctx, "RecordCost", "INSERT INTO x", []interface{}{"a", "b"}))
}

func TestTenantAwareGate_AllowsWhenTenantPresent(t *testing.T) {
	ctx := context.Background()
	g := TenantAwareGate{}
	assert.NoError(t, g.AllowQuery(ctx, "GetCurrentUsage", "", []interface{}{"tenant-1", "user-1"}))
	assert.NoError(t, g.AllowQuery(ctx, "GetBudget", "", []interface{}{"t", "u"}))
	assert.NoError(t, g.AllowQuery(ctx, "RecordCost", "", []interface{}{"id", "tenant-1", "user-1"}))
}

func TestTenantAwareGate_BlocksReadWhenNoTenant(t *testing.T) {
	ctx := context.Background()
	g := TenantAwareGate{}
	err := g.AllowQuery(ctx, "GetCurrentUsage", "", nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "tenant scope")

	err = g.AllowQuery(ctx, "GetCurrentUsage", "", []interface{}{"", ""})
	assert.Error(t, err)
}
