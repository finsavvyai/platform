package events

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newPub(t *testing.T) (*Publisher, *miniredis.Miniredis, *redis.Client) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return NewPublisher(rdb, "test:"), mr, rdb
}

func TestChannel_TenantScoped(t *testing.T) {
	p, _, _ := newPub(t)
	assert.Equal(t, "test:tenant-a", p.Channel("tenant-a"))
	assert.Equal(t, "test:tenant-b", p.Channel("tenant-b"))
}

func TestChannel_DefaultPrefix(t *testing.T) {
	p := NewPublisher(nil, "")
	assert.Equal(t, "events:t1", p.Channel("t1"))
}

func TestPublish_MissingTenantErrors(t *testing.T) {
	p, _, _ := newPub(t)
	err := p.Publish(context.Background(), Event{Type: TypeDocUploaded})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "tenant_id required")
}

func TestPublish_MissingTypeErrors(t *testing.T) {
	p, _, _ := newPub(t)
	err := p.Publish(context.Background(), Event{TenantID: "t1"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "type required")
}

func TestPublish_FillsIDAndTimestamp(t *testing.T) {
	p, _, rdb := newPub(t)
	ctx := context.Background()
	sub := rdb.Subscribe(ctx, p.Channel("t1"))
	defer sub.Close()

	// Consume one message
	done := make(chan *redis.Message, 1)
	go func() {
		msg, _ := sub.ReceiveMessage(ctx)
		done <- msg
	}()

	// miniredis pub/sub needs a tiny warmup for subscribe to register
	time.Sleep(50 * time.Millisecond)

	err := p.Publish(ctx, Event{Type: TypeDocUploaded, TenantID: "t1"})
	require.NoError(t, err)

	select {
	case msg := <-done:
		var got Event
		require.NoError(t, json.Unmarshal([]byte(msg.Payload), &got))
		assert.NotEmpty(t, got.ID)
		assert.False(t, got.Timestamp.IsZero())
		assert.Equal(t, TypeDocUploaded, got.Type)
		assert.Equal(t, "t1", got.TenantID)
	case <-time.After(2 * time.Second):
		t.Fatal("no message received")
	}
}

func TestPublishDoc_BuildsResource(t *testing.T) {
	p, _, rdb := newPub(t)
	ctx := context.Background()
	sub := rdb.Subscribe(ctx, p.Channel("t1"))
	defer sub.Close()

	received := make(chan Event, 1)
	go func() {
		msg, _ := sub.ReceiveMessage(ctx)
		var e Event
		_ = json.Unmarshal([]byte(msg.Payload), &e)
		received <- e
	}()
	time.Sleep(50 * time.Millisecond)

	err := p.PublishDoc(ctx, "t1", "user-7", "doc-42", TypeDocProcessed,
		map[string]any{"pages": 12})
	require.NoError(t, err)

	select {
	case e := <-received:
		assert.Equal(t, TypeDocProcessed, e.Type)
		assert.Equal(t, "document:doc-42", e.Resource)
		assert.Equal(t, "user-7", e.ActorID)
		var payload map[string]any
		_ = json.Unmarshal(e.Payload, &payload)
		assert.EqualValues(t, 12, payload["pages"])
	case <-time.After(2 * time.Second):
		t.Fatal("no message")
	}
}

func TestPublishPolicyChange_Resource(t *testing.T) {
	p, _, rdb := newPub(t)
	ctx := context.Background()
	sub := rdb.Subscribe(ctx, p.Channel("t1"))
	defer sub.Close()

	received := make(chan Event, 1)
	go func() {
		msg, _ := sub.ReceiveMessage(ctx)
		var e Event
		_ = json.Unmarshal([]byte(msg.Payload), &e)
		received <- e
	}()
	time.Sleep(50 * time.Millisecond)

	err := p.PublishPolicyChange(ctx, "t1", "admin-1", "pol-9", "update")
	require.NoError(t, err)

	select {
	case e := <-received:
		assert.Equal(t, TypePolicyChanged, e.Type)
		assert.Equal(t, "policy:pol-9", e.Resource)
	case <-time.After(2 * time.Second):
		t.Fatal("no message")
	}
}

func TestPublish_FailOpenOnNilRedis_IncrementsDroppedCounter(t *testing.T) {
	p := NewPublisher(nil, "")
	require.EqualValues(t, 0, p.Dropped())
	err := p.Publish(context.Background(), Event{Type: TypeAuditEvent, TenantID: "t1"})
	assert.NoError(t, err, "must no-op when Redis is not wired")
	assert.EqualValues(t, 1, p.Dropped(), "dropped counter must increment for observability")

	_ = p.Publish(context.Background(), Event{Type: TypeAuditEvent, TenantID: "t2"})
	assert.EqualValues(t, 2, p.Dropped())
}

func TestPublish_RejectsInvalidTenantID(t *testing.T) {
	p, _, _ := newPub(t)
	cases := []string{
		"",                     // empty (hits earlier check)
		"has spaces",
		"bad/slash",
		"a*b",
		"a?b",
		"<script>",
		"'; DROP TABLE--",
		string(make([]byte, 65)), // too long
	}
	for _, tid := range cases {
		t.Run(tid, func(t *testing.T) {
			err := p.Publish(context.Background(), Event{Type: TypeAuditEvent, TenantID: tid})
			require.Error(t, err, "tenant id %q must be rejected", tid)
		})
	}
}

func TestPublish_AcceptsSafeTenantID(t *testing.T) {
	p, _, rdb := newPub(t)
	sub := rdb.Subscribe(context.Background(), p.Channel("tenant_a-123"))
	defer sub.Close()

	done := make(chan struct{}, 1)
	go func() {
		if _, err := sub.ReceiveMessage(context.Background()); err == nil {
			done <- struct{}{}
		}
	}()
	time.Sleep(50 * time.Millisecond)

	err := p.Publish(context.Background(), Event{Type: TypeAuditEvent, TenantID: "tenant_a-123"})
	require.NoError(t, err)

	select {
	case <-done:
		// pass
	case <-time.After(time.Second):
		t.Fatal("no message received")
	}
}

func TestPublish_TenantIsolation(t *testing.T) {
	p, _, rdb := newPub(t)
	ctx := context.Background()

	subA := rdb.Subscribe(ctx, p.Channel("tenant-a"))
	defer subA.Close()

	gotA := make(chan *redis.Message, 2)
	gotB := make(chan *redis.Message, 2)
	go func() {
		msg, err := subA.ReceiveMessage(ctx)
		if err == nil {
			gotA <- msg
		}
	}()

	subB := rdb.Subscribe(ctx, p.Channel("tenant-b"))
	defer subB.Close()
	go func() {
		msg, err := subB.ReceiveMessage(ctx)
		if err == nil {
			gotB <- msg
		}
	}()

	time.Sleep(50 * time.Millisecond)

	// Publish only to tenant-a
	require.NoError(t, p.Publish(ctx, Event{Type: TypeAuditEvent, TenantID: "tenant-a"}))

	select {
	case <-gotA:
		// expected
	case <-time.After(time.Second):
		t.Fatal("tenant-a should have received event")
	}

	select {
	case <-gotB:
		t.Fatal("tenant-b must not receive tenant-a events")
	case <-time.After(200 * time.Millisecond):
		// pass — isolation verified
	}
}
