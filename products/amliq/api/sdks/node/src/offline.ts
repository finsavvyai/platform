import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { ScreenResult } from "./types.js";

interface OfflineEntity {
  id: string;
  name: string;
  list_id: string;
}

/** Offline screening against locally downloaded sanctions lists. */
export class OfflineScreener {
  private entities: OfflineEntity[] = [];

  constructor(private dataDir: string) {}

  /** Load all JSON list files from the data directory. */
  loadLists(): number {
    this.entities = [];
    const files = readdirSync(this.dataDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const data = JSON.parse(readFileSync(join(this.dataDir, file), "utf-8"));
      if (Array.isArray(data)) {
        this.entities.push(...data);
      }
    }
    return this.entities.length;
  }

  /** Screen a name against loaded entities. */
  screen(name: string, threshold = 0.75): ScreenResult[] {
    const query = name.toLowerCase().trim();
    const results: ScreenResult[] = [];

    for (const entity of this.entities) {
      const entityName = entity.name?.toLowerCase().trim();
      if (!entityName) continue;
      const score = this.jaccardSimilarity(query, entityName);
      if (score >= threshold) {
        results.push({
          entity_id: entity.id,
          matched_name: entity.name,
          confidence: score,
          list_id: entity.list_id,
          evidence: [],
        });
      }
    }
    return results.sort((a, b) => b.confidence - a.confidence).slice(0, 50);
  }

  private jaccardSimilarity(a: string, b: string): number {
    const tokensA = new Set(a.split(/\s+/));
    const tokensB = new Set(b.split(/\s+/));
    const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
    const union = new Set([...tokensA, ...tokensB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }
}

/** Download sanctions list snapshot from API for offline use. */
export async function downloadLists(
  client: { _get: (path: string) => Promise<Record<string, unknown>> },
  outputDir: string,
): Promise<number> {
  mkdirSync(outputDir, { recursive: true });
  const data = (await client._get("/dataset/latest")) as { entities?: OfflineEntity[] };
  const entities = data.entities ?? [];
  writeFileSync(join(outputDir, "sanctions.json"), JSON.stringify(entities));
  return entities.length;
}
