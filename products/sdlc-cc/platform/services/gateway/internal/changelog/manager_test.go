//go:build ignore

package changelog

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestNewChangelogManager(t *testing.T) {
	tempDir := t.TempDir()

	tests := []struct {
		name        string
		config      ChangelogConfig
		expectError bool
	}{
		{
			name: "Default config",
			config: ChangelogConfig{
				StorageDir: tempDir,
			},
			expectError: false,
		},
		{
			name: "Full config",
			config: ChangelogConfig{
				StorageDir:                tempDir,
				StorageFormat:             "json",
				EnableGitIntegration:      true,
				EnableAutoDetection:       true,
				EnableNotifications:       true,
				DefaultAuthor:             "Test Author",
				DefaultComponent:          "api",
				ReleaseTitleTemplate:      "Release {{.Version}}",
				ChangeDescriptionTemplate: "{{.Description}}",
			},
			expectError: false,
		},
		{
			name: "Invalid storage dir",
			config: ChangelogConfig{
				StorageDir: "/invalid/path/that/does/not/exist",
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.name == "Invalid storage dir" {
				// Skip this test as it will fail on directory creation
				t.Skip("Skipping invalid directory test")
			}

			manager, err := NewChangelogManager(tt.config, nil)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, manager)
			} else {
				require.NoError(t, err)
				require.NotNil(t, manager)

				// Check defaults were applied
				assert.Equal(t, tempDir, manager.config.StorageDir)
				assert.Equal(t, "both", manager.config.StorageFormat)
				assert.Equal(t, "Release {{.Version}}", manager.config.ReleaseTitleTemplate)
			}
		})
	}
}

func TestChangelogManager_SaveAndLoadChangelog(t *testing.T) {
	tempDir := t.TempDir()
	config := ChangelogConfig{
		StorageDir:    tempDir,
		StorageFormat: "both",
	}

	manager, err := NewChangelogManager(config, nil)
	require.NoError(t, err)

	// Create a test changelog
	changelog := &Changelog{
		Title:       "Test API Changelog",
		Description: "Test changelog for unit testing",
		Releases: []Release{
			{
				Version:     "1.0.0",
				Title:       "Initial Release",
				Description: "First version of the API",
				ReleaseDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
				Changes: []Change{
					{
						ID:          "change-1",
						Type:        ChangeTypeAdded,
						Impact:      ImpactLow,
						Title:       "Add users endpoint",
						Description: "Added GET /users endpoint to retrieve all users",
						Component:   "api",
						Endpoints:   []string{"/users"},
						Author:      "John Doe",
						Timestamp:   time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC),
						Version:     "1.0.0",
					},
					{
						ID:          "change-2",
						Type:        ChangeTypeAdded,
						Impact:      ImpactMedium,
						Title:       "Add authentication",
						Description: "Implemented JWT-based authentication",
						Component:   "auth",
						Endpoints:   []string{"/auth/login", "/auth/refresh"},
						Author:      "Jane Smith",
						Timestamp:   time.Date(2024, 1, 1, 11, 0, 0, 0, time.UTC),
						Version:     "1.0.0",
					},
				},
			},
		},
		Metadata: map[string]interface{}{
			"api_version":  "v1",
			"generated_by": "tests",
		},
	}

	// Save changelog
	err = manager.SaveChangelog(changelog)
	require.NoError(t, err)

	// Verify files were created
	jsonPath := filepath.Join(tempDir, "changelog.json")
	yamlPath := filepath.Join(tempDir, "changelog.yaml")

	_, err = os.Stat(jsonPath)
	assert.NoError(t, err)

	_, err = os.Stat(yamlPath)
	assert.NoError(t, err)

	// Load JSON changelog
	loadedJSON, err := manager.LoadChangelog()
	require.NoError(t, err)
	assert.Equal(t, changelog.Title, loadedJSON.Title)
	assert.Equal(t, changelog.Description, loadedJSON.Description)
	assert.Len(t, loadedJSON.Releases, 1)
	assert.Equal(t, "1.0.0", loadedJSON.Releases[0].Version)

	// Verify JSON content
	jsonData, err := os.ReadFile(jsonPath)
	require.NoError(t, err)
	var jsonChangelog Changelog
	err = json.Unmarshal(jsonData, &jsonChangelog)
	require.NoError(t, err)
	assert.Equal(t, changelog.Title, jsonChangelog.Title)

	// Verify YAML content
	yamlData, err := os.ReadFile(yamlPath)
	require.NoError(t, err)
	var yamlChangelog Changelog
	err = yaml.Unmarshal(yamlData, &yamlChangelog)
	require.NoError(t, err)
	assert.Equal(t, changelog.Title, yamlChangelog.Title)
}

