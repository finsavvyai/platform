package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

func setBulkContact(ent *domain.Entity, props map[string][]string) {
	if e := toIfaceSlice(props["email"]); len(e) > 0 {
		ent.Metadata["emails"] = e
	}
	if p := toIfaceSlice(props["phone"]); len(p) > 0 {
		ent.Metadata["phones"] = p
	}
	if w := toIfaceSlice(props["website"]); len(w) > 0 {
		ent.Metadata["websites"] = w
	}
}

func setBulkAddresses(ent *domain.Entity, props map[string][]string) {
	for _, a := range props["address"] {
		addUnique(&ent.Addresses, strings.TrimSpace(a))
	}
}

func setBulkIdentifiers(ent *domain.Entity, props map[string][]string) {
	add := func(t domain.IdentifierType, vals []string) {
		for _, v := range vals {
			if id, err := domain.NewIdentifier(t, v, ""); err == nil {
				ent.Identifiers = append(ent.Identifiers, id)
			}
		}
	}
	add(domain.IDPassport, props["passportNumber"])
	add(domain.IDNationalID, props["idNumber"])
	add(domain.IDTaxID, props["taxNumber"])
	add(domain.IDRegistration, props["registrationNumber"])
	add(domain.IDIMOID, props["imoNumber"])
	// Less common but worth capturing on the entity.
	add(domain.IDRegistration, props["ogrnCode"])
	add(domain.IDRegistration, props["innCode"])
	add(domain.IDRegistration, props["leiCode"])
}

// setPepTier derives a simple tier tag from OpenSanctions topics.
// "sanction.*" wins over "role.pep". Writes to both ent.PEPTier
// (first-class column from migration 067) and metadata.pep_tier
// (legacy, kept for backward compat with downstream consumers).
func setPepTier(ent *domain.Entity, topics []string) {
	for _, t := range topics {
		if strings.Contains(strings.ToLower(t), "sanction") {
			setMeta(ent, "pep_tier", "SANCTION")
			if ent.PEPTier == domain.PEPTierNone {
				ent.PEPTier = domain.PEPTier1
			}
			return
		}
	}
	for _, t := range topics {
		if strings.HasPrefix(strings.ToLower(t), "role.pep") {
			setMeta(ent, "pep_tier", "PEP")
			if ent.PEPTier == domain.PEPTierNone {
				ent.PEPTier = domain.PEPTier2
			}
			return
		}
	}
}

func toIfaceSlice(in []string) []interface{} {
	out := make([]interface{}, 0, len(in))
	for _, s := range in {
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, s)
		}
	}
	return out
}
