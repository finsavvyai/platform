package nlp

import (
	"context"
	"fmt"
	"strings"
)

// RoutingTarget identifies which system handles an action.
type RoutingTarget string

const (
	TargetTenantIQ RoutingTarget = "tenantiq"
	TargetPushCI   RoutingTarget = "pushci"
	TargetClaw     RoutingTarget = "claw"
	TargetUnknown  RoutingTarget = "unknown"
)

// RoutedAction pairs an action with its target system.
type RoutedAction struct {
	Target RoutingTarget
	Action *Action
}

// RouteAction determines which system should handle the given action.
func RouteAction(action *Action) RoutedAction {
	target := classifyAction(action.Type)
	return RoutedAction{Target: target, Action: action}
}

// RouteActions routes a list of actions to their target systems.
func RouteActions(actions []*Action) []RoutedAction {
	routed := make([]RoutedAction, 0, len(actions))
	for _, a := range actions {
		routed = append(routed, RouteAction(a))
	}
	return routed
}

func classifyAction(actionType string) RoutingTarget {
	switch {
	case strings.HasPrefix(actionType, "tenantiq_"):
		return TargetTenantIQ
	case strings.HasPrefix(actionType, "claw_"):
		return TargetClaw
	default:
		switch actionType {
		case "run", "deploy", "diagnose", "status", "config",
			"secret", "optimize", "fix_pipeline", "generate", "heal":
			return TargetPushCI
		}
		return TargetUnknown
	}
}

// ExecuteRouted dispatches a routed action to the appropriate handler.
func ExecuteRouted(ctx context.Context, ra RoutedAction, root string) (string, error) {
	switch ra.Target {
	case TargetPushCI:
		return ExecuteAction(ctx, ra.Action, root)
	case TargetTenantIQ:
		return executeTenantIQAction(ra.Action)
	case TargetClaw:
		return executeClawAction(ra.Action)
	default:
		return "", fmt.Errorf("no handler for target: %s", ra.Target)
	}
}

// ExecuteSequential runs a list of routed actions in order.
func ExecuteSequential(ctx context.Context, actions []RoutedAction, root string) ([]string, error) {
	results := make([]string, 0, len(actions))
	for _, ra := range actions {
		result, err := ExecuteRouted(ctx, ra, root)
		if err != nil {
			return results, fmt.Errorf("action %s failed: %w", ra.Action.Type, err)
		}
		results = append(results, result)
	}
	return results, nil
}

func executeTenantIQAction(action *Action) (string, error) {
	return fmt.Sprintf("[tenantiq] Would execute: %s (params: %v)",
		action.Type, action.Params), nil
}