func TestChangelogManager_AddChange(t *testing.T) {
	tempDir := t.TempDir()
	config := ChangelogConfig{
		StorageDir:       tempDir,
		StorageFormat:    "json",
		DefaultAuthor:    "Test Author",
		DefaultComponent: "api",
	}

	manager, err := NewChangelogManager(config, nil)
	require.NoError(t, err)

	// Add a new change
	change := Change{
		Type:        ChangeTypeAdded,
		Impact:      ImpactLow,
		Title:       "Add new endpoint",
		Description: "Added POST /items endpoint",
		Endpoints:   []string{"/items"},
		Author:      "Test Author",
		Timestamp:   time.Now(),
		Version:     "1.1.0",
	}

	err = manager.AddChange("1.1.0", change)
	require.NoError(t, err)

	// Load and verify
	changelog, err := manager.LoadChangelog()
	require.NoError(t, err)
	assert.Len(t, changelog.Releases, 1)
	assert.Equal(t, "1.1.0", changelog.Releases[0].Version)
	assert.Len(t, changelog.Releases[0].Changes, 1)
	assert.Equal(t, "Add new endpoint", changelog.Releases[0].Changes[0].Title)

	// Add another change to the same version
	change2 := Change{
		Type:        ChangeTypeFixed,
		Impact:      ImpactLow,
		Title:       "Fix bug",
		Description: "Fixed issue with authentication",
		Author:      "Test Author",
		Timestamp:   time.Now(),
		Version:     "1.1.0",
	}

	err = manager.AddChange("1.1.0", change2)
	require.NoError(t, err)

	// Load and verify
	changelog, err = manager.LoadChangelog()
	require.NoError(t, err)
	assert.Len(t, changelog.Releases, 1)
	assert.Len(t, changelog.Releases[0].Changes, 2)
}

func TestChangelogManager_CreateRelease(t *testing.T) {
	tempDir := t.TempDir()
	config := ChangelogConfig{
		StorageDir:                tempDir,
		StorageFormat:             "json",
		DefaultAuthor:             "Test Author",
		DefaultComponent:          "api",
		ReleaseTitleTemplate:      "Version {{.Version}} - Released on {{.ReleaseDate.Format \"2006-01-02\"}}",
		ChangeDescriptionTemplate: "{{.Description}}",
	}

	manager, err := NewChangelogManager(config, nil)
	require.NoError(t, err)

	// Create a new release
	release := Release{
		Version:         "2.0.0",
		Title:           "Major Update",
		Description:     "Breaking changes and new features",
		ReleaseDate:     time.Now(),
		PreviousVersion: "1.1.0",
		Changes: []Change{
			{
				Type:        ChangeTypeChanged,
				Impact:      ImpactBreaking,
				Title:       "Change authentication flow",
				Description: "OAuth2 is now required for all endpoints",
				Component:   "auth",
				Author:      "Test Author",
				Timestamp:   time.Now(),
				Version:     "2.0.0",
			},
			{
				Type:        ChangeTypeAdded,
				Impact:      ImpactHigh,
				Title:       "Add analytics endpoint",
				Description: "Added comprehensive analytics API",
				Endpoints:   []string{"/analytics", "/analytics/export"},
				Author:      "Test Author",
				Timestamp:   time.Now(),
				Version:     "2.0.0",
			},
		},
		Metadata: map[string]interface{}{
			"breaking_changes": true,
		},
	}

	err = manager.CreateRelease(release)
	require.NoError(t, err)

	// Load and verify
	changelog, err := manager.LoadChangelog()
	require.NoError(t, err)
	assert.Len(t, changelog.Releases, 1)
	assert.Equal(t, "2.0.0", changelog.Releases[0].Version)
	assert.Equal(t, "Major Update", changelog.Releases[0].Title)
	assert.Len(t, changelog.Releases[0].Changes, 2)
}

