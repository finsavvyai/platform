// Package middleware provides DLP scanning middleware that gates
// inbound prompts (Day 34) and outbound responses (Day 35).
//
// Per-tenant policy: detect → mask | redact | block. Action audited.
package middleware

import (
	"errors"
	"regexp"
	"sort"
	"strings"
)

// Action is the DLP policy outcome for a detection.
type Action string

const (
	ActionAllow    Action = "allow"
	ActionMask     Action = "mask"
	ActionRedact   Action = "redact"
	ActionBlock    Action = "block"
	ActionTokenize Action = "tokenize"
)

// Detector scans text for PII categories.
type Detector struct{}

// NewDetector returns a Detector with the default pattern set.
func NewDetector() *Detector { return &Detector{} }

// Match is one PII finding.
type Match struct {
	Type  string // ssn | credit_card | email | itin | mrn
	Start int
	End   int
	Value string
}

// Detect returns every PII match in input. Patterns are conservative
// — designed for fewer false positives, not for maximal recall. The
// real engine wires Microsoft Presidio in production; this stub
// covers the common categories so the middleware contract is
// testable.
//
// Categories: ssn, credit_card (Luhn-validated), itin, mrn,
// account_number (generic 11+ digits), email, plus the Claude Team
// B1 code-secret pack.
func (d *Detector) Detect(input string) []Match {
	return d.DetectWith(input, nil)
}

// DetectWith runs the built-in pattern set plus any extra patterns
// the caller supplied. Used by Claude Team B4 — tenant-defined
// custom packs — so per-tenant identifiers (employee IDs, project
// codenames, customer numbers) get the same redact/tokenize/block
// treatment as built-in classes without forking the detector.
func (d *Detector) DetectWith(input string, extra []pattern) []Match {
	var out []Match
	for _, p := range patterns {
		for _, idx := range p.re.FindAllStringIndex(input, -1) {
			val := input[idx[0]:idx[1]]
			if p.name == "credit_card" && !luhnValid(val) {
				continue
			}
			out = append(out, Match{
				Type:  p.name,
				Start: idx[0],
				End:   idx[1],
				Value: val,
			})
		}
	}
	for _, p := range extra {
		for _, idx := range p.re.FindAllStringIndex(input, -1) {
			out = append(out, Match{
				Type:  p.name,
				Start: idx[0],
				End:   idx[1],
				Value: input[idx[0]:idx[1]],
			})
		}
	}
	return out
}

// CompileCustomPatterns turns a tenant's name/regex pairs into
// detector-ready patterns. Invalid regexes are skipped silently so
// one bad rule cannot wedge the whole DLP pipeline; the caller can
// surface compile errors via the admin API for validation.
//
// Pattern names are uppercased for the redact label, so a rule
// named "employee_id" produces `<EMPLOYEE_ID>` placeholders.
func CompileCustomPatterns(specs []CustomPatternSpec) []pattern {
	out := make([]pattern, 0, len(specs))
	for _, s := range specs {
		re, err := regexp.Compile(s.Regex)
		if err != nil {
			continue
		}
		out = append(out, pattern{name: s.Name, re: re})
	}
	return out
}

// CustomPatternSpec is the shape PolicyLookup returns for tenant-
// defined patterns. Stored in `tenant_dlp_policy.custom_patterns`
// as JSONB.
type CustomPatternSpec struct {
	Name  string `json:"name"`
	Regex string `json:"regex"`
}

// luhnValid runs the Luhn checksum on digits in s (ignoring spaces +
// dashes). Used to suppress credit-card false positives — every 16-
// digit run in a doc is not a card number.
func luhnValid(s string) bool {
	var digits []int
	for _, r := range s {
		if r >= '0' && r <= '9' {
			digits = append(digits, int(r-'0'))
		}
	}
	if len(digits) < 13 || len(digits) > 19 {
		return false
	}
	sum := 0
	parity := len(digits) % 2
	for i, d := range digits {
		if i%2 == parity {
			d *= 2
			if d > 9 {
				d -= 9
			}
		}
		sum += d
	}
	return sum%10 == 0
}

// Apply rewrites input per the configured action. Block returns
// ErrBlocked + an empty string. Tokenize returns the rewritten
// string + matches and the caller can build the reverse map via
// BuildTokenMap; for round-trip use callers should prefer
// Tokenize() which returns the map directly.
func (d *Detector) Apply(input string, action Action) (string, []Match, error) {
	return d.ApplyWith(input, action, nil)
}

