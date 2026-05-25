/**
 * PDF Report HTML Generator
 *
 * Generates branded HTML suitable for browser-based PDF printing via window.print().
 */

export interface ReportMetric {
	label: string;
	value: string;
}

export interface ReportSection {
	heading: string;
	content: string;
	metrics?: ReportMetric[];
}

export interface ReportData {
	title: string;
	subtitle: string;
	generatedAt: string;
	sections: ReportSection[];
}

function renderMetricCards(metrics: ReportMetric[]): string {
	const cards = metrics
		.map(
			(m) => `
		<div style="flex:1;min-width:140px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center">
			<div style="font-size:24px;font-weight:700;color:#0f172a">${m.value}</div>
			<div style="font-size:12px;color:#64748b;margin-top:4px">${m.label}</div>
		</div>`
		)
		.join('');
	return `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px">${cards}</div>`;
}

function renderSection(section: ReportSection): string {
	const metricsHtml = section.metrics?.length ? renderMetricCards(section.metrics) : '';
	return `
		<div style="margin-bottom:28px">
			<h2 style="font-size:18px;font-weight:600;color:#0f172a;margin:0 0 8px 0;border-bottom:2px solid #e2e8f0;padding-bottom:6px">
				${section.heading}
			</h2>
			<div style="font-size:14px;color:#334155;line-height:1.6;white-space:pre-line">${section.content}</div>
			${metricsHtml}
		</div>`;
}

export function generateReportHTML(data: ReportData): string {
	const sectionsHtml = data.sections.map(renderSection).join('');
	const dateFormatted = new Date(data.generatedAt).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${data.title} — TenantIQ</title>
<style>
@media print {
	body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
	.no-print { display: none !important; }
	@page { margin: 1in 0.75in; size: letter; }
}
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; color: #0f172a; background: #fff; }
.container { max-width: 800px; margin: 0 auto; padding: 40px 32px; }
</style>
</head>
<body>
<div class="container">
	<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;border-bottom:3px solid #3b82f6;padding-bottom:20px">
		<div>
			<div style="font-size:11px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">TenantIQ Report</div>
			<h1 style="font-size:26px;font-weight:700;color:#0f172a;margin:0">${data.title}</h1>
			<p style="font-size:14px;color:#64748b;margin:4px 0 0">${data.subtitle}</p>
		</div>
		<div style="text-align:right;font-size:12px;color:#94a3b8">
			<div>Generated</div>
			<div style="font-weight:600;color:#64748b">${dateFormatted}</div>
		</div>
	</div>
	${sectionsHtml}
	<div style="margin-top:40px;border-top:1px solid #e2e8f0;padding-top:16px;text-align:center;font-size:11px;color:#94a3b8">
		TenantIQ — AI-Powered Microsoft 365 Security &amp; Compliance Intelligence
	</div>
</div>
<script>if(window.opener||window.self!==window.top)window.print();</script>
</body>
</html>`;
}
