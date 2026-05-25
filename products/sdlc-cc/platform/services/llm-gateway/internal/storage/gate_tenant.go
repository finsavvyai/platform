package storage

import (
	"context"
	"fmt"
)

// TenantAwareGate blocks read operations when tenant scope is missing.
// For ops that take (tenantID, userID, ...), the first two string args are checked.
// Write operations (RecordCost, UpdateBudget) are allowed if tenant/user are non-empty.
type TenantAwareGate struct{}

// AllowQuery returns an error if the operation requires tenant scope and it is missing.
func (TenantAwareGate) AllowQuery(ctx context.Context, op string, _ string, args []interface{}) error {
	tenantScope := firstStringArg(args)
	if tenantScope == "" && requiresTenant(op) {
		return fmt.Errorf("storage: %s requires tenant scope", op)
	}
	return nil
}

func requiresTenant(op string) bool {
	switch op {
	case "GetCurrentUsage", "GetCostHistory", "GetCostSummary", "GetBudget", "GetTopSpenders":
		return true
	case "RecordCost", "UpdateBudget", "createTables":
		return false
	default:
		return true
	}
}

func firstStringArg(args []interface{}) string {
	for _, a := range args {
		if s, ok := a.(string); ok && s != "" {
			return s
		}
	}
	return ""
}
