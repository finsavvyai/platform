package production

// Prometheus missing types

type RecordingRulesConfig struct {
	Enabled bool `json:"enabled"`
}

type RuleConfig struct {
	Rule string `json:"rule"`
}

// TargetConfig is defined in monitoring_config.go
// ServiceDiscoveryConfig is defined in environment_manager.go
// RelabelingConfig is defined in monitoring_config.go
// MetricRelabelingConfig is defined in monitoring_config.go

type QueryLoggingConfig struct {
	Enabled bool `json:"enabled"`
}

type AdminConfig struct {
	Enabled bool `json:"enabled"`
}

type APIConfig struct {
	Enabled bool `json:"enabled"`
}

type CompatibilityConfig struct {
	Enabled bool `json:"enabled"`
}

type XRayConfig struct {
	Enabled bool `json:"enabled"`
}

type OpenTelemetryConfig struct {
	Enabled bool `json:"enabled"`
}

type JaegerConfig struct {
	Enabled bool `json:"enabled"`
}

type ZipkinConfig struct {
	Enabled bool `json:"enabled"`
}

type DatadogConfig struct {
	Enabled bool `json:"enabled"`
}

type HealthChecksConfig struct {
	Enabled bool `json:"enabled"`
}

type CollectorConfig struct {
	Enabled bool `json:"enabled"`
}

type ExporterConfig struct {
	Enabled bool `json:"enabled"`
}

type ProcessorConfig struct {
	Enabled bool `json:"enabled"`
}

type ProvisioningFiles struct {
	Dashboards  []string `json:"dashboards"`
	Datasources []string `json:"datasources"`
	Plugins     []string `json:"plugins"`
	Notifiers   []string `json:"notifiers"`
	Alerting    []string `json:"alerting"`
}

type AggregationConfig struct {
	Enabled bool `json:"enabled"`
}

type MonitoringSecurityConfig struct {
	Enabled bool `json:"enabled"`
}

type MonitoringComplianceConfig struct {
	Enabled bool `json:"enabled"`
}

type PerformanceConfig struct {
	Enabled bool `json:"enabled"`
}

type CostConfig struct {
	Enabled bool `json:"enabled"`
}

type IntegrationConfig struct {
	Enabled bool `json:"enabled"`
}
