#!/usr/bin/env node

/**
 * Migration Generation Script for Questro SaaS Platform
 *
 * This script generates proper Drizzle migration files from the schema.ts file
 * for Cloudflare D1 SQLite database.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

const migrationOutputDir = path.join(projectRoot, "drizzle");
const schemaPath = path.join(projectRoot, "src/db/schema.ts");

console.log("🚀 Generating Questro D1 Database Migrations");
console.log("==========================================");

// Ensure migrations directory exists
if (!fs.existsSync(migrationOutputDir)) {
  fs.mkdirSync(migrationOutputDir, { recursive: true });
  console.log("✓ Created migrations directory");
}

// Generate timestamp for migration file
const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
const migrationFileName = `${timestamp}_questro_schema.sql`;
const migrationPath = path.join(migrationOutputDir, migrationFileName);

// Read the schema file to extract table definitions
const schemaContent = fs.readFileSync(schemaPath, "utf8");

// Extract all table definitions using regex
const tableRegex = /export const (\w+) = sqliteTable\("([^"]+)", \{([^}]+)\}/g;
const tables = [];
let match;

while ((match = tableRegex.exec(schemaContent)) !== null) {
  const tableName = match[2];
  const definitions = match[3];

  // Parse column definitions
  const columns = [];
  const foreignKeys = [];

  // Split by comma and process each line
  const lines = definitions.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip comments and empty lines
    if (trimmedLine.startsWith("//") || !trimmedLine) continue;

    // Extract column definition
    const columnMatch = trimmedLine.match(
      /(\w+):\s*(text\([^)]*\)|integer\([^)]*\)|real\([^)]*\)|blob\([^)]*\)|text|integer|real|blob)(\([^)]*\))?/,
    );
    if (columnMatch) {
      const columnName = columnMatch[1];
      const columnType = columnMatch[2];

      // Check for constraints
      const isPrimaryKey = trimmedLine.includes(".primaryKey()");
      const isNotNull = trimmedLine.includes(".notNull()");
      const isUnique = trimmedLine.includes(".unique()");
      const defaultValue = trimmedLine.match(/\.default\(([^)]+)\)/)?.[1];
      const references = trimmedLine.match(/\.references\(\(\)([^)]+)\)/)?.[1];

      columns.push({
        name: columnName,
        type: columnType.split("(")[0], // Remove parameters
        isPrimaryKey,
        isNotNull,
        isUnique,
        defaultValue,
        references,
      });

      // Extract foreign key reference if present
      if (references) {
        const refMatch = references.match(/=>\s*(\w+)\.id/);
        if (refMatch) {
          foreignKeys.push({
            column: columnName,
            refTable: refMatch[1],
            onDelete: trimmedLine.includes('onDelete: "cascade"')
              ? "CASCADE"
              : "SET NULL",
          });
        }
      }
    }
  }

  tables.push({
    name: tableName,
    columns,
    foreignKeys,
  });
}

console.log(`✓ Found ${tables.length} tables in schema`);

// Generate migration SQL content
let migrationSQL = `-- Questro SaaS Platform - Database Migration
-- Generated: ${new Date().toISOString()}
-- Database: Cloudflare D1 SQLite
-- Tables: ${tables.length}
-- Schema Version: 1.0.0-d1

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

`;

// Generate CREATE TABLE statements
for (const table of tables) {
  migrationSQL += `-- Table: ${table.name}\n`;
  migrationSQL += `CREATE TABLE ${table.name} (\n`;

  const columnDefinitions = [];

  // Add columns
  for (const column of table.columns) {
    let columnDef = `  ${column.name} `;

    // Map Drizzle types to SQLite types
    switch (column.type) {
      case "text":
        columnDef += "TEXT";
        break;
      case "integer":
        columnDef += "INTEGER";
        break;
      case "real":
        columnDef += "REAL";
        break;
      case "blob":
        columnDef += "BLOB";
        break;
      default:
        columnDef += "TEXT";
    }

    // Add constraints
    if (column.isPrimaryKey) columnDef += " PRIMARY KEY";
    if (column.isNotNull && !column.isPrimaryKey) columnDef += " NOT NULL";
    if (column.isUnique) columnDef += " UNIQUE";
    if (column.defaultValue) {
      columnDef += ` DEFAULT ${column.defaultValue}`;
    }

    columnDefinitions.push(columnDef);
  }

  migrationSQL += columnDefinitions.join(",\n");

  // Add foreign key constraints
  if (table.foreignKeys.length > 0) {
    migrationSQL += ",\n";

    const fkDefinitions = table.foreignKeys.map(
      (fk) =>
        `  FOREIGN KEY (${fk.column}) REFERENCES ${fk.refTable}(id) ON DELETE ${fk.onDelete}`,
    );

    migrationSQL += fkDefinitions.join(",\n");
  }

  migrationSQL += "\n);\n\n";
}

// Add indexes for performance
migrationSQL += `-- Performance Indexes\n`;

for (const table of tables) {
  // Add index for foreign key columns
  for (const fk of table.foreignKeys) {
    migrationSQL += `CREATE INDEX idx_${table.name}_${fk.column} ON ${table.name}(${fk.column});\n`;
  }

  // Add index for commonly queried columns
  const commonIndexes = [
    "email",
    "user_id",
    "project_id",
    "session_id",
    "created_at",
  ];
  for (const column of table.columns) {
    if (commonIndexes.includes(column.name)) {
      migrationSQL += `CREATE INDEX idx_${table.name}_${column.name} ON ${table.name}(${column.name});\n`;
    }
  }
}

migrationSQL += `
COMMIT;

-- Migration completed successfully
-- Generated ${tables.length} tables with indexes
`;

// Write migration file
fs.writeFileSync(migrationPath, migrationSQL);

console.log(`✓ Generated migration: ${migrationFileName}`);
console.log(`✓ Location: ${migrationPath}`);
console.log(`✓ Tables: ${tables.length}`);

// Create a metadata file for tracking
const metadata = {
  version: timestamp,
  timestamp: new Date().toISOString(),
  tables: tables.map((t) => t.name),
  tableCount: tables.length,
  database: "d1",
  platform: "cloudflare-workers",
};

const metadataPath = path.join(migrationOutputDir, "migration-metadata.json");
fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

console.log(`✓ Generated metadata: migration-metadata.json`);
console.log("");
console.log("🎉 Migration generation completed successfully!");
console.log("");
console.log("Next steps:");
console.log("1. Review the generated migration file");
console.log(
  "2. Apply to local development: wrangler d1 migrations apply upm-plus-config --local",
);
console.log(
  "3. Apply to production: wrangler d1 migrations apply upm-plus-config --remote",
);
console.log("");

// Display table summary
console.log("📊 Generated Tables:");
console.log("===================");
for (const table of tables) {
  console.log(
    `- ${table.name} (${table.columns.length} columns, ${table.foreignKeys.length} foreign keys)`,
  );
}
