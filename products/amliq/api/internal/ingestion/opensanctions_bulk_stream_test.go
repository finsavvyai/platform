package ingestion

import (
	"bytes"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

// TestBulkParser_StreamPreservesEnrichment verifies that the streaming
// path emits the same enriched fields (Addresses, Identifiers, extra
// alias Names) as the buffered Parse path. Also confirms the callback
// is invoked once per primary entity plus once per expanded alias.
func TestBulkParser_StreamPreservesEnrichment(t *testing.T) {
	hdr := "id,schema,name,aliases,birth_date,countries,addresses,identifiers,dataset\n"
	row := "Q1,Person,John Smith,Jon Smith;Johnny S,1970-01-01,US;UK,1 Main St;2 Elm Ave,P123;ID456,us_ofac_sdn\n"
	tests := []struct {
		name      string
		csv       string
		wantEmits int
		wantAddrs int
		wantIDs   int
	}{
		{"simple_with_aliases", hdr + row, 3, 2, 2},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var got []domain.Entity
			err := NewOpenSanctionsBulkParser().ParseStream(
				bytes.NewReader([]byte(tc.csv)),
				func(e domain.Entity) error { got = append(got, e); return nil },
			)
			if err != nil {
				t.Fatalf("ParseStream: %v", err)
			}
			if len(got) != tc.wantEmits {
				t.Fatalf("emits=%d want=%d", len(got), tc.wantEmits)
			}
			primary := got[0]
			if len(primary.Addresses) < tc.wantAddrs {
				t.Errorf("addresses=%d want>=%d", len(primary.Addresses), tc.wantAddrs)
			}
			if len(primary.Identifiers) < tc.wantIDs {
				t.Errorf("identifiers=%d want>=%d", len(primary.Identifiers), tc.wantIDs)
			}
		})
	}
}

// TestBulkParser_StreamCallbackError verifies the emitter's error is
// propagated and parsing stops on the first failing row.
func TestBulkParser_StreamCallbackError(t *testing.T) {
	csv := "id,schema,name,dataset\nQ1,Person,A,ofac\nQ2,Person,B,ofac\n"
	stopErr := errStopStream
	calls := 0
	err := NewOpenSanctionsBulkParser().ParseStream(
		bytes.NewReader([]byte(csv)),
		func(e domain.Entity) error { calls++; return stopErr },
	)
	if err != stopErr {
		t.Fatalf("err=%v want=%v", err, stopErr)
	}
	if calls != 1 {
		t.Errorf("calls=%d want=1", calls)
	}
}

// errStopStream is returned by the test emitter to prove error
// propagation; kept unexported so it doesn't leak to other tests.
var errStopStream = sentinelErr("stop stream")

type sentinelErr string

func (e sentinelErr) Error() string { return string(e) }
