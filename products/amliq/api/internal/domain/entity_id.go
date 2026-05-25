package domain

import (
	"fmt"
	"regexp"
)

type EntityID struct {
	value string
}

var entityIDRegex = regexp.MustCompile(`^[a-zA-Z0-9_\-\.]{2,250}$`)

func NewEntityID(id string) (EntityID, error) {
	if !entityIDRegex.MatchString(id) {
		return EntityID{}, fmt.Errorf("invalid entity id format: %s", id)
	}
	return EntityID{value: id}, nil
}

func (e EntityID) String() string {
	return e.value
}

func (e EntityID) Value() string {
	return e.value
}

func (e EntityID) IsZero() bool {
	return e.value == ""
}
