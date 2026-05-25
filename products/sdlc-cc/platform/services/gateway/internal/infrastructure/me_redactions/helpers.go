// Tiny helpers used by the PgxReader. Kept in a separate file so
// pgx_reader.go stays focused on the SQL.
package me_redactions

import "github.com/google/uuid"

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	digits := make([]byte, 0, 4)
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}

func joinAnd(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += " AND "
		}
		out += p
	}
	return out
}

// uuidFromString parses defensively — caller's tests don't depend
// on the precise return when input is malformed.
func uuidFromString(s string) uuid.UUID {
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil
	}
	return id
}
