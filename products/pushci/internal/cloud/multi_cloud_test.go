package cloud

import "testing"

func TestMultiCloudFallback(t *testing.T) {
	htz := NewHetznerProvisioner("test-token", "")
	fly := NewFlyProvisioner("test-token", "pushci")
	mc := NewMultiCloud(
		NamedProvisioner{Name: "hetzner", Provisioner: htz},
		NamedProvisioner{Name: "fly", Provisioner: fly},
	)

	spec := VMSpec{Name: "test", Image: "ubuntu-22.04", Size: "cx21"}
	r, err := mc.Create(spec)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if r == nil {
		t.Fatal("expected runner")
	}
}

func TestMultiCloudAllFail(t *testing.T) {
	htz := NewHetznerProvisioner("", "") // no token
	fly := NewFlyProvisioner("", "")     // no token
	mc := NewMultiCloud(
		NamedProvisioner{Name: "hetzner", Provisioner: htz},
		NamedProvisioner{Name: "fly", Provisioner: fly},
	)
	_, err := mc.Create(VMSpec{Name: "test"})
	if err == nil {
		t.Error("expected error when all providers fail")
	}
}

func TestMultiCloudEmpty(t *testing.T) {
	mc := NewMultiCloud()
	_, err := mc.Create(VMSpec{Name: "test"})
	if err == nil {
		t.Error("expected error with no providers")
	}
}
