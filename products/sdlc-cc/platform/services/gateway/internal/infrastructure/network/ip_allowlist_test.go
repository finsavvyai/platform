package network

import (
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
)

func TestAllowList_PerKeyTakesPrecedence(t *testing.T) {
	keyID := uuid.New()
	a := AllowList{
		TenantWide: ParseCIDRs([]string{"10.0.0.0/8"}),
		PerKey: map[uuid.UUID][]*net.IPNet{
			keyID: ParseCIDRs([]string{"192.168.0.0/16"}),
		},
	}
	if !a.Permit(net.ParseIP("192.168.1.1"), keyID) {
		t.Fatal("per-key rule should permit 192.168.1.1")
	}
	if a.Permit(net.ParseIP("10.0.0.1"), keyID) {
		t.Fatal("per-key rule must NOT fall back to tenant-wide when set")
	}
}

func TestAllowList_TenantWideFallback(t *testing.T) {
	a := AllowList{TenantWide: ParseCIDRs([]string{"10.0.0.0/8"})}
	if !a.Permit(net.ParseIP("10.0.0.1"), uuid.Nil) {
		t.Fatal("tenant-wide rule should permit 10.x")
	}
	if a.Permit(net.ParseIP("8.8.8.8"), uuid.Nil) {
		t.Fatal("tenant-wide rule must reject 8.8.8.8")
	}
}

func TestAllowList_DenyOnNoRule(t *testing.T) {
	a := AllowList{}
	if a.Permit(net.ParseIP("1.2.3.4"), uuid.Nil) {
		t.Fatal("no rule must deny in private_only path")
	}
}

func TestClientIP_CloudflareHeader(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("CF-Connecting-IP", "203.0.113.7")
	r.RemoteAddr = "127.0.0.1:1234"
	ip := ClientIPFromRequest(r)
	if ip.String() != "203.0.113.7" {
		t.Fatalf("CF header must win, got %s", ip)
	}
}

func TestClientIP_FallsBackToRemoteAddr(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "10.0.0.5:443"
	ip := ClientIPFromRequest(r)
	if ip.String() != "10.0.0.5" {
		t.Fatalf("expected 10.0.0.5 from RemoteAddr, got %s", ip)
	}
}
