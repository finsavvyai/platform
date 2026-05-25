package rules

import "testing"

// Compile-time assertion: MemoryStore implements RuleRepository.
var _ RuleRepository = (*MemoryStore)(nil)

func TestRepositoryInterfaceCompliance(t *testing.T) {
	// Verifies the MemoryStore satisfies the full RuleRepository contract.
	var repo RuleRepository = NewMemoryStore()
	if repo == nil {
		t.Fatal("NewMemoryStore returned nil")
	}
}
