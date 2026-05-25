package domain

import (
	"fmt"
	"time"
)

func errInvalidTransition(from, to CaseStatus) error {
	return fmt.Errorf(
		"invalid transition: %s -> %s", from, to,
	)
}

func errCommentRequired(from, to CaseStatus) error {
	return fmt.Errorf(
		"comment required for transition: %s -> %s", from, to,
	)
}

// touchUpdated sets UpdatedAt to now.
func (c *ComplianceCase) touchUpdated() {
	c.UpdatedAt = time.Now().UTC()
}
