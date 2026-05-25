package ai

import (
	"context"
	"fmt"
	"log"
)

// BatchScreen screens multiple entities with session compaction.
func (o *Orchestrator) BatchScreen(
	ctx context.Context, tenantID string, entities []string,
) ([]*Session, error) {
	var sessions []*Session
	for _, entity := range entities {
		session, err := o.ScreenEntity(ctx, tenantID, entity)
		if err != nil {
			log.Printf("batch: %s error: %v", entity, err)
			continue
		}
		sessions = append(sessions, session)
	}
	return sessions, nil
}

func buildScreeningPrompt(entityName string) string {
	return fmt.Sprintf(
		"You are an AML compliance analyst. Screen '%s' against all available "+
			"sanctions lists, PEP databases, and enforcement records. "+
			"For each check, explain your findings and assess risk level.",
		entityName,
	)
}
