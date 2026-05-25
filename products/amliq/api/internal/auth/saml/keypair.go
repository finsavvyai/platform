package saml

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"time"
)

// GenerateSPKeypair creates a self-signed RSA-2048 keypair for use as
// the SP signing credential. PEM-encoded for database storage.
// Cert valid for 10y — admins rotate proactively, never reactively.
func GenerateSPKeypair(entityID string) (keyPEM, certPEM []byte, err error) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, nil, err
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return nil, nil, err
	}
	tmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject:      pkix.Name{CommonName: entityID},
		NotBefore:    time.Now().Add(-time.Minute),
		NotAfter:     time.Now().Add(10 * 365 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl,
		&priv.PublicKey, priv)
	if err != nil {
		return nil, nil, err
	}
	keyPEM = pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(priv),
	})
	certPEM = pem.EncodeToMemory(&pem.Block{
		Type: "CERTIFICATE", Bytes: der,
	})
	return keyPEM, certPEM, nil
}

// LoadSPKeypair decodes PEM key + cert into the (signer, leaf) tuple
// crewjam/saml's ServiceProvider expects.
func LoadSPKeypair(keyPEM, certPEM []byte) (crypto.Signer, *x509.Certificate, error) {
	tlsCert, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		return nil, nil, err
	}
	leaf, err := x509.ParseCertificate(tlsCert.Certificate[0])
	if err != nil {
		return nil, nil, err
	}
	return tlsCert.PrivateKey.(crypto.Signer), leaf, nil
}
