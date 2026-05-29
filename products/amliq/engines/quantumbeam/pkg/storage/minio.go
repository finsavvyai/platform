//go:build legacy_migrated
// +build legacy_migrated

// Package storage provides MinIO S3-compatible object storage functionality for QuantumBeam.io
package storage

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/minio/minio-go/v7/pkg/encrypt"
	"github.com/minio/minio-go/v7/pkg/lifecycle"
	"github.com/minio/minio-go/v7/pkg/notification"
	"github.com/minio/minio-go/v7/pkg/policy"
	"github.com/minio/minio-go/v7/pkg/replication"
	"github.com/minio/minio-go/v7/pkg/sse"
	"github.com/minio/minio-go/v7/pkg/tags"
	"github.com/rs/zerolog/log"
)

// Client wraps MinIO operations for QuantumBeam
type Client struct {
	client   *minio.Client
	config   *Config
	region   string
	endpoint string
}

// Config holds MinIO configuration
type Config struct {
	Endpoint        string
	AccessKeyID     string
	SecretAccessKey string
	Region          string
	UseSSL          bool
	BucketName      string
	SessionToken    string
	CustomTransport http.RoundTripper
	EncryptionKey   []byte
}

// ObjectInfo contains information about an object
type ObjectInfo struct {
	Key          string            `json:"key"`
	Size         int64             `json:"size"`
	ETag         string            `json:"etag"`
	ContentType  string            `json:"content_type"`
	LastModified time.Time         `json:"last_modified"`
	StorageClass string            `json:"storage_class"`
	Owner        string            `json:"owner"`
	Metadata     map[string]string `json:"metadata"`
	Tags         map[string]string `json:"tags"`
}

// UploadOptions contains options for uploading objects
type UploadOptions struct {
	ContentType          string
	Metadata             map[string]string
	Tags                 map[string]string
	StorageClass         string
	ServerSideEncryption string
	Progress             io.Reader
	Expires              time.Time
}

// BucketPolicy defines bucket access policies
type BucketPolicy struct {
	Version   string            `json:"version"`
	Statement []PolicyStatement `json:"statement"`
}

// PolicyStatement represents a single policy statement
type PolicyStatement struct {
	Effect    string            `json:"effect"`
	Principal map[string]string `json:"principal"`
	Action    []string          `json:"action"`
	Resource  []string          `json:"resource"`
}

// NewClient creates a new MinIO client with the given configuration
func NewClient(config *Config) (*Client, error) {
	if config == nil {
		config = defaultConfig()
	}

	// Initialize MinIO client
	var client *minio.Client
	var err error

	if config.CustomTransport != nil {
		client, err = minio.New(config.Endpoint, &minio.Options{
			Creds:     credentials.NewStaticV4(config.AccessKeyID, config.SecretAccessKey, config.SessionToken),
			Secure:    config.UseSSL,
			Region:    config.Region,
			Transport: config.CustomTransport,
		})
	} else {
		client, err = minio.New(config.Endpoint, &minio.Options{
			Creds:  credentials.NewStaticV4(config.AccessKeyID, config.SecretAccessKey, config.SessionToken),
			Secure: config.UseSSL,
			Region: config.Region,
		})
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create MinIO client: %w", err)
	}

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = client.ListBuckets(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MinIO: %w", err)
	}

	log.Info().
		Str("endpoint", config.Endpoint).
		Str("region", config.Region).
		Bool("ssl", config.UseSSL).
		Msg("Successfully connected to MinIO")

	return &Client{
		client:   client,
		config:   config,
		region:   config.Region,
		endpoint: config.Endpoint,
	}, nil
}

// defaultConfig returns default MinIO configuration
func defaultConfig() *Config {
	return &Config{
		Endpoint:        "localhost:9000",
		AccessKeyID:     "minioadmin",
		SecretAccessKey: "minioadmin123",
		Region:          "us-east-1",
		UseSSL:          false,
		BucketName:      "quantumbeam-storage",
	}
}

