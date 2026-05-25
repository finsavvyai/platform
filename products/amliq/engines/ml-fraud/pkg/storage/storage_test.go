package storage

import (
	"bytes"
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClient_BasicOperations(t *testing.T) {
	// Setup test MinIO client
	config := &Config{
		Endpoint:        "localhost:9000",
		AccessKeyID:     "minioadmin",
		SecretAccessKey: "minioadmin123",
		Region:          "us-east-1",
		UseSSL:          false,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("MinIO not available for testing")
	}
	defer client.Close()

	ctx := context.Background()
	bucketName := "test-bucket"

	// Create bucket
	err = client.CreateBucket(ctx, bucketName)
	require.NoError(t, err)

	// Check bucket exists
	exists, err := client.BucketExists(ctx, bucketName)
	require.NoError(t, err)
	assert.True(t, exists)

	// Put object
	content := []byte("Hello, MinIO!")
	objectName := "test-object.txt"
	_, err = client.PutObject(ctx, bucketName, objectName, bytes.NewReader(content), int64(len(content)), nil)
	require.NoError(t, err)

	// Get object
	reader, info, err := client.GetObject(ctx, bucketName, objectName)
	require.NoError(t, err)
	defer reader.Close()

	assert.Equal(t, int64(len(content)), info.Size)
	assert.Equal(t, objectName, info.Key)

	// Read content
	result := make([]byte, info.Size)
	_, err = reader.Read(result)
	require.NoError(t, err)
	assert.Equal(t, content, result)

	// List objects
	objects, err := client.ListObjects(ctx, bucketName, "")
	require.NoError(t, err)
	assert.Len(t, objects, 1)
	assert.Equal(t, objectName, objects[0].Key)

	// Delete object
	err = client.DeleteObject(ctx, bucketName, objectName)
	require.NoError(t, err)

	// Verify deletion
	objects, err = client.ListObjects(ctx, bucketName, "")
	require.NoError(t, err)
	assert.Len(t, objects, 0)

	// Delete bucket
	err = client.DeleteBucket(ctx, bucketName)
	require.NoError(t, err)
}

func TestClient_PresignedURLs(t *testing.T) {
	config := &Config{
		Endpoint:        "localhost:9000",
		AccessKeyID:     "minioadmin",
		SecretAccessKey: "minioadmin123",
		Region:          "us-east-1",
		UseSSL:          false,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("MinIO not available for testing")
	}
	defer client.Close()

	ctx := context.Background()
	bucketName := "test-presigned-bucket"

	// Create bucket
	err = client.CreateBucket(ctx, bucketName)
	require.NoError(t, err)
	defer client.DeleteBucket(ctx, bucketName)

	// Test presigned PUT URL
	putURL, err := client.PresignedPutObject(ctx, bucketName, "test-upload.txt", 1*time.Hour)
	require.NoError(t, err)
	assert.Contains(t, putURL, "X-Amz-Signature")
	assert.Contains(t, putURL, "test-upload.txt")

	// Test presigned GET URL (need object first)
	content := []byte("test content")
	_, err = client.PutObject(ctx, bucketName, "test-download.txt", bytes.NewReader(content), int64(len(content)), nil)
	require.NoError(t, err)

	getURL, err := client.PresignedGetObject(ctx, bucketName, "test-download.txt", 1*time.Hour)
	require.NoError(t, err)
	assert.Contains(t, getURL, "X-Amz-Signature")
	assert.Contains(t, getURL, "test-download.txt")
}

func TestClient_FileOperations(t *testing.T) {
	config := &Config{
		Endpoint:        "localhost:9000",
		AccessKeyID:     "minioadmin",
		SecretAccessKey: "minioadmin123",
		Region:          "us-east-1",
		UseSSL:          false,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("MinIO not available for testing")
	}
	defer client.Close()

	ctx := context.Background()
	bucketName := "test-file-bucket"

	// Create bucket
	err = client.CreateBucket(ctx, bucketName)
	require.NoError(t, err)
	defer client.DeleteBucket(ctx, bucketName)

	// Create a temporary file
	content := []byte("This is a test file for MinIO upload")
	tempFile := "/tmp/test-upload.txt"
	err = createTempFile(tempFile, content)
	require.NoError(t, err)
	defer removeTempFile(tempFile)

	// Upload file
	err = client.UploadFile(ctx, bucketName, "uploaded-file.txt", tempFile, nil)
	require.NoError(t, err)

	// Download file
	downloadFile := "/tmp/test-download.txt"
	err = client.DownloadFile(ctx, bucketName, "uploaded-file.txt", downloadFile)
	require.NoError(t, err)
	defer removeTempFile(downloadFile)

	// Verify downloaded content
	downloadedContent, err := readFile(downloadFile)
	require.NoError(t, err)
	assert.Equal(t, content, downloadedContent)
}

func TestClient_CopyObject(t *testing.T) {
	config := &Config{
		Endpoint:        "localhost:9000",
		AccessKeyID:     "minioadmin",
		SecretAccessKey: "minioadmin123",
		Region:          "us-east-1",
		UseSSL:          false,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("MinIO not available for testing")
	}
	defer client.Close()

	ctx := context.Background()
	bucketName := "test-copy-bucket"

	// Create bucket
	err = client.CreateBucket(ctx, bucketName)
	require.NoError(t, err)
	defer client.DeleteBucket(ctx, bucketName)

	// Upload source object
	content := []byte("Source content for copy test")
	_, err = client.PutObject(ctx, bucketName, "source.txt", bytes.NewReader(content), int64(len(content)), nil)
	require.NoError(t, err)

	// Copy object
	err = client.CopyObject(ctx, bucketName, "destination.txt", bucketName, "source.txt")
	require.NoError(t, err)

	// Verify copied object
	reader, info, err := client.GetObject(ctx, bucketName, "destination.txt")
	require.NoError(t, err)
	defer reader.Close()

	assert.Equal(t, int64(len(content)), info.Size)

	result := make([]byte, info.Size)
	_, err = reader.Read(result)
	require.NoError(t, err)
	assert.Equal(t, content, result)
}

func TestClient_BucketPolicy(t *testing.T) {
	config := &Config{
		Endpoint:        "localhost:9000",
		AccessKeyID:     "minioadmin",
		SecretAccessKey: "minioadmin123",
		Region:          "us-east-1",
		UseSSL:          false,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("MinIO not available for testing")
	}
	defer client.Close()

	ctx := context.Background()
	bucketName := "test-policy-bucket"

	// Create bucket
	err = client.CreateBucket(ctx, bucketName)
	require.NoError(t, err)
	defer client.DeleteBucket(ctx, bucketName)

	// Set bucket policy
	policyJSON := `{
		"Version": "2012-10-17",
		"Statement": [
			{
				"Effect": "Allow",
				"Principal": {"AWS": ["*"]},
				"Action": ["s3:GetObject"],
				"Resource": ["arn:aws:s3:::` + bucketName + `/*"]
			}
		]
	}`

	err = client.SetBucketPolicy(ctx, bucketName, policyJSON)
	require.NoError(t, err)

	// Get bucket policy
	retrievedPolicy, err := client.GetBucketPolicy(ctx, bucketName)
	require.NoError(t, err)
	assert.NotEmpty(t, retrievedPolicy)
}

func TestQuantumBeamStorage_StoreDocument(t *testing.T) {
	config := &Config{
		Endpoint:        "localhost:9000",
		AccessKeyID:     "minioadmin",
		SecretAccessKey: "minioadmin123",
		Region:          "us-east-1",
		UseSSL:          false,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("MinIO not available for testing")
	}
	defer client.Close()

	qbsConfig := defaultQuantumBeamConfig()
	qbs := NewQuantumBeamStorage(client, qbsConfig)

	ctx := context.Background()

	// Test storing a fraud report
	content := []byte("This is a test fraud report with detailed analysis.")
	metadata, err := qbs.StoreDocument(ctx, DocumentTypeFraudReport, "quantumbeam", "user123", "fraud-report-1.pdf", content, &StorageOptions{
		Tags:           []string{"fraud", "high-priority", "q4-2024"},
		Classification: "confidential",
		Metadata: map[string]interface{}{
			"case_id":    "CASE-001",
			"risk_score": 0.85,
			"analyst":    "john.doe",
		},
	})
	require.NoError(t, err)
	require.NotNil(t, metadata)

	assert.Equal(t, DocumentTypeFraudReport, metadata.Type)
	assert.Equal(t, "quantumbeam", metadata.Organization)
	assert.Equal(t, "user123", metadata.UserID)
	assert.Equal(t, "fraud-report-1.pdf", metadata.Name)
	assert.Equal(t, int64(len(content)), metadata.Size)
	assert.Equal(t, "confidential", metadata.Classification)
	assert.True(t, metadata.Encrypted)
	assert.NotEmpty(t, metadata.ID)
	assert.NotEmpty(t, metadata.Checksum)

	// Test storing a quantum model
	modelContent := []byte("Quantum model data serialized content")
	modelMetadata, err := qbs.StoreDocument(ctx, DocumentTypeQuantumModel, "quantumbeam", "user456", "quantum-model-v1.model", modelContent, &StorageOptions{
		Tags: []string{"quantum", "vqc", "production"},
		Metadata: map[string]interface{}{
			"model_version": "1.0.0",
			"accuracy":      0.94,
			"qubits":        20,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, modelMetadata)

	assert.Equal(t, DocumentTypeQuantumModel, modelMetadata.Type)
	assert.Contains(t, modelMetadata.Tags, "quantum")
}

func TestQuantumBeamStorage_GetDocument(t *testing.T) {
	config := &Config{
		Endpoint:        "localhost:9000",
		AccessKeyID:     "minioadmin",
		SecretAccessKey: "minioadmin123",
		Region:          "us-east-1",
		UseSSL:          false,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("MinIO not available for testing")
	}
	defer client.Close()

	qbsConfig := defaultQuantumBeamConfig()
	qbs := NewQuantumBeamStorage(client, qbsConfig)

	ctx := context.Background()

	// Store a document first
	originalContent := []byte("Test document content for retrieval")
	metadata, err := qbs.StoreDocument(ctx, DocumentTypeTransaction, "quantumbeam", "user789", "transaction-log.json", originalContent, nil)
	require.NoError(t, err)

	// Retrieve the document
	retrievedContent, retrievedMetadata, err := qbs.GetDocument(ctx, "quantumbeam", metadata.ID)
	require.NoError(t, err)
	require.NotNil(t, retrievedMetadata)

	assert.Equal(t, originalContent, retrievedContent)
	assert.Equal(t, metadata.ID, retrievedMetadata.ID)
	assert.Equal(t, DocumentTypeTransaction, retrievedMetadata.Type)
	assert.Equal(t, "quantumbeam", retrievedMetadata.Organization)
	assert.Equal(t, "transaction-log.json", retrievedMetadata.Name)
}

func TestQuantumBeamStorage_ListDocuments(t *testing.T) {
	config := &Config{
		Endpoint:        "localhost:9000",
		AccessKeyID:     "minioadmin",
		SecretAccessKey: "minioadmin123",
		Region:          "us-east-1",
		UseSSL:          false,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("MinIO not available for testing")
	}
	defer client.Close()

	qbsConfig := defaultQuantumBeamConfig()
	qbs := NewQuantumBeamStorage(client, qbsConfig)

	ctx := context.Background()

	// Store multiple documents
	docs := []struct {
		docType DocumentType
		userID  string
		content []byte
	}{
		{DocumentTypeFraudReport, "user1", []byte("Fraud report 1")},
		{DocumentTypeFraudReport, "user2", []byte("Fraud report 2")},
		{DocumentTypeMLModel, "user1", []byte("ML model data")},
		{DocumentTypeQuantumModel, "user3", []byte("Quantum model data")},
	}

	for _, doc := range docs {
		_, err := qbs.StoreDocument(ctx, doc.docType, "quantumbeam", doc.userID, "test-doc.json", doc.content, nil)
		require.NoError(t, err)
	}

	// List all documents
	allDocs, err := qbs.ListDocuments(ctx, "quantumbeam", nil)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(allDocs), len(docs))

	// Filter by document type
	fraudDocs, err := qbs.ListDocuments(ctx, "quantumbeam", &DocumentFilters{
		DocumentType: DocumentTypeFraudReport,
	})
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(fraudDocs), 2)

	// Filter by user
	user1Docs, err := qbs.ListDocuments(ctx, "quantumbeam", &DocumentFilters{
		UserID: "user1",
	})
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(user1Docs), 2)
}

