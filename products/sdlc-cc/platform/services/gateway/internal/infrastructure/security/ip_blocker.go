package security

import (
	"context"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

// IPBlocker manages IP blocking functionality
type IPBlocker struct {
	blocks      map[string]*BlockInfo
	mutex       sync.RWMutex
	logger      *logrus.Logger
	storage     BlockStorage
	cidrBlocks  []*CIDRBlock
	autoCleanup bool
}

// BlockInfo contains IP blocking information
type BlockInfo struct {
	IPAddress      string            `json:"ip_address"`
	BlockedAt      time.Time         `json:"blocked_at"`
	ExpiresAt      time.Time         `json:"expires_at"`
	Reason         string            `json:"reason"`
	BlockType      string            `json:"block_type"` // manual, automatic, abuse_detection
	Severity       string            `json:"severity"`   // low, medium, high, critical
	RequestCount   int64             `json:"request_count"`
	ViolationCount int64             `json:"violation_count"`
	Metadata       map[string]string `json:"metadata"`
	TenantID       string            `json:"tenant_id,omitempty"`
	UserID         string            `json:"user_id,omitempty"`
	PolicyID       string            `json:"policy_id,omitempty"`
}

// CIDRBlock represents a CIDR range block
type CIDRBlock struct {
	CIDR      string    `json:"cidr"`
	BlockedAt time.Time `json:"blocked_at"`
	ExpiresAt time.Time `json:"expires_at"`
	Reason    string    `json:"reason"`
	Severity  string    `json:"severity"`
	CreatedBy string    `json:"created_by"`
}

// BlockStorage interface for persisting block information
type BlockStorage interface {
	StoreBlock(ctx context.Context, block *BlockInfo) error
	GetBlock(ctx context.Context, ip string) (*BlockInfo, error)
	DeleteBlock(ctx context.Context, ip string) error
	GetAllBlocks(ctx context.Context) ([]*BlockInfo, error)
	GetExpiredBlocks(ctx context.Context) ([]*BlockInfo, error)
	StoreCIDRBlock(ctx context.Context, block *CIDRBlock) error
	GetCIDRBlocks(ctx context.Context) ([]*CIDRBlock, error)
	DeleteCIDRBlock(ctx context.Context, cidr string) error
}

// BlockResult represents the result of a block operation
type BlockResult struct {
	Success   bool       `json:"success"`
	BlockInfo *BlockInfo `json:"block_info,omitempty"`
	Error     string     `json:"error,omitempty"`
}

// UnblockResult represents the result of an unblock operation
type UnblockResult struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// BlockStatistics provides statistics about IP blocking
type BlockStatistics struct {
	TotalBlocks      int64            `json:"total_blocks"`
	ActiveBlocks     int64            `json:"active_blocks"`
	ExpiredBlocks    int64            `json:"expired_blocks"`
	BlocksByType     map[string]int64 `json:"blocks_by_type"`
	BlocksBySeverity map[string]int64 `json:"blocks_by_severity"`
	AverageBlockTime time.Duration    `json:"average_block_time"`
	MostCommonReason string           `json:"most_common_reason"`
	LastUpdated      time.Time        `json:"last_updated"`
}

// NewIPBlocker creates a new IP blocker instance
func NewIPBlocker(storage BlockStorage, logger *logrus.Logger, autoCleanup bool) *IPBlocker {
	blocker := &IPBlocker{
		blocks:      make(map[string]*BlockInfo),
		logger:      logger,
		storage:     storage,
		cidrBlocks:  make([]*CIDRBlock, 0),
		autoCleanup: autoCleanup,
	}

	// Load existing blocks
	if err := blocker.loadBlocks(context.Background()); err != nil {
		logger.WithError(err).Error("Failed to load existing IP blocks")
	}

	// Load CIDR blocks
	if err := blocker.loadCIDRBlocks(context.Background()); err != nil {
		logger.WithError(err).Error("Failed to load CIDR blocks")
	}

	// Start cleanup goroutine if enabled
	if autoCleanup {
		go blocker.startCleanup()
	}

	return blocker
}

// BlockIP blocks an IP address
func (ib *IPBlocker) BlockIP(ctx context.Context, ip string, duration time.Duration, reason string, blockType string) error {
	// Validate IP address
	if net.ParseIP(ip) == nil {
		return fmt.Errorf("invalid IP address: %s", ip)
	}

	// Normalize IP address
	normalizedIP := normalizeIP(ip)

	ib.mutex.Lock()
	defer ib.mutex.Unlock()

	// Check if already blocked
	if existingBlock, exists := ib.blocks[normalizedIP]; exists {
		if existingBlock.ExpiresAt.After(time.Now()) {
			// Update existing block
			existingBlock.ExpiresAt = time.Now().Add(duration)
			existingBlock.Reason = reason
			existingBlock.BlockType = blockType
			existingBlock.ViolationCount++

			if err := ib.storage.StoreBlock(ctx, existingBlock); err != nil {
				return fmt.Errorf("failed to update block in storage: %w", err)
			}

			ib.logger.WithFields(logrus.Fields{
				"ip":         normalizedIP,
				"block_type": blockType,
				"reason":     reason,
				"duration":   duration,
			}).Info("Existing IP block updated")

			return nil
		}
	}

	// Create new block
	blockInfo := &BlockInfo{
		IPAddress:      normalizedIP,
		BlockedAt:      time.Now(),
		ExpiresAt:      time.Now().Add(duration),
		Reason:         reason,
		BlockType:      blockType,
		Severity:       determineSeverity(reason, blockType),
		RequestCount:   0,
		ViolationCount: 1,
		Metadata:       make(map[string]string),
	}

	// Store in memory and persistent storage
	ib.blocks[normalizedIP] = blockInfo
	if err := ib.storage.StoreBlock(ctx, blockInfo); err != nil {
		delete(ib.blocks, normalizedIP)
		return fmt.Errorf("failed to store block in storage: %w", err)
	}

	ib.logger.WithFields(logrus.Fields{
		"ip":         normalizedIP,
		"block_type": blockType,
		"reason":     reason,
		"duration":   duration,
		"severity":   blockInfo.Severity,
	}).Info("IP address blocked")

	return nil
}

// UnblockIP unblocks an IP address
func (ib *IPBlocker) UnblockIP(ctx context.Context, ip string) error {
	normalizedIP := normalizeIP(ip)

	ib.mutex.Lock()
	defer ib.mutex.Unlock()

	// Check if blocked
	block, exists := ib.blocks[normalizedIP]
	if !exists {
		return fmt.Errorf("IP %s is not blocked", normalizedIP)
	}

	// Remove from memory
	delete(ib.blocks, normalizedIP)

	// Remove from storage
	if err := ib.storage.DeleteBlock(ctx, normalizedIP); err != nil {
		// Restore in memory if storage deletion fails
		ib.blocks[normalizedIP] = block
		return fmt.Errorf("failed to delete block from storage: %w", err)
	}

	ib.logger.WithFields(logrus.Fields{
		"ip":              normalizedIP,
		"block_type":      block.BlockType,
		"blocked_for":     time.Since(block.BlockedAt),
		"original_reason": block.Reason,
	}).Info("IP address unblocked")

	return nil
}

// IsBlocked checks if an IP address is blocked
func (ib *IPBlocker) IsBlocked(ctx context.Context, ip string) (*BlockInfo, error) {
	normalizedIP := normalizeIP(ip)

	// Check exact IP match first
	ib.mutex.RLock()
	block, exists := ib.blocks[normalizedIP]
	ib.mutex.RUnlock()

	if exists {
		// Check if block has expired
		if time.Now().After(block.ExpiresAt) {
			// Remove expired block asynchronously — uses Background intentionally
			// because the request ctx is already returning; the cleanup must run
			// regardless of caller cancellation.
			go func() { // #nosec G118 -- background cleanup outlives request
				ib.mutex.Lock()
				delete(ib.blocks, normalizedIP)
				ib.mutex.Unlock()
				if err := ib.storage.DeleteBlock(context.Background(), normalizedIP); err != nil {
					ib.logger.WithError(err).WithField("ip", normalizedIP).Warn("Failed to delete expired IP block from storage")
				}
			}()
			return nil, nil
		}

		// Update request count — fire-and-forget background writer; Background
		// is intentional because the caller returns immediately.
		go func() { // #nosec G118 -- fire-and-forget counter writer
			ib.mutex.Lock()
			if b, exists := ib.blocks[normalizedIP]; exists {
				b.RequestCount++
				if err := ib.storage.StoreBlock(context.Background(), b); err != nil {
					ib.logger.WithError(err).WithField("ip", normalizedIP).Warn("Failed to persist IP block counter update")
				}
			}
			ib.mutex.Unlock()
		}()

		// Return a copy to prevent modification
		blockCopy := *block
		return &blockCopy, nil
	}

	// Check CIDR blocks
	ib.mutex.RLock()
	for _, cidrBlock := range ib.cidrBlocks {
		if time.Now().After(cidrBlock.ExpiresAt) {
			continue
		}

		if isIPInCIDR(normalizedIP, cidrBlock.CIDR) {
			ib.mutex.RUnlock()

			// Create a virtual block info for CIDR block
			virtualBlock := &BlockInfo{
				IPAddress: normalizedIP,
				BlockedAt: cidrBlock.BlockedAt,
				ExpiresAt: cidrBlock.ExpiresAt,
				Reason:    fmt.Sprintf("CIDR block: %s - %s", cidrBlock.CIDR, cidrBlock.Reason),
				BlockType: "cidr",
				Severity:  cidrBlock.Severity,
				Metadata: map[string]string{
					"cidr":       cidrBlock.CIDR,
					"created_by": cidrBlock.CreatedBy,
				},
			}

			return virtualBlock, nil
		}
	}
	ib.mutex.RUnlock()

	return nil, nil
}

// GetBlockedIPs returns all currently blocked IPs
func (ib *IPBlocker) GetBlockedIPs(ctx context.Context) ([]*BlockInfo, error) {
	ib.mutex.RLock()
	defer ib.mutex.RUnlock()

	var blockedIPs []*BlockInfo
	now := time.Now()

	for _, block := range ib.blocks {
		if now.Before(block.ExpiresAt) {
			blockCopy := *block
			blockedIPs = append(blockedIPs, &blockCopy)
		}
	}

	return blockedIPs, nil
}

// BlockCIDR blocks an entire CIDR range
func (ib *IPBlocker) BlockCIDR(ctx context.Context, cidr string, duration time.Duration, reason string, createdBy string) error {
	// Validate CIDR
	_, _, err := net.ParseCIDR(cidr)
	if err != nil {
		return fmt.Errorf("invalid CIDR: %w", err)
	}

	ib.mutex.Lock()
	defer ib.mutex.Unlock()

	// Create CIDR block
	cidrBlock := &CIDRBlock{
		CIDR:      cidr,
		BlockedAt: time.Now(),
		ExpiresAt: time.Now().Add(duration),
		Reason:    reason,
		Severity:  determineSeverity(reason, "manual"),
		CreatedBy: createdBy,
	}

	// Store in memory and persistent storage
	ib.cidrBlocks = append(ib.cidrBlocks, cidrBlock)
	if err := ib.storage.StoreCIDRBlock(ctx, cidrBlock); err != nil {
		// Remove from memory if storage fails
		ib.cidrBlocks = ib.cidrBlocks[:len(ib.cidrBlocks)-1]
		return fmt.Errorf("failed to store CIDR block in storage: %w", err)
	}

	ib.logger.WithFields(logrus.Fields{
		"cidr":       cidr,
		"reason":     reason,
		"duration":   duration,
		"created_by": createdBy,
		"severity":   cidrBlock.Severity,
	}).Info("CIDR range blocked")

	return nil
}

// UnblockCIDR unblocks a CIDR range
func (ib *IPBlocker) UnblockCIDR(ctx context.Context, cidr string) error {
	ib.mutex.Lock()
	defer ib.mutex.Unlock()

	for i, block := range ib.cidrBlocks {
		if block.CIDR == cidr {
			// Remove from memory
			ib.cidrBlocks = append(ib.cidrBlocks[:i], ib.cidrBlocks[i+1:]...)

			// Remove from storage
			if err := ib.storage.DeleteCIDRBlock(ctx, cidr); err != nil {
				return fmt.Errorf("failed to delete CIDR block from storage: %w", err)
			}

			ib.logger.WithFields(logrus.Fields{
				"cidr":   cidr,
				"reason": block.Reason,
			}).Info("CIDR range unblocked")

			return nil
		}
	}

	return fmt.Errorf("CIDR %s is not blocked", cidr)
}

// GetStatistics returns blocking statistics
func (ib *IPBlocker) GetStatistics(ctx context.Context) (*BlockStatistics, error) {
	ib.mutex.RLock()
	defer ib.mutex.RUnlock()

	stats := &BlockStatistics{
		BlocksByType:     make(map[string]int64),
		BlocksBySeverity: make(map[string]int64),
		LastUpdated:      time.Now(),
	}

	now := time.Now()
	var totalBlockTime time.Duration
	var blockCount int
	var reasonCount = make(map[string]int64)

	for _, block := range ib.blocks {
		stats.TotalBlocks++

		if now.Before(block.ExpiresAt) {
			stats.ActiveBlocks++
			stats.BlocksByType[block.BlockType]++
			stats.BlocksBySeverity[block.Severity]++

			totalBlockTime += block.ExpiresAt.Sub(block.BlockedAt)
			blockCount++
		} else {
			stats.ExpiredBlocks++
		}

		reasonCount[block.Reason]++
	}

	// Calculate average block time
	if blockCount > 0 {
		stats.AverageBlockTime = totalBlockTime / time.Duration(blockCount)
	}

	// Find most common reason
	var maxCount int64
	for reason, count := range reasonCount {
		if count > maxCount {
			maxCount = count
			stats.MostCommonReason = reason
		}
	}

	return stats, nil
}

// Cleanup removes expired blocks
func (ib *IPBlocker) Cleanup(ctx context.Context) error {
	ib.mutex.Lock()
	defer ib.mutex.Unlock()

	now := time.Now()
	var removedCount int

	// Remove expired IP blocks
	for ip, block := range ib.blocks {
		if now.After(block.ExpiresAt) {
			delete(ib.blocks, ip)
			if err := ib.storage.DeleteBlock(ctx, ip); err != nil {
				ib.logger.WithError(err).WithField("ip", ip).Warn("Failed to delete expired block from storage")
			}
			removedCount++
		}
	}

	// Remove expired CIDR blocks
	var validCIDRBlocks []*CIDRBlock
	for _, block := range ib.cidrBlocks {
		if now.Before(block.ExpiresAt) {
			validCIDRBlocks = append(validCIDRBlocks, block)
		} else {
			if err := ib.storage.DeleteCIDRBlock(ctx, block.CIDR); err != nil {
				ib.logger.WithError(err).WithField("cidr", block.CIDR).Warn("Failed to delete expired CIDR block from storage")
			}
			removedCount++
		}
	}
	ib.cidrBlocks = validCIDRBlocks

	if removedCount > 0 {
		ib.logger.WithField("removed_count", removedCount).Info("Expired blocks cleaned up")
	}

	return nil
}

// Helper methods

func (ib *IPBlocker) loadBlocks(ctx context.Context) error {
	blocks, err := ib.storage.GetAllBlocks(ctx)
	if err != nil {
		return fmt.Errorf("failed to load blocks from storage: %w", err)
	}

	ib.mutex.Lock()
	defer ib.mutex.Unlock()

	for _, block := range blocks {
		// Only load non-expired blocks
		if time.Now().Before(block.ExpiresAt) {
			ib.blocks[block.IPAddress] = block
		}
	}

	ib.logger.WithField("block_count", len(ib.blocks)).Info("IP blocks loaded from storage")
	return nil
}

func (ib *IPBlocker) loadCIDRBlocks(ctx context.Context) error {
	cidrBlocks, err := ib.storage.GetCIDRBlocks(ctx)
	if err != nil {
		return fmt.Errorf("failed to load CIDR blocks from storage: %w", err)
	}

	ib.mutex.Lock()
	defer ib.mutex.Unlock()

	// Only load non-expired CIDR blocks
	now := time.Now()
	for _, block := range cidrBlocks {
		if now.Before(block.ExpiresAt) {
			ib.cidrBlocks = append(ib.cidrBlocks, block)
		}
	}

	ib.logger.WithField("cidr_block_count", len(ib.cidrBlocks)).Info("CIDR blocks loaded from storage")
	return nil
}

func (ib *IPBlocker) startCleanup() {
	ticker := time.NewTicker(time.Minute * 5) // Cleanup every 5 minutes
	defer ticker.Stop()

	for range ticker.C {
		if err := ib.Cleanup(context.Background()); err != nil {
			ib.logger.WithError(err).Error("Failed to cleanup expired blocks")
		}
	}
}

func normalizeIP(ip string) string {
	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return ip // Return as-is if invalid
	}
	return parsedIP.String()
}