// CreateBucket creates a new bucket with the specified name and options
func (c *Client) CreateBucket(ctx context.Context, bucketName string, opts ...minio.MakeBucketOptions) error {
	if bucketName == "" {
		return fmt.Errorf("bucket name cannot be empty")
	}

	// Set default options
	var options minio.MakeBucketOptions
	if len(opts) > 0 {
		options = opts[0]
	}

	if options.Region == "" {
		options.Region = c.region
	}

	err := c.client.MakeBucket(ctx, bucketName, options)
	if err != nil {
		log.Error().Err(err).Str("bucket", bucketName).Msg("Failed to create MinIO bucket")
		return fmt.Errorf("failed to create bucket: %w", err)
	}

	log.Info().
		Str("bucket", bucketName).
		Str("region", options.Region).
		Msg("Bucket created successfully")

	return nil
}

// BucketExists checks if a bucket exists
func (c *Client) BucketExists(ctx context.Context, bucketName string) (bool, error) {
	exists, err := c.client.BucketExists(ctx, bucketName)
	if err != nil {
		log.Error().Err(err).Str("bucket", bucketName).Msg("Failed to check bucket existence")
		return false, fmt.Errorf("failed to check bucket existence: %w", err)
	}

	return exists, nil
}

// ListBuckets returns a list of all buckets
func (c *Client) ListBuckets(ctx context.Context) ([]string, error) {
	buckets, err := c.client.ListBuckets(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list MinIO buckets")
		return nil, fmt.Errorf("failed to list buckets: %w", err)
	}

	var bucketNames []string
	for _, bucket := range buckets {
		bucketNames = append(bucketNames, bucket.Name)
	}

	log.Debug().
		Int("count", len(bucketNames)).
		Msg("Buckets listed successfully")

	return bucketNames, nil
}

// DeleteBucket deletes a bucket
func (c *Client) DeleteBucket(ctx context.Context, bucketName string) error {
	err := c.client.RemoveBucket(ctx, bucketName)
	if err != nil {
		log.Error().Err(err).Str("bucket", bucketName).Msg("Failed to delete MinIO bucket")
		return fmt.Errorf("failed to delete bucket: %w", err)
	}

	log.Info().Str("bucket", bucketName).Msg("Bucket deleted successfully")
	return nil
}

// PutObject uploads an object to MinIO
func (c *Client) PutObject(ctx context.Context, bucketName, objectName string, reader io.Reader, objectSize int64, opts *UploadOptions) (minio.UploadInfo, error) {
	if bucketName == "" || objectName == "" {
		return minio.UploadInfo{}, fmt.Errorf("bucket name and object name cannot be empty")
	}

	// Set default options
	if opts == nil {
		opts = &UploadOptions{}
	}

	// Prepare upload options
	contentType := opts.ContentType
	if contentType == "" {
		// Auto-detect content type based on file extension
		ext := strings.ToLower(filepath.Ext(objectName))
		contentType = getContentType(ext)
	}

	// Create upload context
	uploadCtx := ctx
	if opts.Expires.After(time.Now()) {
		uploadCtx = context.WithValue(ctx, "expires", opts.Expires)
	}

	// Prepare encryption if key is available
	var sseOpts []minio.ServerSideEncryptionOption
	if c.config.EncryptionKey != nil {
		sseOpts = append(sseOpts, encrypt.NewSSE(c.config.EncryptionKey))
	} else if opts.ServerSideEncryption != "" {
		switch opts.ServerSideEncryption {
		case "AES256":
			sseOpts = append(sseOpts, sse.NewSSE())
		case "aws:kms":
			sseOpts = append(sseOpts, sse.NewSSEKMS("aws:kms", ""))
		}
	}

	// Prepare metadata
	metadata := opts.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	// Add system metadata
	metadata["uploaded-by"] = "quantumbeam"
	metadata["upload-time"] = time.Now().Format(time.RFC3339)

	// Prepare user tags
	var tagMap *tags.Tags
	if len(opts.Tags) > 0 {
		tagMap = tags.NewTagsFromMap(opts.Tags)
	}

	// Upload object
	info, err := c.client.PutObject(uploadCtx, bucketName, objectName, reader, objectSize, contentType, sseOpts...)
	if err != nil {
		log.Error().Err(err).
			Str("bucket", bucketName).
			Str("object", objectName).
			Int64("size", objectSize).
			Msg("Failed to upload object to MinIO")
		return minio.UploadInfo{}, fmt.Errorf("failed to upload object: %w", err)
	}

	// Set object tags after upload
	if tagMap != nil {
		err = c.client.PutObjectTagging(ctx, bucketName, objectName, tagMap, minio.PutObjectTaggingOptions{})
		if err != nil {
			log.Warn().Err(err).
				Str("bucket", bucketName).
				Str("object", objectName).
				Msg("Failed to set object tags")
		}
	}

	// Set additional metadata if provided
	if len(metadata) > 0 {
		err = c.client.SetObjectMetadata(ctx, bucketName, objectName, metadata, minio.SetObjectMetadataOptions{})
		if err != nil {
			log.Warn().Err(err).
				Str("bucket", bucketName).
				Str("object", objectName).
				Msg("Failed to set object metadata")
		}
	}

	log.Info().
		Str("bucket", bucketName).
		Str("object", objectName).
		Str("etag", info.ETag).
		Int64("size", info.Size).
		Msg("Object uploaded successfully")

	return info, nil
}

