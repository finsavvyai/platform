package mtls

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

// CertificateInfo contains information about TLS certificates
type CertificateInfo struct {
	Certificate  *x509.Certificate `json:"certificate"`
	PrivateKey   interface{}       `json:"-"`
	CertFile     string            `json:"cert_file"`
	KeyFile      string            `json:"key_file"`
	CAFile       string            `json:"ca_file"`
	ExpiresAt    time.Time         `json:"expires_at"`
	NotBefore    time.Time         `json:"not_before"`
	SerialNumber *big.Int          `json:"serial_number"`
	Subject      string            `json:"subject"`
	Issuer       string            `json:"issuer"`
	DNSNames     []string          `json:"dns_names"`
	IPAddresses  []net.IP          `json:"ip_addresses"`
}

// MTLSConfig holds mTLS configuration
type MTLSConfig struct {
	Enabled           bool          `yaml:"enabled"`
	CertFile          string        `yaml:"cert_file"`
	KeyFile           string        `yaml:"key_file"`
	CAFile            string        `yaml:"ca_file"`
	ClientAuth        bool          `yaml:"client_auth"`
	SkipVerify        bool          `yaml:"skip_verify"`
	MinVersion        string        `yaml:"min_version"`
	MaxVersion        string        `yaml:"max_version"`
	CipherSuites      []string      `yaml:"cipher_suites"`
	CurvePreferences  []string      `yaml:"curve_preferences"`
	AutoRotate        bool          `yaml:"auto_rotate"`
	RotationInterval  time.Duration `yaml:"rotation_interval"`
	RotationThreshold float64       `yaml:"rotation_threshold"`
	BackupCerts       bool          `yaml:"backup_certs"`
	BackupDir         string        `yaml:"backup_dir"`
	CertDirectory     string        `yaml:"cert_directory"`
}

// DefaultMTLSConfig returns default mTLS configuration
func DefaultMTLSConfig() MTLSConfig {
	return MTLSConfig{
		Enabled:           false,
		ClientAuth:        true,
		SkipVerify:        false,
		MinVersion:        "1.2",
		MaxVersion:        "1.3",
		AutoRotate:        true,
		RotationInterval:  90 * 24 * time.Hour, // 90 days
		RotationThreshold: 0.8,                 // Rotate when 80% expired
		BackupCerts:       true,
		BackupDir:         "./certs/backup",
		CertDirectory:     "./certs",
	}
}

// CertificateManager manages TLS certificates and mTLS configuration
type CertificateManager struct {
	config     MTLSConfig
	logger     *logrus.Logger
	certInfo   *CertificateInfo
	caCert     *x509.Certificate
	caKey      interface{}
	mutex      sync.RWMutex
	rotator    *CertificateRotator
	httpClient *http.Client
}

// CertificateRotator handles automatic certificate rotation
type CertificateRotator struct {
	manager     *CertificateManager
	ticker      *time.Ticker
	stopChannel chan struct{}
	running     bool
	mutex       sync.RWMutex
}

// NewCertificateManager creates a new certificate manager
func NewCertificateManager(config MTLSConfig, logger *logrus.Logger) (*CertificateManager, error) {
	if logger == nil {
		logger = logrus.New()
	}

	manager := &CertificateManager{
		config: config,
		logger: logger,
	}

	// Initialize certificate directory
	if err := manager.initCertDirectory(); err != nil {
		return nil, fmt.Errorf("failed to initialize certificate directory: %w", err)
	}

	// Load existing certificates or generate new ones
	if err := manager.loadOrGenerateCertificates(); err != nil {
		return nil, fmt.Errorf("failed to load or generate certificates: %w", err)
	}

	// Start certificate rotation if enabled
	if config.AutoRotate {
		manager.startCertificateRotation()
	}

	return manager, nil
}

