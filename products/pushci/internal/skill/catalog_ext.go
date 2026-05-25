package skill

func init() {
	builtinSkills = append(builtinSkills, securitySkills...)
	builtinSkills = append(builtinSkills, notifySkills...)
	builtinSkills = append(builtinSkills, deploySkills...)
	builtinSkills = append(builtinSkills, checkSkills...)
	builtinSkills = append(builtinSkills, aiSkills...)
}

var securitySkills = []Skill{
	{
		ID: "secret-scan", Name: "Secret Scanner", Version: "1.0.0",
		Category: CategorySecurity, Author: "pushci", Verified: true, Installs: 18300,
		Description: "Scan code for leaked API keys, tokens, passwords, and private keys.",
		Tags:        []string{"Security", "Secrets", "API Keys", "Pre-commit"},
		Steps:       []Step{{Name: "Scan Secrets", Run: "pushci scan --secrets", OnFail: "block"}},
	},
	{
		ID: "license-check", Name: "License Checker", Version: "1.0.0",
		Category: CategorySecurity, Author: "community", Verified: false, Installs: 4100,
		Description: "Verify all dependencies use approved licenses.",
		Tags:        []string{"License", "Compliance", "SBOM", "Legal"},
		Steps:       []Step{{Name: "Check Licenses", Run: "license-checker --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC'", OnFail: "block"}},
	},
	{
		ID: "sbom-gen", Name: "SBOM Generator", Version: "1.0.0",
		Category: CategorySecurity, Author: "pushci", Verified: true, Installs: 6900,
		Description: "Generate Software Bill of Materials in CycloneDX format.",
		Tags:        []string{"SBOM", "CycloneDX", "SPDX", "Supply Chain"},
		Steps:       []Step{{Name: "Generate SBOM", Run: "cyclonedx-bom -o sbom.json"}},
	},
	{
		ID: "vulnerability-scan", Name: "Dependency Audit", Version: "1.0.0",
		Category: CategorySecurity, Author: "pushci", Verified: true, Installs: 11200,
		Description: "Scan dependencies for known CVEs. Block builds on critical vulns.",
		Tags:        []string{"CVE", "Vulnerability", "npm audit", "Safety"},
		Steps:       []Step{{Name: "Audit Deps", Run: "pushci scan --vulnerabilities", OnFail: "block"}},
	},
}

var notifySkills = []Skill{
	{
		ID: "slack-notify", Name: "Slack Notifications", Version: "1.0.0",
		Category: CategoryNotify, Author: "pushci", Verified: true, Installs: 14700,
		Description: "Post build results to Slack channels with rich formatting.",
		Tags:        []string{"Slack", "Notifications", "Chat"},
		Steps:       []Step{{Name: "Notify Slack", Run: "pushci notify --slack $SLACK_WEBHOOK_URL"}},
		Config:      map[string]string{"SLACK_WEBHOOK_URL": ""},
	},
	{
		ID: "discord-notify", Name: "Discord Notifications", Version: "1.0.0",
		Category: CategoryNotify, Author: "community", Verified: false, Installs: 7300,
		Description: "Send build status embeds to Discord channels.",
		Tags:        []string{"Discord", "Notifications", "Webhooks"},
		Steps:       []Step{{Name: "Notify Discord", Run: "pushci notify --discord $DISCORD_WEBHOOK_URL"}},
		Config:      map[string]string{"DISCORD_WEBHOOK_URL": ""},
	},
	{
		ID: "email-digest", Name: "Email Digest", Version: "1.0.0",
		Category: CategoryNotify, Author: "community", Verified: false, Installs: 2100,
		Description: "Daily email summary of pipeline runs and failures.",
		Tags:        []string{"Email", "Digest", "Summary"},
		Steps:       []Step{{Name: "Send Digest", Run: "pushci notify --email $NOTIFY_EMAIL"}},
		Config:      map[string]string{"NOTIFY_EMAIL": ""},
	},
}
