package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTemplate(id, name, dest string, isDefault bool) TemplateRow {
	return TemplateRow{
		ID:          id,
		Name:        name,
		Destination: dest,
		Template:    `{"text": "{{.Title}}"}`,
		IsDefault:   isDefault,
	}
}

func TestCreateTemplate_Basic(t *testing.T) {
	db := newTestDB(t)

	tmpl := newTemplate("tmpl-1", "Slack Alert", "slack", true)
	require.NoError(t, db.CreateTemplate(tmpl))

	got, err := db.GetTemplate("tmpl-1")
	require.NoError(t, err)
	assert.Equal(t, "tmpl-1", got.ID)
	assert.Equal(t, "Slack Alert", got.Name)
	assert.Equal(t, "slack", got.Destination)
	assert.True(t, got.IsDefault)
}

func TestGetTemplate_NotFound(t *testing.T) {
	db := newTestDB(t)

	_, err := db.GetTemplate("no-such-template")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestCreateTemplate_Duplicate(t *testing.T) {
	db := newTestDB(t)

	tmpl := newTemplate("tmpl-dup", "Dup", "email", false)
	require.NoError(t, db.CreateTemplate(tmpl))
	err := db.CreateTemplate(newTemplate("tmpl-dup", "Dup Again", "email", false))
	require.Error(t, err)
}

func TestListTemplates_Empty(t *testing.T) {
	db := newTestDB(t)

	templates, err := db.ListTemplates()
	require.NoError(t, err)
	assert.Empty(t, templates)
}

func TestListTemplates_Multiple(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateTemplate(newTemplate("t1", "Slack", "slack", true)))
	require.NoError(t, db.CreateTemplate(newTemplate("t2", "Teams", "teams", false)))
	require.NoError(t, db.CreateTemplate(newTemplate("t3", "PagerDuty", "pagerduty", false)))

	templates, err := db.ListTemplates()
	require.NoError(t, err)
	assert.Len(t, templates, 3)
}

func TestTemplate_IsDefaultFalse(t *testing.T) {
	db := newTestDB(t)

	tmpl := newTemplate("tmpl-nd", "Non-Default", "teams", false)
	require.NoError(t, db.CreateTemplate(tmpl))

	got, err := db.GetTemplate("tmpl-nd")
	require.NoError(t, err)
	assert.False(t, got.IsDefault)
}

func TestListTemplates_OrderedByCreatedAt(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateTemplate(newTemplate("ta", "A", "slack", false)))
	require.NoError(t, db.CreateTemplate(newTemplate("tb", "B", "slack", false)))
	require.NoError(t, db.CreateTemplate(newTemplate("tc", "C", "slack", false)))

	templates, err := db.ListTemplates()
	require.NoError(t, err)
	require.Len(t, templates, 3)
	// Ordered ASC — first inserted should be first
	assert.Equal(t, "ta", templates[0].ID)
}
