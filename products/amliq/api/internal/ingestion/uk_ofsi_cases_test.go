package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// ukOFSITestCases returns the table-driven fixtures for
// TestUKOFSIParser. Kept in a non-_test.go file so the
// shared runner in uk_ofsi_test_runner.go can reach it.
func ukOFSITestCases() []ukOFSICase {
	return []ukOFSICase{
		{name: "empty_csv", row: "", wantN: 0},
		{
			name: "individual",
			row: "Smith,John,James,,,,Mr,1980-01-01,London,UK,British," +
				"AB123,,Director," +
				"10 Downing St,Westminster,,,,," +
				"SW1A 2AA,UK,Some info," +
				"Individual,,CYBER,2024-01-01,2024-06-01,grp000000001\n",
			wantN:        1,
			wantType:     domain.EntityTypeIndividual,
			wantName:     "John James Smith",
			wantList:     "uk_ofsi",
			checkIDLen:   1,
			wantDataset:  "uk_ofsi",
			wantPrograms: "CYBER",
		},
		{
			name: "company_entity",
			row: "Evil Corp,,,,,,,,,,,,,," +
				"123 Bad St,Suite 5,,,,,," +
				"12345,RU,," +
				"Entity,,RUSSIA,,2024-01-01,grp000000002\n",
			wantN: 0,
		},
		{
			name: "company_with_first_name",
			row: "Industries,ACME,,,,,,,,,,,,,,,,,,,,,," +
				"Entity,,RUSSIA,,2024-01-01,grp000000003\n",
			wantN:       1,
			wantType:    domain.EntityTypeCompany,
			wantName:    "ACME Industries",
			wantDataset: "uk_ofsi",
		},
		{
			name:  "skip_missing_last_name",
			row:   ",John,,,,,,,,,,,,,,,,,,,,,Individual,,,,grp000000004\n",
			wantN: 0,
		},
	}
}
