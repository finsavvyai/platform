package domain

import "fmt"

type ListSource int

const (
	ListSourceUnknown ListSource = iota
	ListSourceOFAC
	ListSourceEU
	ListSourceUN
	ListSourceUKOFSI
	ListSourceSECO
	ListSourceIsraeliMoD
	ListSourceSDFM
	ListSourceOpenSanctions
	ListSourceDFAT
	ListSourceCanada
	ListSourceJapan
	ListSourceMAS
	ListSourceHKMA
	ListSourceFranceTresor
	ListSourceInterpol
	ListSourceWorldBank
	ListSourceKorea
	ListSourceBrazil
	ListSourceIndia
	ListSourceUAE
	ListSourceSouthAfrica
	ListSourceFATF
	ListSourceBIS
	ListSourceEuropol
	ListSourceFBI
	ListSourceUKHMT
	ListSourceNZPolice
	ListSourceCustom
)

func (ls ListSource) String() string {
	switch ls {
	case ListSourceOFAC:
		return "OFAC"
	case ListSourceEU:
		return "EU"
	case ListSourceUN:
		return "UN"
	case ListSourceUKOFSI:
		return "UKOFSI"
	case ListSourceSECO:
		return "SECO"
	case ListSourceIsraeliMoD:
		return "IsraeliMoD"
	case ListSourceSDFM:
		return "SDFM"
	case ListSourceOpenSanctions:
		return "OpenSanctions"
	case ListSourceCustom:
		return "Custom"
	default:
		if s, ok := extendedSourceString(ls); ok {
			return s
		}
		return "Unknown"
	}
}

func ParseListSource(s string) (ListSource, error) {
	switch s {
	case "OFAC":
		return ListSourceOFAC, nil
	case "EU":
		return ListSourceEU, nil
	case "UN":
		return ListSourceUN, nil
	case "UKOFSI":
		return ListSourceUKOFSI, nil
	case "SECO":
		return ListSourceSECO, nil
	case "IsraeliMoD":
		return ListSourceIsraeliMoD, nil
	case "SDFM":
		return ListSourceSDFM, nil
	case "OpenSanctions":
		return ListSourceOpenSanctions, nil
	case "Custom":
		return ListSourceCustom, nil
	default:
		if ls, ok := parseExtendedSource(s); ok {
			return ls, nil
		}
		return ListSourceUnknown, fmt.Errorf("invalid list source: %s", s)
	}
}
