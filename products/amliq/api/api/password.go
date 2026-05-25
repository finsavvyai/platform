package api

import "golang.org/x/crypto/bcrypt"

// hashPassword returns a bcrypt hash of the given plaintext password.
func hashPassword(pw string) string {
	hash, err := bcrypt.GenerateFromPassword(
		[]byte(pw), bcrypt.DefaultCost)
	if err != nil {
		return ""
	}
	return string(hash)
}

// checkPassword compares a plaintext password against a bcrypt hash.
func checkPassword(pw, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) == nil
}
