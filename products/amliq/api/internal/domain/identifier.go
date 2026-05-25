package domain

import (
	"fmt"
	"strings"
)

type LegacyIdentifierType int

const (
	LegacyIDUnknown LegacyIdentifierType = iota
	LegacyIDPassport
	LegacyIDNationalID
	LegacyIDLEI
	LegacyIDIMO
	LegacyIDICAO
	LegacyIDIBAN
	LegacyIDTaxID
)

func (it LegacyIdentifierType) String() string {
	switch it {
	case LegacyIDPassport:
		return "Passport"
	case LegacyIDNationalID:
		return "NationalID"
	case LegacyIDLEI:
		return "LEI"
	case LegacyIDIMO:
		return "IMO"
	case LegacyIDICAO:
		return "ICAO"
	case LegacyIDIBAN:
		return "IBAN"
	case LegacyIDTaxID:
		return "TaxID"
	default:
		return "Unknown"
	}
}

type Identifier struct {
	Type    IdentifierType
	Value   string
	Country string
}

func NewIdentifier(typ IdentifierType, val, country string) (Identifier, error) {
	val = strings.TrimSpace(val)
	if val == "" {
		return Identifier{}, fmt.Errorf("identifier value required")
	}
	return Identifier{
		Type:    typ,
		Value:   val,
		Country: strings.TrimSpace(country),
	}, nil
}
