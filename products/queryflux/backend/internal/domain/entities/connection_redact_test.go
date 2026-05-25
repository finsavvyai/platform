package entities

import (
	"strings"
	"testing"
)

func TestConnection_RedactedDSN(t *testing.T) {
	cases := []struct {
		name     string
		c        *Connection
		wantHas  []string
		wantNot  []string
		exact    string
	}{
		{
			name: "postgres with full credentials",
			c: &Connection{
				Type: TypePostgreSQL, Host: "db.example.com", Port: 5432,
				Database: "app", Username: "admin", Password: "s3cret!",
			},
			wantHas: []string{"postgres://", "admin:***@", "db.example.com:5432", "/app"},
			wantNot: []string{"s3cret!"},
		},
		{
			name: "mysql no password",
			c: &Connection{
				Type: TypeMySQL, Host: "127.0.0.1", Port: 3306,
				Database: "shop", Username: "root",
			},
			wantHas: []string{"mysql://", "root@", "127.0.0.1:3306", "/shop"},
			wantNot: []string{":***@"},
		},
		{
			name: "mongodb+srv with credentials",
			c: &Connection{
				Type: "mongodb+srv", Host: "cluster0.mongo.net",
				Database: "core", Username: "svc", Password: "pw",
			},
			wantHas: []string{"mongodb+srv://", "svc:***@", "cluster0.mongo.net", "/core"},
			wantNot: []string{"pw"},
		},
		{
			name: "redis with TLS alias",
			c: &Connection{
				Type: "redis+tls", Host: "cache", Port: 6380,
				Username: "default", Password: "top",
			},
			wantHas: []string{"rediss://", "default:***@", "cache:6380"},
			wantNot: []string{"top"},
		},
		{
			name: "redis no port",
			c: &Connection{
				Type: TypeRedis, Host: "redis-host",
				Username: "u", Password: "p",
			},
			wantHas: []string{"redis://", "u:***@", "redis-host"},
			wantNot: []string{":p@", "redis-host:0"},
		},
		{
			name: "sqlite returns file path unchanged",
			c: &Connection{
				Type: TypeSQLite, Database: "/var/data/app.db",
			},
			exact: "/var/data/app.db",
		},
		{
			name: "ipv6 host is bracketed",
			c: &Connection{
				Type: TypePostgreSQL, Host: "::1", Port: 5432,
				Database: "x", Username: "u", Password: "topsecret",
			},
			wantHas: []string{"postgres://", "u:***@[::1]:5432", "/x"},
			wantNot: []string{"topsecret"},
		},
		{
			name: "mariadb host default when empty",
			c: &Connection{
				Type: TypeMariaDB, Port: 3306,
				Database: "m", Username: "u",
			},
			wantHas: []string{"mariadb://", "localhost:3306", "/m"},
		},
		{
			name:  "nil connection returns empty string",
			c:     nil,
			exact: "",
		},
		{
			name: "no creds and no port still parses",
			c: &Connection{
				Type: TypePostgreSQL, Host: "db", Database: "core",
			},
			wantHas: []string{"postgres://db", "/core"},
			wantNot: []string{":***", "@"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := tc.c.RedactedDSN()
			if tc.exact != "" {
				if got != tc.exact {
					t.Fatalf("RedactedDSN() = %q, want %q", got, tc.exact)
				}
				return
			}
			for _, s := range tc.wantHas {
				if !strings.Contains(got, s) {
					t.Errorf("RedactedDSN() = %q, missing %q", got, s)
				}
			}
			for _, s := range tc.wantNot {
				if strings.Contains(got, s) {
					t.Errorf("RedactedDSN() = %q, must not contain %q", got, s)
				}
			}
		})
	}
}

func TestRedactDSNString(t *testing.T) {
	cases := []struct {
		name    string
		in      string
		wantHas []string
		wantNot []string
		exact   string
	}{
		{
			name:    "postgres URL masks password",
			in:      "postgres://admin:hunter2@db:5432/app",
			wantHas: []string{"admin:***@db:5432/app"},
			wantNot: []string{"hunter2"},
		},
		{
			name:    "mongodb+srv query param is preserved",
			in:      "mongodb+srv://u:p@cluster/db?retryWrites=true",
			wantHas: []string{"u:***@cluster", "retryWrites=true"},
			wantNot: []string{":p@"},
		},
		{
			name:    "query param password is masked",
			in:      "mysql://root@host/db?password=secret&charset=utf8",
			wantHas: []string{"password=***", "charset=utf8"},
			wantNot: []string{"secret"},
		},
		{
			name:    "no scheme falls back to user:pass@host masking",
			in:      "admin:s3cret@host:1234/db",
			wantHas: []string{"admin:***@host:1234/db"},
			wantNot: []string{"s3cret"},
		},
		{
			name:    "no userinfo passes through",
			in:      "redis://cache:6379/0",
			wantHas: []string{"redis://cache:6379/0"},
		},
		{
			name:  "empty input stays empty",
			in:    "",
			exact: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := RedactDSNString(tc.in)
			if tc.exact != "" || tc.in == "" {
				if got != tc.exact {
					t.Fatalf("RedactDSNString() = %q, want %q", got, tc.exact)
				}
				return
			}
			for _, s := range tc.wantHas {
				if !strings.Contains(got, s) {
					t.Errorf("RedactDSNString(%q) = %q, missing %q", tc.in, got, s)
				}
			}
			for _, s := range tc.wantNot {
				if strings.Contains(got, s) {
					t.Errorf("RedactDSNString(%q) = %q, must not contain %q", tc.in, got, s)
				}
			}
		})
	}
}
