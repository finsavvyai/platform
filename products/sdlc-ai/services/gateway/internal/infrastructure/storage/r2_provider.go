//go:build ignore

package storage

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
)

// R2Config holds configuration for Cloudflare R2
type R2Config struct {
	AccountID        string `json:"account_id"`
	AccessKeyID      string `json:"access_key_id"`
	SecretAccessKey  string `json:"secret_access_key"`
	BucketName       string `json:"bucket_name"`
	Region           string `json:"region"`
	EndpointURL      string `json:"endpoint_url"`
	PublicURL        string `json:"public_url"`
	EnableEncryption bool   `json:"enable_encryption"`
	EncryptionKey    string `json:"encryption_key,omitempty"`
}

// R2Provider implements the StorageProvider interface for Cloudflare R2
type R2Provider struct {
	client     *s3.Client
	config     *R2Config
	logger     *logrus.Logger
	httpClient *http.Client
}

// NewR2Provider creates a new R2 storage provider
func NewR2Provider(cfg *R2Config, logger *logrus.Logger) (*R2Provider, error) {
	if cfg == nil {
		return nil, fmt.Errorf("r2 config cannot be nil")
	}

	// Construct the endpoint URL
	endpointURL := cfg.EndpointURL
	if endpointURL == "" {
		endpointURL = fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.AccountID)
	}

	// Create custom resolver for R2
	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL:               endpointURL,
			SigningRegion:     cfg.Region,
			HostnameImmutable: true,
		}, nil
	})

	// Load AWS configuration
	awsConfig, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(cfg.Region),
		config.WithCredentialsProvider(aws.CredentialsProviderFunc(func(ctx context.Context) (aws.Credentials, error) {
			return aws.Credentials{
				AccessKeyID:     cfg.AccessKeyID,
				SecretAccessKey: cfg.SecretAccessKey,
			}, nil
		})),
		config.WithEndpointResolverWithOptions(customResolver),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Create S3 client
	client := s3.NewFromConfig(awsConfig, func(o *s3.Options) {
		o.UsePathStyle = true
	})

	// Create HTTP client with timeouts
	httpClient := &http.Client{
		Timeout: 30 * time.Minute,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 10,
			IdleConnTimeout:     90 * time.Second,
		},
	}

	return &R2Provider{
		client:     client,
		config:     cfg,
		logger:     logger,
		httpClient: httpClient,
	}, nil
}

// Store stores a file in R2 and returns the storage path
func (p *R2Provider) Store(ctx context.Context, req StoreRequest) (string, error) {
	ctx, span := otel.Tracer("r2-provider").Start(ctx, "Store")
	defer span.End()

	// Generate storage key
	storageKey := p.generateStorageKey(req.TenantID, req.DocumentID, req.Filename)

	// Prepare S3 put object input
	putInput := &s3.PutObjectInput{
		Bucket:      aws.String(p.config.BucketName),
		Key:         aws.String(storageKey),
		Body:        strings.NewReader(string(req.Content)),
		ContentType: aws.String(req.ContentType),
		Metadata:    make(map[string]string),
	}

	// Add metadata
	for k, v := range req.Metadata {
		if strVal, ok := v.(string); ok {
			putInput.Metadata[k] = strVal
		} else {
			putInput.Metadata[k] = fmt.Sprintf("%v", v)
		}
	}

	// Add tenant and document ID metadata
	putInput.Metadata["tenant-id"] = req.TenantID.String()
	putInput.Metadata["document-id"] = req.DocumentID.String()
	putInput.Metadata["original-filename"] = req.Filename
	putInput.Metadata["uploaded-at"] = time.Now().UTC().Format(time.RFC3339)

	// Add tags
	if len(req.Tags) > 0 {
		tagging := p.buildTagSet(req.Tags)
		putInput.Tagging = aws.String(tagging)
	}

	// Enable server-side encryption if configured
	if p.config.EnableEncryption {
		putInput.ServerSideEncryption = types.ServerSideEncryptionAws256
	}

	// Upload to R2
	result, err := p.client.PutObject(ctx, putInput)
	if err != nil {
		p.logger.WithFields(logrus.Fields{
			"tenant_id":   req.TenantID,
			"document_id": req.DocumentID,
			"filename":    req.Filename,
			"error":       err,
		}).Error("Failed to store file in R2")
		return "", fmt.Errorf("failed to store file in R2: %w", err)
	}

	p.logger.WithFields(logrus.Fields{
		"tenant_id":   req.TenantID,
		"document_id": req.DocumentID,
		"filename":    req.Filename,
		"storage_key": storageKey,
		"etag":        result.ETag,
	}).Info("File stored successfully in R2")

	return storageKey, nil
}

