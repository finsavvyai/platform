"use strict";

const fs = require("fs");
const path = require("path");

function writeAuditEvent(auditLogFile, auditLogEnabled, event) {
  if (!auditLogEnabled) return;
  try {
    const line = `${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`;
    fs.mkdirSync(path.dirname(auditLogFile), { recursive: true });
    fs.appendFile(auditLogFile, line, () => {});
  } catch {
    // Logging failures must not impact request handling.
  }
}

module.exports = { writeAuditEvent };