// ApplyWith is the per-tenant variant: extra is the compiled custom
// pattern pack from PolicyLookup.CustomPatterns. Same semantics as
// Apply otherwise. Claude Team B4.
func (d *Detector) ApplyWith(input string, action Action, extra []pattern) (string, []Match, error) {
	matches := d.DetectWith(input, extra)
	if len(matches) == 0 {
		return input, nil, nil
	}
	switch action {
	case ActionAllow:
		return input, matches, nil
	case ActionBlock:
		return "", matches, ErrBlocked
	case ActionMask:
		return rewrite(input, matches, mask), matches, nil
	case ActionRedact:
		return rewrite(input, matches, redact), matches, nil
	case ActionTokenize:
		out, _, _ := d.tokenizeWith(input, extra)
		return out, matches, nil
	}
	return input, matches, nil
}

// tokenizeWith is Tokenize but uses extra patterns too. Exposed
// privately because the middleware is the only caller and a public
// API would imply a stable contract for the per-request map shape.
func (d *Detector) tokenizeWith(input string, extra []pattern) (string, TokenMap, []Match) {
	matches := d.DetectWith(input, extra)
	if len(matches) == 0 {
		return input, nil, nil
	}
	tokenMap := make(TokenMap)
	valueToToken := make(map[string]string)
	counts := make(map[string]int)
	rewritten := rewrite(input, matches, func(m Match) string {
		if existing, ok := valueToToken[m.Type+"|"+m.Value]; ok {
			return existing
		}
		counts[m.Type]++
		token := tokenString(m.Type, counts[m.Type])
		valueToToken[m.Type+"|"+m.Value] = token
		tokenMap[token] = m.Value
		return token
	})
	return rewritten, tokenMap, matches
}

// TokenMap holds the reverse lookup table for one request: each
// `<TYPE_NNN>` placeholder maps back to the original value the
// inbound middleware replaced. Outbound walks this map to restore
// the original text in responses so Claude's answer reads naturally
// instead of containing `<EMAIL_001>`-style placeholders.
type TokenMap map[string]string

// Tokenize replaces each PII match with a deterministic
// `<TYPE_NNN>` placeholder (NNN is 1-indexed per type) and returns
// (rewritten text, reverse map, matches). The reverse map is
// safe to attach to the request context — values never leave the
// gateway process.
//
// Same-value duplicates collapse to the same placeholder so the
// LLM sees consistent identifiers (e.g. two occurrences of
// "alice@example.com" both become `<EMAIL_001>`).
func (d *Detector) Tokenize(input string) (string, TokenMap, []Match) {
	matches := d.Detect(input)
	if len(matches) == 0 {
		return input, nil, nil
	}
	tokenMap := make(TokenMap)
	valueToToken := make(map[string]string) // collapse duplicates
	counts := make(map[string]int)
	rewritten := rewrite(input, matches, func(m Match) string {
		if existing, ok := valueToToken[m.Type+"|"+m.Value]; ok {
			return existing
		}
		counts[m.Type]++
		token := tokenString(m.Type, counts[m.Type])
		valueToToken[m.Type+"|"+m.Value] = token
		tokenMap[token] = m.Value
		return token
	})
	return rewritten, tokenMap, matches
}

// Detokenize reverses a prior Tokenize call: every placeholder in
// the input is replaced by the original value from the map. Tokens
// not present in the map are left in place (best-effort behavior so
// a partially corrupt map cannot wedge the response).
func Detokenize(input string, m TokenMap) string {
	if len(m) == 0 {
		return input
	}
	out := input
	for token, original := range m {
		out = replaceAllString(out, token, original)
	}
	return out
}

// tokenString formats `<TYPE_NNN>` deterministically: 3-digit zero-
// padded counter so ordering is stable when callers inspect the
// audit trail.
func tokenString(piiType string, counter int) string {
	return "<" + upper(piiType) + "_" + pad3(counter) + ">"
}

func upper(s string) string {
	out := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'a' && c <= 'z' {
			c -= 32
		}
		out[i] = c
	}
	return string(out)
}

func pad3(n int) string {
	if n >= 100 {
		return itoa(n)
	}
	if n >= 10 {
		return "0" + itoa(n)
	}
	return "00" + itoa(n)
}

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

// replaceAllString delegates to strings.ReplaceAll. Wrapped here
// only so Detokenize reads symmetrically with the other helpers.
func replaceAllString(s, old, new string) string {
	return strings.ReplaceAll(s, old, new)
}

// ErrBlocked signals the input must be rejected by the caller.
var ErrBlocked = errors.New("dlp: PII detected and policy is block")

func mask(m Match) string {
	if len(m.Value) <= 4 {
		return strings.Repeat("*", len(m.Value))
	}
	return strings.Repeat("*", len(m.Value)-4) + m.Value[len(m.Value)-4:]
}

// redact emits `<UPPER_TYPE>` so the surrounding code/JSON/YAML
// stays parseable. The historical `[REDACTED:type]` form had two
// problems for Claude Team customers: (1) square brackets aren't
// valid in shell scripts, and (2) the lowercase `type` exposed the
// internal class name in user-visible output. Examples after the
// change:
//
//	"email": "<EMAIL>"          (JSON value)
//	api_key = "<ANTHROPIC_KEY>" (Python assignment)
//	AKIA = <AWS_ACCESS_KEY>     (YAML, unquoted)
//
// Surrounding context (variable names, quotes, indentation) was
// already preserved by rewrite() — only the matched value gets
// substituted — but the new label syntax makes the result a valid
// example placeholder rather than an obviously-broken artefact.
func redact(m Match) string {
	return "<" + upper(m.Type) + ">"
}

