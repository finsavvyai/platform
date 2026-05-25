package agent

import (
	"crypto/aes"
	"crypto/sha256"
	"fmt"
)

// EncryptedResult is the outcome of token-based encrypted screening.
type EncryptedResult struct {
	TokenIndex         int
	Matched            bool
	EncryptedMatchData []byte
}

// EncryptedScreener performs deterministic encrypted token screening.
type EncryptedScreener struct {
	tokenIndex map[string][]byte // encrypted token -> match data
}

// NewEncryptedScreener creates a new encrypted screener.
func NewEncryptedScreener() *EncryptedScreener {
	return &EncryptedScreener{
		tokenIndex: make(map[string][]byte),
	}
}

// LoadTokenizedEntities pre-encrypts entity names with the given key.
func (es *EncryptedScreener) LoadTokenizedEntities(
	names []string, key []byte,
) error {
	tokens := GenerateTokens(names, key)
	for i, tok := range tokens {
		es.tokenIndex[string(tok)] = []byte(fmt.Sprintf("entity_%d", i))
	}
	return nil
}

// GenerateTokens encrypts names using deterministic AES encryption.
func GenerateTokens(names []string, key []byte) [][]byte {
	derivedKey := deriveKey(key)
	tokens := make([][]byte, len(names))
	for i, name := range names {
		tokens[i] = encryptDeterministic(normalizeName(name), derivedKey)
	}
	return tokens
}

// ScreenTokens checks encrypted tokens against the pre-encrypted index.
func (es *EncryptedScreener) ScreenTokens(
	tokens [][]byte,
) ([]EncryptedResult, error) {
	var results []EncryptedResult
	for i, tok := range tokens {
		matchData, found := es.tokenIndex[string(tok)]
		results = append(results, EncryptedResult{
			TokenIndex: i, Matched: found, EncryptedMatchData: matchData,
		})
	}
	return results, nil
}

func deriveKey(key []byte) []byte {
	h := sha256.Sum256(key)
	return h[:]
}

// encryptDeterministic uses AES-ECB for deterministic encryption.
func encryptDeterministic(plaintext string, key []byte) []byte {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil
	}
	data := padPKCS7([]byte(plaintext), aes.BlockSize)
	encrypted := make([]byte, len(data))
	for i := 0; i < len(data); i += aes.BlockSize {
		block.Encrypt(encrypted[i:i+aes.BlockSize], data[i:i+aes.BlockSize])
	}
	return encrypted
}

func padPKCS7(data []byte, blockSize int) []byte {
	padding := blockSize - len(data)%blockSize
	pad := make([]byte, padding)
	for i := range pad {
		pad[i] = byte(padding)
	}
	return append(data, pad...)
}