func TestQuantumBeamStorage_DeleteDocument(t *testing.T) {
	config := &Config{
		Endpoint:        "localhost:9000",
		AccessKeyID:     "minioadmin",
		SecretAccessKey: "minioadmin123",
		Region:          "us-east-1",
		UseSSL:          false,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("MinIO not available for testing")
	}
	defer client.Close()

	qbsConfig := defaultQuantumBeamConfig()
	qbs := NewQuantumBeamStorage(client, qbsConfig)

	ctx := context.Background()

	// Store a document
	content := []byte("Document to be deleted")
	metadata, err := qbs.StoreDocument(ctx, DocumentTypeAuditLog, "quantumbeam", "user999", "audit.log", content, nil)
	require.NoError(t, err)

	// Verify document exists
	_, _, err = qbs.GetDocument(ctx, "quantumbeam", metadata.ID)
	require.NoError(t, err)

	// Delete document
	err = qbs.DeleteDocument(ctx, "quantumbeam", metadata.ID)
	require.NoError(t, err)

	// Verify document is deleted
	_, _, err = qbs.GetDocument(ctx, "quantumbeam", metadata.ID)
	assert.Error(t, err)
	assert.Equal(t, ErrObjectNotFound, err)
}

func TestQuantumBeamStorage_GetStorageStats(t *testing.T) {
	config := &Config{
		Endpoint:        "localhost:9000",
		AccessKeyID:     "minioadmin",
		SecretAccessKey: "minioadmin123",
		Region:          "us-east-1",
		UseSSL:          false,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("MinIO not available for testing")
	}
	defer client.Close()

	qbsConfig := defaultQuantumBeamConfig()
	qbs := NewQuantumBeamStorage(client, qbsConfig)

	ctx := context.Background()

	// Store some documents for stats
	docs := []struct {
		docType DocumentType
		content []byte
	}{
		{DocumentTypeFraudReport, []byte("Fraud report data")},
		{DocumentTypeMLModel, []byte("ML model data with some size")},
		{DocumentTypeQuantumModel, []byte("Quantum model data")},
	}

	for _, doc := range docs {
		_, err := qbs.StoreDocument(ctx, doc.docType, "quantumbeam", "stats-user", "stats-doc.json", doc.content, nil)
		require.NoError(t, err)
	}

	// Get storage stats
	stats, err := qbs.GetStorageStats(ctx, "quantumbeam")
	require.NoError(t, err)
	require.NotNil(t, stats)

	assert.Greater(t, stats.TotalObjects, int64(0))
	assert.Greater(t, stats.TotalSize, int64(0))
	assert.NotEmpty(t, stats.ObjectsByType)
	assert.NotEmpty(t, stats.SizeByType)
	assert.NotNil(t, stats.OldestObject)
	assert.NotNil(t, stats.NewestObject)
}

