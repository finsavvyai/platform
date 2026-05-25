package domain

import "fmt"

type VesselDetails struct {
	IMO        string  // International Maritime Organization number
	MMSI       string  // Maritime Mobile Service Identity
	CallSign   string
	Flag       string  // Country flag (ISO)
	Tonnage    float64 // Gross tonnage
	VesselType string  // Cargo, Tanker, etc.
	Owner      string
	Built      int // Year built
}

func NewVesselDetails(imo, flag string) (VesselDetails, error) {
	if imo == "" {
		return VesselDetails{}, fmt.Errorf("IMO number required for vessel")
	}
	return VesselDetails{IMO: imo, Flag: flag}, nil
}

func (v VesselDetails) String() string {
	return fmt.Sprintf("IMO:%s Flag:%s Type:%s", v.IMO, v.Flag, v.VesselType)
}
