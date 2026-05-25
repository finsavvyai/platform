package compliance

// initPCIDSSControls registers representative PCI DSS controls.
func initPCIDSSControls(r *InMemoryControlRegistry) {
	defs := []ControlDefinition{
		pci("PCI-1.1", "Network Security",
			"Install and Maintain Network Security Controls",
			"Install and maintain network security controls to protect cardholder data.",
			0.8, es(EncryptionConf, "Network encryption configuration", true)),
		pci("PCI-2.1", "Secure Configuration",
			"Apply Secure Configurations",
			"Apply secure configurations to all system components.",
			0.85, es(CICDLog, "Secure configuration deployment logs", true)),
		pci("PCI-3.1", "Data Protection",
			"Protect Stored Account Data",
			"Protect stored account data with strong cryptography.",
			0.9, es(EncryptionConf, "Encryption-at-rest verification", true)),
		pci("PCI-6.1", "Secure Development",
			"Develop and Maintain Secure Systems",
			"Develop and maintain secure systems and software.",
			0.9, es(CICDLog, "SAST/DAST scan results", true)),
		pci("PCI-7.1", "Access Control",
			"Restrict Access by Business Need",
			"Restrict access to system components by business need to know.",
			0.9, es(RBACConfig, "Role-based access policy check", true)),
		pci("PCI-8.1", "User Authentication",
			"Identify Users and Authenticate Access",
			"Identify users and authenticate access to system components.",
			0.85,
			es(AuditLog, "Authentication event logs", true),
			es(RBACConfig, "Identity provider configuration", true)),
		pci("PCI-10.1", "Logging and Monitoring",
			"Log and Monitor All Access",
			"Log and monitor all access to system components and cardholder data.",
			0.9,
			es(AuditLog, "Centralized access logs", true),
			es(MonitoringAlert, "Real-time access monitoring", true)),
		pci("PCI-11.1", "Security Testing",
			"Test Security of Systems and Networks",
			"Test security of systems and networks regularly.",
			0.8, es(CICDLog, "Penetration test and vulnerability scan logs", true)),
	}
	for i := range defs {
		r.register(&defs[i])
	}
}

// pci is a helper that builds a PCI DSS ControlDefinition.
func pci(
	id, category, title, desc string,
	confidence float64, sources ...EvidenceSource,
) ControlDefinition {
	return ControlDefinition{
		Control: Control{
			ID:          id,
			Framework:   PCI_DSS,
			Category:    category,
			Title:       title,
			Description: desc,
			Status:      PendingReview,
		},
		EvidenceSources: sources,
		Confidence:      confidence,
	}
}
