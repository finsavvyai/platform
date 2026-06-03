package main

import "context"

type initializedService struct {
	name string
	env  *Env
}

func NewBillingService(ctx context.Context, env *Env) (*initializedService, error) {
	return newInitializedService(ctx, env, "billing")
}

func NewComplianceService(ctx context.Context, env *Env) (*initializedService, error) {
	return newInitializedService(ctx, env, "compliance")
}

func NewIntelligenceService(ctx context.Context, env *Env) (*initializedService, error) {
	return newInitializedService(ctx, env, "intelligence")
}

func NewRiskService(ctx context.Context, env *Env) (*initializedService, error) {
	return newInitializedService(ctx, env, "risk")
}

func newInitializedService(ctx context.Context, env *Env, name string) (*initializedService, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return &initializedService{name: name, env: env}, nil
}
