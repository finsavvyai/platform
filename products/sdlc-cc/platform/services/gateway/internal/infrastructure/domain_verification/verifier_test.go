package domain_verification

import (
	"context"
	"errors"
	"testing"
	"time"
)

type fakeResolver struct {
	records []string
	err     error
}

func (f fakeResolver) LookupTXT(_ context.Context, _ string) ([]string, error) {
	return f.records, f.err
}

type fakeHTTP struct {
	body   []byte
	status int
	err    error
}

func (f fakeHTTP) Get(_ context.Context, _ string) ([]byte, int, error) {
	return f.body, f.status, f.err
}

func newV(res Resolver, http HTTPClient) *Verifier {
	return &Verifier{Res: res, HTTP: http, Now: time.Now, Window: time.Hour}
}

func TestVerifyDNS_Success(t *testing.T) {
	v := newV(fakeResolver{records: []string{"v=spf1 ...", "sdlc-cc-verification=abc123"}}, nil)
	if err := v.Verify(context.Background(), MethodDNS, "example.com", "abc123"); err != nil {
		t.Fatalf("DNS verify must succeed, got %v", err)
	}
}

func TestVerifyDNS_TokenMissing(t *testing.T) {
	v := newV(fakeResolver{records: []string{"v=spf1 ..."}}, nil)
	err := v.Verify(context.Background(), MethodDNS, "example.com", "abc123")
	if !errors.Is(err, ErrTokenNotFound) {
		t.Fatalf("missing token must be ErrTokenNotFound, got %v", err)
	}
}

func TestVerifyHTTP_Success(t *testing.T) {
	v := newV(nil, fakeHTTP{body: []byte("abc123\n"), status: 200})
	if err := v.Verify(context.Background(), MethodHTTP, "example.com", "abc123"); err != nil {
		t.Fatalf("HTTP verify must succeed, got %v", err)
	}
}

func TestVerifyHTTP_TokenMismatch(t *testing.T) {
	v := newV(nil, fakeHTTP{body: []byte("zzz"), status: 200})
	err := v.Verify(context.Background(), MethodHTTP, "example.com", "abc123")
	if !errors.Is(err, ErrTokenNotFound) {
		t.Fatalf("mismatch must be ErrTokenNotFound, got %v", err)
	}
}

func TestVerifyHTTP_Non200Errors(t *testing.T) {
	v := newV(nil, fakeHTTP{body: []byte("nope"), status: 404})
	err := v.Verify(context.Background(), MethodHTTP, "example.com", "abc123")
	if err == nil {
		t.Fatal("non-200 must error")
	}
}

func TestVerify_UnknownMethod(t *testing.T) {
	v := newV(nil, nil)
	err := v.Verify(context.Background(), "ftp", "example.com", "abc")
	if err == nil {
		t.Fatal("unknown method must error")
	}
}