// GetTLSConfig returns a TLS configuration for mTLS
func (cm *CertificateManager) GetTLSConfig() (*tls.Config, error) {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	if cm.certInfo == nil {
		return nil, fmt.Errorf("no certificate available")
	}

	// Create certificate pair
	cert, err := tls.X509KeyPair(cm.certInfo.Certificate.Raw, cm.getPrivateKeyBytes())
	if err != nil {
		return nil, fmt.Errorf("failed to create certificate pair: %w", err)
	}

	// Create CA certificate pool
	caCertPool := x509.NewCertPool()
	if cm.caCert != nil {
		caCertPool.AppendCertsFromPEM(cm.encodeCertificate(cm.caCert))
	}

	// Parse TLS versions; clamp min to 1.2 regardless of config to comply
	// with the portfolio security baseline (no TLS 1.0/1.1 in production).
	minVersion := cm.parseTLSVersion(cm.config.MinVersion)
	if minVersion < tls.VersionTLS12 {
		minVersion = tls.VersionTLS12
	}
	maxVersion := cm.parseTLSVersion(cm.config.MaxVersion)

	// Create TLS configuration
	tlsConfig := &tls.Config{ // #nosec G402 -- minVersion clamped to >=TLS12 above
		Certificates: []tls.Certificate{cert},
		ClientCAs:    caCertPool,
		MinVersion:   minVersion,
		MaxVersion:   maxVersion,
		NextProtos:   []string{"h2", "http/1.1"},
	}

	if cm.config.ClientAuth {
		tlsConfig.ClientAuth = tls.RequireAndVerifyClientCert
	} else {
		tlsConfig.ClientAuth = tls.NoClientCert
	}

	if cm.config.SkipVerify {
		tlsConfig.InsecureSkipVerify = true
	}

	// Add cipher suites if specified
	if len(cm.config.CipherSuites) > 0 {
		tlsConfig.CipherSuites = cm.parseCipherSuites(cm.config.CipherSuites)
	}

	// Add curve preferences if specified
	if len(cm.config.CurvePreferences) > 0 {
		tlsConfig.CurvePreferences = cm.parseCurvePreferences(cm.config.CurvePreferences)
	}

	return tlsConfig, nil
}

// GetHTTPClient returns an HTTP client configured with mTLS
func (cm *CertificateManager) GetHTTPClient() (*http.Client, error) {
	tlsConfig, err := cm.GetTLSConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get TLS config: %w", err)
	}

	transport := &http.Transport{
		TLSClientConfig: tlsConfig,
		MaxIdleConns:    100,
		IdleConnTimeout: 90 * time.Second,
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   30 * time.Second,
	}

	return client, nil
}

// RotateCertificate forces immediate certificate rotation
func (cm *CertificateManager) RotateCertificate() error {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()

	return cm.rotateCertificateInternal()
}

// GetCertificateInfo returns information about the current certificate
func (cm *CertificateManager) GetCertificateInfo() *CertificateInfo {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	if cm.certInfo == nil {
		return nil
	}

	// Return a copy to prevent external modification
	info := *cm.certInfo
	return &info
}

// ValidateCertificate checks if the current certificate is valid
func (cm *CertificateManager) ValidateCertificate() error {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	if cm.certInfo == nil {
		return fmt.Errorf("no certificate loaded")
	}

	now := time.Now()

	// Check if certificate is expired
	if now.After(cm.certInfo.ExpiresAt) {
		return fmt.Errorf("certificate has expired")
	}

	// Check if certificate is not yet valid
	if now.Before(cm.certInfo.NotBefore) {
		return fmt.Errorf("certificate is not yet valid")
	}

	// Check if certificate is approaching expiration
	threshold := time.Duration(float64(cm.certInfo.ExpiresAt.Sub(cm.certInfo.NotBefore)) * cm.config.RotationThreshold)
	if time.Until(cm.certInfo.ExpiresAt) < threshold {
		cm.logger.WithFields(logrus.Fields{
			"expires_at":         cm.certInfo.ExpiresAt,
			"rotation_threshold": threshold,
		}).Warn("Certificate approaching expiration")
	}

	return nil
}

// CleanupExpiredCertificates removes expired certificate backups
func (cm *CertificateManager) CleanupExpiredCertificates() error {
	if !cm.config.BackupCerts {
		return nil
	}

	backupDir := cm.config.BackupDir
	if backupDir == "" {
		backupDir = "./certs/backup"
	}

	files, err := os.ReadDir(backupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("failed to read backup directory: %w", err)
	}

	cleaned := 0
	for _, file := range files {
		if file.IsDir() {
			continue
		}

		// Check if file is older than rotation interval
		info, err := file.Info()
		if err != nil {
			continue
		}

		if time.Since(info.ModTime()) > cm.config.RotationInterval {
			filePath := fmt.Sprintf("%s/%s", backupDir, file.Name())
			err := os.Remove(filePath)
			if err != nil {
				cm.logger.WithError(err).WithField("file", filePath).Warn("Failed to remove expired backup certificate")
			} else {
				cleaned++
			}
		}
	}

	if cleaned > 0 {
		cm.logger.WithField("cleaned_count", cleaned).Info("Cleaned up expired certificate backups")
	}

	return nil
}

