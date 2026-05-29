import type {
  Layer,
  ListId,
  PepStatus,
  RiskLevel,
  ScreenMatch,
  ScreenRequest,
  ScreenResponse,
} from "./types.js";

interface FixtureMatch {
  entityId: string;
  entityName: string;
  confidence: number;
  lists: ListId[];
  pepStatus: PepStatus;
  scores: Partial<Record<Layer, number>>;
}

interface Fixture {
  riskLevel: RiskLevel;
  matches: FixtureMatch[];
}

const FIXTURES: Record<string, Fixture> = {
  "vladimir putin": {
    riskLevel: "high",
    matches: [
      {
        entityId: "ofac-12345",
        entityName: "Vladimir Putin",
        confidence: 0.98,
        lists: ["ofac", "eu_fsf"],
        pepStatus: "current",
        scores: { exact: 1.0, fuzzy: 0.97, phonetic: 0.95, token: 0.99, embedding: 0.96 },
      },
    ],
  },
  "sberbank of russia": {
    riskLevel: "high",
    matches: [
      {
        entityId: "ofac-67890",
        entityName: "Sberbank of Russia",
        confidence: 0.95,
        lists: ["ofac"],
        pepStatus: "none",
        scores: { exact: 1.0, fuzzy: 0.94, phonetic: 0.90, token: 0.96, embedding: 0.93 },
      },
    ],
  },
  "recep erdogan": {
    riskLevel: "medium",
    matches: [
      {
        entityId: "pep-22334",
        entityName: "Recep Erdogan",
        confidence: 0.82,
        lists: [],
        pepStatus: "current",
        scores: { exact: 0.0, fuzzy: 0.85, phonetic: 0.80, token: 0.86, embedding: 0.79 },
      },
    ],
  },
  "mohammad ali": {
    riskLevel: "clear",
    matches: [],
  },
};

export class MockScreenClient {
  private readonly fixtures: Record<string, Fixture>;
  private readonly nowFn: () => Date;

  public constructor(opts?: { fixtures?: Record<string, Fixture>; now?: () => Date }) {
    this.fixtures = opts?.fixtures ?? FIXTURES;
    this.nowFn = opts?.now ?? (() => new Date("2026-01-01T00:00:00.000Z"));
  }

  public async screen(request: ScreenRequest): Promise<ScreenResponse> {
    const key = request.name.trim().toLowerCase();
    const fx = this.fixtures[key];
    const matches = fx ? fx.matches.map((m) => this.toMatch(m, request)) : [];
    const filtered = this.applyFilters(matches, request);
    const riskLevel: RiskLevel = filtered.length === 0 ? "clear" : (fx?.riskLevel ?? "clear");
    return Promise.resolve({
      query: request.name,
      matches: filtered,
      riskLevel,
      latencyMs: 7,
      screenedAt: this.nowFn().toISOString(),
    });
  }

  private toMatch(m: FixtureMatch, request: ScreenRequest): ScreenMatch {
    const layers = (["exact", "fuzzy", "phonetic", "token", "embedding"] as const).map(
      (layer): { layer: Layer; score: number; matched: boolean } => {
        const score = m.scores[layer] ?? 0;
        return { layer, score, matched: score >= 0.85 };
      },
    );
    const lists = request.lists && request.lists.length > 0
      ? m.lists.filter((l) => request.lists?.includes(l))
      : m.lists;
    return {
      entityId: m.entityId,
      entityName: m.entityName,
      confidence: m.confidence,
      lists,
      layers,
      pepStatus: request.pep === false ? "none" : m.pepStatus,
    };
  }

  private applyFilters(matches: ScreenMatch[], request: ScreenRequest): ScreenMatch[] {
    const threshold = request.threshold ?? 0;
    return matches.filter((m) => m.confidence >= threshold);
  }
}
