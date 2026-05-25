package ai

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"strings"

	"go.uber.org/zap"

	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/infrastructure/ai/templates"
)

// TemplateManager manages AI prompt templates
type TemplateManager struct {
	templates map[string]*template.Template
	logger    *zap.Logger
}

// NewTemplateManager creates a new template manager
func NewTemplateManager(logger *zap.Logger) *TemplateManager {
	tm := &TemplateManager{
		templates: make(map[string]*template.Template),
		logger:    logger,
	}

	// Initialize default templates
	tm.initializeDefaultTemplates()

	return tm
}

// initializeDefaultTemplates loads the default prompt templates
func (tm *TemplateManager) initializeDefaultTemplates() {
	defaultTemplates := map[string]string{
		"openai:nl_to_sql":          templates.NLToSQLTemplate,
		"openai:query_optimization": templates.QueryOptimizationTemplate,
		"openai:query_explanation":  templates.QueryExplanationTemplate,
		"openai:error_analysis":     templates.ErrorAnalysisTemplate,
		"openai:schema_analysis":    templates.SchemaAnalysisTemplate,
		"claude:nl_to_sql":          templates.NLToSQLTemplate,
		"claude:query_optimization": templates.QueryOptimizationTemplate,
		"claude:query_explanation":  templates.QueryExplanationTemplate,
		"claude:error_analysis":     templates.ErrorAnalysisTemplate,
		"claude:schema_analysis":    templates.SchemaAnalysisTemplate,
	}

	for key, tmpl := range defaultTemplates {
		t, err := template.New(key).Parse(tmpl)
		if err != nil {
			tm.logger.Error("Failed to parse template",
				zap.String("key", key),
				zap.Error(err))
			continue
		}
		tm.templates[key] = t
		tm.logger.Debug("Loaded default template", zap.String("key", key))
	}
}

// LoadTemplate loads a template for a specific service and operation
func (tm *TemplateManager) LoadTemplate(ctx context.Context, service domain.AIService, operation string) (*domain.AIPromptTemplate, error) {
	key := fmt.Sprintf("%s:%s", service, operation)

	tmpl, exists := tm.templates[key]
	if !exists {
		// Try to load a generic template
		genericKey := fmt.Sprintf("generic:%s", operation)
		tmpl, exists = tm.templates[genericKey]
		if !exists {
			return nil, fmt.Errorf("template not found for service %s and operation %s", service, operation)
		}
	}

	// Extract the template content
	var buf bytes.Buffer
	err := tmpl.Execute(&buf, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to execute template: %w", err)
	}

	// Create AIPromptTemplate
	promptTemplate := &domain.AIPromptTemplate{
		ID:        key,
		Name:      fmt.Sprintf("%s_%s", service, operation),
		Service:   service,
		Operation: operation,
		Template:  buf.String(),
		Variables: tm.extractVariables(buf.String()),
		Enabled:   true,
	}

	return promptTemplate, nil
}

// RenderTemplate renders a template with the provided variables
func (tm *TemplateManager) RenderTemplate(ctx context.Context, promptTemplate *domain.AIPromptTemplate, variables map[string]interface{}) (string, error) {
	// Create or get the template
	t, err := template.New(promptTemplate.ID).Parse(promptTemplate.Template)
	if err != nil {
		tm.logger.Error("Failed to parse template",
			zap.String("id", promptTemplate.ID),
			zap.Error(err))
		return "", fmt.Errorf("failed to parse template: %w", err)
	}

	// Render the template
	var buf bytes.Buffer
	err = t.Execute(&buf, variables)
	if err != nil {
		tm.logger.Error("Failed to render template",
			zap.String("id", promptTemplate.ID),
			zap.Error(err))
		return "", fmt.Errorf("failed to render template: %w", err)
	}

	return buf.String(), nil
}