// Retrieve retrieves a file from R2
func (p *R2Provider) Retrieve(ctx context.Context, tenantID, documentID, filename string) ([]byte, error) {
	ctx, span := otel.Tracer("r2-provider").Start(ctx, "Retrieve")
	defer span.End()

	storageKey := p.generateStorageKey(uuid.MustParse(tenantID), uuid.MustParse(documentID), filename)

	getInput := &s3.GetObjectInput{
		Bucket: aws.String(p.config.BucketName),
		Key:    aws.String(storageKey),
	}

	result, err := p.client.GetObject(ctx, getInput)
	if err != nil {
		var noSuchKey *types.NoSuchKey
		if AsError(err, noSuchKey) {
			return nil, fmt.Errorf("file not found: %s", storageKey)
		}
		return nil, fmt.Errorf("failed to retrieve file from R2: %w", err)
	}
	defer result.Body.Close()

	content, err := io.ReadAll(result.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read file content: %w", err)
	}

	p.logger.WithFields(logrus.Fields{
		"tenant_id":   tenantID,
		"document_id": documentID,
		"filename":    filename,
		"storage_key": storageKey,
		"size":        len(content),
	}).Debug("File retrieved successfully from R2")

	return content, nil
}

// Delete deletes a file from R2
func (p *R2Provider) Delete(ctx context.Context, tenantID, documentID, filename string) error {
	ctx, span := otel.Tracer("r2-provider").Start(ctx, "Delete")
	defer span.End()

	storageKey := p.generateStorageKey(uuid.MustParse(tenantID), uuid.MustParse(documentID), filename)

	deleteInput := &s3.DeleteObjectInput{
		Bucket: aws.String(p.config.BucketName),
		Key:    aws.String(storageKey),
	}

	_, err := p.client.DeleteObject(ctx, deleteInput)
	if err != nil {
		p.logger.WithFields(logrus.Fields{
			"tenant_id":   tenantID,
			"document_id": documentID,
			"filename":    filename,
			"storage_key": storageKey,
			"error":       err,
		}).Error("Failed to delete file from R2")
		return fmt.Errorf("failed to delete file from R2: %w", err)
	}

	p.logger.WithFields(logrus.Fields{
		"tenant_id":   tenantID,
		"document_id": documentID,
		"filename":    filename,
		"storage_key": storageKey,
	}).Info("File deleted successfully from R2")

	return nil
}