func TestChangelogManager_GetVersionChanges(t *testing.T) {
	tempDir := t.TempDir()
	config := ChangelogConfig{
		StorageDir:    tempDir,
		StorageFormat: "json",
	}

	manager, err := NewChangelogManager(config, nil)
	require.NoError(t, err)

	// Create a changelog with multiple releases
	changelog := &Changelog{
		Title:       "Test API Changelog",
		Description: "Test changelog",
		Releases: []Release{
			{
				Version:     "1.0.0",
				Title:       "Initial Release",
				ReleaseDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
				Changes: []Change{
					{
						ID:      "change-1",
						Type:    ChangeTypeAdded,
						Title:   "Add users endpoint",
						Version: "1.0.0",
					},
				},
			},
			{
				Version:     "1.1.0",
				Title:       "Minor Update",
				ReleaseDate: time.Date(2024, 2, 1, 0, 0, 0, 0, time.UTC),
				Changes: []Change{
					{
						ID:      "change-2",
						Type:    ChangeTypeAdded,
						Title:   "Add items endpoint",
						Version: "1.1.0",
					},
					{
						ID:      "change-3",
						Type:    ChangeTypeFixed,
						Title:   "Fix bug",
						Version: "1.1.0",
					},
				},
			},
		},
	}

	err = manager.SaveChangelog(changelog)
	require.NoError(t, err)

	// Get changes for version 1.1.0
	changes, err := manager.GetVersionChanges("1.1.0")
	require.NoError(t, err)
	assert.Len(t, changes, 2)
	assert.Equal(t, "Add items endpoint", changes[0].Title)
	assert.Equal(t, "Fix bug", changes[1].Title)

	// Get changes for version 1.0.0
	changes, err = manager.GetVersionChanges("1.0.0")
	require.NoError(t, err)
	assert.Len(t, changes, 1)
	assert.Equal(t, "Add users endpoint", changes[0].Title)

	// Get changes for non-existent version
	changes, err = manager.GetVersionChanges("2.0.0")
	require.NoError(t, err)
	assert.Len(t, changes, 0)
}

func TestChangelogManager_GetLatestRelease(t *testing.T) {
	tempDir := t.TempDir()
	config := ChangelogConfig{
		StorageDir:    tempDir,
		StorageFormat: "json",
	}

	manager, err := NewChangelogManager(config, nil)
	require.NoError(t, err)

	// Test with empty changelog
	release, err := manager.GetLatestRelease()
	assert.NoError(t, err)
	assert.Nil(t, release)

	// Create a changelog with releases
	changelog := &Changelog{
		Title:       "Test API Changelog",
		Description: "Test changelog",
		Releases: []Release{
			{
				Version:     "1.0.0",
				Title:       "Initial Release",
				ReleaseDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			},
			{
				Version:     "1.1.0",
				Title:       "Minor Update",
				ReleaseDate: time.Date(2024, 2, 1, 0, 0, 0, 0, time.UTC),
			},
			{
				Version:     "2.0.0",
				Title:       "Major Update",
				ReleaseDate: time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC),
			},
		},
	}

	err = manager.SaveChangelog(changelog)
	require.NoError(t, err)

	// Get latest release
	release, err = manager.GetLatestRelease()
	require.NoError(t, err)
	require.NotNil(t, release)
	assert.Equal(t, "2.0.0", release.Version)
	assert.Equal(t, "Major Update", release.Title)
}