// Private methods

func (cm *CertificateManager) initCertDirectory() error {
	certDir := cm.config.CertDirectory
	if certDir == "" {
		certDir = "./certs"
	}

	err := os.MkdirAll(certDir, 0750)
	if err != nil {
		return fmt.Errorf("failed to create certificate directory: %w", err)
	}

	if cm.config.BackupCerts {
		backupDir := cm.config.BackupDir
		if backupDir == "" {
			backupDir = "./certs/backup"
		}

		err = os.MkdirAll(backupDir, 0750)
		if err != nil {
			return fmt.Errorf("failed to create backup directory: %w", err)
		}
	}

	return nil
}

func (cm *CertificateManager) loadOrGenerateCertificates() error {
	// Try to load existing certificates
	if cm.config.CertFile != "" && cm.config.KeyFile != "" {
		certInfo, err := cm.loadCertificate(cm.config.CertFile, cm.config.KeyFile, cm.config.CAFile)
		if err == nil {
			cm.certInfo = certInfo
			cm.logger.Info("Loaded existing TLS certificates")

			// Validate certificate
			if err := cm.ValidateCertificate(); err != nil {
				cm.logger.WithError(err).Warn("Loaded certificate validation failed, will rotate")
				return cm.rotateCertificateInternal()
			}

			return nil
		}
		cm.logger.WithError(err).Info("Failed to load existing certificates, will generate new ones")
	}

	// Generate new certificates
	return cm.rotateCertificateInternal()
}

func (cm *CertificateManager) loadCertificate(certFile, keyFile, caFile string) (*CertificateInfo, error) {
	// Cert/key/CA paths come from administrator-managed configuration; clean
	// them to prevent traversal artifacts before reading.
	certFile = filepath.Clean(certFile)
	keyFile = filepath.Clean(keyFile)
	if caFile != "" {
		caFile = filepath.Clean(caFile)
	}

	// Load certificate
	// #nosec G304 -- certFile is administrator-managed config, cleaned above
	certPEM, err := os.ReadFile(certFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read certificate file: %w", err)
	}

	certBlock, _ := pem.Decode(certPEM)
	if certBlock == nil {
		return nil, fmt.Errorf("failed to decode certificate PEM")
	}

	cert, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse certificate: %w", err)
	}

	// Load private key
	// #nosec G304 -- keyFile is administrator-managed config, cleaned above
	keyPEM, err := os.ReadFile(keyFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read key file: %w", err)
	}

	keyBlock, _ := pem.Decode(keyPEM)
	if keyBlock == nil {
		return nil, fmt.Errorf("failed to decode key PEM")
	}

	var privateKey interface{}
	privateKey, err = x509.ParsePKCS8PrivateKey(keyBlock.Bytes)
	if err != nil {
		if key, err := x509.ParsePKCS1PrivateKey(keyBlock.Bytes); err == nil {
			privateKey = key
		} else if key, err := x509.ParseECPrivateKey(keyBlock.Bytes); err == nil {
			privateKey = key
		} else {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}
	}

	// Load CA certificate if provided
	var caCert *x509.Certificate
	if caFile != "" {
		// #nosec G304 -- caFile is administrator-managed config, cleaned above
		caPEM, err := os.ReadFile(caFile)
		if err != nil {
			cm.logger.WithError(err).Warn("Failed to read CA file")
		} else {
			caBlock, _ := pem.Decode(caPEM)
			if caBlock != nil {
				caCert, err = x509.ParseCertificate(caBlock.Bytes)
				if err != nil {
					cm.logger.WithError(err).Warn("Failed to parse CA certificate")
				}
			}
		}
	}

	certInfo := &CertificateInfo{
		Certificate:  cert,
		PrivateKey:   privateKey,
		CertFile:     certFile,
		KeyFile:      keyFile,
		CAFile:       caFile,
		ExpiresAt:    cert.NotAfter,
		NotBefore:    cert.NotBefore,
		SerialNumber: cert.SerialNumber,
		Subject:      cert.Subject.String(),
		Issuer:       cert.Issuer.String(),
		DNSNames:     cert.DNSNames,
		IPAddresses:  cert.IPAddresses,
	}

	cm.caCert = caCert

	return certInfo, nil
}

