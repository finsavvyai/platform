import type { NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import {
  ApiKeyStoreUnavailableError,
  ApiKeyValidationError,
  createApiKey,
} from "../../../lib/api-keys";

export const config = {
  runtime: "edge",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });

export default async function handler(req: NextRequest) {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return json(401, { error: "Unauthorized" });
    }

    const apiKey = await createApiKey(userId);
    return json(200, {
      ...apiKey,
      message: "Store this API key securely. It will not be shown again.",
    });
  } catch (error) {
    if (error instanceof ApiKeyStoreUnavailableError) {
      return json(503, {
        error: "API key management unavailable",
        message: error.message,
      });
    }

    if (error instanceof ApiKeyValidationError) {
      return json(400, {
        error: "Invalid API key request",
        message: error.message,
      });
    }

    console.error("Error generating API key:", error);
    return json(500, {
      error: "Internal server error",
      message: "Failed to generate API key",
    });
  }
}
