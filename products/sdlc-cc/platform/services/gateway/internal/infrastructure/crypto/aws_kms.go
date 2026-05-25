// AWS KMS adapter for the envelope encryption layer.
//
// BEAT-PLAN S3.1 follow-up. Implements crypto.KMSClient against a
// real AWS KMS endpoint via aws-sdk-go-v2. Wrap calls KMS Encrypt
// (with the customer's KEK ARN as KeyId), Unwrap calls Decrypt.
// Revoke detection maps AccessDeniedException, NotFoundException,
// DisabledException, KMSInvalidStateException, and KMSScheduledKeyDeletion
// errors to ErrRevoked so callers can distinguish transient KMS
// failures from "you no longer own the data."
package crypto

import (
	"context"
	"errors"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/service/kms"
	smithy "github.com/aws/smithy-go"
)

// AWSKMS implements KMSClient against AWS KMS.
type AWSKMS struct {
	client *kms.Client
}

// NewAWSKMS wraps an existing kms.Client. Callers build the client
// from a config.LoadDefaultConfig + kms.NewFromConfig so credential
// resolution (instance role, AssumeRole, profile) stays under the
// caller's control.
func NewAWSKMS(client *kms.Client) *AWSKMS {
	if client == nil {
		panic("crypto: kms.Client required")
	}
	return &AWSKMS{client: client}
}

// Wrap implements KMSClient.Wrap. Returns the KMS-wrapped DEK opaque
// blob ready to embed in an Envelope.
func (a *AWSKMS) Wrap(ctx Ctx, kekARN string, dek []byte) ([]byte, error) {
	if kekARN == "" {
		return nil, errors.New("aws-kms: kekARN required")
	}
	out, err := a.client.Encrypt(toCtx(ctx), &kms.EncryptInput{
		KeyId:     &kekARN,
		Plaintext: dek,
	})
	if err != nil {
		return nil, mapKMSError("encrypt", err)
	}
	return out.CiphertextBlob, nil
}

// Unwrap implements KMSClient.Unwrap. Returns ErrRevoked when the KEK
// is unavailable so Decrypt() can surface a hard 503.
func (a *AWSKMS) Unwrap(ctx Ctx, kekARN string, wrapped []byte) ([]byte, error) {
	if len(wrapped) == 0 {
		return nil, errors.New("aws-kms: wrapped DEK is empty")
	}
	out, err := a.client.Decrypt(toCtx(ctx), &kms.DecryptInput{
		CiphertextBlob: wrapped,
		KeyId:          &kekARN, // optional but tightens key-rotation safety
	})
	if err != nil {
		return nil, mapKMSError("decrypt", err)
	}
	return out.Plaintext, nil
}

// mapKMSError translates KMS-specific failures to ErrRevoked when the
// failure means the key is gone or unusable. Everything else returns
// the wrapped error so callers see the transient vs revoked
// distinction the envelope contract requires.
func mapKMSError(op string, err error) error {
	if err == nil {
		return nil
	}
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		switch apiErr.ErrorCode() {
		case "AccessDeniedException",
			"NotFoundException",
			"DisabledException",
			"KMSInvalidStateException",
			"KMSInvalidKeyUsageException",
			"InvalidKeyUsageException",
			"KeyUnavailableException":
			return fmt.Errorf("%w: kms %s: %s", ErrRevoked, op, apiErr.ErrorMessage())
		}
	}
	return fmt.Errorf("kms %s: %w", op, err)
}

// toCtx converts our Ctx interface to a context.Context. The ctx
// type-asserts because every real caller passes a context.Context;
// the interface in envelope.go is only for stdlib-cleanliness.
func toCtx(ctx Ctx) context.Context {
	if c, ok := ctx.(context.Context); ok {
		return c
	}
	return context.Background()
}
