/**
 * MCP Tools - Generated from OpenAPI specification
 */

import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Tool definitions
export const tools: Tool[] = [
  {
    name: "listPets",
    description: "Returns all pets from the store",
    inputSchema: {
      type: "object",
      properties: {
            "limit": {
                  "type": "number",
                  "description": "Maximum number of pets to return"
            }
      },
      required: [],
    },
  },
  {
    name: "createPet",
    description: "Create a pet",
    inputSchema: {
      type: "object",
      properties: {
            "body": {
                  "type": "object",
                  "description": "Request body"
            }
      },
      required: ["body"],
    },
  },
  {
    name: "getPet",
    description: "Get a pet by ID",
    inputSchema: {
      type: "object",
      properties: {
            "petId": {
                  "type": "string",
                  "description": "path parameter: petId"
            }
      },
      required: ["petId"],
    },
  },
  {
    name: "deletePet",
    description: "Delete a pet",
    inputSchema: {
      type: "object",
      properties: {
            "petId": {
                  "type": "string",
                  "description": "path parameter: petId"
            }
      },
      required: ["petId"],
    },
  }
];

// Tool name to executor mapping
const toolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  "listPets": execute_listPets,
  "createPet": execute_createPet,
  "getPet": execute_getPet,
  "deletePet": execute_deletePet
};

// Main executor
export async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const executor = toolExecutors[name];
  if (!executor) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return executor(args);
}

// Individual tool executors
async function execute_listPets(args: Record<string, unknown>): Promise<unknown> {
  // TODO: Configure your base URL
  const BASE_URL = process.env.API_BASE_URL || "https://api.example.com";
  const url = `${BASE_URL}/pets`;
  
  const queryParams = new URLSearchParams();
  if (args.limit !== undefined) queryParams.set("limit", String(args.limit));
  const queryString = queryParams.toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  
  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication headers
      // "Authorization": `Bearer ${process.env.API_KEY}`,
    },
    
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

async function execute_createPet(args: Record<string, unknown>): Promise<unknown> {
  // TODO: Configure your base URL
  const BASE_URL = process.env.API_BASE_URL || "https://api.example.com";
  const url = `${BASE_URL}/pets`;
  const fullUrl = url;
  
  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication headers
      // "Authorization": `Bearer ${process.env.API_KEY}`,
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

async function execute_getPet(args: Record<string, unknown>): Promise<unknown> {
  // TODO: Configure your base URL
  const BASE_URL = process.env.API_BASE_URL || "https://api.example.com";
  const url = `${BASE_URL}/pets/${args.petId}`;
  const fullUrl = url;
  
  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication headers
      // "Authorization": `Bearer ${process.env.API_KEY}`,
    },
    
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

async function execute_deletePet(args: Record<string, unknown>): Promise<unknown> {
  // TODO: Configure your base URL
  const BASE_URL = process.env.API_BASE_URL || "https://api.example.com";
  const url = `${BASE_URL}/pets/${args.petId}`;
  const fullUrl = url;
  
  const response = await fetch(fullUrl, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication headers
      // "Authorization": `Bearer ${process.env.API_KEY}`,
    },
    
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}
