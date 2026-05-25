package cloud

import "fmt"

// MultiCloudProvisioner tries multiple providers with fallback.
type MultiCloudProvisioner struct {
	Providers []NamedProvisioner
}

// NamedProvisioner wraps a provisioner with its name.
type NamedProvisioner struct {
	Name        string
	Provisioner Provisioner
}

// NewMultiCloud creates a multi-cloud provisioner with fallback order.
func NewMultiCloud(providers ...NamedProvisioner) *MultiCloudProvisioner {
	return &MultiCloudProvisioner{Providers: providers}
}

// Create tries each provider in order until one succeeds.
func (mc *MultiCloudProvisioner) Create(spec VMSpec) (*Runner, error) {
	var lastErr error
	for _, np := range mc.Providers {
		r, err := np.Provisioner.Create(spec)
		if err == nil {
			r.Labels = append(r.Labels, np.Name)
			return r, nil
		}
		lastErr = err
	}
	if lastErr != nil {
		return nil, fmt.Errorf("all providers failed: %w", lastErr)
	}
	return nil, fmt.Errorf("no providers configured")
}

// Destroy tries to destroy on any provider (by ID prefix).
func (mc *MultiCloudProvisioner) Destroy(id string) error {
	for _, np := range mc.Providers {
		if err := np.Provisioner.Destroy(id); err == nil {
			return nil
		}
	}
	return fmt.Errorf("could not destroy runner %s", id)
}