func (cm *CertificateManager) rotateCertificateInternal() error {
	cm.logger.Info("Starting certificate rotation")

	// Backup existing certificates if they exist
	if cm.certInfo != nil && cm.config.BackupCerts {
		if err := cm.backupCertificates(); err != nil {
			cm.logger.WithError(err).Warn("Failed to backup existing certificates")
		}
	}

	// Generate CA certificate if not exists
	if cm.caCert == nil || cm.caKey == nil {
		caCert, caKey, err := cm.generateCACertificate()
		if err != nil {
			return fmt.Errorf("failed to generate CA certificate: %w", err)
		}
		cm.caCert = caCert
		cm.caKey = caKey

		// Save CA certificate
		if err := cm.saveCACertificate(caCert, caKey); err != nil {
			cm.logger.WithError(err).Warn("Failed to save CA certificate")
		}
	}

	// Generate server certificate
	cert, key, err := cm.generateServerCertificate()
	if err != nil {
		return fmt.Errorf("failed to generate server certificate: %w", err)
	}

	// Save certificates
	certFile, keyFile, err := cm.saveCertificate(cert, key)
	if err != nil {
		return fmt.Errorf("failed to save certificates: %w", err)
	}

	// Update certificate info
	cm.certInfo = &CertificateInfo{
		Certificate:  cert,
		PrivateKey:   key,
		CertFile:     certFile,
		KeyFile:      keyFile,
		CAFile:       cm.config.CAFile,
		ExpiresAt:    cert.NotAfter,
		NotBefore:    cert.NotBefore,
		SerialNumber: cert.SerialNumber,
		Subject:      cert.Subject.String(),
		Issuer:       cert.Issuer.String(),
		DNSNames:     cert.DNSNames,
		IPAddresses:  cert.IPAddresses,
	}

	cm.logger.WithFields(logrus.Fields{
		"cert_file":  certFile,
		"key_file":   keyFile,
		"expires_at": cert.NotAfter,
	}).Info("Certificate rotation completed")

	return nil
}

func (cm *CertificateManager) generateCACertificate() (*x509.Certificate, interface{}, error) {
	// Generate ECDSA private key
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate CA private key: %w", err)
	}

	// Create CA certificate template
	serialNumber, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate serial number: %w", err)
	}

	template := &x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			CommonName:   "SDLC Platform CA",
			Organization: []string{"SDLC Platform"},
			Country:      []string{"US"},
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(365 * 24 * time.Hour), // 1 year
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth},
		BasicConstraintsValid: true,
		IsCA:                  true,
		MaxPathLen:            2,
		DNSNames:              []string{"sdlc-platform-ca.local"},
	}

	// Create certificate
	certDER, err := x509.CreateCertificate(rand.Reader, template, template, &privateKey.PublicKey, privateKey)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create CA certificate: %w", err)
	}

	// Parse certificate
	cert, err := x509.ParseCertificate(certDER)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse CA certificate: %w", err)
	}

	return cert, privateKey, nil
}

func (cm *CertificateManager) generateServerCertificate() (*x509.Certificate, interface{}, error) {
	// Generate ECDSA private key
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate server private key: %w", err)
	}

	// Create server certificate template
	serialNumber, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate serial number: %w", err)
	}

	// Get common names from configuration or use defaults
	commonNames := []string{"localhost", "sdlc-platform.local"}

	template := &x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			CommonName:   "SDLC Platform Service",
			Organization: []string{"SDLC Platform"},
			Country:      []string{"US"},
		},
		NotBefore:   time.Now(),
		NotAfter:    time.Now().Add(cm.config.RotationInterval),
		KeyUsage:    x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth},
		DNSNames:    commonNames,
		IPAddresses: []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("::1")},
	}

	// Create certificate signed by CA
	certDER, err := x509.CreateCertificate(rand.Reader, template, cm.caCert, &privateKey.PublicKey, cm.caKey)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create server certificate: %w", err)
	}

	// Parse certificate
	cert, err := x509.ParseCertificate(certDER)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse server certificate: %w", err)
	}

	return cert, privateKey, nil
}

