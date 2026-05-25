package query

import (
	"strings"
	"unicode"
)

// stripTrailingSemicolon trims one trailing `;` plus any trailing
// whitespace so the multi-statement scanner does not flag the normal
// terminator. We only strip a single `;` — `SELECT 1;;` is still a
// stacked statement and must be rejected.
func stripTrailingSemicolon(sql string) string {
	s := strings.TrimRightFunc(sql, unicode.IsSpace)
	if strings.HasSuffix(s, ";") {
		s = strings.TrimSuffix(s, ";")
	}
	return s
}

// countUnquotedSemicolons walks sql and counts `;` runes that sit
// outside single quotes, double quotes and line/block comments. The
// scanner is intentionally minimal — it is a defence-in-depth gate,
// not a full SQL parser. Parameterised queries via the driver remain
// the primary injection defence.
func countUnquotedSemicolons(sql string) int {
	st := newScanState()
	runes := []rune(sql)
	count := 0
	for i := 0; i < len(runes); i++ {
		next := byte(0)
		if i+1 < len(runes) {
			next = byte(runes[i+1])
		}
		consumed, hit := st.step(runes[i], next, runes, i, ';')
		if hit {
			count++
		}
		i += consumed
	}
	return count
}

// countPlaceholders walks sql and counts `?` plus `$N` tokens that
// sit outside quotes/comments. `$$` quoted strings (Postgres tags)
// are treated as opaque and ignored. Named placeholders (`:name`)
// are out of scope for Phase 1.
func countPlaceholders(sql string) int {
	st := newScanState()
	runes := []rune(sql)
	count := 0
	for i := 0; i < len(runes); i++ {
		next := byte(0)
		if i+1 < len(runes) {
			next = byte(runes[i+1])
		}
		consumed, hit := st.stepPlaceholder(runes[i], next, runes, i)
		if hit {
			count++
		}
		i += consumed
	}
	return count
}

// scanState tracks the parser's position in literals/comments while
// walking the SQL string. Shared by both semicolon and placeholder
// scanners to keep one source of truth for tokenisation rules.
type scanState struct {
	inSingle bool
	inDouble bool
	inLine   bool
	inBlock  bool
}

func newScanState() *scanState { return &scanState{} }

// step advances the scanner by one rune. Returns (extraConsumed, hit)
// where extraConsumed is the number of additional runes the caller
// should skip (used for two-char tokens like `--` and `/*`) and hit
// is true when the supplied target rune was matched outside a string
// or comment.
func (s *scanState) step(c rune, next byte, _ []rune, _ int, target rune) (int, bool) {
	switch {
	case s.inLine:
		if c == '\n' {
			s.inLine = false
		}
	case s.inBlock:
		if c == '*' && next == '/' {
			s.inBlock = false
			return 1, false
		}
	case s.inSingle:
		if c == '\'' {
			s.inSingle = false
		}
	case s.inDouble:
		if c == '"' {
			s.inDouble = false
		}
	case c == '\'':
		s.inSingle = true
	case c == '"':
		s.inDouble = true
	case c == '-' && next == '-':
		s.inLine = true
		return 1, false
	case c == '/' && next == '*':
		s.inBlock = true
		return 1, false
	case c == target:
		return 0, true
	}
	return 0, false
}

// stepPlaceholder runs the same scan but treats `?` and `$N` as the
// hit set. Returns the extra runes consumed (digit run for `$N`).
func (s *scanState) stepPlaceholder(c rune, next byte, runes []rune, i int) (int, bool) {
	if s.inLine || s.inBlock || s.inSingle || s.inDouble {
		consumed, _ := s.step(c, next, runes, i, ' ')
		return consumed, false
	}
	switch {
	case c == '\'':
		s.inSingle = true
	case c == '"':
		s.inDouble = true
	case c == '-' && next == '-':
		s.inLine = true
		return 1, false
	case c == '/' && next == '*':
		s.inBlock = true
		return 1, false
	case c == '?':
		return 0, true
	case c == '$' && i+1 < len(runes) && unicode.IsDigit(runes[i+1]):
		extra := 0
		for i+1+extra < len(runes) && unicode.IsDigit(runes[i+1+extra]) {
			extra++
		}
		return extra, true
	}
	return 0, false
}
