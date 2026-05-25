package crypto

import (
	"context"
	"errors"
	"fmt"
	"testing"

	smithy "github.com/aws/smithy-go"
)

// fakeKMSAPIError satisfies smithy.APIError so mapKMSError can sniff
// the code without us standing up a full mock client.
type fakeKMSAPIError struct {
	code    string
	message string
}

func (e *fakeKMSAPIError) Error() string         { return e.message }
func (e *fakeKMSAPIError) ErrorCode() string     { return e.code }
func (e *fakeKMSAPIError) ErrorMessage() string  { return e.message }
func (e *fakeKMSAPIError) ErrorFault() smithy.ErrorFault { return smithy.FaultClient }

func TestMapKMSError_RevokedCodes(t *testing.T) {
	cases := []string{
		"AccessDeniedException",
		"NotFoundException",
		"DisabledException",
		"KMSInvalidStateException",
		"KeyUnavailableException",
	}
	for _, code := range cases {
		t.Run(code, func(t *testing.T) {
			in := &fakeKMSAPIError{code: code, message: "x"}
			got := mapKMSError("decrypt", in)
			if !errors.Is(got, ErrRevoked) {
				t.Fatalf("code %s: expected ErrRevoked, got %v", code, got)
			}
		})
	}
}

func TestMapKMSError_TransientPassesThrough(t *testing.T) {
	in := &fakeKMSAPIError{code: "ThrottlingException", message: "slow down"}
	got := mapKMSError("encrypt", in)
	if errors.Is(got, ErrRevoked) {
		t.Fatalf("ThrottlingException must NOT map to ErrRevoked")
	}
	if got == nil {
		t.Fatal("expected wrapped error, got nil")
	}
}

func TestMapKMSError_NonAPIErrorPassesThrough(t *testing.T) {
	plain := fmt.Errorf("connection refused")
	got := mapKMSError("encrypt", plain)
	if errors.Is(got, ErrRevoked) {
		t.Fatal("plain error must NOT map to ErrRevoked")
	}
}

func TestNewAWSKMS_PanicsOnNilClient(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic on nil client")
		}
	}()
	NewAWSKMS(nil)
}

func TestToCtx_PassthroughAndDefault(t *testing.T) {
	ctx := context.WithValue(context.Background(), "k", "v")
	if toCtx(ctx).Value("k") != "v" {
		t.Fatal("toCtx should pass through context.Context")
	}
	// non-context.Context Ctx falls back to Background.
	type fakeCtx struct{ Ctx }
	if toCtx(fakeCtx{}) == nil {
		t.Fatal("toCtx should never return nil")
	}
}
