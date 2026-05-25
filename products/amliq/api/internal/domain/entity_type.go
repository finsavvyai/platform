package domain

import "fmt"

type EntityType int

const (
	EntityTypeUnknown EntityType = iota
	EntityTypeIndividual
	EntityTypeCompany
	EntityTypeVessel
	EntityTypeAircraft
)

func (et EntityType) String() string {
	switch et {
	case EntityTypeIndividual:
		return "Individual"
	case EntityTypeCompany:
		return "Company"
	case EntityTypeVessel:
		return "Vessel"
	case EntityTypeAircraft:
		return "Aircraft"
	default:
		return "Unknown"
	}
}

func ParseEntityType(s string) (EntityType, error) {
	switch s {
	case "Individual":
		return EntityTypeIndividual, nil
	case "Company":
		return EntityTypeCompany, nil
	case "Vessel":
		return EntityTypeVessel, nil
	case "Aircraft":
		return EntityTypeAircraft, nil
	default:
		return EntityTypeUnknown, fmt.Errorf("invalid entity type: %s", s)
	}
}
