package cloud

import (
	"fmt"
	"sync/atomic"
	"time"
)

var flySeq atomic.Int64

// FlyProvisioner provisions runners on Fly.io Machines.
type FlyProvisioner struct {
	APIToken string
	AppName  string
}

// NewFlyProvisioner creates a Fly.io provisioner.
func NewFlyProvisioner(token, appName string) *FlyProvisioner {
	return &FlyProvisioner{
		APIToken: token,
		AppName:  appName,
	}
}

// Create launches a Fly Machine with the runner agent image.
// In production: flyctl machines run <image> --app <app>.
func (f *FlyProvisioner) Create(spec VMSpec) (*Runner, error) {
	if f.APIToken == "" {
		return nil, fmt.Errorf("fly: API token not configured")
	}
	seq := flySeq.Add(1)
	id := fmt.Sprintf("fly-%s-%d-%d", spec.Name, time.Now().UnixMilli(), seq)
	return &Runner{
		ID:            id,
		IP:            "", // populated after machine starts
		Status:        StatusStarting,
		Labels:        spec.Labels,
		OS:            spec.Image,
		Arch:          "amd64",
		CreatedAt:     time.Now(),
		LastHeartbeat: time.Now(),
	}, nil
}

// Destroy stops and removes a Fly Machine.
// In production: flyctl machines destroy <id> --app <app>.
func (f *FlyProvisioner) Destroy(id string) error {
	if f.APIToken == "" {
		return fmt.Errorf("fly: API token not configured")
	}
	return nil
}
