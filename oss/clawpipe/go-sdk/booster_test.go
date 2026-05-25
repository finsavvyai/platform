package clawpipe

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
)

func TestBoosterRuleCount(t *testing.T) {
	b := NewBooster()
	if b.RuleCount() != 6 {
		t.Fatalf("expected 6 rules, got %d", b.RuleCount())
	}
}

func TestBoosterNoMatch(t *testing.T) {
	b := NewBooster()
	_, ok := b.TryResolve("Tell me a joke")
	if ok {
		t.Fatal("expected no match")
	}
}

func TestBoosterJSONFormat(t *testing.T) {
	b := NewBooster()
	res, ok := b.TryResolve(`Format this JSON {"a":1,"b":2}`)
	if !ok {
		t.Fatal("expected match")
	}
	var v map[string]interface{}
	if err := json.Unmarshal([]byte(res), &v); err != nil {
		t.Fatal(err)
	}
	if v["a"] != float64(1) || v["b"] != float64(2) {
		t.Fatalf("unexpected: %s", res)
	}
	if !strings.Contains(res, "\n") {
		t.Fatal("expected pretty-printed")
	}
}

func TestBoosterPrettyPrint(t *testing.T) {
	b := NewBooster()
	res, ok := b.TryResolve(`Pretty print {"x":true}`)
	if !ok || !strings.Contains(res, "\n") {
		t.Fatalf("expected pretty-printed, got %q ok=%v", res, ok)
	}
}

func TestBoosterJSONNoMatch(t *testing.T) {
	b := NewBooster()
	_, ok := b.TryResolve("Format this JSON without braces")
	if ok {
		t.Fatal("should not match without {")
	}
}

func TestBoosterMathSimple(t *testing.T) {
	b := NewBooster()
	res, ok := b.TryResolve("Calculate 42 * 2")
	if !ok || res != "84" {
		t.Fatalf("expected 84, got %q ok=%v", res, ok)
	}
}

func TestBoosterMathAddition(t *testing.T) {
	b := NewBooster()
	res, ok := b.TryResolve("compute 10 + 20")
	if !ok || res != "30" {
		t.Fatalf("expected 30, got %q", res)
	}
}

func TestBoosterMathComplex(t *testing.T) {
	b := NewBooster()
	res, ok := b.TryResolve("what is (3 + 4) * 2")
	if !ok || res != "14" {
		t.Fatalf("expected 14, got %q", res)
	}
}

func TestBoosterMathDivision(t *testing.T) {
	b := NewBooster()
	res, ok := b.TryResolve("evaluate 100 / 4")
	if !ok || res != "25" {
		t.Fatalf("expected 25, got %q", res)
	}
}

func TestBoosterMathPower(t *testing.T) {
	b := NewBooster()
	res, ok := b.TryResolve("solve 2^10")
	if !ok || res != "1024" {
		t.Fatalf("expected 1024, got %q", res)
	}
}

func TestBoosterMathNoMatch(t *testing.T) {
	b := NewBooster()
	_, ok := b.TryResolve("Calculate the meaning of life")
	if ok {
		t.Fatal("should not match non-expression")
	}
}

func TestBoosterDateToday(t *testing.T) {
	b := NewBooster()
	res, ok := b.TryResolve("What is the current date")
	if !ok || len(res) < 10 {
		t.Fatalf("expected ISO date, got %q", res)
	}
}

func TestBoosterDateNow(t *testing.T) {
	b := NewBooster()
	res, ok := b.TryResolve("today")
	if !ok || !strings.Contains(res, "T") {
		t.Fatalf("expected RFC3339, got %q", res)
	}
}

func TestBoosterDateTooLong(t *testing.T) {
	b := NewBooster()
	_, ok := b.TryResolve("What is the date when the first moon landing happened in history")
	if ok {
		t.Fatal("should not match long input")
	}
}

func TestBoosterConvertKmMiles(t *testing.T) {
	b := NewBooster()
	res, ok := b.TryResolve("Convert 10 km to miles")
	if !ok || !strings.Contains(res, "6.2137") {
		t.Fatalf("expected ~6.2137, got %q", res)
	}
}

func TestBoosterConvertCelsiusFahrenheit(t *testing.T) {
	b := NewBooster()
	res, ok := b.TryResolve("convert 100 c to f")
	if !ok || !strings.Contains(res, "212") {
		t.Fatalf("expected 212, got %q", res)
	}
}

func TestBoosterConvertUnknown(t *testing.T) {
	b := NewBooster()
	_, ok := b.TryResolve("convert 5 widgets to gadgets")
	if ok {
		t.Fatal("should fail for unknown units")
	}
}

func TestBoosterUUID(t *testing.T) {
	b := NewBooster()
	res, ok := b.TryResolve("Generate a UUID")
	if !ok || len(res) < 32 {
		t.Fatalf("expected UUID, got %q", res)
	}
	if strings.Count(res, "-") != 4 {
		t.Fatalf("UUID format wrong: %q", res)
	}
}

func TestBoosterUUIDUnique(t *testing.T) {
	b := NewBooster()
	r1, _ := b.TryResolve("generate uuid")
	r2, _ := b.TryResolve("generate uuid")
	if r1 == r2 {
		t.Fatal("UUIDs should be unique")
	}
}

func TestBoosterBase64Encode(t *testing.T) {
	b := NewBooster()
	res, ok := b.TryResolve("base64 encode hello world")
	if !ok {
		t.Fatal("expected match")
	}
	expected := base64.StdEncoding.EncodeToString([]byte("hello world"))
	if res != expected {
		t.Fatalf("expected %q, got %q", expected, res)
	}
}

func TestBoosterBase64Decode(t *testing.T) {
	b := NewBooster()
	encoded := base64.StdEncoding.EncodeToString([]byte("test data"))
	res, ok := b.TryResolve("base64 decode " + encoded)
	if !ok || res != "test data" {
		t.Fatalf("expected 'test data', got %q ok=%v", res, ok)
	}
}