func isIPInCIDR(ip, cidr string) bool {
	ipAddr := net.ParseIP(ip)
	if ipAddr == nil {
		return false
	}

	_, ipNet, err := net.ParseCIDR(cidr)
	if err != nil {
		return false
	}

	return ipNet.Contains(ipAddr)
}

func determineSeverity(reason, blockType string) string {
	// Determine severity based on reason and block type
	lowerReason := strings.ToLower(reason)

	if strings.Contains(lowerReason, "ddos") || strings.Contains(lowerReason, "attack") {
		return "critical"
	}

	if strings.Contains(lowerReason, "sql injection") || strings.Contains(lowerReason, "xss") {
		return "high"
	}

	if strings.Contains(lowerReason, "brute force") || strings.Contains(lowerReason, "abuse") {
		return "medium"
	}

	if blockType == "automatic" {
		return "low"
	}

	return "low" // Default severity
}

// BlockRequest represents a block request
type BlockRequest struct {
	IPAddress string            `json:"ip_address"`
	Duration  time.Duration     `json:"duration"`
	Reason    string            `json:"reason"`
	BlockType string            `json:"block_type"`
	TenantID  string            `json:"tenant_id,omitempty"`
	UserID    string            `json:"user_id,omitempty"`
	PolicyID  string            `json:"policy_id,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

// UnblockRequest represents an unblock request
type UnblockRequest struct {
	IPAddress string `json:"ip_address"`
	Reason    string `json:"reason,omitempty"`
}

// BlockCIDRRequest represents a CIDR block request
type BlockCIDRRequest struct {
	CIDR      string        `json:"cidr"`
	Duration  time.Duration `json:"duration"`
	Reason    string        `json:"reason"`
	CreatedBy string        `json:"created_by"`
}

// BatchBlockResult represents the result of a batch block operation
type BatchBlockResult struct {
	Successful []string     `json:"successful"`
	Failed     []BlockError `json:"failed"`
	Total      int          `json:"total"`
}

// BlockError represents a block operation error
type BlockError struct {
	IPAddress string `json:"ip_address"`
	Error     string `json:"error"`
}
