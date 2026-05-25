package storage

import (
	"errors"
	"testing"
)

func TestDialectPlaceholdersSQLitePassthrough(t *testing.T) {
	db := &DB{driver: EngineSQLite}
	if got := db.dialectPlaceholders("SELECT ? FROM t WHERE x=?"); got != "SELECT ? FROM t WHERE x=?" {
		t.Fatalf("sqlite passthrough: %q", got)
	}
}

func TestDialectPlaceholdersPostgresRewrite(t *testing.T) {
	db := &DB{driver: EnginePostgres}
	got := db.dialectPlaceholders("SELECT ? FROM t WHERE a=? AND b=?")
	want := "SELECT $1 FROM t WHERE a=$2 AND b=$3"
	if got != want {
		t.Fatalf("postgres rewrite: %q want %q", got, want)
	}
}

func TestDialectPlaceholdersNoQuestionMarks(t *testing.T) {
	db := &DB{driver: EnginePostgres}
	in := "SELECT 1 FROM t"
	if got := db.dialectPlaceholders(in); got != in {
		t.Fatalf("no-? rewrite: %q", got)
	}
}

func TestCanonicalEmail(t *testing.T) {
	if got := canonicalEmail("  Foo@Bar.COM  "); got != "foo@bar.com" {
		t.Fatalf("canonical: %q", got)
	}
}

func TestIsUniqueViolationKnownStrings(t *testing.T) {
	if isUniqueViolation(nil) {
		t.Fatal("nil should be false")
	}
	cases := []string{
		"UNIQUE constraint failed: users.email",
		"duplicate key value violates unique constraint",
		"pq: duplicate key value violates unique constraint",
	}
	for _, c := range cases {
		if !isUniqueViolation(errors.New(c)) {
			t.Fatalf("expected unique violation: %s", c)
		}
	}
	if isUniqueViolation(errors.New("some other error")) {
		t.Fatal("non-unique error should be false")
	}
}
