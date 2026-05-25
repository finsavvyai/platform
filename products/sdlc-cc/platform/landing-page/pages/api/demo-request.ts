import type { NextRequest } from "next/server";

export const config = {
  runtime: "edge",
};

type DemoRequestPayload = {
  name?: string;
  email?: string;
  company?: string;
  useCase?: string;
  timeline?: string;
  message?: string;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export default async function handler(req: NextRequest) {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const payload = (await req.json()) as DemoRequestPayload;
    const { name, email, company, useCase, timeline, message } = payload;

    if (!name || !email || !company) {
      return json(400, {
        error: "Missing required fields: name, email, company",
      });
    }

    const webhookUrl = process.env.DEMO_REQUEST_WEBHOOK_URL;
    const webhookToken = process.env.DEMO_REQUEST_WEBHOOK_TOKEN;

    if (!webhookUrl) {
      console.error("Demo request intake is not configured");
      return json(503, {
        error: "Demo intake unavailable",
        message: "Demo request delivery is not configured for this environment",
      });
    }

    const submittedAt = new Date().toISOString();
    const demoRequestId = `demo_${Date.now()}`;
    const forwardedPayload = {
      id: demoRequestId,
      submittedAt,
      source: "landing-page",
      contact: {
        name,
        email,
        company,
      },
      request: {
        useCase: useCase || "",
        timeline: timeline || "",
        message: message || "",
      },
    };

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookToken
          ? {
              Authorization: `Bearer ${webhookToken}`,
            }
          : {}),
      },
      body: JSON.stringify(forwardedPayload),
    });

    if (!webhookResponse.ok) {
      const responseBody = await webhookResponse.text();
      console.error("Demo request delivery failed", {
        status: webhookResponse.status,
        body: responseBody,
      });

      return json(502, {
        error: "Demo intake delivery failed",
        message: "The request could not be delivered to the configured intake endpoint",
      });
    }

    console.log("Demo request received:", { name, email, company, useCase, timeline });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Demo request received successfully",
        data: {
          id: demoRequestId,
          status: "submitted",
          nextSteps: [
            "Our team will review your request",
            "Initial contact within 24 hours",
            "Discovery call to understand requirements",
            "Personalized demo preparation",
            "Custom proposal and pilot discussion",
          ],
        },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Demo request failed:", error instanceof Error ? error.message : "Unknown error");
    return json(500, {
      error: "Internal server error",
      message: "Failed to process demo request",
    });
  }
}
