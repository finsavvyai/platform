// SPDX-License-Identifier: AGPL-3.0-or-later
package middleware

import (
	"context"
	"strings"
	"testing"
)

func TestDLPScan_AllowAction_PassesThrough(t *testing.T) {
	d := NewDLP(NewDetector(), staticPolicy{ActionAllow}, nil)
	res := d.Scan(context.Background(), "alice@example.com is here", "t1")
	if res.Blocked {
		t.Fatalf("blocked unexpectedly: %+v", res)
	}
	if res.Rewritten != "alice@example.com is here" {
		t.Fatalf("rewritten: %q", res.Rewritten)
	}
	if res.Action != ActionAllow {
		t.Fatalf("action: %s", res.Action)
	}
}

func TestDLPScan_RedactAction_ReplacesPII(t *testing.T) {
	d := NewDLP(NewDetector(), staticPolicy{ActionRedact}, nil)
	res := d.Scan(context.Background(), "email alice@example.com please", "t1")
	if res.Blocked {
		t.Fatalf("blocked: %+v", res)
	}
	if strings.Contains(res.Rewritten, "alice@example.com") {
		t.Fatalf("email leaked through: %q", res.Rewritten)
	}
	if len(res.Matches) == 0 {
		t.Fatalf("expected matches")
	}
}

func TestDLPScan_BlockAction_ReturnsBlockedWithReason(t *testing.T) {
	d := NewDLP(NewDetector(), staticPolicy{ActionBlock}, nil)
	res := d.Scan(context.Background(), "ssn 123-45-6789", "t1")
	if !res.Blocked {
		t.Fatalf("expected blocked, got %+v", res)
	}
	if res.Rewritten != "" {
		t.Fatalf("rewritten not empty on block: %q", res.Rewritten)
	}
	if res.BlockReason == "" || res.BlockReason == "policy violation" {
		t.Fatalf("block reason: %q (want category names)", res.BlockReason)
	}
}

func TestDLPScan_EmptyTenant_DegradesToAllow(t *testing.T) {
	d := NewDLP(NewDetector(), staticPolicy{ActionBlock}, nil)
	res := d.Scan(context.Background(), "ssn 123-45-6789", "")
	if res.Blocked {
		t.Fatalf("empty-tenant must not block: %+v", res)
	}
	if res.Action != ActionAllow {
		t.Fatalf("action: %s", res.Action)
	}
}

func TestDLPScan_TokenizeFallsBackToRedact(t *testing.T) {
	d := NewDLP(NewDetector(), staticPolicy{ActionTokenize}, nil)
	res := d.Scan(context.Background(), "alice@example.com", "t1")
	if res.Action != ActionRedact {
		t.Fatalf("expected tokenize→redact fallback, got %s", res.Action)
	}
	if strings.Contains(res.Rewritten, "alice@example.com") {
		t.Fatalf("rewritten leaked email: %q", res.Rewritten)
	}
}
