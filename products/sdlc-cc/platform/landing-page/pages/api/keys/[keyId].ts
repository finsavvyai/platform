import type { NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import {
  ApiKeyNotFoundError,
  ApiKeyStoreUnavailableError,
  ApiKeyValidationError,
  deleteApiKey,
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

const getKeyIdFromRequest = (req: NextRequest) => {
  const url = new URL(req.url);
  const keyId = url.pathname.split("/").pop();
  return keyId ? decodeURIComponent(keyId) : "";
};

export default async function handler(req: NextRequest) {
  const { userId } = getAuth(req);

  if (!userId) {
    return json(401, { error: "Unauthorized" });
  }

  const keyId = getKeyIdFromRequest(req);

  if (req.method === "DELETE") {
    try {
      await deleteApiKey(userId, keyId);
      return json(200, { success: true });
    } catch (error) {
      if (error instanceof ApiKeyNotFoundError) {
        return json(404, { error: "API key not found" });
      }

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

      console.error("Error deleting API key:", error);
      return json(500, {
        error: "Internal server error",
        message: "Failed to delete API key",
      });
    }
  }

  return json(405, { error: "Method not allowed" });
}
