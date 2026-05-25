import type { NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import {
  ApiKeyNotFoundError,
  ApiKeyStoreUnavailableError,
  ApiKeyValidationError,
  createApiKey,
  listApiKeys,
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
  const { userId } = getAuth(req);

  if (!userId) {
    return json(401, { error: "Unauthorized" });
  }

  try {
    if (req.method === "GET") {
      const items = await listApiKeys(userId);
      return json(200, { items });
    }

    if (req.method === "POST") {
      const apiKey = await createApiKey(userId);
      return json(201, {
        ...apiKey,
        message: "Store this API key securely. It will not be shown again.",
      });
    }

    return json(405, { error: "Method not allowed" });
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

    if (error instanceof ApiKeyNotFoundError) {
      return json(404, {
        error: "API key not found",
      });
    }

    console.error("API key request failed:", error);
    return json(500, {
      error: "Internal server error",
      message: "Failed to process API key request",
    });
  }
}
