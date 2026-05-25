package types

import (
	"errors"
	"strings"
	"testing"
)

func TestSafeIdentifier_Valid(t *testing.T) {
	cases := []string{
		"users",
		"Users",
		"user_table",
		"_private",
		"t1",
		"abc_123",
		"A",
		strings.Repeat("a", 63),
	}
	for _, in := range cases {
		got, err := SafeIdentifier(in)
		if err != nil {
			t.Errorf("SafeIdentifier(%q) unexpected err: %v", in, err)
			continue
		}
		if got != in {
			t.Errorf("SafeIdentifier(%q) = %q, want unchanged", in, got)
		}
	}
}

func TestSafeIdentifier_RejectsInjectionPayloads(t *testing.T) {
	// Each payload is a real-world injection attempt that MUST be rejected
	// before being interpolated into PRAGMA / SHOW VARIABLES LIKE / CREATE.
	payloads := []string{
		"",                                   // empty
		" ",                                  // whitespace
		" users",                             // leading space
		"users ",                             // trailing space
		"users;",                             // statement terminator
		"users; DROP TABLE x",                // multi-statement
		"users); DETACH DATABASE main; --",   // PRAGMA escape
		"users--",                            // SQL comment
		"users/*x*/",                         // block comment
		"users'",                             // single quote
		"'users'",                            // quoted
		"\"users\"",                          // double-quoted
		"`users`",                            // backtick-quoted
		"users\\",                            // backslash
		"users\x00",                          // NUL byte
		"users\n",                            // newline
		"1users",                             // leading digit
		"my.table",                           // dotted
		"my-table",                           // hyphen
		"user table",                         // space
		"users%",                             // LIKE wildcard
		"users_%",                            // underscore wildcard escape attempt
		"' UNION SELECT user,password FROM mysql.user --", // classic UNION
		strings.Repeat("a", 64),              // over 63-char cap
	}
	for _, p := range payloads {
		got, err := SafeIdentifier(p)
		if err == nil {
			t.Errorf("SafeIdentifier(%q) = %q, want rejection", p, got)
			continue
		}
		if !errors.Is(err, ErrInvalidParam) {
			t.Errorf("SafeIdentifier(%q) err %v, want errors.Is(ErrInvalidParam)", p, err)
		}
	}
}
