package storage

import (
	"context"
	"crypto/sha256"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
)

// ClamAVConfig holds configuration for ClamAV scanner
type ClamAVConfig struct {
	ClamScanPath string        `json:"clamscan_path"` // Path to clamscan binary
	ClamDSocket  string        `json:"clamd_socket"`  // Path to clamd socket
	ClamDHost    string        `json:"clamd_host"`    // ClamAV daemon host
	ClamDPort    int           `json:"clamd_port"`    // ClamAV daemon port
	UseDaemon    bool          `json:"use_daemon"`    // Use clamd instead of clamscan
	Timeout      time.Duration `json:"timeout"`       // Scan timeout
	MaxFileSize  int64         `json:"max_file_size"` // Maximum file size to scan
	EnableCache  bool          `json:"enable_cache"`  // Enable scan result caching
	CacheTTL     time.Duration `json:"cache_ttl"`     // Cache TTL
}

// ClamAVScanner implements the VirusScanner interface using ClamAV
type ClamAVScanner struct {
	config    *ClamAVConfig
	logger    *logrus.Logger
	cache     map[string]*ScanResult
	cacheTime map[string]time.Time
}

// NewClamAVScanner creates a new ClamAV virus scanner
func NewClamAVScanner(cfg *ClamAVConfig, logger *logrus.Logger) (*ClamAVScanner, error) {
	if cfg == nil {
		cfg = &ClamAVConfig{
			ClamScanPath: "/usr/bin/clamscan",
			UseDaemon:    true,
			ClamDSocket:  "/var/run/clamav/clamd.ctl",
			ClamDHost:    "localhost",
			ClamDPort:    3310,
			Timeout:      5 * time.Minute,
			MaxFileSize:  100 * 1024 * 1024, // 100MB
			EnableCache:  true,
			CacheTTL:     1 * time.Hour,
		}
	}

	scanner := &ClamAVScanner{
		config:    cfg,
		logger:    logger,
		cache:     make(map[string]*ScanResult),
		cacheTime: make(map[string]time.Time),
	}

	// Test ClamAV availability
	if err := scanner.testClamAV(); err != nil {
		return nil, fmt.Errorf("ClamAV not available: %w", err)
	}

	return scanner, nil
}

// Scan scans file content for viruses
func (s *ClamAVScanner) Scan(ctx context.Context, content []byte) (*ScanResult, error) {
	ctx, span := otel.Tracer("clamav-scanner").Start(ctx, "Scan")
	defer span.End()

	startTime := time.Now()

	// Check file size
	if int64(len(content)) > s.config.MaxFileSize {
		return nil, fmt.Errorf("file too large for scanning: %d bytes (max: %d bytes)", len(content), s.config.MaxFileSize)
	}

	// Generate content hash for caching
	contentHash := s.generateContentHash(content)

	// Check cache first
	if s.config.EnableCache {
		if cached, found := s.getFromCache(contentHash); found {
			s.logger.WithField("hash", contentHash).Debug("Returning cached scan result")
			if cached.Metadata == nil {
				cached.Metadata = make(map[string]interface{})
			}
			cached.Metadata["cache_hit"] = true
			return cached, nil
		}
	}

	var result *ScanResult
	var err error

	if s.config.UseDaemon {
		result, err = s.scanWithDaemon(ctx, content)
	} else {
		result, err = s.scanWithBinary(ctx, content)
	}

	if err != nil {
		return nil, fmt.Errorf("virus scan failed: %w", err)
	}

	// Add timing information
	scanTime := time.Since(startTime)
	if result.Metadata == nil {
		result.Metadata = make(map[string]interface{})
	}
	result.Metadata["scan_time_ms"] = scanTime.Milliseconds()
	result.Metadata["content_size_bytes"] = len(content)
	result.Metadata["content_hash"] = contentHash

	// Cache the result
	if s.config.EnableCache {
		s.addToCache(contentHash, result)
	}

	s.logger.WithFields(logrus.Fields{
		"infected":     result.Infected,
		"scan_time":    scanTime,
		"engine":       result.Engine,
		"content_size": len(content),
	}).Info("Virus scan completed")

	return result, nil
}

