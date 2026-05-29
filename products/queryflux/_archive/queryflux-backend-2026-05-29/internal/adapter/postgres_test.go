package adapter

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsDangerousSQL_BlocksDrop(t *testing.T) {
	tests := []struct {
		query     string
		dangerous bool
	}{
		{"DROP TABLE users", true},
		{"TRUNCATE users", true},
		{"ALTER TABLE users ADD COLUMN x TEXT", true},
		{"CREATE TABLE evil (id INT)", true},
		{"GRANT ALL ON users TO evil", true},
		{"REVOKE ALL ON users FROM user1", true},
		{"SELECT * FROM users", false},
		{"INSERT INTO users (email) VALUES ('a@b.com')", false},
		{"UPDATE users SET name = 'x' WHERE id = 1", false},
		{"DELETE FROM users WHERE id = 1", false},
		{"  DROP TABLE users", true},
		{"select * from users", false},
		{"SELECT * FROM users WHERE name = 'DROP'", false},
	}

	for _, tt := range tests {
		t.Run(tt.query, func(t *testing.T) {
			assert.Equal(t, tt.dangerous, IsDangerousSQL(tt.query),
				"IsDangerousSQL(%q) should be %v", tt.query, tt.dangerous)
		})
	}
}
