package clawpipe

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
)

// KnownLlamafileSHA256 maps known-good llamafile release filenames to their
// upstream SHA256 hashes. Populated by scripts/refresh-llamafile-checksums.sh
// against https://github.com/Mozilla-Ocho/llamafile/releases. Empty by default
// so VerifyLlamafileBinary never blocks; a populated map flips it to "warn on
// mismatch" mode. Verification is advisory, not a security boundary.
var KnownLlamafileSHA256 = map[string]string{
	// Populate via scripts/refresh-llamafile-checksums.sh.
}

// LlamafileChecksumResult reports the outcome of a verification call.
type LlamafileChecksumResult struct {
	Path           string
	ComputedSHA256 string
	Filename       string
	Known          bool
	Match          bool
}

// VerifyLlamafileBinary computes the SHA256 of the file at path and compares
// it against KnownLlamafileSHA256[basename]. The result is advisory:
//   - Known=false  → no entry for that filename, caller should warn-and-continue.
//   - Known=true && Match=false → checksum mismatch, caller should warn loudly.
//   - Known=true && Match=true  → verified.
//
// Errors only when the file is unreadable. Never returns an error solely
// because the allow-list is empty or the filename is absent.
func VerifyLlamafileBinary(path string) (LlamafileChecksumResult, error) {
	res := LlamafileChecksumResult{Path: path, Filename: baseName(path)}

	f, err := os.Open(path)
	if err != nil {
		return res, fmt.Errorf("open llamafile binary %q: %w", path, err)
	}
	defer func() { _ = f.Close() }()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return res, fmt.Errorf("hash llamafile binary %q: %w", path, err)
	}
	res.ComputedSHA256 = hex.EncodeToString(h.Sum(nil))

	expected, ok := KnownLlamafileSHA256[res.Filename]
	res.Known = ok
	if ok {
		res.Match = expected == res.ComputedSHA256
	}
	return res, nil
}

// baseName returns the path component after the last '/'. Inlined to avoid
// pulling path/filepath for one call.
func baseName(p string) string {
	for i := len(p) - 1; i >= 0; i-- {
		if p[i] == '/' || p[i] == '\\' {
			return p[i+1:]
		}
	}
	return p
}
