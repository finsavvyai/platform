// Gradle parser + init-script generator + pipeline builder tests.

import { describe, it, expect } from "vitest";
import {
  parseGradle,
  parseGradlePlugins,
  parseSettingsGradle,
} from "./gradle";
import {
  generateGradleInitScript,
  generateGradleProperties,
  looksLikePlaintextGradleSecret,
} from "./gradle-settings";
import { buildGradlePipeline } from "./gradle-routes";

// --- Fixtures --------------------------------------------------------------

const GROOVY_SIMPLE = `
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.2.0'
    id 'com.github.spotbugs' version '6.0.0'
}

group = 'com.norlys.example'
version = '1.0.0'

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web:3.2.0'
    api 'org.apache.commons:commons-lang3:3.14.0'
    runtimeOnly 'org.postgresql:postgresql:42.7.1'
    testImplementation 'junit:junit:4.13.2'
}
`;

const KOTLIN_DSL = `
plugins {
    kotlin("jvm") version "1.9.22"
    id("org.springframework.boot") version "3.2.1"
    id("io.gitlab.arturbosch.detekt") version "1.23.4"
}

group = "com.norlys.kotlin"
version = "2.1.0"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web:3.2.1")
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.1")
}
`;

const SETTINGS_GROOVY = `
rootProject.name = 'norlys-platform'
include 'svc-a', 'svc-b'
include ':svc-c'
`;

const SETTINGS_KOTLIN = `
rootProject.name = "norlys-platform"
include("svc-a", "svc-b")
include(":svc-c")
`;

// --- parseGradle -----------------------------------------------------------

describe("parseGradle (Groovy DSL)", () => {
  it("extracts group and version", () => {
    const p = parseGradle(GROOVY_SIMPLE);
    expect(p.group).toBe("com.norlys.example");
    expect(p.version).toBe("1.0.0");
  });

  it("extracts plugins as string ids", () => {
    const p = parseGradle(GROOVY_SIMPLE);
    expect(p.plugins).toContain("java");
    expect(p.plugins).toContain("org.springframework.boot");
    expect(p.plugins).toContain("com.github.spotbugs");
  });

  it("captures Spring Boot plugin version via structured helper", () => {
    const plugins = parseGradlePlugins(GROOVY_SIMPLE);
    const boot = plugins.find((p) => p.id === "org.springframework.boot");
    expect(boot?.version).toBe("3.2.0");
  });

  it("extracts javaVersion from toolchain", () => {
    const p = parseGradle(GROOVY_SIMPLE);
    expect(p.javaVersion).toBe("17");
  });

  it("extracts dependencies across multiple configurations", () => {
    const p = parseGradle(GROOVY_SIMPLE);
    const configs = new Set(p.dependencies.map((d) => d.configuration));
    expect(configs.has("implementation")).toBe(true);
    expect(configs.has("api")).toBe(true);
    expect(configs.has("runtimeOnly")).toBe(true);
    expect(configs.has("testImplementation")).toBe(true);
  });

  it("parses dependency coordinates with version", () => {
    const p = parseGradle(GROOVY_SIMPLE);
    const pg = p.dependencies.find((d) => d.name === "postgresql");
    expect(pg?.group).toBe("org.postgresql");
    expect(pg?.version).toBe("42.7.1");
    expect(pg?.configuration).toBe("runtimeOnly");
  });

  it("flags Groovy DSL as non-Kotlin", () => {
    const p = parseGradle(GROOVY_SIMPLE);
    expect(p.isKotlinDsl).toBe(false);
  });
});

describe("parseGradle (Kotlin DSL)", () => {
  it("extracts group and version for Kotlin DSL", () => {
    const p = parseGradle(KOTLIN_DSL);
    expect(p.group).toBe("com.norlys.kotlin");
    expect(p.version).toBe("2.1.0");
  });

  it("detects Kotlin DSL from content", () => {
    const p = parseGradle(KOTLIN_DSL);
    expect(p.isKotlinDsl).toBe(true);
  });

  it("extracts javaVersion 21 from toolchain", () => {
    const p = parseGradle(KOTLIN_DSL);
    expect(p.javaVersion).toBe("21");
  });

  it("captures kotlin jvm plugin version", () => {
    const p = parseGradle(KOTLIN_DSL);
    expect(p.kotlinVersion).toBe("1.9.22");
  });

  it("extracts Kotlin-DSL parenthesised dependencies", () => {
    const p = parseGradle(KOTLIN_DSL);
    expect(
      p.dependencies.some(
        (d) => d.name === "junit-jupiter" && d.configuration === "testImplementation",
      ),
    ).toBe(true);
  });
});

// --- parseSettingsGradle ---------------------------------------------------