// GetObject downloads an object from MinIO
func (c *Client) GetObject(ctx context.Context, bucketName, objectName string) (io.ReadCloser, *ObjectInfo, error) {
	if bucketName == "" || objectName == "" {
		return nil, nil, fmt.Errorf("bucket name and object name cannot be empty")
	}

	// Get object info first
	objInfo, err := c.client.StatObject(ctx, bucketName, objectName, minio.StatObjectOptions{})
	if err != nil {
		log.Error().Err(err).
			Str("bucket", bucketName).
			Str("object", objectName).
			Msg("Failed to get object info from MinIO")
		return nil, nil, fmt.Errorf("failed to get object info: %w", err)
	}

	// Get object
	object, err := c.client.GetObject(ctx, bucketName, objectName, minio.GetObjectOptions{})
	if err != nil {
		log.Error().Err(err).
			Str("bucket", bucketName).
			Str("object", objectName).
			Msg("Failed to download object from MinIO")
		return nil, nil, fmt.Errorf("failed to download object: %w", err)
	}

	// Get object tags
	tagSet, err := c.client.GetObjectTagging(ctx, bucketName, objectName, minio.GetObjectTaggingOptions{})
	var tags map[string]string
	if err == nil {
		tags = tagSet.ToMap()
	}

	// Convert to our ObjectInfo format
	info := &ObjectInfo{
		Key:          objectName,
		Size:         objInfo.Size,
		ETag:         objInfo.ETag,
		ContentType:  objInfo.ContentType,
		LastModified: objInfo.LastModified,
		StorageClass: objInfo.StorageClass,
		Owner:        objInfo.Owner.DisplayName,
		Metadata:     objInfo.UserMetadata,
		Tags:         tags,
	}

	log.Debug().
		Str("bucket", bucketName).
		Str("object", objectName).
		Int64("size", info.Size).
		Msg("Object downloaded successfully")

	return object, info, nil
}

// DeleteObject deletes an object from MinIO
func (c *Client) DeleteObject(ctx context.Context, bucketName, objectName string) error {
	if bucketName == "" || objectName == "" {
		return fmt.Errorf("bucket name and object name cannot be empty")
	}

	err := c.client.RemoveObject(ctx, bucketName, objectName, minio.RemoveObjectOptions{})
	if err != nil {
		log.Error().Err(err).
			Str("bucket", bucketName).
			Str("object", objectName).
			Msg("Failed to delete object from MinIO")
		return fmt.Errorf("failed to delete object: %w", err)
	}

	log.Info().
		Str("bucket", bucketName).
		Str("object", objectName).
		Msg("Object deleted successfully")

	return nil
}