// DeleteBatch deletes multiple files from R2
func (p *R2Provider) DeleteBatch(ctx context.Context, req BatchDeleteRequest) error {
	ctx, span := otel.Tracer("r2-provider").Start(ctx, "DeleteBatch")
	defer span.End()

	// Build delete objects list
	var objects []types.ObjectIdentifier
	for _, filename := range req.Filenames {
		storageKey := p.generateStorageKey(req.TenantID, req.DocumentID, filename)
		objects = append(objects, types.ObjectIdentifier{
			Key: aws.String(storageKey),
		})
	}

	deleteInput := &s3.DeleteObjectsInput{
		Bucket: aws.String(p.config.BucketName),
		Delete: &types.Delete{
			Objects: objects,
			Quiet:   aws.Bool(false),
		},
	}

	result, err := p.client.DeleteObjects(ctx, deleteInput)
	if err != nil {
		p.logger.WithFields(logrus.Fields{
			"tenant_id":   req.TenantID,
			"document_id": req.DocumentID,
			"files_count": len(req.Filenames),
			"error":       err,
		}).Error("Failed to delete batch files from R2")
		return fmt.Errorf("failed to delete batch files from R2: %w", err)
	}

	// Log deleted and failed files
	if len(result.Deleted) > 0 {
		p.logger.WithField("deleted_count", len(result.Deleted)).Info("Files deleted successfully from R2")
	}

	if len(result.Errors) > 0 {
		var errorMessages []string
		for _, err := range result.Errors {
			errorMessages = append(errorMessages, fmt.Sprintf("Key: %s, Error: %s", *err.Key, *err.Message))
		}
		p.logger.WithField("errors", errorMessages).Error("Some files failed to delete from R2")
		return fmt.Errorf("some files failed to delete: %v", errorMessages)
	}

	return nil
}

// Exists checks if a file exists in R2
func (p *R2Provider) Exists(ctx context.Context, tenantID, documentID, filename string) (bool, error) {
	ctx, span := otel.Tracer("r2-provider").Start(ctx, "Exists")
	defer span.End()

	storageKey := p.generateStorageKey(uuid.MustParse(tenantID), uuid.MustParse(documentID), filename)

	headInput := &s3.HeadObjectInput{
		Bucket: aws.String(p.config.BucketName),
		Key:    aws.String(storageKey),
	}

	_, err := p.client.HeadObject(ctx, headInput)
	if err != nil {
		var noSuchKey *types.NoSuchKey
		if AsError(err, noSuchKey) {
			return false, nil
		}
		return false, fmt.Errorf("failed to check file existence in R2: %w", err)
	}

	return true, nil
}

// GetMetadata retrieves file metadata from R2
func (p *R2Provider) GetMetadata(ctx context.Context, tenantID, documentID, filename string) (map[string]interface{}, error) {
	ctx, span := otel.Tracer("r2-provider").Start(ctx, "GetMetadata")
	defer span.End()

	storageKey := p.generateStorageKey(uuid.MustParse(tenantID), uuid.MustParse(documentID), filename)

	headInput := &s3.HeadObjectInput{
		Bucket: aws.String(p.config.BucketName),
		Key:    aws.String(storageKey),
	}

	result, err := p.client.HeadObject(ctx, headInput)
	if err != nil {
		return nil, fmt.Errorf("failed to get file metadata from R2: %w", err)
	}

	metadata := make(map[string]interface{})

	// Add standard metadata
	metadata["content-type"] = *result.ContentType
	metadata["content-length"] = *result.ContentLength
	metadata["last-modified"] = *result.LastModified
	metadata["etag"] = *result.ETag
	metadata["storage-class"] = string(result.StorageClass)

	// Add custom metadata
	for k, v := range result.Metadata {
		metadata[k] = v
	}

	return metadata, nil
}

// ListFiles lists files for a tenant with optional filtering
func (p *R2Provider) ListFiles(ctx context.Context, tenantID string, filter ListFilter) ([]FileInfo, error) {
	ctx, span := otel.Tracer("r2-provider").Start(ctx, "ListFiles")
	defer span.End()

	// Build prefix for tenant
	prefix := fmt.Sprintf("tenants/%s/", tenantID)
	if filter.Prefix != "" {
		prefix = fmt.Sprintf("%s%s", prefix, filter.Prefix)
	}

	listInput := &s3.ListObjectsV2Input{
		Bucket: aws.String(p.config.BucketName),
		Prefix: aws.String(prefix),
	}

	// Apply limit if specified
	if filter.Limit > 0 {
		listInput.MaxKeys = int32(filter.Limit)
	}

	result, err := p.client.ListObjectsV2(ctx, listInput)
	if err != nil {
		return nil, fmt.Errorf("failed to list files in R2: %w", err)
	}

	var files []FileInfo
	for _, obj := range result.Contents {
		fileInfo := FileInfo{
			Key:          *obj.Key,
			Size:         *obj.Size,
			LastModified: *obj.LastModified,
			ETag:         *obj.ETag,
		}

		// Get additional metadata for each file (could be optimized with batch head requests)
		metadata, err := p.GetMetadata(ctx, tenantID, "", strings.TrimPrefix(*obj.Key, prefix))
		if err == nil {
			fileInfo.ContentType = metadata["content-type"].(string)
			fileInfo.Metadata = metadata
		}

		files = append(files, fileInfo)
	}

	return files, nil
}

