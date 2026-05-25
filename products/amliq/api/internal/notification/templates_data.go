package notification

// template holds subject + body for a notification.
type alertTemplate struct {
	Subject string
	Body    string
}

var templates = map[TemplateKey]alertTemplate{
	TplHighRiskEmail: {
		Subject: `{{severityEmoji .Severity}} High-Risk Match: {{.EntityName}}`,
		Body: `
<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;padding:24px;background:#fff">
  <h2 style="color:#0f172a;margin:0 0 8px">High-Risk Match Detected</h2>
  <p style="color:#475569;margin:0 0 20px">A screening returned a high-confidence match requiring review.</p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <tr><td style="padding:8px 0;color:#94a3b8">Entity</td><td style="padding:8px 0;color:#0f172a;font-weight:600">{{.EntityName}}</td></tr>
    <tr><td style="padding:8px 0;color:#94a3b8">Type</td><td style="padding:8px 0;color:#0f172a">{{.EntityType}}</td></tr>
    <tr><td style="padding:8px 0;color:#94a3b8">Matched List</td><td style="padding:8px 0;color:#0f172a">{{.ListSource}}</td></tr>
    <tr><td style="padding:8px 0;color:#94a3b8">Confidence</td><td style="padding:8px 0;color:#dc2626;font-weight:600">{{.Confidence}}</td></tr>
    <tr><td style="padding:8px 0;color:#94a3b8">Match Reason</td><td style="padding:8px 0;color:#0f172a">{{.MatchReason}}</td></tr>
    <tr><td style="padding:8px 0;color:#94a3b8">Detected</td><td style="padding:8px 0;color:#0f172a">{{fmtTime .Timestamp}}</td></tr>
  </table>

  <a href="{{.DashboardURL}}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Review Alert</a>

  <p style="color:#94a3b8;font-size:12px;margin-top:24px">
    AMLIQ — Sanctions screening infrastructure. Alert ID: {{.AlertID}}
  </p>
</div>`,
	},

	TplHighRiskSMS: {
		Subject: "",
		Body: `AMLIQ: High-risk match — {{.EntityName}} ({{.Confidence}} on {{.ListSource}}). Review: {{.DashboardURL}}`,
	},

	TplHighRiskWhatsApp: {
		Subject: "",
		Body: `{{severityEmoji .Severity}} *AMLIQ High-Risk Alert*

*Entity:* {{.EntityName}}
*Type:* {{.EntityType}}
*List:* {{.ListSource}}
*Confidence:* {{.Confidence}}
*Reason:* {{.MatchReason}}

Review: {{.DashboardURL}}`,
	},

	TplAlertCreated: {
		Subject: `New Alert: {{.EntityName}}`,
		Body: `
A new screening alert has been created.

Entity: {{.EntityName}}
Severity: {{upper .Severity}}
Confidence: {{.Confidence}}
Matched: {{.ListSource}}

View: {{.DashboardURL}}`,
	},

	TplCaseEscalated: {
		Subject: `Case Escalated: {{.CaseID}}`,
		Body: `
Case {{.CaseID}} has been escalated and requires your attention.

Entity: {{.EntityName}}
Severity: {{upper .Severity}}
Escalated by: {{.AnalystName}}
Notes: {{.Notes}}

Open case: {{.DashboardURL}}`,
	},

	TplSLABreach: {
		Subject: `SLA Breach: {{.CaseID}}`,
		Body: `
Case {{.CaseID}} has exceeded its review SLA.

Entity: {{.EntityName}}
Opened: {{fmtTime .Timestamp}}

Action required: {{.DashboardURL}}`,
	},

	TplDailyDigest: {
		Subject: `📊 AMLIQ Daily Summary — {{fmtDate .Timestamp}}`,
		Body: `
<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;padding:24px;background:#fff">
  <h2 style="color:#0f172a;margin:0 0 8px">📊 Daily Summary</h2>
  <p style="color:#94a3b8;margin:0 0 20px;font-size:13px">{{.TenantName}} — {{fmtDate .Timestamp}}</p>
  <div style="white-space:pre-line;color:#475569;line-height:1.6;margin-bottom:24px;padding:16px;background:#f8fafc;border-radius:8px;font-family:ui-monospace,SF Mono,monospace;font-size:13px">{{.Notes}}</div>
  <a href="{{.DashboardURL}}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">View Dashboard</a>
  <p style="color:#94a3b8;font-size:12px;margin-top:24px">AMLIQ — Sanctions screening infrastructure</p>
</div>`,
	},
}