func rewrite(input string, matches []Match, fn func(Match) string) string {
	// Sort by Start so we can walk left-to-right. Detect() returns
	// matches in pattern-declaration order so a multi-pattern doc
	// (e.g. email + SSN) arrives unordered. Without this sort the
	// rewrite drops every match that appears earlier in the input
	// than the previously-emitted match — silently swallowing data.
	if len(matches) > 1 {
		sorted := make([]Match, len(matches))
		copy(sorted, matches)
		sort.Slice(sorted, func(i, j int) bool {
			return sorted[i].Start < sorted[j].Start
		})
		matches = sorted
	}
	var b strings.Builder
	prev := 0
	for _, m := range matches {
		if m.Start < prev {
			continue // overlapping match, already handled
		}
		b.WriteString(input[prev:m.Start])
		b.WriteString(fn(m))
		prev = m.End
	}
	b.WriteString(input[prev:])
	return b.String()
}

type pattern struct {
	name string
	re   *regexp.Regexp
}

var patterns = []pattern{
	{"ssn", regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`)},
	// ITIN: starts with 9, second group 70-88 or 90-99 per IRS spec.
	{"itin", regexp.MustCompile(`\b9\d{2}-[78]\d-\d{4}\b`)},
	// MRN: configurable in production; this default matches the common
	// 6-10 digit alphanumeric form prefixed by "MRN" or "MR#".
	{"mrn", regexp.MustCompile(`\b(?:MRN|MR#)\s*[:#]?\s*[A-Z0-9]{6,10}\b`)},
	// Credit card — Luhn-validated downstream so this regex can stay
	// generous (13–19 digits with optional spaces/dashes).
	{"credit_card", regexp.MustCompile(`\b(?:\d[ -]?){12,18}\d\b`)},

	// === Code-secret pack (Claude Team B1, 2026-05-01) ===========
	// These come BEFORE account_number / email because their formats
	// are more specific; first-match-wins semantics in rewrite().

	// Anthropic API key — must precede openai_key because both start
	// with "sk-".
	{"anthropic_key", regexp.MustCompile(`\bsk-ant-[A-Za-z0-9_-]{32,}\b`)},
	// OpenAI API key (project + legacy + admin formats).
	{"openai_key", regexp.MustCompile(`\bsk-(?:proj-|admin-)?[A-Za-z0-9_-]{20,}\b`)},
	// AWS access key id (AKIA, ASIA, AROA, etc.). Detection here is
	// sufficient because secrets without an access key are useless;
	// a standalone aws_secret_key pattern (40 base64 chars) would
	// false-positive on git commit hashes and similar.
	{"aws_access_key", regexp.MustCompile(`\b(?:AKIA|ASIA|AROA|AIDA|AGPA|ANPA|ANVA|ASCA)[A-Z0-9]{16}\b`)},
	// GitHub PATs and OAuth tokens. ghp_=PAT, gho_=OAuth, ghs_=server,
	// ghr_=refresh, ghu_=user.
	{"github_token", regexp.MustCompile(`\bgh[pousr]_[A-Za-z0-9]{36,}\b`)},
	// Slack tokens. xoxb=bot, xoxp=user, xapp=app, xoxa=workspace,
	// xoxr=refresh.
	{"slack_token", regexp.MustCompile(`\bxox[baprs]-[A-Za-z0-9-]{10,}\b`)},
	// Stripe keys (live + test, secret + publishable + restricted).
	{"stripe_key", regexp.MustCompile(`\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b`)},
	// Generic JWT (three base64url segments separated by dots,
	// header decodes to JSON starting with {"alg").
	{"jwt", regexp.MustCompile(`\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b`)},
	// SSH / TLS / GPG private-key armor. Match the BEGIN line; the
	// surrounding rewrite redacts the whole match.
	{"private_key_block", regexp.MustCompile(`-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY-----`)},
	// DB connection strings with embedded credentials.
	{"db_connection_string", regexp.MustCompile(`\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp)://[^:\s]+:[^@\s]+@[^\s/]+`)},
	// Google Cloud service account JSON tell — the unique "type":
	// "service_account" string is the durable signal.
	{"gcp_service_account", regexp.MustCompile(`"type":\s*"service_account"`)},

	// === End code-secret pack ===================================

	// Generic 11+ digit account-number-looking runs. Comes AFTER
	// credit_card so the more specific pattern wins.
	{"account_number", regexp.MustCompile(`\b\d{11,19}\b`)},
	{"email", regexp.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b`)},
}
