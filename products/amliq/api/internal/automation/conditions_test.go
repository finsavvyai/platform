package automation

import "testing"

func TestEvalCondition(t *testing.T) {
	evt := EventContext{
		EntityName: "Hassan Ali", Score: 0.85, ListID: "OFAC",
	}
	tests := []struct {
		name string
		cond Condition
		want bool
	}{
		{"score gte match", Condition{"score", "gte", "0.80"}, true},
		{"score gte miss", Condition{"score", "gte", "0.90"}, false},
		{"list eq", Condition{"list", "eq", "OFAC"}, true},
		{"list ne", Condition{"list", "ne", "UN"}, true},
		{"list in", Condition{"list", "in", "OFAC,UN,EU"}, true},
		{"list in miss", Condition{"list", "in", "UN,EU"}, false},
		{"name contains", Condition{"entity_name", "contains", "Ali"}, true},
		{"unknown field", Condition{"xxx", "eq", "y"}, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := evalCondition(tc.cond, evt); got != tc.want {
				t.Errorf("evalCondition = %v, want %v", got, tc.want)
			}
		})
	}
}
