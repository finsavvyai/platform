// AWS CodePipeline route handlers — split from aws-routes.ts to
// keep each file under the 200-line portfolio cap. These handlers
// all depend on resolveCreds and getUserSub exported from
// aws-routes.ts.

import type { Hono } from "hono";
import type { Env } from "./types";
import {
  listPipelines,
  startPipelineExecution,
  getPipelineState,
  getPipelineExecution,
  listPipelineExecutions,
  type CodePipelineCreds,
} from "./aws-codepipeline";

type Resolver = (c: any, sub: string) => Promise<CodePipelineCreds | Response>;
type SubResolver = (c: any) => Promise<string | null>;

// mountPipelineRoutes attaches all /pipelines/* handlers onto the
// router. Called from aws-routes.ts after the credential handlers
// are wired so the two files share a single Hono instance.
export function mountPipelineRoutes(
  awsRoutes: Hono<{ Bindings: Env }>,
  resolveCreds: Resolver,
  getUserSub: SubResolver
) {
  awsRoutes.get("/pipelines", async (c) => {
    const sub = await getUserSub(c);
    if (!sub) return c.json({ error: "unauthorized" }, 401);
    const creds = await resolveCreds(c, sub);
    if (creds instanceof Response) return creds;
    try {
      const res = await listPipelines(creds);
      return c.json({ ok: true, pipelines: res.pipelines ?? [] });
    } catch (err) {
      return c.json({ error: "aws_error", message: (err as Error).message }, 502);
    }
  });

  awsRoutes.post("/pipelines/:name/trigger", async (c) => {
    const sub = await getUserSub(c);
    if (!sub) return c.json({ error: "unauthorized" }, 401);
    const creds = await resolveCreds(c, sub);
    if (creds instanceof Response) return creds;
    const name = c.req.param("name");
    try {
      const res = await startPipelineExecution(name, creds, crypto.randomUUID());
      return c.json({ ok: true, execution_id: res.pipelineExecutionId });
    } catch (err) {
      return c.json({ error: "aws_error", message: (err as Error).message }, 502);
    }
  });

  awsRoutes.get("/pipelines/:name/status", async (c) => {
    const sub = await getUserSub(c);
    if (!sub) return c.json({ error: "unauthorized" }, 401);
    const creds = await resolveCreds(c, sub);
    if (creds instanceof Response) return creds;
    const name = c.req.param("name");
    try {
      const state = await getPipelineState(name, creds);
      return c.json({
        ok: true,
        pipeline_name: state.pipelineName ?? name,
        stages: (state.stageStates ?? []).map((s) => ({
          name: s.stageName,
          status: s.latestExecution?.status,
          execution_id: s.latestExecution?.pipelineExecutionId,
          actions: (s.actionStates ?? []).map((a) => ({
            name: a.actionName,
            status: a.latestExecution?.status,
            summary: a.latestExecution?.summary,
            last_status_change: a.latestExecution?.lastStatusChange,
          })),
        })),
      });
    } catch (err) {
      return c.json({ error: "aws_error", message: (err as Error).message }, 502);
    }
  });

  awsRoutes.get("/pipelines/:name/executions", async (c) => {
    const sub = await getUserSub(c);
    if (!sub) return c.json({ error: "unauthorized" }, 401);
    const creds = await resolveCreds(c, sub);
    if (creds instanceof Response) return creds;
    const name = c.req.param("name");
    try {
      const res = await listPipelineExecutions(name, creds, 10);
      return c.json({ ok: true, executions: res.pipelineExecutionSummaries ?? [] });
    } catch (err) {
      return c.json({ error: "aws_error", message: (err as Error).message }, 502);
    }
  });

  awsRoutes.get("/pipelines/:name/executions/:id", async (c) => {
    const sub = await getUserSub(c);
    if (!sub) return c.json({ error: "unauthorized" }, 401);
    const creds = await resolveCreds(c, sub);
    if (creds instanceof Response) return creds;
    const name = c.req.param("name");
    const id = c.req.param("id");
    try {
      const res = await getPipelineExecution(name, id, creds);
      return c.json({ ok: true, execution: res.pipelineExecution });
    } catch (err) {
      return c.json({ error: "aws_error", message: (err as Error).message }, 502);
    }
  });
}
