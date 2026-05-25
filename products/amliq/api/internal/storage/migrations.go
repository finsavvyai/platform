package storage

type Migration struct {
	Version string
	Up      string
	Down    string
}

var migrations = []Migration{
	{
		Version: "001",
		Up:      "migrations/001_create_tenants.up.sql",
		Down:    "migrations/001_create_tenants.down.sql",
	},
	{
		Version: "002",
		Up:      "migrations/002_create_entities.up.sql",
		Down:    "migrations/002_create_entities.down.sql",
	},
	{
		Version: "003",
		Up:      "migrations/003_create_screenings.up.sql",
		Down:    "migrations/003_create_screenings.down.sql",
	},
	{
		Version: "004",
		Up:      "migrations/004_create_alerts.up.sql",
		Down:    "migrations/004_create_alerts.down.sql",
	},
	{
		Version: "005",
		Up:      "migrations/005_create_audit.up.sql",
		Down:    "migrations/005_create_audit.down.sql",
	},
}

func GetMigrations() []Migration {
	return migrations
}
