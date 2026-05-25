package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

// ukOFSITestHeader is the CSV header fixture used by TestUKOFSIParser.
const ukOFSITestHeader = "Name 6,Name 1,Name 2,Name 3,Name 4,Name 5," +
	"Title,DOB,Town of Birth,Country of Birth,Nationality," +
	"Passport Details,NI Number,Position," +
	"Address 1,Address 2,Address 3,Address 4,Address 5,Address 6," +
	"Post/Zip Code,Country,Other Information," +
	"Group Type,Alias Type,Regime,Listed On,Last Updated,Group ID\n"

// ukOFSICase is a single table-driven row for TestUKOFSIParser.
type ukOFSICase struct {
	name         string
	row          string
	wantN        int
	wantType     domain.EntityType
	wantName     string
	wantList     string
	checkIDLen   int
	wantDataset  string
	wantPrograms string
}

func TestUKOFSIParser(t *testing.T) {
	for _, tc := range ukOFSITestCases() {
		t.Run(tc.name, func(t *testing.T) { runUKOFSICase(t, tc) })
	}
}
