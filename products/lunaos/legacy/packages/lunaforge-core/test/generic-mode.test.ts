import { describe, it, expect, vi, beforeAll } from "vitest";
import fs from "fs";
import path from "path";



vi.mock("lunaforge-core", async (orig) => {
  const actual = await orig();
  const { MockClient } = await import("./__mocks__/universal-clients");

  return {
    ...actual,
    WorkerClient: MockClient
  };
});

// Mythic
vi.mock("lunaforge-mythic", async (orig) => {
  const actual = await orig();
  const { MockClient } = await import("./__mocks__/universal-clients");

  return {
    ...actual,
    MythicBackendClient: MockClient
  };
});

// Guardian?
vi.mock("lunaforge-guardian", async (orig) => {
  const actual = await orig();
  const { MockClient } = await import("./__mocks__/universal-clients");

  return {
    ...actual,
    GuardianClient: MockClient
  };
});

// Ritual?
vi.mock("lunaforge-ritual", async (orig) => {
  const actual = await orig();
  const { MockClient } = await import("./__mocks__/universal-clients");

  return {
    ...actual,
    RitualBackendClient: MockClient
  };
});
//
// 1. MOCK WorkerClient globally so all modes load safely
//

vi.mock("lunaforge-core", async (orig) => {
  const actual = await orig();

  return {
    ...actual,
    WorkerClient: (await import("./__mocks__/workerClient")).WorkerClient
  };
});
vi.mock("lunaforge-core", async () => {
  const actual = await vi.importActual<any>("lunaforge-core");

  return {
    ...actual,

    WorkerClient: vi.fn().mockImplementation((opts) => {
      if (!opts || !opts.workerUrl) {
        throw new Error("WorkerClient missing workerUrl");
      }
      return {
        call: vi.fn().mockResolvedValue({ ok: true }),
      };
    }),
  };
});

//
// STATIC DISCOVERY
//
const ROOT = path.resolve(__dirname, "../../../");
const PKG_DIR = path.join(ROOT, "packages");

const IGNORED = new Set([
  "lunaforge-core",
  "lunaforge-worker",
  "lunaforge-agent-brain-worker",
  "lunaforge-extension",
  "lunaforge-mcp",
  "lunaforge-web",
  "lunaforge-aura",
  "jira-testquality-sync",
]);

const modePackages = fs
  .readdirSync(PKG_DIR)
  .filter((name) => name.startsWith("lunaforge-"))
  .filter((name) => !IGNORED.has(name));

function loadModeFactory(pkg: string) {
  const entry = path.join(PKG_DIR, pkg, "dist", "index.js");
  if (!fs.existsSync(entry)) return null;

  try {
    const mod = require(entry);
    const factoryName = Object.keys(mod).find((k) => k.startsWith("create"));
    return factoryName ? mod[factoryName] : null;
  } catch (err) {
    console.error(`🔥 Failed loading ${pkg}:`, err);
    return null;
  }
}

function mockCtx(features: string[] = []) {
  return {
    emit: vi.fn(),
    graph: { files: [], dependencies: [] },
    workspace: { rootPath: "/repo", folders: ["/repo"] },
    license: {
      valid: true,
      plan: "pro",
      features,
    },
  };
}

//
// TEST SUITE
//
describe("Generic LunaForge Mode Behavior", () => {
  for (const pkg of modePackages) {
    const factory = loadModeFactory(pkg);

    describe(pkg, () => {
      if (!factory) {
        it("loads mode factory", () => {
          throw new Error(`❌ Factory not found for ${pkg}`);
        });
        return;
      }

      let mode: any;

      it("initializes mode without throwing", () => {
        try {
          mode = factory({ workerUrl: "http://localhost:8787" });
        } catch (err: any) {
          console.error(
            `\n🔥 Mode initialization failure: ${pkg}\n` +
            `Factory: ${factory.toString()}\n` +
            `Error: ${err.stack || err}\n`
          );
          throw err;
        }

        expect(mode).toBeDefined();
      });

      it("has required metadata", () => {
        expect(mode.id).toBeTypeOf("string");
        expect(mode.title).toBeTypeOf("string");
        expect(mode.description).toBeTypeOf("string");
      });

      it("requires license to activate", () => {
        const ctx = mockCtx([]);

        mode.activate(ctx as any);

        const calls = (ctx.emit as any).mock.calls;
        const hasError = calls.some(([event]) =>
          event.includes("license:error")
        );

        expect(hasError).toBe(true);
      });

      it("activates with valid license", () => {
        const ctx = mockCtx([mode.requiredFeature]);

        mode.activate(ctx as any);

        const calls = (ctx.emit as any).mock.calls;
        const ready = calls.some(([event]) => event.includes(":ready"));

        expect(ready).toBe(true);
      });

      it("deactivates safely", () => {
        expect(() => mode.deactivate()).not.toThrow();
      });
    });
  }
});