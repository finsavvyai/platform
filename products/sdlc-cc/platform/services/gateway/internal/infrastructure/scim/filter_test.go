package scim

import (
	"errors"
	"testing"
)

func TestParseFilter_Eq(t *testing.T) {
	op, err := ParseFilter(`userName eq "alice@example.com"`)
	if err != nil {
		t.Fatal(err)
	}
	if op.Attr != "userName" || op.Op != "eq" || op.Value != "alice@example.com" {
		t.Fatalf("got %+v", op)
	}
}

func TestParseFilter_Co(t *testing.T) {
	op, _ := ParseFilter(`displayName co "Smith"`)
	if op.Op != "co" || op.Value != "Smith" {
		t.Fatalf("co parse: %+v", op)
	}
}

func TestParseFilter_Sw_Ew(t *testing.T) {
	for _, op := range []string{"sw", "ew"} {
		got, err := ParseFilter(`emails ` + op + ` "@example.com"`)
		if err != nil || got.Op != op {
			t.Fatalf("%s: got %+v err %v", op, got, err)
		}
	}
}

func TestParseFilter_Pr(t *testing.T) {
	op, _ := ParseFilter(`title pr`)
	if op.Op != "pr" || op.Attr != "title" {
		t.Fatalf("pr: %+v", op)
	}
}

func TestParseFilter_RejectsCompound(t *testing.T) {
	_, err := ParseFilter(`userName eq "x" and active eq true`)
	if !errors.Is(err, ErrCompoundUnsupported) {
		t.Fatalf("compound must error: %v", err)
	}
}

func TestParseFilter_RejectsEmpty(t *testing.T) {
	_, err := ParseFilter("")
	if !errors.Is(err, ErrUnsupportedFilter) {
		t.Fatalf("empty must error: %v", err)
	}
}

func TestParseFilter_RejectsUnknownOp(t *testing.T) {
	_, err := ParseFilter(`userName xx "foo"`)
	if err == nil {
		t.Fatal("unknown op must error")
	}
}
