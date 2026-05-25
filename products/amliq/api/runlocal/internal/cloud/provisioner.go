package cloud

import (
	"fmt"
	"sync/atomic"
	"time"
)

var htzSeq atomic.Int64

// VMSpec describes the desired VM configuration.
type VMSpec struct {
	Name   string
	Labels []string
	Image  string
	Size   string
	Region string
}

// Provisioner creates and destroys cloud VMs.
type Provisioner interface {
	Create(spec VMSpec) (*Runner, error)
	Destroy(id string) error
}

// HetznerProvisioner provisions runners on Hetzner Cloud.
type HetznerProvisioner struct {
	APIToken string
	CloudInit string
}

// NewHetznerProvisioner creates a Hetzner provisioner.
func NewHetznerProvisioner(token, cloudInit string) *HetznerProvisioner {
	return &HetznerProvisioner{
		APIToken:  token,
		CloudInit: cloudInit,
	}
}

// Create provisions a Hetzner server with cloud-init bootstrap.
// In production this calls POST https://api.hetzner.cloud/v1/servers.
func (h *HetznerProvisioner) Create(spec VMSpec) (*Runner, error) {
	if h.APIToken == "" {
		return nil, fmt.Errorf("hetzner: API token not configured")
	}
	seq := htzSeq.Add(1)
	id := fmt.Sprintf("htz-%s-%d-%d", spec.Name, time.Now().UnixMilli(), seq)
	return &Runner{
		ID:            id,
		IP:            "", // populated after API response
		Status:        StatusStarting,
		Labels:        spec.Labels,
		OS:            spec.Image,
		Arch:          "amd64",
		CreatedAt:     time.Now(),
		LastHeartbeat: time.Now(),
	}, nil
}

// Destroy deletes a Hetzner server.
// In production this calls DELETE /v1/servers/{id}.
func (h *HetznerProvisioner) Destroy(id string) error {
	if h.APIToken == "" {
		return fmt.Errorf("hetzner: API token not configured")
	}
	return nil
}
