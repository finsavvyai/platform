package auth

import "quantumbeam/internal/models"

func mapOIDCGroupsToRole(groups []string, attributeMap map[string]string) (models.UserRole, bool) {
	if len(groups) == 0 || len(attributeMap) == 0 {
		return "", false
	}
	check := func(key string) bool {
		groupName, ok := attributeMap[key]
		if !ok || groupName == "" {
			return false
		}
		for _, group := range groups {
			if group == groupName {
				return true
			}
		}
		return false
	}
	switch {
	case check("role_group_admin"):
		return models.UserRoleAdmin, true
	case check("role_group_enterprise"):
		return models.UserRoleEnterprise, true
	case check("role_group_developer"):
		return models.UserRoleDeveloper, true
	case check("role_group_viewer"):
		return models.UserRoleViewer, true
	default:
		return "", false
	}
}

