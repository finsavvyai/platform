package llm

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/record"
	infllm "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/llm"
)

// captureRecording writes a start→request→response→stop sequence into
// session_recordings when the tenant has recording enabled.
//
// Errors are swallowed — recording is best-effort and must not fail the
// request path. Only called from Chat() after a successful provider
// response; callers ensure resp is non-nil before invoking.
func captureRecording(
	r *http.Request,
	deps Deps,
	tenantID uuid.UUID,
	req chatRequest,
	resp *infllm.Response,
) {
	if deps.Recorder == nil || deps.RecordingEnabled == nil {
		return
	}
	if tenantID == uuid.Nil || !deps.RecordingEnabled(r.Context(), tenantID) {
		return
	}

	sid, ok := record.SessionFromRequest(r)
	if !ok {
		sid = uuid.New()
	}

	var userID uuid.UUID
	if deps.UserCtx != nil {
		userID, _ = deps.UserCtx(r.Context())
	}

	// Synthetic consent token ties the recording to the session ID so
	// the audit trail is self-describing without a separate consent table.
	consentToken := "auto:" + sid.String()
	ctx := r.Context()

	if err := deps.Recorder.Start(ctx, sid, userID, consentToken); err != nil {
		return
	}
	_ = deps.Recorder.Append(ctx, sid, record.Event{
		Type: "request",
		At:   time.Now().UTC(),
		Payload: map[string]any{
			"model":   req.Model,
			"n_turns": len(req.Messages),
		},
	})
	_ = deps.Recorder.Append(ctx, sid, record.Event{
		Type: "response",
		At:   time.Now().UTC(),
		Payload: map[string]any{
			"provider":          resp.Provider,
			"model":             resp.Model,
			"prompt_tokens":     resp.PromptTokens,
			"completion_tokens": resp.CompletionTokens,
		},
	})
	_ = deps.Recorder.Stop(ctx, sid)
}

// alwaysEnabled is a RecordingEnabled implementation that enables
// recording for every tenant. Used in wiring when a Recorder is
// configured and no per-tenant opt-in table is yet available.
func alwaysEnabled(_ context.Context, _ uuid.UUID) bool { return true }
