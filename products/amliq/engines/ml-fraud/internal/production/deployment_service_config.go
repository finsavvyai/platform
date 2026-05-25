package production

// DeploymentServiceConfig holds service configuration for deployment
type DeploymentServiceConfig struct {
	Name         string                  `json:"name"`
	Type         string                  `json:"type"` // "api", "worker", "batch", "database", "cache"
	Image        string                  `json:"image"`
	Version      string                  `json:"version"`
	Port         int                     `json:"port"`
	Replicas     int                     `json:"replicas"`
	Resources    ResourceConfig          `json:"resources"`
	Environment  map[string]Variable     `json:"environment"`
	HealthCheck  HealthCheckConfig       `json:"health_check"`
	Autoscaling  AutoscalingConfig       `json:"autoscaling"`
	Networking   ServiceNetworkingConfig `json:"networking"`
	Security     ServiceSecurityConfig   `json:"security"`
	Monitoring   ServiceMonitoringConfig `json:"monitoring"`
	Backup       ServiceBackupConfig     `json:"backup"`
	Deployment   DeploymentConfig        `json:"deployment"`
	Dependencies []string                `json:"dependencies"`
	Tags         map[string]string       `json:"tags"`
}
