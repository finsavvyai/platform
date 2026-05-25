package platform

import (
	"bytes"
	"net/http"
	"testing"
)

func TestAzureParsePush(t *testing.T) {
	body := `{"eventType":"git.push","resource":{
		"commits":[{"commitId":"azsha"}],
		"refUpdates":[{"name":"refs/heads/main","newObjectId":"azsha"}],
		"repository":{"id":"rid","project":{"name":"proj"},"remoteUrl":"https://dev.azure.com/org/proj/_git/r"},
		"pushedBy":{"displayName":"Heidi"}}}`
	req, _ := http.NewRequest("POST", "/", bytes.NewReader([]byte(body)))
	az := &Azure{}
	ev, err := az.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	tests := []struct{ name, got, want string }{
		{"provider", ev.Provider, "azure"},
		{"action", ev.Action, "push"},
		{"repo", ev.Repo, "proj/rid"},
		{"branch", ev.Branch, "main"},
		{"sha", ev.SHA, "azsha"},
		{"sender", ev.Sender, "Heidi"},
	}
	for _, tt := range tests {
		if tt.got != tt.want {
			t.Errorf("%s = %q, want %q", tt.name, tt.got, tt.want)
		}
	}
}

func TestAzureParsePR(t *testing.T) {
	body := `{"eventType":"git.pullrequest.created","resource":{
		"pullRequestId":12,
		"sourceRefName":"refs/heads/feature",
		"lastMergeSourceCommit":{"commitId":"prsha"},
		"repository":{"id":"rid","project":{"name":"proj"}},
		"createdBy":{"displayName":"Ivan"}}}`
	req, _ := http.NewRequest("POST", "/", bytes.NewReader([]byte(body)))
	az := &Azure{}
	ev, err := az.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Action != "pull_request" || ev.PRNumber != 12 || ev.Branch != "feature" || ev.SHA != "prsha" || ev.Sender != "Ivan" {
		t.Errorf("unexpected event: %+v", ev)
	}
}

func TestAzureBasicAuthVerification(t *testing.T) {
	tests := []struct {
		name       string
		u, p       string
		set        bool
		wantErr    bool
		secretUser string
	}{
		{"valid creds", "hook", "shh", true, false, "hook"},
		{"wrong pass", "hook", "bad", true, true, "hook"},
		{"missing header", "", "", false, true, "hook"},
		{"no secret skips", "", "", false, false, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("POST", "/", bytes.NewReader([]byte(`{}`)))
			if tt.set {
				req.SetBasicAuth(tt.u, tt.p)
			}
			az := &Azure{WebhookUser: tt.secretUser, WebhookSecret: map[bool]string{true: "shh", false: ""}[tt.secretUser != ""]}
			err := az.verifyBasicAuth(req)
			if (err != nil) != tt.wantErr {
				t.Errorf("err = %v, wantErr = %v", err, tt.wantErr)
			}
		})
	}
}

func TestAzureStateMap(t *testing.T) {
	cases := map[State]string{StateSuccess: "succeeded", StateFailure: "failed", StatePending: "pending", StateError: "error"}
	for in, want := range cases {
		if got := mapAzureState(in); got != want {
			t.Errorf("mapAzureState(%s) = %q, want %q", in, got, want)
		}
	}
	if got, _ := splitAzureRepo("proj/rid"); got != "proj" {
		t.Errorf("splitAzureRepo project = %q", got)
	}
	if _, rid := splitAzureRepo("proj/rid"); rid != "rid" {
		t.Errorf("splitAzureRepo repoID = %q", rid)
	}
	if p, r := splitAzureRepo("bad"); p != "" || r != "" {
		t.Errorf("splitAzureRepo(bad) = %q,%q", p, r)
	}
}
