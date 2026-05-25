package tenant

import (
	"net/netip"
	"testing"
)

func TestNetworkMap_ResolveByIP_MostSpecific(t *testing.T) {
	rows := []Row{
		{CIDR: "10.0.0.0/8", TenantID: "tnt_corp"},
		{CIDR: "10.1.2.0/24", TenantID: "tnt_subsidiary"},
		{CIDR: "10.1.2.128/28", TenantID: "tnt_contractor"},
		{CIDR: "192.168.0.0/16", TenantID: "tnt_other"},
	}
	m := NewNetworkMap(rows)

	cases := []struct {
		ip   string
		want string
	}{
		{"10.0.0.5", "tnt_corp"},
		{"10.1.2.10", "tnt_subsidiary"},
		{"10.1.2.130", "tnt_contractor"},
		{"192.168.5.1", "tnt_other"},
		{"172.16.0.1", ""},
	}
	for _, tc := range cases {
		got := m.ResolveByIP(netip.MustParseAddr(tc.ip))
		if got != tc.want {
			t.Errorf("ResolveByIP(%s) = %q, want %q", tc.ip, got, tc.want)
		}
	}
}

func TestNetworkMap_BadCIDRDropped(t *testing.T) {
	m := NewNetworkMap([]Row{
		{CIDR: "not-a-cidr", TenantID: "tnt_x"},
		{CIDR: "10.0.0.0/8", TenantID: "tnt_y"},
	})
	if got := m.ResolveByIP(netip.MustParseAddr("10.0.0.1")); got != "tnt_y" {
		t.Errorf("good rule should still resolve, got %q", got)
	}
}

func TestParseRemoteAddr(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"10.0.0.1:5234", "10.0.0.1"},
		{"203.0.113.5:443", "203.0.113.5"},
		{"[2001:db8::1]:80", "2001:db8::1"},
		{"not-an-addr", ""},
	}
	for _, tc := range cases {
		got := ParseRemoteAddr(tc.in)
		if !got.IsValid() && tc.want == "" {
			continue
		}
		if got.String() != tc.want {
			t.Errorf("ParseRemoteAddr(%q) = %v, want %q", tc.in, got, tc.want)
		}
	}
}

func TestNetworkMap_IPv6(t *testing.T) {
	m := NewNetworkMap([]Row{
		{CIDR: "2001:db8::/32", TenantID: "tnt_v6"},
	})
	if got := m.ResolveByIP(netip.MustParseAddr("2001:db8::abcd")); got != "tnt_v6" {
		t.Errorf("IPv6 lookup failed: got %q", got)
	}
}
