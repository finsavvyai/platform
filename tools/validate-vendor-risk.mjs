#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const registerPath = resolve(root, "docs/compliance/vendor-risk-register.json");
const allowedCriticality = new Set(["critical", "high", "medium", "low"]);
const allowedReviewStatus = new Set(["approved", "needs-review"]);
const errors = [];

const isObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const nonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;
const nonEmptyStringArray = (value) =>
  Array.isArray(value) && value.length > 0 && value.every(nonEmptyString);

function fail(message) {
  errors.push(message);
}

function parseIsoDate(field, value) {
  if (!nonEmptyString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`${field} must be YYYY-MM-DD`);
    return Number.NaN;
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(timestamp)) {
    fail(`${field} must be a valid date`);
  }
  return timestamp;
}

function todayUtcMs() {
  const override = process.env.VENDOR_RISK_TODAY;
  if (override !== undefined) {
    return parseIsoDate("VENDOR_RISK_TODAY", override);
  }

  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function validateVendor(vendor, index, seenIds) {
  const label = isObject(vendor) && nonEmptyString(vendor.id)
    ? `vendor ${vendor.id}`
    : `vendors[${index}]`;

  if (!isObject(vendor)) {
    fail(`${label} must be an object`);
    return;
  }

  if (!nonEmptyString(vendor.id)) {
    fail(`${label}.id is required`);
  } else if (seenIds.has(vendor.id)) {
    fail(`${label}.id must be unique`);
  } else {
    seenIds.add(vendor.id);
  }

  if (!nonEmptyString(vendor.name)) fail(`${label}.name is required`);
  if (!nonEmptyString(vendor.category)) fail(`${label}.category is required`);
  if (!allowedCriticality.has(vendor.criticality)) {
    fail(`${label}.criticality must be one of ${[...allowedCriticality].join(", ")}`);
  }
  if (!nonEmptyStringArray(vendor.services)) {
    fail(`${label}.services must be a non-empty string array`);
  }
  if (!nonEmptyString(vendor.data_access)) fail(`${label}.data_access is required`);
  if (!nonEmptyString(vendor.risk)) fail(`${label}.risk is required`);
  if (!nonEmptyStringArray(vendor.mitigations)) {
    fail(`${label}.mitigations must be a non-empty string array`);
  }
  if (!nonEmptyStringArray(vendor.evidence)) {
    fail(`${label}.evidence must be a non-empty string array`);
  }
  if (!nonEmptyString(vendor.owner)) fail(`${label}.owner is required`);
  if (!allowedReviewStatus.has(vendor.review_status)) {
    fail(`${label}.review_status must be one of ${[...allowedReviewStatus].join(", ")}`);
  }

  if (Array.isArray(vendor.evidence)) {
    for (const evidencePath of vendor.evidence) {
      if (!nonEmptyString(evidencePath)) continue;
      if (!existsSync(resolve(root, evidencePath))) {
        fail(`${label}.evidence references missing path: ${evidencePath}`);
      }
    }
  }

  if (
    (vendor.criticality === "critical" || vendor.criticality === "high") &&
    (!nonEmptyStringArray(vendor.mitigations) ||
      !nonEmptyStringArray(vendor.evidence) ||
      !nonEmptyString(vendor.owner))
  ) {
    fail(`${label} is ${vendor.criticality} and must have owner, mitigations, and evidence`);
  }
}

if (!existsSync(registerPath)) {
  fail("docs/compliance/vendor-risk-register.json is missing");
}

let register;
if (errors.length === 0) {
  try {
    register = JSON.parse(readFileSync(registerPath, "utf8"));
  } catch (error) {
    fail(`vendor-risk-register.json is invalid JSON: ${error.message}`);
  }
}

if (errors.length === 0) {
  if (!isObject(register)) {
    fail("register must be an object");
  } else {
    if (typeof register.schema_version !== "number") {
      fail("schema_version must be a number");
    }

    const lastReviewed = parseIsoDate("last_reviewed", register.last_reviewed);
    const nextReview = parseIsoDate("next_review", register.next_review);
    if (!Number.isNaN(lastReviewed) && !Number.isNaN(nextReview)) {
      const daysBetween = (nextReview - lastReviewed) / 86_400_000;
      if (daysBetween <= 0) fail("next_review must be after last_reviewed");
      if (daysBetween > 100) fail("next_review must be within 100 days of last_reviewed");
      const today = todayUtcMs();
      if (!Number.isNaN(today) && nextReview < today) {
        fail("next_review must not be in the past");
      }
    }

    if (!nonEmptyStringArray(register.required_vendor_ids)) {
      fail("required_vendor_ids must be a non-empty string array");
    }
    if (!Array.isArray(register.vendors) || register.vendors.length === 0) {
      fail("vendors must be a non-empty array");
    }

    const seenIds = new Set();
    if (Array.isArray(register.vendors)) {
      register.vendors.forEach((vendor, index) => validateVendor(vendor, index, seenIds));
    }

    if (Array.isArray(register.required_vendor_ids)) {
      for (const requiredId of register.required_vendor_ids) {
        if (!seenIds.has(requiredId)) {
          fail(`required vendor is missing from vendors: ${requiredId}`);
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error("vendor-risk: failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `vendor-risk: ok (${register.vendors.length} vendors, ${register.required_vendor_ids.length} required)`,
);