// ValidateTemplate validates a prompt template
func (tm *TemplateManager) ValidateTemplate(ctx context.Context, promptTemplate *domain.AIPromptTemplate) error {
	// Try to parse the template
	_, err := template.New(promptTemplate.ID).Parse(promptTemplate.Template)
	if err != nil {
		return fmt.Errorf("invalid template syntax: %w", err)
	}

	// Check for required variables based on operation
	requiredVars := tm.getRequiredVariables(promptTemplate.Operation)
	for _, reqVar := range requiredVars {
		found := false
		for _, tmplVar := range promptTemplate.Variables {
			if tmplVar == reqVar {
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("required variable %s not found in template", reqVar)
		}
	}

	return nil
}

// UpdateTemplate updates a template in memory
func (tm *TemplateManager) UpdateTemplate(ctx context.Context, promptTemplate *domain.AIPromptTemplate) error {
	// Validate the template first
	if err := tm.ValidateTemplate(ctx, promptTemplate); err != nil {
		return err
	}

	// Parse and store the template
	t, err := template.New(promptTemplate.ID).Parse(promptTemplate.Template)
	if err != nil {
		return fmt.Errorf("failed to parse updated template: %w", err)
	}

	tm.templates[promptTemplate.ID] = t
	tm.logger.Info("Updated template",
		zap.String("id", promptTemplate.ID),
		zap.String("operation", promptTemplate.Operation))

	return nil
}

// extractVariables extracts template variables from a template string
func (tm *TemplateManager) extractVariables(tmpl string) []string {
	var variables []string
	t, _ := template.New("extract").Parse(tmpl)

	// Execute with a dummy map to capture variable names
	t.Execute(&bytes.Buffer{}, map[string]interface{}{})

	// Simple extraction - look for {{.VariableName}} patterns
	start := strings.Index(tmpl, "{{.")
	for start != -1 {
		end := strings.Index(tmpl[start:], "}}")
		if end == -1 {
			break
		}
		end += start

		// Extract variable name
		varName := strings.TrimSpace(tmpl[start+3 : end])
		if !tm.containsVariable(variables, varName) {
			variables = append(variables, varName)
		}

		// Look for next variable
		start = strings.Index(tmpl[end:], "{{.")
		if start != -1 {
			start += end
		}
	}

	return variables
}

// containsVariable checks if a variable is already in the list
func (tm *TemplateManager) containsVariable(variables []string, variable string) bool {
	for _, v := range variables {
		if v == variable {
			return true
		}
	}
	return false
}

// getRequiredVariables returns the list of required variables for an operation
func (tm *TemplateManager) getRequiredVariables(operation string) []string {
	switch operation {
	case "nl_to_sql":
		return []string{"NLQuery", "DatabaseType", "Schema"}
	case "query_optimization":
		return []string{"SQLQuery", "DatabaseType"}
	case "query_explanation":
		return []string{"SQLQuery", "DatabaseType"}
	case "error_analysis":
		return []string{"SQLQuery", "ErrorMessage"}
	case "schema_analysis":
		return []string{"Schema", "DatabaseType"}
	default:
		return []string{}
	}
}

// ListTemplates returns all available templates
func (tm *TemplateManager) ListTemplates() map[string]string {
	result := make(map[string]string)
	for key := range tm.templates {
		result[key] = key
	}
	return result
}

// DeleteTemplate removes a template
func (tm *TemplateManager) DeleteTemplate(service domain.AIService, operation string) error {
	key := fmt.Sprintf("%s:%s", service, operation)

	if _, exists := tm.templates[key]; !exists {
		return fmt.Errorf("template not found: %s", key)
	}

	delete(tm.templates, key)
	tm.logger.Info("Deleted template", zap.String("key", key))

	return nil
}

// AddCustomTemplate adds a custom template
func (tm *TemplateManager) AddCustomTemplate(service domain.AIService, operation string, templateContent string) error {
	key := fmt.Sprintf("%s:%s", service, operation)

	t, err := template.New(key).Parse(templateContent)
	if err != nil {
		return fmt.Errorf("failed to parse custom template: %w", err)
	}

	tm.templates[key] = t
	tm.logger.Info("Added custom template", zap.String("key", key))

	return nil
}