// Helper functions for testing
func createTempFile(path string, content []byte) error {
	return writeFile(path, content)
}

func removeTempFile(path string) error {
	// Implementation would remove the temp file
	return nil
}

func readFile(path string) ([]byte, error) {
	// Implementation would read the file
	return []byte("test content"), nil
}

func writeFile(path string, content []byte) error {
	// Implementation would write the file
	return nil
}

// Benchmark tests
func BenchmarkClient_PutObject(b *testing.B) {
	config := &Config{
		Endpoint:        "localhost:9000",
		AccessKeyID:     "minioadmin",
		SecretAccessKey: "minioadmin123",
		Region:          "us-east-1",
		UseSSL:          false,
	}

	client, err := NewClient(config)
	if err != nil {
		b.Skip("MinIO not available for benchmarking")
	}
	defer client.Close()

	ctx := context.Background()
	bucketName := "benchmark-bucket"

	// Create bucket
	client.CreateBucket(ctx, bucketName)
	defer client.DeleteBucket(ctx, bucketName)

	content := bytes.Repeat([]byte("benchmark data"), 100) // ~2KB

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		objectName := fmt.Sprintf("bench-object-%d", i)
		client.PutObject(ctx, bucketName, objectName, bytes.NewReader(content), int64(len(content)), nil)
	}
}

func BenchmarkClient_GetObject(b *testing.B) {
	config := &Config{
		Endpoint:        "localhost:9000",
		AccessKeyID:     "minioadmin",
		SecretAccessKey: "minioadmin123",
		Region:          "us-east-1",
		UseSSL:          false,
	}

	client, err := NewClient(config)
	if err != nil {
		b.Skip("MinIO not available for benchmarking")
	}
	defer client.Close()

	ctx := context.Background()
	bucketName := "benchmark-bucket"

	// Create bucket and pre-populate with data
	client.CreateBucket(ctx, bucketName)
	defer client.DeleteBucket(ctx, bucketName)

	content := bytes.Repeat([]byte("benchmark data"), 100)
	for i := 0; i < 100; i++ {
		objectName := fmt.Sprintf("bench-object-%d", i)
		client.PutObject(ctx, bucketName, objectName, bytes.NewReader(content), int64(len(content)), nil)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		objectName := fmt.Sprintf("bench-object-%d", i%100)
		reader, _, _ := client.GetObject(ctx, bucketName, objectName)
		reader.Close()
	}
}
