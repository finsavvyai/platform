#!/usr/bin/env node

/**
 * Migration Validation Script for Questro SaaS Platform
 *
 * This script validates the generated migration files for correctness
 * and performs safety checks before deployment.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const migrationDir = path.join(projectRoot, "drizzle");

console.log("🔍 Validating Questro Database Migrations");
console.log("=========================================");

// Find the latest migration file
const migrationFiles = fs
  .readdirSync(migrationDir)
  .filter((file) => file.endsWith(".sql") && file.includes("questro"))
  .sort()
  .reverse();

if (migrationFiles.length === 0) {
  console.error("❌ No migration files found");
  process.exit(1);
}

const latestMigration = migrationFiles[0];
const migrationPath = path.join(migrationDir, latestMigration);
const migrationContent = fs.readFileSync(migrationPath, "utf8");

console.log(`✓ Found migration: ${latestMigration}`);

// Validation checks
const validations = {
  hasTransaction:
    migrationContent.includes("BEGIN TRANSACTION") &&
    migrationContent.includes("COMMIT"),
  hasPragmaForeignKeys: migrationContent.includes("PRAGMA foreign_keys = ON"),
  hasCreateTableStatements:
    (migrationContent.match(/CREATE TABLE/g) || []).length >= 30,
  hasIndexes: (migrationContent.match(/CREATE INDEX/g) || []).length >= 50,
  hasTriggers: (migrationContent.match(/CREATE TRIGGER/g) || []).length >= 10,
  hasNoHarmfulCommands:
    !migrationContent.includes("DROP TABLE") &&
    !migrationContent.includes("DELETE FROM"),
  hasMigrationMeta: migrationContent.includes("migration_meta"),
  hasProperComments:
    migrationContent.includes("-- Generated:") &&
    migrationContent.includes("-- Migration Type:"),
  hasForeignKeyConstraints: migrationContent.includes("FOREIGN KEY"),
  hasTimestampColumns:
    migrationContent.includes("created_at") &&
    migrationContent.includes("updated_at"),
};

console.log("\n📋 Validation Results:");
console.log("=====================");

let allPassed = true;
for (const [check, passed] of Object.entries(validations)) {
  const status = passed ? "✅" : "❌";
  const description = check
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
  console.log(`${status} ${description}: ${passed ? "PASS" : "FAIL"}`);
  if (!passed) allPassed = false;
}

// Count actual tables
const tableMatches = migrationContent.match(/CREATE TABLE\s+(\w+)/g);
const tableCount = tableMatches ? tableMatches.length : 0;

// Count actual indexes
const indexMatches = migrationContent.match(/CREATE INDEX/g);
const indexCount = indexMatches ? indexMatches.length : 0;

// Count actual triggers
const triggerMatches = migrationContent.match(/CREATE TRIGGER/g);
const triggerCount = triggerMatches ? triggerMatches.length : 0;

console.log("\n📊 Migration Statistics:");
console.log("========================");
console.log(`- Tables: ${tableCount}`);
console.log(`- Indexes: ${indexCount}`);
console.log(`- Triggers: ${triggerCount}`);
console.log(
  `- File size: ${(fs.statSync(migrationPath).size / 1024).toFixed(2)} KB`,
);

// Expected counts
const expectedCounts = {
  tables: 33,
  indexes: 50,
  triggers: 15,
};

console.log("\n🎯 Expected vs Actual:");
console.log("=======================");
console.log(
  `Tables: ${expectedCounts.tables} expected, ${tableCount} actual ${tableCount >= expectedCounts.tables ? "✅" : "❌"}`,
);
console.log(
  `Indexes: ${expectedCounts.indexes}+ expected, ${indexCount} actual ${indexCount >= expectedCounts.indexes ? "✅" : "❌"}`,
);
console.log(
  `Triggers: ${expectedCounts.triggers} expected, ${triggerCount} actual ${triggerCount >= expectedCounts.triggers ? "✅" : "❌"}`,
);

// Final verdict
console.log("\n🏁 Final Verdict:");
console.log("==================");
if (
  allPassed &&
  tableCount >= expectedCounts.tables &&
  indexCount >= expectedCounts.indexes
) {
  console.log("✅ Migration validation PASSED");
  console.log("✅ Ready for deployment");
  console.log("");
  console.log("🚀 Next steps:");
  console.log("1. Test in development environment");
  console.log("2. Create database backup");
  console.log("3. Deploy to staging environment");
  console.log("4. Deploy to production");
  console.log("");
  console.log("📝 Deployment commands:");
  console.log(
    "Development: wrangler d1 migrations apply upm-plus-config --local",
  );
  console.log(
    "Production:  wrangler d1 migrations apply upm-plus-config --remote",
  );
} else {
  console.log("❌ Migration validation FAILED");
  console.log("❌ Please fix issues before deployment");
  console.log("");
  console.log("🔧 Common fixes:");
  console.log("- Ensure all tables are included");
  console.log("- Add missing foreign key constraints");
  console.log("- Include proper transaction handling");
  console.log("- Add performance indexes");
  process.exit(1);
}
