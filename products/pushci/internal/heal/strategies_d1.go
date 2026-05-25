package heal

import (
	"fmt"
	"regexp"
	"strings"
)

var (
	reTableExists   = regexp.MustCompile(`table\s+["']?(\w+)["']?\s+already exists`)
	reColumnMissing = regexp.MustCompile(`no such column:\s+(\w+)\.(\w+)`)
	reSQLiteError   = regexp.MustCompile(`SQLITE_ERROR:\s+(.+)`)
	reD1Error       = regexp.MustCompile(`D1_ERROR:\s+(.+)`)
)

// d1TableExists detects "table already exists" errors and suggests
// wrapping CREATE TABLE with IF NOT EXISTS.
func d1TableExists(output string) *Fix {
	m := reTableExists.FindStringSubmatch(output)
	if m == nil {
		return nil
	}
	table := m[1]
	return &Fix{
		Pattern: "d1-table-exists",
		Action:  "write:migration-fix",
		FilesChanged: []string{
			fmt.Sprintf("packages/db/migrations/fix_%s.sql=CREATE TABLE IF NOT EXISTS %s;", table, table),
		},
	}
}

// d1ColumnMissing detects missing column errors and suggests an ALTER TABLE.
func d1ColumnMissing(output string) *Fix {
	m := reColumnMissing.FindStringSubmatch(output)
	if m == nil {
		return nil
	}
	table := m[1]
	column := m[2]
	return &Fix{
		Pattern: "d1-column-missing",
		Action:  "write:migration-fix",
		FilesChanged: []string{
			fmt.Sprintf("packages/db/migrations/fix_add_%s_%s.sql=ALTER TABLE %s ADD COLUMN %s TEXT;",
				table, column, table, column),
		},
	}
}

// d1SQLiteGeneric detects generic D1/SQLite errors.
func d1SQLiteGeneric(output string) *Fix {
	if !strings.Contains(output, "SQLITE_ERROR") && !strings.Contains(output, "D1_ERROR") {
		return nil
	}
	var msg string
	if m := reSQLiteError.FindStringSubmatch(output); len(m) > 1 {
		msg = m[1]
	} else if m := reD1Error.FindStringSubmatch(output); len(m) > 1 {
		msg = m[1]
	}
	if msg == "" {
		return nil
	}
	// Cannot auto-fix generic errors, but provide diagnosis
	return &Fix{
		Pattern: "d1-sqlite-error",
		Action:  "echo 'D1 error detected: " + sanitize(msg) + " — review migration SQL'",
	}
}

// d1ForeignKey detects foreign key constraint failures.
func d1ForeignKey(output string) *Fix {
	if !strings.Contains(output, "FOREIGN KEY constraint failed") {
		return nil
	}
	return &Fix{
		Pattern: "d1-foreign-key",
		Action:  "echo 'Foreign key constraint failed — check migration order and seed data'",
	}
}

func sanitize(s string) string {
	s = strings.ReplaceAll(s, "'", "")
	s = strings.ReplaceAll(s, "\n", " ")
	if len(s) > 100 {
		s = s[:100]
	}
	return s
}

// d1Strategies returns all D1/SQLite heal strategies.
func d1Strategies() []strategy {
	return []strategy{
		d1TableExists,
		d1ColumnMissing,
		d1SQLiteGeneric,
		d1ForeignKey,
	}
}
