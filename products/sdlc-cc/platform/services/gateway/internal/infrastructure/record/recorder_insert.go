// Append-only INSERT path for AppendOnlyPostgresRecorder.
//
// Split from recorder.go so the encryption branch + future
// instrumentation hooks (metrics, tracing) can grow without pushing
// recorder.go over the 200-line cap.
package record

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
)

const insertQ = `
	INSERT INTO session_recordings
		(session_id, tenant_id, user_id, consent_token, recorded_at, payload, encrypted_payload)
	VALUES ($1, $2, $3, $4, $5, $6, $7)`

// insert writes one event row. When r.envelope is non-nil the payload
// is sealed with a fresh per-record DEK and the cleartext column is
// NULL; otherwise we write cleartext JSON to payload (CHECK constraint
// on the table still enforces the XOR).
func (r *AppendOnlyPostgresRecorder) insert(ctx context.Context, sessionID uuid.UUID, ev Event) error {
	r.mu.RLock()
	s, ok := r.active[sessionID]
	r.mu.RUnlock()
	if !ok {
		return ErrNotRecording
	}
	payload, err := json.Marshal(ev)
	if err != nil {
		return err
	}
	if r.envelope != nil {
		ct, err := r.envelope.Encrypt(ctx, payload)
		if err != nil {
			return err
		}
		blob, err := MarshalCiphertext(ct)
		if err != nil {
			return err
		}
		_, err = r.db.ExecContext(ctx, insertQ,
			sessionID, s.tenantID, s.userID, s.consentToken, ev.At, nil, blob)
		return err
	}
	_, err = r.db.ExecContext(ctx, insertQ,
		sessionID, s.tenantID, s.userID, s.consentToken, ev.At, payload, nil)
	return err
}
