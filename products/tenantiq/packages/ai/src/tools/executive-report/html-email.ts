/**
 * Executive Report HTML Email Builder
 *
 * Generates boardroom-ready HTML email for the executive report.
 */

import type { ExecutiveReport } from './types';
import { formatCurrency } from './helpers';

export function buildHtmlEmail(report: ExecutiveReport): string {
	const kpiHtml = report.sections
		.flatMap((s) => s.kpis)
		.slice(0, 8)
		.map(
			(kpi) => `
		<td style="padding:12px 16px;text-align:center;width:25%">
			<div style="font-size:24px;margin-bottom:4px">${kpi.icon}</div>
			<div style="font-size:22px;font-weight:700;color:${kpi.isPositive ? '#10b981' : '#ef4444'}">${kpi.value}</div>
			<div style="font-size:12px;color:#6b7280;margin-top:2px">${kpi.label}</div>
			${kpi.change !== undefined ? `<div style="font-size:11px;color:${kpi.isPositive ? '#10b981' : '#ef4444'}">${kpi.change >= 0 ? '▲' : '▼'} ${Math.abs(kpi.change)}</div>` : ''}
		</td>`
		)
		.reduce((rows: string[], cell, i) => {
			if (i % 4 === 0) rows.push('<tr>');
			rows[rows.length - 1] += cell;
			if (i % 4 === 3 || i === report.sections.flatMap((s) => s.kpis).slice(0, 8).length - 1)
				rows[rows.length - 1] += '</tr>';
			return rows;
		}, [])
		.join('');

	const actionsHtml = report.keyActions
		.slice(0, 5)
		.map(
			(a) => `
		<tr>
			<td style="padding:8px 12px">
				<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;color:white;background:${
					a.priority === 'critical' ? '#ef4444' : a.priority === 'high' ? '#f59e0b' : '#6366f1'
				}">${a.priority.toUpperCase()}</span>
			</td>
			<td style="padding:8px 12px">
				<strong>${a.title}</strong><br/>
				<span style="font-size:13px;color:#6b7280">${a.description}</span>
			</td>
			${a.estimatedSavings ? `<td style="padding:8px 12px;text-align:right;color:#10b981;font-weight:600">${formatCurrency(a.estimatedSavings)}/yr</td>` : '<td></td>'}
		</tr>`
		)
		.join('');

	const benchmarkHtml = `
	<tr><td style="padding:0 16px 24px">
		<div style="border:1px solid #dbeafe;background:#eff6ff;border-radius:12px;padding:18px 16px">
			<div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2563eb;margin-bottom:10px">Board-ready snapshot</div>
			<div style="font-size:14px;line-height:1.7;color:#1f2937;margin-bottom:10px">${report.benchmarkSummary}</div>
			<div style="font-size:13px;line-height:1.6;color:#475569;border-top:1px solid #bfdbfe;padding-top:10px">
				<strong style="color:#1e3a8a">Shareable summary:</strong> ${report.shareSnippet}
			</div>
		</div>
	</td></tr>`;

	return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;margin-top:24px;margin-bottom:24px;box-shadow:0 4px 6px rgba(0,0,0,0.07)">
	<!-- Header -->
	<tr>
		<td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 24px;text-align:center">
			<div style="font-size:28px;font-weight:800;color:white">${report.title}</div>
			<div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:8px">${report.period} | Generated ${new Date(report.generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
			<div style="margin-top:16px">
				<span style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:50%;width:80px;height:80px;line-height:80px;font-size:32px;font-weight:800;color:white">${report.overallScore}</span>
			</div>
			<div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:8px">Overall Health Grade: <strong>${report.overallGrade}</strong></div>
		</td>
	</tr>
	${benchmarkHtml}
	<!-- KPIs -->
	<tr><td style="padding:24px 16px">
		<div style="font-size:16px;font-weight:700;margin-bottom:16px;color:#1f2937">Key Metrics</div>
		<table width="100%" cellpadding="0" cellspacing="0">${kpiHtml}</table>
	</td></tr>
	<!-- Actions -->
	<tr><td style="padding:0 16px 24px">
		<div style="font-size:16px;font-weight:700;margin-bottom:12px;color:#1f2937">Recommended Actions</div>
		<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">${actionsHtml}</table>
	</td></tr>
	<!-- Footer -->
	<tr><td style="background:#f9fafb;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb">
		<div style="font-size:12px;color:#9ca3af">Powered by <strong style="color:#6366f1">TenantIQ</strong> — AI-Powered M365 Intelligence</div>
		<div style="margin-top:8px"><a href="https://app.tenantiq.app" style="color:#6366f1;font-size:13px;text-decoration:none;font-weight:600">View Full Report →</a></div>
	</td></tr>
</table>
</body>
</html>`;
}
