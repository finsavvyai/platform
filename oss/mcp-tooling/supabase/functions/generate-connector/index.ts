import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateRequest {
  specContent?: string;
  specUrl?: string;
  targetRuntime: string;
  authMode: string;
  connectorName: string;
  filter?: { exclude?: string[] };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: GenerateRequest = await req.json();

    let specContent = body.specContent;

    if (!specContent && body.specUrl) {
      const specRes = await fetch(body.specUrl);
      if (!specRes.ok) {
        throw new Error(`Failed to fetch spec from URL: ${specRes.status}`);
      }
      specContent = await specRes.text();
    }

    if (!specContent) {
      return new Response(
        JSON.stringify({ error: "Either specContent or specUrl required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const spec = JSON.parse(specContent);

    const { data: connector, error: connectorError } = await supabase
      .from("connectors")
      .insert({
        name: body.connectorName,
        owner_id: user.id,
        runtime: body.targetRuntime,
        auth_mode: body.authMode,
        spec_url: body.specUrl,
        spec_content: spec,
        status: "draft",
      })
      .select()
      .single();

    if (connectorError) throw connectorError;

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        connector_id: connector.id,
        status: "pending",
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: "info",
            message: "Job created, parsing spec...",
          },
        ],
      })
      .select()
      .single();

    if (jobError) throw jobError;

    const tools = parseOpenAPIToTools(spec, body.filter?.exclude || []);
    const manifest = {
      name: body.connectorName,
      version: spec.info?.version || "1.0.0",
      description: spec.info?.description || "",
      tools,
    };

    await supabase
      .from("connectors")
      .update({
        manifest_content: manifest,
        status: "active",
      })
      .eq("id", connector.id);

    await supabase
      .from("jobs")
      .update({
        status: "completed",
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: "info",
            message: "Job created, parsing spec...",
          },
          {
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Generated ${tools.length} tools from spec`,
          },
          {
            timestamp: new Date().toISOString(),
            level: "info",
            message: "Generation completed successfully",
          },
        ],
      })
      .eq("id", job.id);

    return new Response(
      JSON.stringify({
        jobId: job.id,
        connectorId: connector.id,
        estimated: 5,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generation error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseOpenAPIToTools(spec: any, excludePatterns: string[] = []) {
  const tools: any[] = [];
  const exclude = ["/health", "/metrics", "/internal", "/admin", ...excludePatterns];

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    if (exclude.some((pattern) => path.includes(pattern))) continue;

    for (const method of ["get", "post", "put", "delete", "patch"]) {
      const operation = (pathItem as any)[method];
      if (!operation) continue;

      const name = operation.operationId ||
        `${method}_${path.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const description = operation.summary || operation.description ||
        `${method.toUpperCase()} ${path}`;

      const properties: any = {};
      const required: string[] = [];

      if (operation.parameters) {
        for (const param of operation.parameters) {
          properties[param.name] = {
            type: param.schema?.type || "string",
            description: param.description || "",
          };
          if (param.required) required.push(param.name);
        }
      }

      if (operation.requestBody?.content?.["application/json"]?.schema) {
        properties.body = operation.requestBody.content["application/json"].schema;
        required.push("body");
      }

      tools.push({
        name,
        description,
        inputSchema: {
          type: "object",
          properties,
          ...(required.length > 0 ? { required } : {}),
        },
      });
    }
  }

  return tools;
}
