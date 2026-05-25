import { describe, it, expect } from "vitest";
import {
  getSkillCatalog,
  getSkillById,
  searchSkills,
  listSkillsByCategory,
} from "./skills";
import type { SkillCategory } from "./skills";

describe("Skill Catalog", () => {
  it("returns all 69 skills", () => {
    const skills = getSkillCatalog();
    expect(skills).toHaveLength(69);
  });

  it("every skill has required fields", () => {
    for (const s of getSkillCatalog()) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.version).toBeTruthy();
      expect(s.category).toBeTruthy();
      expect(s.author).toBeTruthy();
      expect(s.tags.length).toBeGreaterThan(0);
      expect(s.steps.length).toBeGreaterThan(0);
    }
  });

  it("every step has a run command", () => {
    for (const s of getSkillCatalog()) {
      for (const step of s.steps) {
        expect(step.run).toBeTruthy();
      }
    }
  });

  it("has unique IDs", () => {
    const ids = getSkillCatalog().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getSkillById", () => {
  it("finds existing skill", () => {
    const skill = getSkillById("nextjs-vercel");
    expect(skill).toBeDefined();
    expect(skill!.name).toBe("Next.js + Vercel");
    expect(skill!.category).toBe("templates");
    expect(skill!.verified).toBe(true);
  });

  it("returns undefined for missing skill", () => {
    expect(getSkillById("nonexistent")).toBeUndefined();
  });

  it("finds all catalog skills by id", () => {
    const catalog = getSkillCatalog();
    for (const s of catalog) {
      const found = getSkillById(s.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(s.id);
    }
  });
});

describe("searchSkills", () => {
  it("returns all skills for empty query", () => {
    expect(searchSkills("")).toHaveLength(69);
  });

  it("finds skills by name", () => {
    const results = searchSkills("Next.js");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.id === "nextjs-vercel")).toBe(true);
  });

  it("finds skills by tag", () => {
    const results = searchSkills("Docker");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.id === "go-docker")).toBe(true);
  });

  it("finds skills by description", () => {
    const results = searchSkills("bundle size");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.id === "bundle-size")).toBe(true);
  });

  it("finds skills by category", () => {
    const results = searchSkills("security");
    expect(results.length).toBeGreaterThanOrEqual(4);
  });

  it("is case insensitive", () => {
    const lower = searchSkills("slack");
    const upper = searchSkills("SLACK");
    expect(lower.length).toBe(upper.length);
    expect(lower.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty for nonsense query", () => {
    expect(searchSkills("zzzznonexistent")).toHaveLength(0);
  });
});

describe("listSkillsByCategory", () => {
  const expectedCounts: Record<SkillCategory, number> = {
    templates: 9,
    security: 12,
    notify: 6,
    deploy: 16,
    checks: 18,
    ai: 8,
  };

  for (const [cat, count] of Object.entries(expectedCounts)) {
    it(`returns ${count} ${cat} skills`, () => {
      const results = listSkillsByCategory(cat as SkillCategory);
      expect(results).toHaveLength(count);
      for (const s of results) {
        expect(s.category).toBe(cat);
      }
    });
  }

  it("category counts add up to total", () => {
    let total = 0;
    for (const cat of Object.keys(expectedCounts)) {
      total += listSkillsByCategory(cat as SkillCategory).length;
    }
    expect(total).toBe(69);
  });
});

describe("Skill data integrity", () => {
  it("verified skills are by known authors", () => {
    const knownAuthors = new Set(["pushci", "community", "finsavvyai"]);
    for (const s of getSkillCatalog()) {
      if (s.verified) {
        expect(knownAuthors.has(s.author)).toBe(true);
      }
    }
  });

  it("all skills have valid categories", () => {
    const valid = new Set(["templates", "checks", "deploy", "notify", "security", "ai"]);
    for (const s of getSkillCatalog()) {
      expect(valid.has(s.category)).toBe(true);
    }
  });

  it("skills with config have non-empty keys", () => {
    for (const s of getSkillCatalog()) {
      if (s.config) {
        const keys = Object.keys(s.config);
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) {
          expect(key).toBeTruthy();
          expect(key).toMatch(/^[A-Z_]+$/);
        }
      }
    }
  });

  it("install counts are positive", () => {
    for (const s of getSkillCatalog()) {
      expect(s.installs).toBeGreaterThan(0);
    }
  });

  it("versions follow semver format", () => {
    const semverRe = /^\d+\.\d+\.\d+$/;
    for (const s of getSkillCatalog()) {
      expect(s.version).toMatch(semverRe);
    }
  });
});
