#!/usr/bin/env node

/**
 * Build OpenAI App Manifest
 *
 * Creates the manifest.json file required for OpenAI GPT Store submission
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"),
);

// OpenAI App manifest configuration
const manifest = {
  schema_version: "1.0",
  name_for_model: "QueryFlux_Database_Assistant",
  name_for_human: "QueryFlux Database Assistant",
  description_for_model:
    "AI-powered database assistant that converts natural language to SQL and executes queries securely across multiple database types including PostgreSQL, MySQL, MongoDB, Redis, and SQL Server with enterprise-grade security.",
  description_for_human:
    "The first comprehensive database assistant in OpenAI GPT Store. Connect to any database, ask questions in natural language, and get instant results with visualizations. Enterprise-grade security with SQL injection prevention.",
  auth: {
    type: "none",
  },
  api: {
    type: "openapi",
    url: "openapi.yaml",
  },
  logo_url: "https://queryflux.com/logo.png",
  contact_email: "support@queryflux.com",
  legal_info_url: "https://queryflux.com/legal",
  capabilities: {
    code_interpreter: false,
    file_search: false,
    image_generation: false,
    web_search: false,
  },
  category: "productivity",
  keywords: [
    "database",
    "sql",
    "query",
    "postgresql",
    "mysql",
    "mongodb",
    "data analysis",
    "business intelligence",
    "nosql",
    "analytics",
  ],
  tags: ["data", "database", "sql", "analytics", "productivity"],
};

// Write manifest to dist directory
const distDir = path.join(__dirname, "../dist");
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const manifestPath = path.join(distDir, "manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log("✅ OpenAI App manifest built successfully!");
console.log(`📄 Manifest saved to: ${manifestPath}`);
console.log(`📦 App version: ${packageJson.version}`);
console.log(`🔧 Schema version: ${manifest.schema_version}`);
