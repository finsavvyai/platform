package billing

import (
	"testing"
	"time"
)

func TestCurrentPeriodFormat(t *testing.T) {
	got := CurrentPeriod()
	now := time.Now().UTC()
	want := now.Format("2006-01")
	if got != want {
		t.Errorf("CurrentPeriod() = %s, want %s", got, want)
	}
}

func TestCurrentPeriodLength(t *testing.T) {
	got := CurrentPeriod()
	if len(got) != 7 {
		t.Errorf("CurrentPeriod() length = %d, want 7", len(got))
	}
	if got[4] != '-' {
		t.Errorf("CurrentPeriod() separator = %c, want '-'", got[4])
	}
}

func TestCurrentPeriodAlias(t *testing.T) {
	got := currentPeriod()
	want := CurrentPeriod()
	if got != want {
		t.Errorf("currentPeriod() = %s, want %s", got, want)
	}
}
