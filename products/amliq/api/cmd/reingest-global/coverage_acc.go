package main

import "github.com/aegis-aml/aegis/internal/domain"

// coverageAcc tallies field-coverage counters one entity at a
// time. Used by the streaming path so we can still emit
// list_sync_audit coverage rows without buffering the full slice.
type coverageAcc struct {
	parsed, dob, nat, addr, ids, aliases int
}

func (c *coverageAcc) observe(e *domain.Entity) {
	c.parsed++
	if e.DOB != nil {
		c.dob++
	}
	if len(e.Nationalities) > 0 {
		c.nat++
	}
	if len(e.Addresses) > 0 {
		c.addr++
	}
	if len(e.Identifiers) > 0 {
		c.ids++
	}
	if len(e.Names) > 1 {
		c.aliases++
	}
}

func (c *coverageAcc) applyToAudit(a *domain.ListSyncAudit) {
	a.EntitiesParsed = c.parsed
	a.EntitiesWithDOB = c.dob
	a.EntitiesWithNat = c.nat
	a.EntitiesWithAddr = c.addr
	a.EntitiesWithIDs = c.ids
	a.EntitiesWithAliases = c.aliases
}
