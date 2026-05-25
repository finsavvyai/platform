import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  driver: "d1",
  dbCredentials: {
    wranglerConfigPath: "./wrangler.toml",
    dbName: "upm-plus-config",
  },
  verbose: true,
  strict: true,
} satisfies Config;