// ScanBatch scans multiple files for viruses
func (s *ClamAVScanner) ScanBatch(ctx context.Context, files []BatchScanRequest) ([]*ScanResult, error) {
	ctx, span := otel.Tracer("clamav-scanner").Start(ctx, "ScanBatch")
	defer span.End()

	results := make([]*ScanResult, len(files))

	for i, file := range files {
		result, err := s.Scan(ctx, file.Content)
		if err != nil {
			// Log error but continue with other files
			s.logger.WithFields(logrus.Fields{
				"file_id": file.ID,
				"error":   err,
			}).Error("Failed to scan file in batch")

			// Create error result
			results[i] = &ScanResult{
				Infected: false,
				Engine:   s.getEngineInfo(),
				Threats:  []string{err.Error()},
				Metadata: map[string]interface{}{
					"scan_error": err.Error(),
					"file_id":    file.ID,
				},
			}
		} else {
			results[i] = result
		}
	}

	return results, nil
}

// UpdateSignatures updates virus signatures
func (s *ClamAVScanner) UpdateSignatures(ctx context.Context) error {
	ctx, span := otel.Tracer("clamav-scanner").Start(ctx, "UpdateSignatures")
	defer span.End()

	s.logger.Info("Updating ClamAV virus signatures")

	// Use freshclam to update signatures
	cmd := exec.CommandContext(ctx, "freshclam", "--quiet")

	output, err := cmd.CombinedOutput()
	if err != nil {
		s.logger.WithFields(logrus.Fields{
			"error":  err,
			"output": string(output),
		}).Error("Failed to update ClamAV signatures")
		return fmt.Errorf("failed to update signatures: %w", err)
	}

	// Clear cache after signature update
	s.clearCache()

	s.logger.Info("ClamAV virus signatures updated successfully")
	return nil
}

// GetEngineInfo returns information about the scanning engine
func (s *ClamAVScanner) GetEngineInfo(ctx context.Context) (*EngineInfo, error) {
	ctx, span := otel.Tracer("clamav-scanner").Start(ctx, "GetEngineInfo")
	defer span.End()

	info := &EngineInfo{
		Name: "ClamAV",
	}

	// Get ClamAV version
	versionCmd := exec.CommandContext(ctx, "clamscan", "--version")
	output, err := versionCmd.CombinedOutput()
	if err != nil {
		s.logger.WithError(err).Warn("Failed to get ClamAV version")
		info.Version = "unknown"
	} else {
		versionOutput := string(output)
		lines := strings.Split(versionOutput, "\n")
		if len(lines) > 0 {
			info.Version = strings.TrimSpace(lines[0])
		}
	}

	// Get signature database info
	sigcheckCmd := exec.CommandContext(ctx, "sigtool", "--info")
	sigOutput, err := sigcheckCmd.CombinedOutput()
	if err != nil {
		s.logger.WithError(err).Warn("Failed to get signature database info")
	} else {
		sigOutputStr := string(sigOutput)
		// Parse signature database information
		if strings.Contains(sigOutputStr, "Build time:") {
			info.DatabaseVer = "available"
		}
	}

	info.LastUpdate = time.Now()
	info.TotalSigs = 1000000 // Default estimate

	return info, nil
}

// HealthCheck performs a health check on the virus scanner
func (s *ClamAVScanner) HealthCheck(ctx context.Context) error {
	ctx, span := otel.Tracer("clamav-scanner").Start(ctx, "HealthCheck")
	defer span.End()

	// Test with a known clean EICAR test signature
	eicarSignature := "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
	testContent := []byte(eicarSignature)

	result, err := s.Scan(ctx, testContent)
	if err != nil {
		return fmt.Errorf("virus scanner health check failed: %w", err)
	}

	// Should detect EICAR as infected
	if !result.Infected {
		return fmt.Errorf("virus scanner failed to detect EICAR test signature")
	}

	s.logger.Debug("Virus scanner health check passed")
	return nil
}

// scanWithDaemon scans content using clamd daemon
func (s *ClamAVScanner) scanWithDaemon(ctx context.Context, content []byte) (*ScanResult, error) {
	startTime := time.Now()

	// Create temporary file for scanning
	tempFile, err := s.createTempFile(content)
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer s.cleanupTempFile(tempFile)

	// Use clamdscan for daemon-based scanning
	var cmd *exec.Cmd
	if s.config.ClamDSocket != "" {
		cmd = exec.CommandContext(ctx, "clamdscan", "--no-summary", "--fdpass", tempFile)
	} else {
		cmd = exec.CommandContext(ctx, "clamdscan", "--no-summary", "--fdpass",
			fmt.Sprintf("--stream=%s:%d", s.config.ClamDHost, s.config.ClamDPort), tempFile)
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("clamdscan failed: %w", err)
	}

	return s.parseScanOutput(string(output), "ClamAV (clamd)", time.Since(startTime))
}

