package compliance

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockProvider implements EvidenceProvider for testing.
type mockProvider struct {
	items []EvidenceItem
	err   error
	calls int
}

func (m *mockProvider) Collect(_ context.Context, _ string, et EvidenceType) ([]EvidenceItem, error) {
	m.calls++
	if m.err != nil {
		return nil, m.err
	}
	return m.items, nil
}

func TestRegisterProvider(t *testing.T) {
	ec := NewEvidenceCollector()
	mp := &mockProvider{}

	ec.RegisterProvider(AuditLog, mp)

	assert.Contains(t, ec.providers, AuditLog)
	assert.Equal(t, mp, ec.providers[AuditLog])
}

func TestCollectEvidence_CallsCorrectProvider(t *testing.T) {
	ec := NewEvidenceCollector()
	auditProv := &mockProvider{items: []EvidenceItem{{Data: "audit-data", Source: "audit"}}}
	rbacProv := &mockProvider{items: []EvidenceItem{{Data: "rbac-data", Source: "rbac"}}}

	ec.RegisterProvider(AuditLog, auditProv)
	ec.RegisterProvider(RBACConfig, rbacProv)

	items, err := ec.CollectEvidence(context.Background(), "t1", "CTL-001", []EvidenceType{AuditLog})
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, "audit-data", items[0].Data)
	assert.Equal(t, 1, auditProv.calls)
	assert.Equal(t, 0, rbacProv.calls)
}

func TestCollectEvidence_SetsControlID(t *testing.T) {
	ec := NewEvidenceCollector()
	ec.RegisterProvider(CICDLog, &mockProvider{
		items: []EvidenceItem{{Data: "ci-log"}, {Data: "ci-log-2"}},
	})

	items, err := ec.CollectEvidence(context.Background(), "t1", "CTL-005", []EvidenceType{CICDLog})
	require.NoError(t, err)
	for _, item := range items {
		assert.Equal(t, "CTL-005", item.ControlID)
	}
}

func TestCollectEvidence_ComputesSHA256Hash(t *testing.T) {
	ec := NewEvidenceCollector()
	ec.RegisterProvider(AuditLog, &mockProvider{
		items: []EvidenceItem{{Data: "test-data"}},
	})

	items, err := ec.CollectEvidence(context.Background(), "t1", "CTL-001", []EvidenceType{AuditLog})
	require.NoError(t, err)
	require.Len(t, items, 1)

	expected := sha256.Sum256([]byte("test-data"))
	assert.Equal(t, fmt.Sprintf("%x", expected), items[0].Hash)
}

func TestCollectEvidence_SetsIDAndCollectedAt(t *testing.T) {
	ec := NewEvidenceCollector()
	ec.RegisterProvider(AuditLog, &mockProvider{
		items: []EvidenceItem{{Data: "d"}},
	})

	items, err := ec.CollectEvidence(context.Background(), "t1", "CTL-001", []EvidenceType{AuditLog})
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.NotEmpty(t, items[0].ID)
	assert.False(t, items[0].CollectedAt.IsZero())
}

func TestCollectEvidence_MissingProviderSkips(t *testing.T) {
	ec := NewEvidenceCollector()
	// No providers registered; requesting MonitoringAlert should skip silently.
	items, err := ec.CollectEvidence(context.Background(), "t1", "CTL-001", []EvidenceType{MonitoringAlert})
	require.NoError(t, err)
	assert.Empty(t, items)
}

func TestCollectEvidence_ProviderErrorReturnsError(t *testing.T) {
	ec := NewEvidenceCollector()
	ec.RegisterProvider(EncryptionConf, &mockProvider{
		err: errors.New("connection refused"),
	})

	_, err := ec.CollectEvidence(context.Background(), "t1", "CTL-001", []EvidenceType{EncryptionConf})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "connection refused")
}

func TestCollectAll_CollectsFromAllProviders(t *testing.T) {
	ec := NewEvidenceCollector()
	p1 := &mockProvider{items: []EvidenceItem{{Data: "a"}}}
	p2 := &mockProvider{items: []EvidenceItem{{Data: "b"}}}
	ec.RegisterProvider(AuditLog, p1)
	ec.RegisterProvider(RBACConfig, p2)

	items, err := ec.CollectAll(context.Background(), "t1", "CTL-010")
	require.NoError(t, err)
	assert.Len(t, items, 2)
	assert.Equal(t, 1, p1.calls)
	assert.Equal(t, 1, p2.calls)
	for _, item := range items {
		assert.Equal(t, "CTL-010", item.ControlID)
	}
}

func TestCollectAll_EmptyProviders(t *testing.T) {
	ec := NewEvidenceCollector()
	items, err := ec.CollectAll(context.Background(), "t1", "CTL-001")
	require.NoError(t, err)
	assert.Empty(t, items)
}

func TestHashEvidence_Consistent(t *testing.T) {
	h1 := hashEvidence("hello")
	h2 := hashEvidence("hello")
	assert.Equal(t, h1, h2)
	assert.Len(t, h1, 64) // SHA-256 hex = 64 chars
}

func TestHashEvidence_DifferentInputs(t *testing.T) {
	h1 := hashEvidence("alpha")
	h2 := hashEvidence("beta")
	assert.NotEqual(t, h1, h2)
}

func TestCollectEvidence_MultipleTypes(t *testing.T) {
	ec := NewEvidenceCollector()
	ec.RegisterProvider(AuditLog, &mockProvider{items: []EvidenceItem{{Data: "a1"}}})
	ec.RegisterProvider(CICDLog, &mockProvider{items: []EvidenceItem{{Data: "c1"}, {Data: "c2"}}})

	items, err := ec.CollectEvidence(
		context.Background(), "t1", "CTL-002",
		[]EvidenceType{AuditLog, CICDLog},
	)
	require.NoError(t, err)
	assert.Len(t, items, 3)
}
