package automation

import "testing"

func TestStoreCRUD(t *testing.T) {
	s := NewInMemoryStore()
	rule := Rule{
		TenantID: "t1", Name: "High Risk Alert",
		Trigger: TriggerAlertCreated, Enabled: true,
		Actions: []Action{{Type: ActionEmail, Config: map[string]interface{}{"to": "x@y.z"}}},
	}
	created, err := s.Create(rule)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if created.ID == "" {
		t.Error("ID not generated")
	}

	got, err := s.Get("t1", created.ID)
	if err != nil || got.Name != "High Risk Alert" {
		t.Errorf("Get mismatch: %v %+v", err, got)
	}

	list, _ := s.List("t1")
	if len(list) != 1 {
		t.Errorf("List count = %d, want 1", len(list))
	}

	if err := s.Delete("t1", created.ID); err != nil {
		t.Errorf("Delete: %v", err)
	}
	if _, err := s.Get("t1", created.ID); err == nil {
		t.Error("Get should fail after delete")
	}
}

func TestRuleValidate(t *testing.T) {
	cases := []struct {
		name    string
		rule    Rule
		wantErr bool
	}{
		{"missing name", Rule{Trigger: TriggerAlertCreated, Actions: []Action{{Type: ActionEmail}}}, true},
		{"missing trigger", Rule{Name: "x", Actions: []Action{{Type: ActionEmail}}}, true},
		{"no actions", Rule{Name: "x", Trigger: TriggerAlertCreated}, true},
		{"valid", Rule{Name: "x", Trigger: TriggerAlertCreated,
			Actions: []Action{{Type: ActionEmail}}}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.rule.Validate()
			if (err != nil) != tc.wantErr {
				t.Errorf("Validate() err=%v, wantErr=%v", err, tc.wantErr)
			}
		})
	}
}

func TestForTrigger(t *testing.T) {
	s := NewInMemoryStore()
	s.Create(Rule{TenantID: "t1", Name: "r1", Enabled: true,
		Trigger: TriggerAlertCreated,
		Actions: []Action{{Type: ActionEmail}}})
	s.Create(Rule{TenantID: "t1", Name: "r2", Enabled: false,
		Trigger: TriggerAlertCreated,
		Actions: []Action{{Type: ActionEmail}}})
	s.Create(Rule{TenantID: "t1", Name: "r3", Enabled: true,
		Trigger: TriggerMatchHighRisk,
		Actions: []Action{{Type: ActionEmail}}})

	matches, _ := s.ForTrigger("t1", TriggerAlertCreated)
	if len(matches) != 1 {
		t.Errorf("enabled AlertCreated rules = %d, want 1", len(matches))
	}
}