func (cm *CertificateManager) saveCertificate(cert *x509.Certificate, key interface{}) (string, string, error) {
	certDir := cm.config.CertDirectory
	if certDir == "" {
		certDir = "./certs"
	}

	timestamp := time.Now().Format("20060102-150405")
	certFile := fmt.Sprintf("%s/server-%s.crt", certDir, timestamp)
	keyFile := fmt.Sprintf("%s/server-%s.key", certDir, timestamp)

	// Save certificate
	certPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: cert.Raw,
	})

	err := os.WriteFile(certFile, certPEM, 0600)
	if err != nil {
		return "", "", fmt.Errorf("failed to write certificate file: %w", err)
	}

	// Save private key
	keyBytes, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return "", "", fmt.Errorf("failed to marshal private key: %w", err)
	}

	keyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: keyBytes,
	})

	err = os.WriteFile(keyFile, keyPEM, 0600)
	if err != nil {
		return "", "", fmt.Errorf("failed to write key file: %w", err)
	}

	// Update configuration
	cm.config.CertFile = certFile
	cm.config.KeyFile = keyFile

	return certFile, keyFile, nil
}

func (cm *CertificateManager) saveCACertificate(cert *x509.Certificate, key interface{}) error {
	certDir := cm.config.CertDirectory
	if certDir == "" {
		certDir = "./certs"
	}

	caFile := fmt.Sprintf("%s/ca.crt", certDir)
	caKeyFile := fmt.Sprintf("%s/ca.key", certDir)

	// Save CA certificate
	certPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: cert.Raw,
	})

	err := os.WriteFile(caFile, certPEM, 0600)
	if err != nil {
		return fmt.Errorf("failed to write CA certificate file: %w", err)
	}

	// Save CA private key
	keyBytes, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return fmt.Errorf("failed to marshal CA private key: %w", err)
	}

	keyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: keyBytes,
	})

	err = os.WriteFile(caKeyFile, keyPEM, 0600)
	if err != nil {
		return fmt.Errorf("failed to write CA key file: %w", err)
	}

	// Update configuration
	cm.config.CAFile = caFile

	return nil
}

func (cm *CertificateManager) backupCertificates() error {
	if cm.certInfo == nil {
		return nil
	}

	backupDir := cm.config.BackupDir
	if backupDir == "" {
		backupDir = "./certs/backup"
	}

	timestamp := time.Now().Format("20060102-150405")
	backupCertFile := fmt.Sprintf("%s/server-%s.crt", backupDir, timestamp)
	backupKeyFile := fmt.Sprintf("%s/server-%s.key", backupDir, timestamp)

	// Backup certificate file
	if cm.certInfo.CertFile != "" {
		err := copyFile(cm.certInfo.CertFile, backupCertFile)
		if err != nil {
			return fmt.Errorf("failed to backup certificate file: %w", err)
		}
	}

	// Backup key file
	if cm.certInfo.KeyFile != "" {
		err := copyFile(cm.certInfo.KeyFile, backupKeyFile)
		if err != nil {
			return fmt.Errorf("failed to backup key file: %w", err)
		}
	}

	cm.logger.WithFields(logrus.Fields{
		"backup_cert": backupCertFile,
		"backup_key":  backupKeyFile,
	}).Info("Certificates backed up")

	return nil
}

func (cm *CertificateManager) startCertificateRotation() {
	cm.rotator = &CertificateRotator{
		manager:     cm,
		stopChannel: make(chan struct{}),
		running:     true,
	}

	cm.rotator.start()
}

func (cr *CertificateRotator) start() {
	cr.mutex.Lock()
	defer cr.mutex.Unlock()

	if cr.running {
		return
	}

	// Calculate rotation interval (check every hour or 1/10 of rotation interval, whichever is smaller)
	checkInterval := cr.manager.config.RotationInterval / 10
	if checkInterval > time.Hour {
		checkInterval = time.Hour
	}

	cr.ticker = time.NewTicker(checkInterval)
	cr.running = true

	go func() {
		for {
			select {
			case <-cr.ticker.C:
				cr.checkAndRotate()
			case <-cr.stopChannel:
				return
			}
		}
	}()

	cr.manager.logger.WithField("check_interval", checkInterval).Info("Certificate rotation started")
}

func (cr *CertificateRotator) stop() {
	cr.mutex.Lock()
	defer cr.mutex.Unlock()

	if !cr.running {
		return
	}

	close(cr.stopChannel)
	if cr.ticker != nil {
		cr.ticker.Stop()
	}
	cr.running = false

	cr.manager.logger.Info("Certificate rotation stopped")
}

