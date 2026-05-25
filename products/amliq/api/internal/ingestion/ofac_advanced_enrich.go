package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

func advSetMeta(ent *domain.Entity, e advSDNEntry) {
	setMeta(ent, "dataset", "us_ofac_sdn")
	setMeta(ent, "schemaType", e.SDNType)
	setMeta(ent, "gender", mapGender(e.Gender))
	setMeta(ent, "title", e.Title)
	setMeta(ent, "remarks", e.Remarks)
	setMeta(ent, "source_url", "https://sanctionssearch.ofac.treas.gov/Details.aspx?id="+e.UID)

	// Gather programs
	var progs []string
	for _, p := range e.ProgramList {
		if prog := strings.TrimSpace(p.ProgramID); prog != "" {
			addUnique(&progs, prog)
		}
	}
	if len(progs) > 0 {
		setMeta(ent, "programs", joinSemi(progs...))
	}

	// Gather nationalities
	for _, nat := range e.NationalityList {
		if c := strings.TrimSpace(nat.Country); c != "" {
			addUnique(&ent.Nationalities, c)
		}
	}

	// Gather citizenships
	for _, cit := range e.CitizenshipList {
		if c := strings.TrimSpace(cit.Country); c != "" {
			addUnique(&ent.Nationalities, c)
		}
	}

	// Vessel info — critical for vessel screening cases.
	if e.VesselInfo != nil {
		v := e.VesselInfo
		setMeta(ent, "vessel_name", v.VesselName)
		setMeta(ent, "vessel_type", v.VesselType)
		setMeta(ent, "call_sign", v.CallSign)
		setMeta(ent, "imo", v.IMONumber)
		setMeta(ent, "mmsi", v.MMSI)
		setMeta(ent, "flag", v.Flag)
		// Also as structured identifier so exact-match works on IMO.
		if imo := strings.TrimSpace(v.IMONumber); imo != "" {
			if id, err := domain.NewIdentifier(domain.IDIMOID, imo, v.Flag); err == nil {
				ent.Identifiers = append(ent.Identifiers, id)
			}
		}
	}

	// Structured DOB parse (first non-empty).
	for _, d := range e.DOBList {
		if s := strings.TrimSpace(d.DateOfBirth); s != "" {
			parseDOB(ent, s)
			break
		}
	}

	// Birth place (first non-empty).
	for _, p := range e.POBList {
		parts := joinNonEmpty(p.City, p.Country)
		if parts != "" {
			setMeta(ent, "birth_place", parts)
			if p.Country != "" {
				setMeta(ent, "birth_country", strings.TrimSpace(p.Country))
			}
			break
		}
	}
}

func advSetAddresses(ent *domain.Entity, addrs []advAddress) {
	for _, a := range addrs {
		addr := joinSemi(
			strings.TrimSpace(a.AddressLine1),
			strings.TrimSpace(a.AddressLine2),
			strings.TrimSpace(a.City),
			strings.TrimSpace(a.PostalCode),
			strings.TrimSpace(a.Country),
		)
		if addr != "" {
			addUnique(&ent.Addresses, addr)
		}
	}
}

func advSetIdentifiers(ent *domain.Entity, ids []advID) {
	for _, id := range ids {
		idVal := strings.TrimSpace(id.IDNumber)
		idType := strings.TrimSpace(id.IDType)
		if idVal == "" {
			continue
		}

		// Map document type to IdentifierType
		var domType domain.IdentifierType
		lower := strings.ToLower(idType)
		switch {
		case strings.Contains(lower, "passport"):
			domType = domain.IDPassport
		case strings.Contains(lower, "national id"):
			domType = domain.IDNationalID
		case strings.Contains(lower, "tax"):
			domType = domain.IDTaxID
		case strings.Contains(lower, "registration"):
			domType = domain.IDRegistration
		default:
			domType = domain.IDRegistration
		}

		country := strings.TrimSpace(id.Country)
		if ident, err := domain.NewIdentifier(domType, idVal, country); err == nil {
			ent.Identifiers = append(ent.Identifiers, ident)
		}
	}
}

