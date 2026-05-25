package domain

import (
	"fmt"
	"strings"
)

type Name struct {
	Full           string
	Given          string
	Family         string
	OriginalScript string
}

func NewName(full, given, family, original string) (Name, error) {
	if full = strings.TrimSpace(full); full == "" {
		return Name{}, fmt.Errorf("full name required")
	}
	return Name{
		Full:           full,
		Given:          strings.TrimSpace(given),
		Family:         strings.TrimSpace(family),
		OriginalScript: strings.TrimSpace(original),
	}, nil
}

func (n Name) Normalize() string {
	return strings.ToLower(strings.TrimSpace(n.Full))
}

func (n Name) IsZero() bool {
	return n.Full == ""
}

func (n Name) String() string {
	return n.Full
}
