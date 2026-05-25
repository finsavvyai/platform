package fraud

import "strings"

// matchesNodeFilters returns true if the node passes all filter criteria.
func matchesNodeFilters(node *GraphNode, filters *GraphFilters) bool {
	if filters == nil {
		return true
	}
	if len(filters.NodeTypes) > 0 && !containsStr(filters.NodeTypes, node.Type) {
		return false
	}
	if filters.MinRiskScore > 0 && node.RiskScore < filters.MinRiskScore {
		return false
	}
	if filters.MaxRiskScore > 0 && node.RiskScore > filters.MaxRiskScore {
		return false
	}
	return true
}

// paginateNodes returns a slice of nodes for the given offset and limit.
func paginateNodes(nodes []GraphNode, offset, limit int) []GraphNode {
	if offset >= len(nodes) {
		return []GraphNode{}
	}
	end := offset + limit
	if end > len(nodes) {
		end = len(nodes)
	}
	return nodes[offset:end]
}

// containsStr checks if a string slice contains the given value (case-insensitive).
func containsStr(slice []string, s string) bool {
	for _, v := range slice {
		if strings.EqualFold(v, s) {
			return true
		}
	}
	return false
}
