package clawpipe

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// boosterRule is a deterministic transform that can skip the LLM.
type boosterRule struct {
	name    string
	test    func(string) bool
	resolve func(string) (string, error)
}

// Booster resolves prompts locally when possible.
type Booster struct{ rules []boosterRule }

// NewBooster creates a Booster with the six default rules.
func NewBooster() *Booster {
	b := &Booster{}
	b.rules = []boosterRule{
		b.jsonFormatRule(),
		b.mathRule(),
		b.dateRule(),
		b.unitConversionRule(),
		b.uuidRule(),
		b.base64Rule(),
	}
	return b
}

// TryResolve returns (answer, true) if a rule matched, else ("", false).
func (b *Booster) TryResolve(input string) (string, bool) {
	trimmed := strings.TrimSpace(input)
	for _, r := range b.rules {
		if r.test(trimmed) {
			if res, err := r.resolve(trimmed); err == nil {
				return res, true
			}
		}
	}
	return "", false
}

// RuleCount returns the number of registered rules.
func (b *Booster) RuleCount() int { return len(b.rules) }

// --- rules -----------------------------------------------------------

func (b *Booster) jsonFormatRule() boosterRule {
	return boosterRule{
		name: "json-format",
		test: func(s string) bool {
			l := strings.ToLower(s)
			return (strings.HasPrefix(l, "format this json") ||
				strings.HasPrefix(l, "pretty print")) && strings.Contains(s, "{")
		},
		resolve: func(s string) (string, error) {
			idx := strings.Index(s, "{")
			var v interface{}
			if err := json.Unmarshal([]byte(s[idx:]), &v); err != nil {
				return "", err
			}
			out, err := json.MarshalIndent(v, "", "  ")
			return string(out), err
		},
	}
}

var mathCmd = regexp.MustCompile(`(?i)^(?:calculate|compute|what is|evaluate|solve)\s+(.+)`)
var safeExpr = regexp.MustCompile(`^[\d\s+\-*/().,%^]+$`)

func (b *Booster) mathRule() boosterRule {
	return boosterRule{
		name: "math",
		test: func(s string) bool {
			m := mathCmd.FindStringSubmatch(s)
			return m != nil && safeExpr.MatchString(strings.TrimSpace(m[1]))
		},
		resolve: func(s string) (string, error) {
			m := mathCmd.FindStringSubmatch(s)
			expr := strings.ReplaceAll(strings.TrimSpace(m[1]), "^", "**")
			v, err := safeEvalMath(expr)
			if err != nil {
				return "", err
			}
			return formatNumber(v), nil
		},
	}
}

var datePats = []*regexp.Regexp{
	regexp.MustCompile(`(?i)what(?:'s| is) (?:the )?(?:current )?(?:date|time|day)`),
	regexp.MustCompile(`(?i)(?:today|now|current date)`),
}

func (b *Booster) dateRule() boosterRule {
	return boosterRule{
		name: "date",
		test: func(s string) bool {
			if len(s) >= 60 {
				return false
			}
			for _, p := range datePats {
				if p.MatchString(s) {
					return true
				}
			}
			return false
		},
		resolve: func(string) (string, error) {
			return time.Now().UTC().Format(time.RFC3339), nil
		},
	}
}

var unitPat = regexp.MustCompile(`(?i)convert\s+([\d.]+)\s+(\w+)\s+to\s+(\w+)`)

type convFn func(float64) float64

func mul(f float64) convFn { return func(v float64) float64 { return v * f } }

var conversions = map[string]map[string]convFn{
	"km":    {"miles": mul(0.621371), "m": mul(1000), "ft": mul(3280.84)},
	"miles": {"km": mul(1.60934), "m": mul(1609.34), "ft": mul(5280)},
	"kg":    {"lbs": mul(2.20462), "g": mul(1000), "oz": mul(35.274)},
	"lbs":   {"kg": mul(0.453592), "g": mul(453.592), "oz": mul(16)},
	"c": {
		"f": func(v float64) float64 { return v*9/5 + 32 },
		"k": func(v float64) float64 { return v + 273.15 },
	},
	"f": {
		"c": func(v float64) float64 { return (v - 32) * 5 / 9 },
		"k": func(v float64) float64 { return (v-32)*5/9 + 273.15 },
	},
}

func (b *Booster) unitConversionRule() boosterRule {
	return boosterRule{
		name: "unit-conversion",
		test: func(s string) bool { return unitPat.MatchString(s) },
		resolve: func(s string) (string, error) {
			m := unitPat.FindStringSubmatch(s)
			val, _ := strconv.ParseFloat(m[1], 64)
			from, to := strings.ToLower(m[2]), strings.ToLower(m[3])
			fn, ok := conversions[from][to]
			if !ok {
				return "", fmt.Errorf("unknown conversion %s->%s", from, to)
			}
			res := fn(val)
			rounded := math.Round(res*10000) / 10000
			return fmt.Sprintf("%v %s = %v %s", val, from, rounded, to), nil
		},
	}
}

var uuidPat = regexp.MustCompile(`(?i)generate\s+(?:a\s+)?uuid`)

func (b *Booster) uuidRule() boosterRule {
	return boosterRule{
		name: "uuid",
		test: func(s string) bool { return uuidPat.MatchString(s) },
		resolve: func(string) (string, error) { return generateUUID(), nil },
	}
}

var b64Enc = regexp.MustCompile(`(?i)base64\s+encode\s+(.+)`)
var b64Dec = regexp.MustCompile(`(?i)base64\s+decode\s+(.+)`)

func (b *Booster) base64Rule() boosterRule {
	return boosterRule{
		name: "base64",
		test: func(s string) bool { return b64Enc.MatchString(s) || b64Dec.MatchString(s) },
		resolve: func(s string) (string, error) {
			if m := b64Enc.FindStringSubmatch(s); m != nil {
				return base64.StdEncoding.EncodeToString(
					[]byte(strings.TrimSpace(m[1]))), nil
			}
			if m := b64Dec.FindStringSubmatch(s); m != nil {
				d, err := base64.StdEncoding.DecodeString(strings.TrimSpace(m[1]))
				return string(d), err
			}
			return "", fmt.Errorf("no match")
		},
	}
}