// DeleteObjects deletes multiple objects from MinIO
func (c *Client) DeleteObjects(ctx context.Context, bucketName string, objectNames []string) error {
	if len(objectNames) == 0 {
		return nil
	}

	objectsCh := make(chan minio.ObjectInfo)

	// Start goroutine to send object names
	go func() {
		defer close(objectsCh)
		for _, objectName := range objectNames {
			objectsCh <- minio.ObjectInfo{Key: objectName}
		}
	}()

	errorCh := c.client.RemoveObjects(ctx, bucketName, objectsCh, minio.RemoveObjectsOptions{})

	var errors []error
	for result := range errorCh {
		if result.Err != nil {
			log.Error().Err(result.Err).
				Str("bucket", bucketName).
				Str("object", result.ObjectName).
				Msg("Failed to delete object from MinIO")
			errors = append(errors, result.Err)
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("failed to delete %d objects out of %d", len(errors), len(objectNames))
	}

	log.Info().
		Str("bucket", bucketName).
		Int("count", len(objectNames)).
		Msg("Objects deleted successfully")

	return nil
}

// ListObjects lists objects in a bucket
func (c *Client) ListObjects(ctx context.Context, bucketName, prefix string) ([]*ObjectInfo, error) {
	if bucketName == "" {
		return nil, fmt.Errorf("bucket name cannot be empty")
	}

	var objects []*ObjectInfo

	// Create object channel
	objectCh := c.client.ListObjects(ctx, bucketName, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	})

	for object := range objectCh {
		if object.Err != nil {
			log.Error().Err(object.Err).
				Str("bucket", bucketName).
				Str("prefix", prefix).
				Msg("Error listing objects in MinIO")
			continue
		}

		// Get object tags
		tagSet, err := c.client.GetObjectTagging(ctx, bucketName, object.Key, minio.GetObjectTaggingOptions{})
		var tags map[string]string
		if err == nil {
			tags = tagSet.ToMap()
		}

		info := &ObjectInfo{
			Key:          object.Key,
			Size:         object.Size,
			ETag:         object.ETag,
			ContentType:  object.ContentType,
			LastModified: object.LastModified,
			StorageClass: object.StorageClass,
			Owner:        "",
			Metadata:     object.UserMetadata,
			Tags:         tags,
		}

		objects = append(objects, info)
	}

	log.Debug().
		Str("bucket", bucketName).
		Str("prefix", prefix).
		Int("count", len(objects)).
		Msg("Objects listed successfully")

	return objects, nil
}

// CopyObject copies an object within or between buckets
func (c *Client) CopyObject(ctx context.Context, destBucket, destObject, srcBucket, srcObject string) error {
	if destBucket == "" || destObject == "" || srcBucket == "" || srcObject == "" {
		return fmt.Errorf("bucket and object names cannot be empty")
	}

	// Get source object info
	srcOpts := minio.CopySrcOptions{
		Bucket: srcBucket,
		Object: srcObject,
	}

	// Set destination options
	dstOpts := minio.CopyDestOptions{
		Bucket: destBucket,
		Object: destObject,
	}

	_, err := c.client.CopyObject(ctx, dstOpts, srcOpts)
	if err != nil {
		log.Error().Err(err).
			Str("src_bucket", srcBucket).
			Str("src_object", srcObject).
			Str("dest_bucket", destBucket).
			Str("dest_object", destObject).
			Msg("Failed to copy object in MinIO")
		return fmt.Errorf("failed to copy object: %w", err)
	}

	log.Info().
		Str("src_bucket", srcBucket).
		Str("src_object", srcObject).
		Str("dest_bucket", destBucket).
		Str("dest_object", destObject).
		Msg("Object copied successfully")

	return nil
}

// SetBucketPolicy sets a bucket policy
func (c *Client) SetBucketPolicy(ctx context.Context, bucketName string, policyJSON string) error {
	err := c.client.SetBucketPolicy(ctx, bucketName, policyJSON)
	if err != nil {
		log.Error().Err(err).Str("bucket", bucketName).Msg("Failed to set bucket policy")
		return fmt.Errorf("failed to set bucket policy: %w", err)
	}

	log.Info().Str("bucket", bucketName).Msg("Bucket policy set successfully")
	return nil
}

// GetBucketPolicy gets a bucket policy
func (c *Client) GetBucketPolicy(ctx context.Context, bucketName string) (string, error) {
	policyJSON, err := c.client.GetBucketPolicy(ctx, bucketName)
	if err != nil {
		log.Error().Err(err).Str("bucket", bucketName).Msg("Failed to get bucket policy")
		return "", fmt.Errorf("failed to get bucket policy: %w", err)
	}

	return policyJSON, nil
}

