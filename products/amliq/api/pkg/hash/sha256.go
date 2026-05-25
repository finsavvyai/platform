package hash

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
)

func SHA256(data []byte) string {
	h := sha256.New()
	h.Write(data)
	return hex.EncodeToString(h.Sum(nil))
}

func SHA256Reader(r io.Reader) (string, error) {
	h := sha256.New()
	if _, err := io.Copy(h, r); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func SHA256String(s string) string {
	return SHA256([]byte(s))
}
