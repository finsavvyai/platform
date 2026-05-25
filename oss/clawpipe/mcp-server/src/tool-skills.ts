/** AI security analyst skill tools — ported from OpenSyber's skills/.
 *
 * Each skill is a thin MCP tool wrapper that calls ClawPipe.prompt()
 * with a system-prompt template. ClawPipe applies the full pipeline
 * (Booster -> Packer -> Cache -> Router -> Provider) so each skill
 * gets cost optimization for free.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PipelineContext } from './pipeline.js';

const reasoningSystem = `You are an AI security analyst. Given a finding, identify root cause, attack chain, blast radius, and a 1-10 risk score with reasoning.`;
const triageSystem = `You are an AI triage analyst. Given a list of security findings, prioritize by actual exploitability and business impact, not raw CVSS.`;
const remediationSystem = `You are an AI remediation engineer. Given a vulnerability, output a concrete fix (code/config) plus a rollback procedure.`;
const complianceSystem = `You are an AI compliance writer. Generate audit evidence text aligned to the requested framework (SOC 2 / ISO 27001 / HIPAA / GDPR).`;
const threatIntelSystem = `You are a threat intelligence analyst. Enrich the given CVE or IOC with NVD/CIRCL-style context: severity, exploitation status, affected products, mitigations.`;
const incidentSystem = `You are an incident responder. Given alerts, reconstruct the multi-step attack chain, identify the entry point, and recommend containment + eradication steps.`;

function asTool(server: McpServer, name: string, desc: string, system: string, ctx: PipelineContext): void {
  const Input = z.object({ input: z.string().min(1).max(50_000) });
  server.tool(name, desc, Input.shape, async (args) => {
    const r = await ctx.client.prompt(args.input, { system });
    return { content: [{ type: 'text', text: r.text }] };
  });
}

export function registerSkillTools(server: McpServer, ctx: PipelineContext): void {
  asTool(server, 'clawpipe_skill_reasoning', 'Root-cause + risk-score a security finding.', reasoningSystem, ctx);
  asTool(server, 'clawpipe_skill_triage', 'Prioritize a batch of security findings by actual risk.', triageSystem, ctx);
  asTool(server, 'clawpipe_skill_remediation', 'Generate a fix plus rollback for a vulnerability.', remediationSystem, ctx);
  asTool(server, 'clawpipe_skill_compliance', 'Write SOC 2 / ISO 27001 / HIPAA / GDPR evidence.', complianceSystem, ctx);
  asTool(server, 'clawpipe_skill_threat_intel', 'Enrich CVE / IOC with NVD/CIRCL-style context.', threatIntelSystem, ctx);
  asTool(server, 'clawpipe_skill_incident', 'Reconstruct attack chain + recommend containment steps.', incidentSystem, ctx);
}