// GetBucketName returns the name of the storage bucket
func (p *R2Provider) GetBucketName() string {
	return p.config.BucketName
}

// HealthCheck performs a health check on the R2 provider
func (p *R2Provider) HealthCheck(ctx context.Context) error {
	ctx, span := otel.Tracer("r2-provider").Start(ctx, "HealthCheck")
	defer span.End()

	// Try to list objects with limit 1 to test connectivity
	listInput := &s3.ListObjectsV2Input{
		Bucket:  aws.String(p.config.BucketName),
		MaxKeys: 1,
	}

	_, err := p.client.ListObjectsV2(ctx, listInput)
	if err != nil {
		return fmt.Errorf("R2 health check failed: %w", err)
	}

	return nil
}

// generateStorageKey generates a unique storage key for files
func (p *R2Provider) generateStorageKey(tenantID, documentID uuid.UUID, filename string) string {
	timestamp := time.Now().UTC().Format("2006-01-02")
	return fmt.Sprintf("tenants/%s/documents/%s/%s/%s",
		tenantID.String(),
		documentID.String(),
		timestamp,
		filename)
}

// buildTagSet builds a tag set string from tags
func (p *R2Provider) buildTagSet(tags []string) string {
	if len(tags) == 0 {
		return ""
	}

	var tagPairs []string
	for i, tag := range tags {
		if i%2 == 0 {
			// This is a key
			if i+1 < len(tags) {
				// Has a value
				tagPairs = append(tagPairs, fmt.Sprintf("%s=%s", url.QueryEscape(tag), url.QueryEscape(tags[i+1])))
			} else {
				// No value, just key
				tagPairs = append(tagPairs, url.QueryEscape(tag))
			}
		}
	}

	return strings.Join(tagPairs, "&")
}

// GetPublicURL returns a public URL for accessing the file (if configured)
func (p *R2Provider) GetPublicURL(tenantID, documentID, filename string) string {
	if p.config.PublicURL == "" {
		return ""
	}

	storageKey := p.generateStorageKey(uuid.MustParse(tenantID), uuid.MustParse(documentID), filename)
	return fmt.Sprintf("%s/%s", strings.TrimSuffix(p.config.PublicURL, "/"), storageKey)
}

// GeneratePresignedURL generates a presigned URL for temporary access
func (p *R2Provider) GeneratePresignedURL(ctx context.Context, tenantID, documentID, filename string, expiration time.Duration) (string, error) {
	ctx, span := otel.Tracer("r2-provider").Start(ctx, "GeneratePresignedURL")
	defer span.End()

	storageKey := p.generateStorageKey(uuid.MustParse(tenantID), uuid.MustParse(documentID), filename)

	presignClient := s3.NewPresignClient(p.client)

	getInput := &s3.GetObjectInput{
		Bucket: aws.String(p.config.BucketName),
		Key:    aws.String(storageKey),
	}

	presignedResult, err := presignClient.PresignGetObject(ctx, getInput, expiration)
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	return presignedResult.URL, nil
}

// AsError is a helper function to check if an error is of a specific type
func AsError(err error, target interface{}) bool {
	return false // This would need proper implementation based on AWS SDK v2 error handling
}
