package ingestion

import (
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

func parseAdvEntry(e advSDNEntry) (domain.Entity, bool) {
	if e.UID == "" {
		return domain.Entity{}, false
	}

	// Build primary name from firstName+lastName; fallback to lastName only
	primaryName := strings.TrimSpace(e.FirstName)
	lastName := strings.TrimSpace(e.LastName)
	if lastName != "" && primaryName != "" {
		primaryName = primaryName + " " + lastName
	} else if lastName != "" {
		primaryName = lastName
	}
	primaryName = strings.TrimSpace(primaryName)

	// Skip if empty or single-token name
	if primaryName == "" || isOneWord(primaryName) {
		return domain.Entity{}, false
	}

	// Pad UID to 12 digits
	padded := fmt.Sprintf("%012s", e.UID)
	padded = strings.ReplaceAll(padded, " ", "0")
	id, err := domain.NewEntityID("ent_" + padded)
	if err != nil {
		return domain.Entity{}, false
	}

	// Determine entity type
	typ := mapOFACEntityType(e.SDNType)

	// Create primary name preserving first/last so downstream search
	// can use given/family separately (exact-match boosts).
	name, _ := domain.NewName(primaryName,
		strings.TrimSpace(e.FirstName),
		strings.TrimSpace(e.LastName),
		"")
	ent, err := domain.NewEntity(id, typ, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = "ofac-sdn"

	// Add aliases from AKA list, preserving name parts per alias.
	for _, aka := range e.AKAList {
		aliasFirst := strings.TrimSpace(aka.FirstName)
		aliasLast := strings.TrimSpace(aka.LastName)
		var aliasName string
		if aliasFirst != "" && aliasLast != "" {
			aliasName = aliasFirst + " " + aliasLast
		} else if aliasLast != "" {
			aliasName = aliasLast
		} else if aliasFirst != "" {
			aliasName = aliasFirst
		}
		aliasName = strings.TrimSpace(aliasName)
		if aliasName != "" && !isOneWord(aliasName) {
			if n, err := domain.NewName(aliasName, aliasFirst, aliasLast, ""); err == nil {
				ent.Names = append(ent.Names, n)
			}
		}
	}

	// Set metadata and structured fields
	advSetMeta(&ent, e)
	advSetAddresses(&ent, e.AddressList)
	advSetIdentifiers(&ent, e.IDList)
	advSetDatesAndPlaces(&ent, e.DOBList, e.POBList)

	return ent, true
}
