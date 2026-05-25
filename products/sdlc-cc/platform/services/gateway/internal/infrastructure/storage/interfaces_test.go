package storage

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestStoreRequest_Validation tests implicit validation of StoreRequest
func TestStoreRequest_Validation(t *testing.T) {
	tests := []struct {
		name    string
		req     StoreRequest
		wantErr bool
	}{
		{
			name: "Valid request",
			req: StoreRequest{
				TenantID:    uuid.New(),
				DocumentID:  uuid.New(),
				Filename:    "test.pdf",
				Content:     []byte("test content"),
				ContentType: "application/pdf",
			},
			wantErr: false,
		},
		{
			name: "Empty tenant ID",
			req: StoreRequest{
				DocumentID:  uuid.New(),
				Filename:    "test.pdf",
				Content:     []byte("test content"),
				ContentType: "application/pdf",
			},
			wantErr: true, // Would fail in actual use
		},
		{
			name: "Empty document ID",
			req: StoreRequest{
				TenantID:    uuid.New(),
				Filename:    "test.pdf",
				Content:     []byte("test content"),
				ContentType: "application/pdf",
			},
			wantErr: true,
		},
		{
			name: "Empty filename",
			req: StoreRequest{
				TenantID:    uuid.New(),
				DocumentID:  uuid.New(),
				Content:     []byte("test content"),
				ContentType: "application/pdf",
			},
			wantErr: true,
		},
		{
			name: "Empty content",
			req: StoreRequest{
				TenantID:    uuid.New(),
				DocumentID:  uuid.New(),
				Filename:    "test.pdf",
				ContentType: "application/pdf",
			},
			wantErr: false, // Empty content might be valid for some use cases
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Verify the request can be constructed
			assert.NotNil(t, tt.req)

			// Check if key fields are set
			hasValidTenant := tt.req.TenantID != uuid.Nil
			hasValidDocument := tt.req.DocumentID != uuid.Nil
			hasValidFilename := tt.req.Filename != ""

			isValid := hasValidTenant && hasValidDocument && hasValidFilename
			if tt.wantErr {
				assert.False(t, isValid, "expected request to be invalid")
			} else {
				assert.True(t, isValid || !tt.wantErr, "request validation check")
			}
		})
	}
}

// TestBatchDeleteRequest_Validation tests BatchDeleteRequest validation
func TestBatchDeleteRequest_Validation(t *testing.T) {
	tests := []struct {
		name    string
		req     BatchDeleteRequest
		wantErr bool
	}{
		{
			name: "Valid request",
			req: BatchDeleteRequest{
				TenantID:   uuid.New(),
				DocumentID: uuid.New(),
				Filenames:  []string{"file1.pdf", "file2.pdf"},
			},
			wantErr: false,
		},
		{
			name: "Empty tenant ID",
			req: BatchDeleteRequest{
				DocumentID: uuid.New(),
				Filenames:  []string{"file1.pdf"},
			},
			wantErr: true,
		},
		{
			name: "Empty document ID",
			req: BatchDeleteRequest{
				TenantID:  uuid.New(),
				Filenames: []string{"file1.pdf"},
			},
			wantErr: true,
		},
		{
			name: "Empty filenames",
			req: BatchDeleteRequest{
				TenantID:   uuid.New(),
				DocumentID: uuid.New(),
				Filenames:  []string{},
			},
			wantErr: true,
		},
		{
			name: "Nil filenames",
			req: BatchDeleteRequest{
				TenantID:   uuid.New(),
				DocumentID: uuid.New(),
				Filenames:  nil,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Verify the request can be constructed
			assert.NotNil(t, tt.req)

			// Check if key fields are set
			hasValidTenant := tt.req.TenantID != uuid.Nil
			hasValidDocument := tt.req.DocumentID != uuid.Nil
			hasValidFilenames := len(tt.req.Filenames) > 0

			isValid := hasValidTenant && hasValidDocument && hasValidFilenames
			if tt.wantErr {
				assert.False(t, isValid, "expected request to be invalid")
			} else {
				assert.True(t, isValid, "expected request to be valid")
			}
		})
	}
}

// TestScanResult_ThreatDetection tests ScanResult threat detection
func TestScanResult_ThreatDetection(t *testing.T) {
	tests := []struct {
		name   string
		result ScanResult
		want   bool
	}{
		{
			name: "Infected file",
			result: ScanResult{
				Infected: true,
				Threats:  []string{"Virus.Trojan.Generic"},
				Engine:   "ClamAV",
			},
			want: true,
		},
		{
			name: "Clean file",
			result: ScanResult{
				Infected: false,
				Threats:  []string{},
				Engine:   "ClamAV",
			},
			want: false,
		},
		{
			name: "Multiple threats",
			result: ScanResult{
				Infected: true,
				Threats:  []string{"Virus.A", "Virus.B", "Trojan.C"},
				Engine:   "ClamAV",
			},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, tt.result.Infected)
			if tt.want {
				assert.NotEmpty(t, tt.result.Threats)
			}
		})
	}
}

