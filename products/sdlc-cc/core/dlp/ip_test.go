package dlp

import (
	"strings"
	"testing"
)

func TestMaskIP_IPv4(t *testing.T) {
	in := "Source 203.0.113.42 hit the API; gateway 10.0.0.1 forwarded."
	out := MaskIP(in)
	if strings.Contains(out, "203.0.113.42") || strings.Contains(out, "10.0.0.1") {
		t.Errorf("IP leaked: %s", out)
	}
	if strings.Count(out, "[IPv4]") != 2 {
		t.Errorf("expected 2 [IPv4] placeholders, got: %s", out)
	}
}

func TestMaskIP_IPv6(t *testing.T) {
	in := "Inbound from 2001:db8::abcd at 12:00"
	out := MaskIP(in)
	if strings.Contains(out, "2001:db8::abcd") {
		t.Errorf("IPv6 leaked: %s", out)
	}
	if !strings.Contains(out, "[IPv6]") {
		t.Errorf("expected IPv6 placeholder, got: %s", out)
	}
}

func TestMaskIP_BogusNumeric(t *testing.T) {
	in := "Nothing here: 999.999.999.999 not an IP"
	out := MaskIP(in)
	// 999.999.999.999 fails net.ParseIP, so it stays.
	if !strings.Contains(out, "999.999.999.999") {
		t.Errorf("unparseable IP-shaped string was modified: %s", out)
	}
}

func TestCountIPs(t *testing.T) {
	in := "203.0.113.5 and 2001:db8::42 and 10.0.0.7"
	if n := countIPs(in); n != 3 {
		t.Errorf("expected 3 IPs, got %d", n)
	}
}
