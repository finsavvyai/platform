package domain

// SystemTenantID returns the reserved `__global__` tenant used for
// shared sanctions/PEP data that is loaded once and queried by every
// customer tenant at screening time.
//
// The value bypasses the tnt_[a-z0-9]{12} regex enforced by
// NewTenantID on purpose: only system code paths — seed commands,
// global reingest tools, migrations — may use it. Customer-facing
// code must continue to construct TenantIDs via NewTenantID so
// malformed IDs coming over the wire are still rejected.
func SystemTenantID() TenantID {
	return TenantID{value: "__global__"}
}

// IsSystem reports whether this TenantID is the reserved `__global__`
// system tenant used for shared global list data.
func (t TenantID) IsSystem() bool {
	return t.value == "__global__"
}