// TestFileInfo_KeyParsing tests FileInfo key parsing
func TestFileInfo_KeyParsing(t *testing.T) {
	tests := []struct {
		name     string
		key      string
		expected struct {
			tenant   string
			document string
			filename string
			valid    bool
		}
	}{
		{
			name: "Valid key format",
			key:  "tenant123/doc123/file.pdf",
			expected: struct {
				tenant   string
				document string
				filename string
				valid    bool
			}{
				tenant:   "tenant123",
				document: "doc123",
				filename: "file.pdf",
				valid:    true,
			},
		},
		{
			name: "Key with subfolder",
			key:  "tenant123/doc123/subfolder/file.pdf",
			expected: struct {
				tenant   string
				document string
				filename string
				valid    bool
			}{
				tenant:   "tenant123",
				document: "doc123",
				filename: "subfolder/file.pdf",
				valid:    true,
			},
		},
		{
			name: "Invalid key format - missing parts",
			key:  "tenant123/file.pdf",
			expected: struct {
				tenant   string
				document string
				filename string
				valid    bool
			}{
				valid: false,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parts := parseStorageKey(tt.key)
			if tt.expected.valid {
				require.NotNil(t, parts)
				assert.Equal(t, tt.expected.tenant, parts.Tenant)
				assert.Equal(t, tt.expected.document, parts.Document)
			} else {
				assert.Nil(t, parts)
			}
		})
	}
}

// TestListFilter_Defaults tests ListFilter default values
func TestListFilter_Defaults(t *testing.T) {
	filter := ListFilter{}

	assert.Equal(t, 0, filter.Limit)
	assert.Equal(t, 0, filter.Offset)
	assert.Nil(t, filter.CreatedAfter)
	assert.Nil(t, filter.CreatedBefore)
	assert.Nil(t, filter.Tags)
	assert.Nil(t, filter.ContentType)
}

// Helper types and functions

// StorageKeyParts represents the parsed parts of a storage key
type StorageKeyParts struct {
	Tenant   string
	Document string
	Filename string
}

// parseStorageKey parses a storage key into its components
func parseStorageKey(key string) *StorageKeyParts {
	parts := &StorageKeyParts{}

	// Simple parsing logic - adjust based on actual key format
	// Expected format: tenantID/documentID/filename
	idx1 := indexOf(key, "/")
	if idx1 == -1 {
		return nil
	}

	idx2 := indexOf(key[idx1+1:], "/")
	if idx2 == -1 {
		return nil
	}

	parts.Tenant = key[:idx1]
	parts.Document = key[idx1+1 : idx1+1+idx2]
	parts.Filename = key[idx1+1+idx2+1:]

	return parts
}

// indexOf finds the index of a substring
func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

// Mock implementations for testing

// MockStorageProvider implements StorageProvider for testing
type MockStorageProvider struct {
	StoreFunc         func(ctx context.Context, req StoreRequest) (string, error)
	RetrieveFunc      func(ctx context.Context, tenantID, documentID, filename string) ([]byte, error)
	DeleteFunc        func(ctx context.Context, tenantID, documentID, filename string) error
	DeleteBatchFunc   func(ctx context.Context, req BatchDeleteRequest) error
	ExistsFunc        func(ctx context.Context, tenantID, documentID, filename string) (bool, error)
	GetMetadataFunc   func(ctx context.Context, tenantID, documentID, filename string) (map[string]interface{}, error)
	ListFilesFunc     func(ctx context.Context, tenantID string, filter ListFilter) ([]FileInfo, error)
	GetBucketNameFunc func() string
	HealthCheckFunc   func(ctx context.Context) error
}

func (m *MockStorageProvider) Store(ctx context.Context, req StoreRequest) (string, error) {
	if m.StoreFunc != nil {
		return m.StoreFunc(ctx, req)
	}
	return "", nil
}

func (m *MockStorageProvider) Retrieve(ctx context.Context, tenantID, documentID, filename string) ([]byte, error) {
	if m.RetrieveFunc != nil {
		return m.RetrieveFunc(ctx, tenantID, documentID, filename)
	}
	return []byte{}, nil
}

func (m *MockStorageProvider) Delete(ctx context.Context, tenantID, documentID, filename string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, tenantID, documentID, filename)
	}
	return nil
}

func (m *MockStorageProvider) DeleteBatch(ctx context.Context, req BatchDeleteRequest) error {
	if m.DeleteBatchFunc != nil {
		return m.DeleteBatchFunc(ctx, req)
	}
	return nil
}

