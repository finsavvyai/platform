package domain

import "fmt"

type AuditAction int

const (
	AuditActionUnknown AuditAction = iota
	AuditActionScreeningPerformed
	AuditActionAlertCreated
	AuditActionAlertResolved
	AuditActionConfigUpdated
	AuditActionListSynced
	AuditActionEntityIngested
	AuditActionMatchOverridden
	AuditActionUserLogin
	AuditActionUserAdded
	AuditActionUserRemoved
	AuditActionRoleChanged
	AuditActionTenantCreated
)

func (aa AuditAction) String() string {
	switch aa {
	case AuditActionScreeningPerformed:
		return "ScreeningPerformed"
	case AuditActionAlertCreated:
		return "AlertCreated"
	case AuditActionAlertResolved:
		return "AlertResolved"
	case AuditActionConfigUpdated:
		return "ConfigUpdated"
	case AuditActionListSynced:
		return "ListSynced"
	case AuditActionEntityIngested:
		return "EntityIngested"
	case AuditActionMatchOverridden:
		return "MatchOverridden"
	case AuditActionUserLogin:
		return "UserLogin"
	case AuditActionUserAdded:
		return "UserAdded"
	case AuditActionUserRemoved:
		return "UserRemoved"
	case AuditActionRoleChanged:
		return "RoleChanged"
	case AuditActionTenantCreated:
		return "TenantCreated"
	default:
		return "Unknown"
	}
}

func ParseAuditAction(s string) (AuditAction, error) {
	switch s {
	case "ScreeningPerformed":
		return AuditActionScreeningPerformed, nil
	case "AlertCreated":
		return AuditActionAlertCreated, nil
	case "AlertResolved":
		return AuditActionAlertResolved, nil
	case "ConfigUpdated":
		return AuditActionConfigUpdated, nil
	case "ListSynced":
		return AuditActionListSynced, nil
	case "EntityIngested":
		return AuditActionEntityIngested, nil
	case "MatchOverridden":
		return AuditActionMatchOverridden, nil
	case "UserLogin":
		return AuditActionUserLogin, nil
	case "UserAdded":
		return AuditActionUserAdded, nil
	case "UserRemoved":
		return AuditActionUserRemoved, nil
	case "RoleChanged":
		return AuditActionRoleChanged, nil
	case "TenantCreated":
		return AuditActionTenantCreated, nil
	default:
		return AuditActionUnknown, fmt.Errorf("invalid audit action: %s", s)
	}
}