func (cr *CertificateRotator) checkAndRotate() {
	// Validate current certificate
	err := cr.manager.ValidateCertificate()
	if err != nil {
		cr.manager.logger.WithError(err).Info("Certificate validation failed, rotating")
		if err := cr.manager.rotateCertificateInternal(); err != nil {
			cr.manager.logger.WithError(err).Error("Failed to rotate certificate")
		}
		return
	}

	// Check if rotation is needed
	if cr.manager.certInfo != nil {
		threshold := time.Duration(float64(cr.manager.certInfo.ExpiresAt.Sub(cr.manager.certInfo.NotBefore)) * cr.manager.config.RotationThreshold)
		if time.Until(cr.manager.certInfo.ExpiresAt) < threshold {
			cr.manager.logger.Info("Certificate approaching rotation threshold, rotating")
			if err := cr.manager.rotateCertificateInternal(); err != nil {
				cr.manager.logger.WithError(err).Error("Failed to rotate certificate")
			}
		}
	}
}

// Utility functions

func copyFile(src, dst string) error {
	// Reject path traversal: callers must supply clean, absolute paths.
	cleanSrc := filepath.Clean(src)
	cleanDst := filepath.Clean(dst)
	if strings.Contains(cleanSrc, "..") || strings.Contains(cleanDst, "..") {
		return fmt.Errorf("path traversal rejected: src=%q dst=%q", src, dst)
	}
	data, err := os.ReadFile(cleanSrc) // #nosec G304 -- path cleaned + validated above
	if err != nil {
		return err
	}
	return os.WriteFile(cleanDst, data, 0600) // #nosec G304 G703 -- path cleaned + validated above
}

func (cm *CertificateManager) getPrivateKeyBytes() []byte {
	if cm.certInfo == nil || cm.certInfo.PrivateKey == nil {
		return nil
	}

	keyBytes, err := x509.MarshalPKCS8PrivateKey(cm.certInfo.PrivateKey)
	if err != nil {
		return nil
	}

	return pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: keyBytes,
	})
}

func (cm *CertificateManager) encodeCertificate(cert *x509.Certificate) []byte {
	return pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: cert.Raw,
	})
}

func (cm *CertificateManager) parseTLSVersion(version string) uint16 {
	switch version {
	case "1.0":
		return tls.VersionTLS10
	case "1.1":
		return tls.VersionTLS11
	case "1.2":
		return tls.VersionTLS12
	case "1.3":
		return tls.VersionTLS13
	default:
		return tls.VersionTLS12
	}
}

func (cm *CertificateManager) parseCipherSuites(suites []string) []uint16 {
	var result []uint16
	cipherMap := map[string]uint16{
		"TLS_RSA_WITH_AES_128_CBC_SHA":            tls.TLS_RSA_WITH_AES_128_CBC_SHA,
		"TLS_RSA_WITH_AES_256_CBC_SHA":            tls.TLS_RSA_WITH_AES_256_CBC_SHA,
		"TLS_RSA_WITH_AES_128_GCM_SHA256":         tls.TLS_RSA_WITH_AES_128_GCM_SHA256,
		"TLS_RSA_WITH_AES_256_GCM_SHA384":         tls.TLS_RSA_WITH_AES_256_GCM_SHA384,
		"TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA":    tls.TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA,
		"TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA":    tls.TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA,
		"TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256": tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
		"TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384": tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
		"TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA":      tls.TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA,
		"TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA":      tls.TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA,
		"TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256":   tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
		"TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384":   tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
	}

	for _, suite := range suites {
		if cipher, exists := cipherMap[suite]; exists {
			result = append(result, cipher)
		}
	}

	return result
}

func (cm *CertificateManager) parseCurvePreferences(curves []string) []tls.CurveID {
	var result []tls.CurveID
	curveMap := map[string]tls.CurveID{
		"P256":   tls.CurveP256,
		"P384":   tls.CurveP384,
		"P521":   tls.CurveP521,
		"X25519": tls.X25519,
	}

	for _, curve := range curves {
		if curveID, exists := curveMap[curve]; exists {
			result = append(result, curveID)
		}
	}

	return result
}

// Stop stops the certificate manager and its rotation
func (cm *CertificateManager) Stop() {
	if cm.rotator != nil {
		cm.rotator.stop()
	}
}
