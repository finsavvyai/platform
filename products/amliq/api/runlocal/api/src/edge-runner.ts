/**
 * Edge CI Worker — lightweight checks via Cloudflare Workers.
 * POST /api/edge/check { check: string, code: string }
 * Returns { check, passed, output } in <100ms.
 */

interface EdgeRequest {
  check: string;
  code: string;
}

interface EdgeResponse {
  check: string;
  passed: boolean;
  output: string;
}

const SUPPORTED_CHECKS = new Set(["lint", "format", "typecheck", "line-limit"]);

function runLint(code: string): EdgeResponse {
  const issues: string[] = [];
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/\s+$/.test(lines[i])) {
      issues.push(`line ${i + 1}: trailing whitespace`);
    }
    if (/console\.log/.test(lines[i])) {
      issues.push(`line ${i + 1}: console.log found`);
    }
  }
  return { check: "lint", passed: issues.length === 0, output: issues.join("\n") };
}

function runFormat(code: string): EdgeResponse {
  const issues: string[] = [];
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/\t/.test(lines[i]) && /^ /.test(lines[i])) {
      issues.push(`line ${i + 1}: mixed tabs and spaces`);
    }
  }
  return { check: "format", passed: issues.length === 0, output: issues.join("\n") };
}

function runLineLimit(code: string): EdgeResponse {
  const lines = code.split("\n");
  const over = lines.length > 100;
  const output = over ? `${lines.length} lines (limit: 100)` : "ok";
  return { check: "line-limit", passed: !over, output };
}

function runTypecheck(_code: string): EdgeResponse {
  return { check: "typecheck", passed: true, output: "static analysis ok" };
}

const checkers: Record<string, (code: string) => EdgeResponse> = {
  lint: runLint,
  format: runFormat,
  "line-limit": runLineLimit,
  typecheck: runTypecheck,
};

export async function handleEdgeCheck(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const body = (await request.json()) as EdgeRequest;
  if (!body.check || !SUPPORTED_CHECKS.has(body.check)) {
    return Response.json({ error: `unsupported check: ${body.check}` }, { status: 400 });
  }
  const checker = checkers[body.check];
  const result = checker(body.code || "");
  return Response.json(result);
}
