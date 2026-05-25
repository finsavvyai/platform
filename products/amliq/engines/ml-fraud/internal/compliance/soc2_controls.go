package compliance

// initSOC2Controls registers representative SOC 2 controls.
func initSOC2Controls(r *InMemoryControlRegistry) {
	defs := []ControlDefinition{
		soc2("CC1.1", "Integrity and Ethics",
			"COSO Principle 1 - Integrity and Ethics",
			"Organization demonstrates commitment to integrity and ethical values.",
			0.3, es(ManualUpload, "Manual policy documentation upload", false)),
		soc2("CC2.1", "Information and Communication",
			"Information and Communication",
			"Entity internally communicates information necessary for internal control.",
			0.8, es(AuditLog, "Automated audit log analysis", true)),
		soc2("CC3.1", "Risk Assessment",
			"Risk Assessment",
			"Entity specifies objectives to identify and assess risks.",
			0.7, es(MonitoringAlert, "Monitoring alert review", true)),
		soc2("CC5.1", "Control Activities",
			"Control Activities - Logical Access",
			"Entity selects and develops control activities for logical access.",
			0.9, es(RBACConfig, "RBAC configuration verification", true)),
		soc2("CC6.1", "Logical and Physical Access",
			"Logical and Physical Access",
			"Entity implements logical access security over protected assets.",
			0.85,
			es(RBACConfig, "RBAC policy enforcement check", true),
			es(AuditLog, "Access event audit trail", true)),
		soc2("CC7.1", "System Operations",
			"System Operations - Change Management",
			"Entity manages changes to infrastructure and software.",
			0.9, es(CICDLog, "CI/CD pipeline change log", true)),
		soc2("CC7.2", "System Operations",
			"System Operations - Monitoring",
			"Entity monitors system components for anomalies.",
			0.9, es(MonitoringAlert, "Automated monitoring alerts", true)),
		soc2("CC8.1", "Change Management",
			"Change Management",
			"Entity authorizes, designs, develops, and implements changes.",
			0.85, es(CICDLog, "Change management pipeline logs", true)),
		soc2("CC9.1", "Risk Mitigation",
			"Risk Mitigation",
			"Entity identifies and assesses risk-mitigation activities.",
			0.75,
			es(MonitoringAlert, "Risk monitoring alerts", true),
			es(AuditLog, "Risk event audit records", true)),
	}
	for i := range defs {
		r.register(&defs[i])
	}
}

// soc2 is a helper that builds a SOC 2 ControlDefinition.
func soc2(
	id, category, title, desc string,
	confidence float64, sources ...EvidenceSource,
) ControlDefinition {
	return ControlDefinition{
		Control: Control{
			ID:          id,
			Framework:   SOC2,
			Category:    category,
			Title:       title,
			Description: desc,
			Status:      PendingReview,
		},
		EvidenceSources: sources,
		Confidence:      confidence,
	}
}

// es builds a single EvidenceSource.
func es(t EvidenceType, desc string, auto bool) EvidenceSource {
	return EvidenceSource{Type: t, Description: desc, AutoCollectable: auto}
}
