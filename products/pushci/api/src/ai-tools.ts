// Claude tool definitions for agentic PushCI workflows.
import Anthropic from "@anthropic-ai/sdk";

type Tool = Anthropic.Messages.Tool;
const obj = "object" as const;
const str = { type: "string" } as const;

export const tools: Tool[] = [
  { name: "inspect_repo", description: "Get repo languages, package managers, build files",
    input_schema: { type: obj, properties: { repoId: str }, required: ["repoId"] } },
  { name: "save_pipeline", description: "Save generated PushCI pipeline YAML",
    input_schema: { type: obj, properties: { repoId: str, yaml: str }, required: ["repoId", "yaml"] } },
  { name: "list_runners", description: "List available runners with labels and status",
    input_schema: { type: obj, properties: { orgId: str }, required: [] } },
  { name: "retry_job", description: "Retry a failed CI job",
    input_schema: { type: obj, properties: { jobId: str }, required: ["jobId"] } },
];

interface ToolInput {
  repoId?: string;
  yaml?: string;
  orgId?: string;
  jobId?: string;
}

// Execute a tool call and return a result string.
export async function executeTool(
  name: string,
  input: ToolInput
): Promise<string> {
  switch (name) {
    case "inspect_repo":
      return JSON.stringify({
        languages: ["typescript", "go"],
        packageManagers: ["npm", "go modules"],
        buildFiles: ["package.json", "go.mod", "Dockerfile"],
      });
    case "save_pipeline":
      return JSON.stringify({
        saved: true,
        repoId: input.repoId,
        bytes: input.yaml?.length ?? 0,
      });
    case "list_runners":
      return JSON.stringify({
        runners: [
          { id: "local-1", labels: ["self-hosted"], status: "online" },
        ],
      });
    case "retry_job":
      return JSON.stringify({ retried: true, jobId: input.jobId });
    default:
      return JSON.stringify({ error: `unknown tool: ${name}` });
  }
}

// Process tool_use blocks: execute each, return tool_result messages.
export async function handleToolUse(
  blocks: Anthropic.Messages.ContentBlock[]
): Promise<Anthropic.Messages.ToolResultBlockParam[]> {
  const results: Anthropic.Messages.ToolResultBlockParam[] = [];
  for (const block of blocks) {
    if (block.type === "tool_use") {
      const output = await executeTool(
        block.name,
        block.input as ToolInput
      );
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: output,
      });
    }
  }
  return results;
}
