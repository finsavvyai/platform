// Helpers shared by the audit signer + writer — see signer.go for the
// package doc.

package audit

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// jsonOrNil marshals two payloads, returning nil bytes for nil inputs
// so the database stores SQL NULL instead of "null"::jsonb.
func jsonOrNil(before, after interface{}) ([]byte, []byte, error) {
	var b, a []byte
	if before != nil {
		v, err := json.Marshal(before)
		if err != nil {
			return nil, nil, err
		}
		b = v
	}
	if after != nil {
		v, err := json.Marshal(after)
		if err != nil {
			return nil, nil, err
		}
		a = v
	}
	return b, a, nil
}

// nilOrUUID dereferences a pointer-to-UUID, returning nil interface
// when the pointer is nil so SQL drivers map to NULL.
func nilOrUUID(id *uuid.UUID) interface{} {
	if id == nil {
		return nil
	}
	return *id
}

// contextWithTimeoutDefaults applies the default audit-write deadline
// (3 seconds) when the caller did not provide one. Used by the async
// drain goroutine where ctx is implicit.
func contextWithTimeoutDefaults() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 3*time.Second)
}