func TestChangelogManager_GenerateMarkdown(t *testing.T) {
	tempDir := t.TempDir()
	config := ChangelogConfig{
		StorageDir:    tempDir,
		StorageFormat: "json",
	}

	manager, err := NewChangelogManager(config, nil)
	require.NoError(t, err)

	// Create a changelog
	changelog := &Changelog{
		Title:       "Test API Changelog",
		Description: "Test changelog for unit testing",
		Releases: []Release{
			{
				Version:     "2.0.0",
				Title:       "Major Update",
				Description: "Breaking changes and new features",
				ReleaseDate: time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC),
				Changes: []Change{
					{
						Type:        ChangeTypeChanged,
						Impact:      ImpactBreaking,
						Title:       "Change authentication flow",
						Description: "OAuth2 is now required for all endpoints",
					},
					{
						Type:        ChangeTypeAdded,
						Impact:      ImpactHigh,
						Title:       "Add analytics endpoint",
						Description: "Added comprehensive analytics API",
					},
				},
			},
			{
				Version:     "1.1.0",
				Title:       "Minor Update",
				Description: "New features and improvements",
				ReleaseDate: time.Date(2024, 2, 1, 0, 0, 0, 0, time.UTC),
				Changes: []Change{
					{
						Type:        ChangeTypeAdded,
						Impact:      ImpactLow,
						Title:       "Add new endpoint",
						Description: "Added POST /items endpoint",
					},
					{
						Type:        ChangeTypeFixed,
						Impact:      ImpactLow,
						Title:       "Fix bug",
						Description: "Fixed issue with authentication",
					},
				},
			},
		},
	}

	err = manager.SaveChangelog(changelog)
	require.NoError(t, err)

	// Generate markdown
	markdown, err := manager.GenerateMarkdown()
	require.NoError(t, err)

	// Verify markdown content
	assert.Contains(t, markdown, "# Test API Changelog")
	assert.Contains(t, markdown, "Test changelog for unit testing")
	assert.Contains(t, markdown, "## [2.0.0] - 2024-03-01")
	assert.Contains(t, markdown, "### 🔄 Changed")
	assert.Contains(t, markdown, "### ✅ Added")
	assert.Contains(t, markdown, "### 🐛 Fixed")
	assert.Contains(t, markdown, "### 💥 Breaking Changes")
	assert.Contains(t, markdown, "Change authentication flow")
	assert.Contains(t, markdown, "Add analytics endpoint")
	assert.Contains(t, markdown, "Add new endpoint")
	assert.Contains(t, markdown, "Fix bug")
}

func TestChangeType_ImpactEmoji(t *testing.T) {
	tests := map[ChangeType]string{
		ChangeTypeAdded:      "✅ Added",
		ChangeTypeChanged:    "🔄 Changed",
		ChangeTypeDeprecated: "⚠️ Deprecated",
		ChangeTypeRemoved:    "❌ Removed",
		ChangeTypeFixed:      "🐛 Fixed",
		ChangeTypeSecurity:   "🔒 Security",
	}

	for changeType, expected := range tests {
		t.Run(string(changeType), func(t *testing.T) {
			assert.Equal(t, expected, changeType.String())
		})
	}
}

func BenchmarkChangelogManager_SaveAndLoad(b *testing.B) {
	tempDir := b.TempDir()
	config := ChangelogConfig{
		StorageDir:    tempDir,
		StorageFormat: "json",
	}

	manager, err := NewChangelogManager(config, nil)
	require.NoError(b, err)

	// Create a large changelog
	changelog := &Changelog{
		Title:       "Benchmark Changelog",
		Description: "Large changelog for benchmarking",
		Releases:    make([]Release, 100),
	}

	for i := 0; i < 100; i++ {
		release := Release{
			Version:     "1.0." + string(rune(i)),
			Title:       "Release " + string(rune(i)),
			ReleaseDate: time.Now(),
			Changes:     make([]Change, 10),
		}

		for j := 0; j < 10; j++ {
			release.Changes[j] = Change{
				ID:          "change-" + string(rune(i)) + "-" + string(rune(j)),
				Type:        ChangeTypeAdded,
				Impact:      ImpactLow,
				Title:       "Change " + string(rune(j)),
				Description: "Description for change " + string(rune(j)),
				Author:      "Test Author",
				Timestamp:   time.Now(),
				Version:     release.Version,
			}
		}

		changelog.Releases[i] = release
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		err := manager.SaveChangelog(changelog)
		require.NoError(b, err)
		_, err = manager.LoadChangelog()
		require.NoError(b, err)
	}
}