// PresignedGetObject generates a presigned URL for downloading an object
func (c *Client) PresignedGetObject(ctx context.Context, bucketName, objectName string, expires time.Duration) (string, error) {
	if bucketName == "" || objectName == "" {
		return "", fmt.Errorf("bucket and object names cannot be empty")
	}

	reqParams := make(url.Values)
	presignedURL, err := c.client.PresignedGetObject(ctx, bucketName, objectName, expires, reqParams)
	if err != nil {
		log.Error().Err(err).
			Str("bucket", bucketName).
			Str("object", objectName).
			Msg("Failed to generate presigned URL")
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	log.Debug().
		Str("bucket", bucketName).
		Str("object", objectName).
		Dur("expires", expires).
		Msg("Presigned URL generated successfully")

	return presignedURL.String(), nil
}

// PresignedPutObject generates a presigned URL for uploading an object
func (c *Client) PresignedPutObject(ctx context.Context, bucketName, objectName string, expires time.Duration) (string, error) {
	if bucketName == "" || objectName == "" {
		return "", fmt.Errorf("bucket and object names cannot be empty")
	}

	presignedURL, err := c.client.PresignedPutObject(ctx, bucketName, objectName, expires)
	if err != nil {
		log.Error().Err(err).
			Str("bucket", bucketName).
			Str("object", objectName).
			Msg("Failed to generate presigned PUT URL")
		return "", fmt.Errorf("failed to generate presigned PUT URL: %w", err)
	}

	log.Debug().
		Str("bucket", bucketName).
		Str("object", objectName).
		Dur("expires", expires).
		Msg("Presigned PUT URL generated successfully")

	return presignedURL.String(), nil
}

// UploadFile uploads a local file to MinIO
func (c *Client) UploadFile(ctx context.Context, bucketName, objectName, filePath string, opts *UploadOptions) error {
	if bucketName == "" || objectName == "" || filePath == "" {
		return fmt.Errorf("bucket, object, and file path cannot be empty")
	}

	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	// Get file info
	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to get file info: %w", err)
	}

	_, err = c.PutObject(ctx, bucketName, objectName, file, fileInfo.Size(), opts)
	if err != nil {
		return fmt.Errorf("failed to upload file: %w", err)
	}

	log.Info().
		Str("bucket", bucketName).
		Str("object", objectName).
		Str("file", filePath).
		Int64("size", fileInfo.Size()).
		Msg("File uploaded successfully")

	return nil
}

// DownloadFile downloads an object from MinIO to a local file
func (c *Client) DownloadFile(ctx context.Context, bucketName, objectName, filePath string) error {
	if bucketName == "" || objectName == "" || filePath == "" {
		return fmt.Errorf("bucket, object, and file path cannot be empty")
	}

	// Create directory if it doesn't exist
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	object, _, err := c.GetObject(ctx, bucketName, objectName)
	if err != nil {
		return fmt.Errorf("failed to get object: %w", err)
	}
	defer object.Close()

	file, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	_, err = io.Copy(file, object)
	if err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	log.Info().
		Str("bucket", bucketName).
		Str("object", objectName).
		Str("file", filePath).
		Msg("File downloaded successfully")

	return nil
}

// getContentType returns the MIME type for a file extension
func getContentType(ext string) string {
	contentTypes := map[string]string{
		".txt":  "text/plain",
		".html": "text/html",
		".css":  "text/css",
		".js":   "application/javascript",
		".json": "application/json",
		".xml":  "application/xml",
		".pdf":  "application/pdf",
		".zip":  "application/zip",
		".png":  "image/png",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".gif":  "image/gif",
		".mp4":  "video/mp4",
		".mp3":  "audio/mpeg",
		".csv":  "text/csv",
		".yaml": "application/x-yaml",
		".yml":  "application/x-yaml",
	}

	if contentType, exists := contentTypes[ext]; exists {
		return contentType
	}

	return "application/octet-stream"
}

// CalculateMD5 calculates the MD5 hash of a reader
func CalculateMD5(reader io.Reader) (string, error) {
	hash := md5.New()
	if _, err := io.Copy(hash, reader); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

// Custom errors
var (
	ErrBucketNotFound     = fmt.Errorf("bucket not found")
	ErrObjectNotFound     = fmt.Errorf("object not found")
	ErrInvalidCredentials = fmt.Errorf("invalid credentials")
	ErrConnectionFailed   = fmt.Errorf("connection failed")
)