package clawpipe

import (
	"crypto/rand"
	"fmt"
	"math"
	"strconv"
	"strings"
)

// safeEvalMath is a recursive-descent parser for arithmetic expressions.
// Supports +, -, *, /, %, ** and parentheses. No eval().
func safeEvalMath(expr string) (float64, error) {
	p := &parser{src: expr}
	v, err := p.parseExpr()
	if err != nil {
		return 0, err
	}
	p.skip()
	if p.pos < len(p.src) {
		return 0, fmt.Errorf("unexpected char at %d", p.pos)
	}
	return v, nil
}

type parser struct {
	src string
	pos int
}

func (p *parser) ch() byte {
	if p.pos >= len(p.src) {
		return 0
	}
	return p.src[p.pos]
}

func (p *parser) skip() {
	for p.pos < len(p.src) && p.src[p.pos] == ' ' {
		p.pos++
	}
}

func (p *parser) parseNumber() (float64, error) {
	p.skip()
	start := p.pos
	if p.ch() == '-' {
		p.pos++
	}
	for p.pos < len(p.src) && (p.src[p.pos] >= '0' && p.src[p.pos] <= '9' || p.src[p.pos] == '.') {
		p.pos++
	}
	s := p.src[start:p.pos]
	if s == "" || s == "-" {
		return 0, fmt.Errorf("expected number at %d", start)
	}
	return strconv.ParseFloat(s, 64)
}

func (p *parser) parseFactor() (float64, error) {
	p.skip()
	if p.ch() == '(' {
		p.pos++
		v, err := p.parseExpr()
		if err != nil {
			return 0, err
		}
		p.skip()
		if p.ch() == ')' {
			p.pos++
		}
		return v, nil
	}
	return p.parseNumber()
}

func (p *parser) parsePower() (float64, error) {
	base, err := p.parseFactor()
	if err != nil {
		return 0, err
	}
	p.skip()
	if p.pos+1 < len(p.src) && p.src[p.pos:p.pos+2] == "**" {
		p.pos += 2
		exp, err := p.parsePower()
		if err != nil {
			return 0, err
		}
		return math.Pow(base, exp), nil
	}
	return base, nil
}

func (p *parser) parseTerm() (float64, error) {
	val, err := p.parsePower()
	if err != nil {
		return 0, err
	}
	for {
		p.skip()
		op := p.ch()
		if op != '*' && op != '/' && op != '%' {
			break
		}
		p.pos++
		if op == '*' && p.ch() == '*' {
			p.pos--
			break
		}
		right, err := p.parsePower()
		if err != nil {
			return 0, err
		}
		switch op {
		case '*':
			val *= right
		case '/':
			val /= right
		case '%':
			val = math.Mod(val, right)
		}
	}
	return val, nil
}

func (p *parser) parseExpr() (float64, error) {
	val, err := p.parseTerm()
	if err != nil {
		return 0, err
	}
	for {
		p.skip()
		op := p.ch()
		if op != '+' && op != '-' {
			break
		}
		p.pos++
		right, err := p.parseTerm()
		if err != nil {
			return 0, err
		}
		if op == '+' {
			val += right
		} else {
			val -= right
		}
	}
	return val, nil
}

// formatNumber formats a float nicely (no trailing zeros).
func formatNumber(v float64) string {
	if v == math.Trunc(v) && math.Abs(v) < 1e15 {
		return strconv.FormatInt(int64(v), 10)
	}
	return strconv.FormatFloat(v, 'f', -1, 64)
}

// generateUUID produces a v4 UUID using crypto/rand.
func generateUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// hashDJB2 is the djb2 string hash matching the TS SDK.
func hashDJB2(s string) string {
	var h uint32 = 5381
	for i := 0; i < len(s); i++ {
		h = (h << 5) + h + uint32(s[i])
	}
	return "cp_" + strings.ToLower(strconv.FormatUint(uint64(h), 36))
}