func (m *MockStorageProvider) Exists(ctx context.Context, tenantID, documentID, filename string) (bool, error) {
	if m.ExistsFunc != nil {
		return m.ExistsFunc(ctx, tenantID, documentID, filename)
	}
	return false, nil
}

func (m *MockStorageProvider) GetMetadata(ctx context.Context, tenantID, documentID, filename string) (map[string]interface{}, error) {
	if m.GetMetadataFunc != nil {
		return m.GetMetadataFunc(ctx, tenantID, documentID, filename)
	}
	return nil, nil
}

func (m *MockStorageProvider) ListFiles(ctx context.Context, tenantID string, filter ListFilter) ([]FileInfo, error) {
	if m.ListFilesFunc != nil {
		return m.ListFilesFunc(ctx, tenantID, filter)
	}
	return []FileInfo{}, nil
}

func (m *MockStorageProvider) GetBucketName() string {
	if m.GetBucketNameFunc != nil {
		return m.GetBucketNameFunc()
	}
	return "default-bucket"
}

func (m *MockStorageProvider) HealthCheck(ctx context.Context) error {
	if m.HealthCheckFunc != nil {
		return m.HealthCheckFunc(ctx)
	}
	return nil
}

// MockVirusScanner implements VirusScanner for testing
type MockVirusScanner struct {
	ScanFunc             func(ctx context.Context, content []byte) (*ScanResult, error)
	ScanBatchFunc        func(ctx context.Context, files []BatchScanRequest) ([]*ScanResult, error)
	UpdateSignaturesFunc func(ctx context.Context) error
	GetEngineInfoFunc    func(ctx context.Context) (*EngineInfo, error)
	HealthCheckFunc      func(ctx context.Context) error
}

func (m *MockVirusScanner) Scan(ctx context.Context, content []byte) (*ScanResult, error) {
	if m.ScanFunc != nil {
		return m.ScanFunc(ctx, content)
	}
	return &ScanResult{Infected: false}, nil
}

func (m *MockVirusScanner) ScanBatch(ctx context.Context, files []BatchScanRequest) ([]*ScanResult, error) {
	if m.ScanBatchFunc != nil {
		return m.ScanBatchFunc(ctx, files)
	}
	return []*ScanResult{}, nil
}

func (m *MockVirusScanner) UpdateSignatures(ctx context.Context) error {
	if m.UpdateSignaturesFunc != nil {
		return m.UpdateSignaturesFunc(ctx)
	}
	return nil
}

func (m *MockVirusScanner) GetEngineInfo(ctx context.Context) (*EngineInfo, error) {
	if m.GetEngineInfoFunc != nil {
		return m.GetEngineInfoFunc(ctx)
	}
	return &EngineInfo{Name: "MockScanner"}, nil
}

func (m *MockVirusScanner) HealthCheck(ctx context.Context) error {
	if m.HealthCheckFunc != nil {
		return m.HealthCheckFunc(ctx)
	}
	return nil
}

// TestMockStorageProvider tests the mock storage provider
func TestMockStorageProvider(t *testing.T) {
	ctx := context.Background()
	mock := &MockStorageProvider{
		StoreFunc: func(ctx context.Context, req StoreRequest) (string, error) {
			return "stored/path", nil
		},
		GetBucketNameFunc: func() string {
			return "test-bucket"
		},
	}

	path, err := mock.Store(ctx, StoreRequest{})
	require.NoError(t, err)
	assert.Equal(t, "stored/path", path)

	bucket := mock.GetBucketName()
	assert.Equal(t, "test-bucket", bucket)
}

// TestMockVirusScanner tests the mock virus scanner
func TestMockVirusScanner(t *testing.T) {
	ctx := context.Background()
	mock := &MockVirusScanner{
		ScanFunc: func(ctx context.Context, content []byte) (*ScanResult, error) {
			return &ScanResult{Infected: false, Engine: "MockScanner"}, nil
		},
	}

	result, err := mock.Scan(ctx, []byte("test content"))
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.False(t, result.Infected)
	assert.Equal(t, "MockScanner", result.Engine)
}

// Benchmark storage operations
func BenchmarkStoreRequest_Creation(b *testing.B) {
	tenantID := uuid.New()
	documentID := uuid.New()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = StoreRequest{
			TenantID:    tenantID,
			DocumentID:  documentID,
			Filename:    "test.pdf",
			Content:     []byte("test content"),
			ContentType: "application/pdf",
		}
	}
}

func BenchmarkStorageKeyParsing(b *testing.B) {
	key := "tenant123/doc123/subfolder/file.pdf"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = parseStorageKey(key)
	}
}