describe("parseSettingsGradle", () => {
  it("extracts subprojects from Groovy settings", () => {
    const subs = parseSettingsGradle(SETTINGS_GROOVY);
    expect(subs).toEqual(expect.arrayContaining(["svc-a", "svc-b", "svc-c"]));
  });

  it("extracts subprojects from Kotlin DSL settings", () => {
    const subs = parseSettingsGradle(SETTINGS_KOTLIN);
    expect(subs).toEqual(expect.arrayContaining(["svc-a", "svc-b", "svc-c"]));
  });
});

// --- init script + properties ----------------------------------------------

describe("generateGradleInitScript", () => {
  it("references env vars instead of plaintext passwords", () => {
    const script = generateGradleInitScript({
      repositories: [
        { name: "nexus", url: "https://nexus.norlys.dk/repository/maven-releases" },
        { name: "artifactory", url: "https://artifactory.norlys.dk/libs-release" },
      ],
    });
    expect(script).toContain("System.getenv(\"NEXUS_USERNAME\")");
    expect(script).toContain("System.getenv(\"NEXUS_PASSWORD\")");
    expect(script).toContain("System.getenv(\"ARTIFACTORY_USERNAME\")");
    expect(script).not.toContain("hunter2");
    expect(script).not.toMatch(/password\s*=\s*"[^$S]/);
  });

  it("includes all repository URLs in the output", () => {
    const script = generateGradleInitScript({
      repositories: [
        { name: "nexus", url: "https://nexus.norlys.dk/repository/maven-releases" },
      ],
    });
    expect(script).toContain("https://nexus.norlys.dk/repository/maven-releases");
    expect(script).toContain("allprojects");
  });
});

describe("generateGradleProperties", () => {
  it("produces KEY=VALUE per line", () => {
    const props = generateGradleProperties({
      props: { "org.gradle.parallel": "true", "foo": "bar" },
    });
    expect(props).toContain("org.gradle.parallel=true");
    expect(props).toContain("foo=bar");
  });
});

describe("looksLikePlaintextGradleSecret", () => {
  it("accepts env-var references", () => {
    expect(looksLikePlaintextGradleSecret("NEXUS_PASSWORD")).toBe(false);
    expect(looksLikePlaintextGradleSecret("System.getenv(\"X\")")).toBe(false);
  });
  it("flags plaintext", () => {
    expect(looksLikePlaintextGradleSecret("hunter2")).toBe(true);
  });
  it("ignores empty", () => {
    expect(looksLikePlaintextGradleSecret("")).toBe(false);
  });
});

// --- pipeline builder ------------------------------------------------------

describe("buildGradlePipeline", () => {
  it("uses ./gradlew --no-daemon and caches the gradle dir", () => {
    const p = parseGradle(GROOVY_SIMPLE);
    const plugins = parseGradlePlugins(GROOVY_SIMPLE);
    const yaml = buildGradlePipeline(p, plugins);
    expect(yaml).toContain("./gradlew --no-daemon");
    expect(yaml).toContain("~/.gradle/caches/modules-2");
    expect(yaml).toContain("~/.gradle/caches/jars-9");
    expect(yaml).toContain("~/.gradle/wrapper/dists");
    expect(yaml).toContain("test-results");
  });

  it("uses detected java version", () => {
    const p = parseGradle(KOTLIN_DSL);
    const plugins = parseGradlePlugins(KOTLIN_DSL);
    const yaml = buildGradlePipeline(p, plugins);
    expect(yaml).toContain(`java: "21"`);
  });

  it("adds spotbugs stage when plugin detected", () => {
    const p = parseGradle(GROOVY_SIMPLE);
    const plugins = parseGradlePlugins(GROOVY_SIMPLE);
    const yaml = buildGradlePipeline(p, plugins);
    expect(yaml).toContain("spotbugsMain");
  });

  it("adds detekt stage when plugin detected in Kotlin DSL", () => {
    const p = parseGradle(KOTLIN_DSL);
    const plugins = parseGradlePlugins(KOTLIN_DSL);
    const yaml = buildGradlePipeline(p, plugins);
    expect(yaml).toContain("./gradlew detekt");
  });

  it("emits :subproject:build hints when multi-project", () => {
    const p = parseGradle(GROOVY_SIMPLE);
    const plugins = parseGradlePlugins(GROOVY_SIMPLE);
    const yaml = buildGradlePipeline(
      { ...p, subprojects: ["svc-a", "svc-b"] },
      plugins,
      { multiProject: true, subprojects: ["svc-a", "svc-b"] },
    );
    expect(yaml).toContain(":svc-a:build");
    expect(yaml).toContain(":svc-b:build");
  });
});
