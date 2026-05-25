// Maven parser + settings.xml generator tests.

import { describe, it, expect } from "vitest";
import { parsePom, parseMultiModule, substituteProperties } from "./maven";
import { generateSettingsXml, looksLikePlaintextSecret } from "./maven-settings";
import { buildMavenPipeline } from "./maven-routes";

const SIMPLE_POM = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>dk.norlys</groupId>
  <artifactId>billing-svc</artifactId>
  <version>1.2.3</version>
  <packaging>jar</packaging>
  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <junit.version>5.10.0</junit.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>\${junit.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>dk.norlys</groupId>
      <artifactId>commons</artifactId>
      <version>\${project.version}</version>
    </dependency>
  </dependencies>
</project>`;

const PARENT_POM = `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>dk.norlys</groupId>
  <artifactId>platform</artifactId>
  <version>2.0.0</version>
  <packaging>pom</packaging>
  <modules>
    <module>svc-a</module>
    <module>svc-b</module>
  </modules>
</project>`;

const CHILD_A = `<?xml version="1.0"?>
<project>
  <parent>
    <groupId>dk.norlys</groupId>
    <artifactId>platform</artifactId>
    <version>2.0.0</version>
  </parent>
  <artifactId>svc-a</artifactId>
</project>`;

describe("parsePom", () => {
  it("parses groupId/artifactId/version and packaging", () => {
    const p = parsePom(SIMPLE_POM);
    expect(p.groupId).toBe("dk.norlys");
    expect(p.artifactId).toBe("billing-svc");
    expect(p.version).toBe("1.2.3");
    expect(p.packaging).toBe("jar");
  });

  it("captures properties", () => {
    const p = parsePom(SIMPLE_POM);
    expect(p.properties["maven.compiler.release"]).toBe("17");
    expect(p.properties["junit.version"]).toBe("5.10.0");
  });

  it("substitutes ${junit.version} in dependency version", () => {
    const p = parsePom(SIMPLE_POM);
    const junit = p.dependencies.find((d) => d.artifactId === "junit-jupiter");
    expect(junit?.version).toBe("5.10.0");
    expect(junit?.scope).toBe("test");
  });

  it("substitutes ${project.version} in dependency version", () => {
    const p = parsePom(SIMPLE_POM);
    const commons = p.dependencies.find((d) => d.artifactId === "commons");
    expect(commons?.version).toBe("1.2.3");
  });

  it("ignores XML comments", () => {
    const xml = `<project><!-- comment with <groupId>evil</groupId> -->
      <groupId>ok</groupId><artifactId>x</artifactId><version>1</version></project>`;
    const p = parsePom(xml);
    expect(p.groupId).toBe("ok");
  });
});

describe("parseMultiModule", () => {
  it("detects modules in parent pom", () => {
    const p = parsePom(PARENT_POM);
    expect(p.modules).toEqual(["svc-a", "svc-b"]);
    expect(p.packaging).toBe("pom");
  });

  it("builds a module graph with child poms", () => {
    const graph = parseMultiModule(PARENT_POM, {
      "svc-a": CHILD_A,
    });
    expect(graph.pom.artifactId).toBe("platform");
    expect(graph.children).toHaveLength(1);
    expect(graph.children[0].path).toBe("svc-a");
    expect(graph.children[0].pom.artifactId).toBe("svc-a");
    // child inherits version from parent block
    expect(graph.children[0].pom.version).toBe("2.0.0");
  });
});

describe("substituteProperties", () => {
  it("bounds recursion on circular references", () => {
    const out = substituteProperties("${a}", { a: "${b}", b: "${a}" });
    // Should not hang. Bound is 10 passes; we just assert termination.
    expect(typeof out).toBe("string");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(substituteProperties("${missing}", {})).toBe("${missing}");
  });

  it("falls through maven.compiler.release to java.version", () => {
    const out = substituteProperties("${java.version}", {
      "maven.compiler.release": "21",
    });
    expect(out).toBe("21");
  });
});

describe("generateSettingsXml", () => {
  it("emits servers with env-var placeholder password", () => {
    const xml = generateSettingsXml({
      servers: [
        { id: "nexus", username: "pushci", password: "${env.NEXUS_PASSWORD}" },
      ],
    });
    expect(xml).toContain("<id>nexus</id>");
    expect(xml).toContain("<username>pushci</username>");
    expect(xml).toContain("<password>${env.NEXUS_PASSWORD}</password>");
    expect(xml).toContain("<?xml version=");
    expect(xml).toContain("<settings xmlns=");
  });

  it("includes mirrors when provided", () => {
    const xml = generateSettingsXml({
      servers: [{ id: "nexus", username: "u", password: "${env.X}" }],
      mirrors: [
        { id: "central-mirror", url: "https://nexus.norlys.dk/repository/maven-central", mirrorOf: "central" },
      ],
    });
    expect(xml).toContain("<mirrorOf>central</mirrorOf>");
  });

  it("matches deterministic snapshot for minimal config", () => {
    const xml = generateSettingsXml({
      servers: [{ id: "nexus", username: "pushci", password: "${env.NEXUS_PASSWORD}" }],
    });
    // Snapshot-style exact-match — easy to update if generator changes.
    expect(xml.trim().split("\n")[0]).toBe(`<?xml version="1.0" encoding="UTF-8"?>`);
    expect(xml).toContain("<servers>\n    <server>");
    expect(xml).toContain("</server>\n  </servers>");
  });
});

describe("looksLikePlaintextSecret", () => {
  it("accepts env-var placeholders", () => {
    expect(looksLikePlaintextSecret("${env.NEXUS_PASSWORD}")).toBe(false);
  });
  it("flags plaintext", () => {
    expect(looksLikePlaintextSecret("hunter2")).toBe(true);
  });
  it("ignores empty", () => {
    expect(looksLikePlaintextSecret("")).toBe(false);
  });
});

describe("buildMavenPipeline", () => {
  it("includes parallel verify + m2 cache", () => {
    const p = parsePom(SIMPLE_POM);
    const yaml = buildMavenPipeline(p);
    expect(yaml).toContain("mvn -B -T 1C verify");
    expect(yaml).toContain("~/.m2/repository");
    expect(yaml).toContain("surefire-reports");
  });

  it("uses detected java version", () => {
    const p = parsePom(SIMPLE_POM);
    const yaml = buildMavenPipeline(p);
    expect(yaml).toContain(`java: "17"`);
  });

  it("opts in to spotbugs when requested", () => {
    const p = parsePom(SIMPLE_POM);
    const yaml = buildMavenPipeline(p, { spotbugs: true });
    expect(yaml).toContain("spotbugs-maven-plugin:check");
  });
});
