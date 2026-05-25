/**
 * Error Handler Utility
 *
 * Centralized error handling for the Questro API
 */

import type { ErrorHandler } from "hono";

export const errorHandler: ErrorHandler = (error, c) => {
  console.error("API Error:", error);

  // Default error response
  let status = 500;
  let message = "Internal server error";

  // Handle specific error types
  if (error.message.includes("not found")) {
    status = 404;
    message = "Resource not found";
  } else if (
    error.message.includes("unauthorized") ||
    error.message.includes("token")
  ) {
    status = 401;
    message = "Unauthorized";
  } else if (error.message.includes("forbidden")) {
    status = 403;
    message = "Forbidden";
  } else if (error.message.includes("validation")) {
    status = 400;
    message = "Validation error";
  }

  return c.json(
    {
      error: message,
      status,
      timestamp: new Date().toISOString(),
      requestId: c.get("requestId"),
    },
    status,
  );
};