// scanWithBinary scans content using clamscan binary
func (s *ClamAVScanner) scanWithBinary(ctx context.Context, content []byte) (*ScanResult, error) {
	startTime := time.Now()

	// Create temporary file for scanning
	tempFile, err := s.createTempFile(content)
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer s.cleanupTempFile(tempFile)

	// Use clamscan for binary-based scanning
	cmd := exec.CommandContext(ctx, s.config.ClamScanPath, "--no-summary", tempFile)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("clamscan failed: %w", err)
	}

	return s.parseScanOutput(string(output), "ClamAV (clamscan)", time.Since(startTime))
}

// parseScanOutput parses the output from ClamAV scan
func (s *ClamAVScanner) parseScanOutput(output, engine string, scanTime time.Duration) (*ScanResult, error) {
	result := &ScanResult{
		Engine:     engine,
		Infected:   false,
		Threats:    []string{},
		Signatures: make(map[string]string),
		Metadata: map[string]interface{}{
			"scan_time_ms": scanTime.Milliseconds(),
			"raw_output":   output,
		},
	}

	lines := strings.Split(strings.TrimSpace(output), "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Parse infection lines like: /tmp/file: Trojan.FakeAlert-xyz FOUND
		if strings.Contains(line, "FOUND") {
			result.Infected = true
			parts := strings.Split(line, ":")
			if len(parts) >= 2 {
				signature := strings.TrimSpace(parts[len(parts)-1])
				signature = strings.Replace(signature, "FOUND", "", -1)
				signature = strings.TrimSpace(signature)

				if signature != "" {
					result.Threats = append(result.Threats, signature)
					result.Signatures["threat_"+signature] = signature
				}
			}
		}

		// Parse other status information
		if strings.Contains(line, "OK") {
			result.Infected = false
		}
	}

	return result, nil
}

// createTempFile creates a temporary file with the given content
func (s *ClamAVScanner) createTempFile(content []byte) (string, error) {
	tempFile := "/tmp/clamav_scan_" + fmt.Sprintf("%d", time.Now().UnixNano())

	if err := os.WriteFile(tempFile, content, 0600); err != nil {
		return "", fmt.Errorf("failed to write temp file: %w", err)
	}

	return tempFile, nil
}

// cleanupTempFile removes a temporary file
func (s *ClamAVScanner) cleanupTempFile(filename string) {
	if err := os.Remove(filename); err != nil {
		s.logger.WithFields(logrus.Fields{
			"file":  filename,
			"error": err,
		}).Warn("Failed to cleanup temp file")
	}
}

// generateContentHash generates a hash for caching purposes
func (s *ClamAVScanner) generateContentHash(content []byte) string {
	hash := sha256.Sum256(content)
	return fmt.Sprintf("%x", hash)
}

// getFromCache retrieves a scan result from cache
func (s *ClamAVScanner) getFromCache(hash string) (*ScanResult, bool) {
	if !s.config.EnableCache {
		return nil, false
	}

	if cachedTime, found := s.cacheTime[hash]; found {
		if time.Since(cachedTime) < s.config.CacheTTL {
			if result, found := s.cache[hash]; found {
				return result, true
			}
		} else {
			// Expired, remove from cache
			delete(s.cache, hash)
			delete(s.cacheTime, hash)
		}
	}

	return nil, false
}

// addToCache adds a scan result to cache
func (s *ClamAVScanner) addToCache(hash string, result *ScanResult) {
	if !s.config.EnableCache {
		return
	}

	s.cache[hash] = result
	s.cacheTime[hash] = time.Now()

	// Limit cache size
	if len(s.cache) > 10000 {
		s.clearCache()
	}
}

// clearCache clears the scan result cache
func (s *ClamAVScanner) clearCache() {
	s.cache = make(map[string]*ScanResult)
	s.cacheTime = make(map[string]time.Time)
}

// testClamAV tests if ClamAV is available
func (s *ClamAVScanner) testClamAV() error {
	var cmd *exec.Cmd
	if s.config.UseDaemon {
		cmd = exec.Command("clamdscan", "--version")
	} else {
		cmd = exec.Command(s.config.ClamScanPath, "--version")
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ClamAV not available: %w, output: %s", err, string(output))
	}

	s.logger.WithField("version", string(output)).Info("ClamAV scanner initialized")
	return nil
}

// getEngineInfo returns basic engine information
func (s *ClamAVScanner) getEngineInfo() string {
	if s.config.UseDaemon {
		return "ClamAV (clamd)"
	}
	return "ClamAV (clamscan)"
}
