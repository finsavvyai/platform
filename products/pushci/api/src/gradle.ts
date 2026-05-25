// Gradle build.gradle / build.gradle.kts parser — pure functions, no I/O.
//
// Runs in Cloudflare Workers (no Node APIs). Uses regex scanning which
// is intentionally forgiving: good enough to extract coordinates,
// plugins, dependencies, toolchain, and multi-project includes for the
// Norlys pilot. Not a Groovy/Kotlin parser — we do NOT import one.
//
// Supports BOTH Groovy DSL and Kotlin DSL. The two dialects differ in
// quoting (`"foo"` vs `'foo'`), parentheses around function calls, and
// property assignment (`group = "x"` vs `group "x"`). The regexes
// below accept either form.

export interface GradleDependency {
  configuration: string; // implementation / testImplementation / api / runtimeOnly / ...
  group: string;
  name: string;
  version?: string;
}

export interface GradlePlugin {
  id: string;
  version?: string;
}

export interface ParsedGradle {
  group?: string;
  version?: string;
  dependencies: GradleDependency[];
  /**
   * Plugin identifiers found in the `plugins { ... }` block, flattened
   * to string IDs. Use `parseGradlePlugins` if you need the
   * structured {id, version} form — the route layer does for
   * Spring Boot version extraction.
   */
  plugins: string[];
  subprojects: string[];
  javaVersion?: string;
  kotlinVersion?: string;
  isKotlinDsl: boolean;
}

// --- Low-level helpers -----------------------------------------------------

/**
 * Strip line (`//`) and block (`/* ... *\/`) comments so later regexes
 * never match text that's actually commented out. Done up front so the
 * rest of the parser can assume clean content.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Heuristic: `build.gradle.kts` uses `val x = "..."` and function-call
 * parentheses. Accept an explicit flag from callers (Workers routes
 * pass it in), otherwise sniff for Kotlin-isms.
 */
export function isKotlinDslContent(src: string): boolean {
  if (/\bval\s+\w+\s*=/.test(src)) return true;
  if (/\bplugins\s*\{[^}]*id\(\s*["']/.test(src)) return true;
  if (/\bimplementation\(\s*["']/.test(src)) return true;
  return false;
}

/**
 * Extract the body of a top-level block like `plugins { ... }`,
 * respecting nested braces. Returns undefined if the block isn't found.
 */
function blockBody(src: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*\\{`, "g");
  const m = re.exec(src);
  if (!m) return undefined;
  let depth = 1;
  let i = m.index + m[0].length;
  const start = i;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth === 0) return src.slice(start, i);
    i++;
  }
  return undefined;
}

// --- Field extractors -----------------------------------------------------

/**
 * Match `group = "x"`, `group "x"`, or `group("x")` — the three forms
 * you see across Groovy and Kotlin DSL files in the wild.
 */
function extractField(src: string, name: string): string | undefined {
  const patterns = [
    new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`),
    new RegExp(`\\b${name}\\s*\\(\\s*["']([^"']+)["']\\s*\\)`),
    new RegExp(`\\b${name}\\s+["']([^"']+)["']`),
  ];
  for (const p of patterns) {
    const m = p.exec(src);
    if (m) return m[1];
  }
  return undefined;
}

/**
 * Extract plugins from a `plugins { ... }` block. Accepts both the
 * Groovy shorthand `id 'foo' version '1.0'` and the Kotlin
 * `id("foo") version "1.0"`.
 */
function extractPlugins(src: string): GradlePlugin[] {
  const body = blockBody(src, "plugins");
  if (!body) return [];
  const out: GradlePlugin[] = [];
  const re = /id\s*\(?\s*["']([^"']+)["']\s*\)?(?:\s*version\s*["']([^"']+)["'])?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const plugin: GradlePlugin = { id: m[1] };
    if (m[2]) plugin.version = m[2];
    out.push(plugin);
  }
  // Kotlin DSL also supports `kotlin("jvm") version "1.9"` — capture it.
  const ktRe = /kotlin\s*\(\s*["']([^"']+)["']\s*\)(?:\s*version\s*["']([^"']+)["'])?/g;
  while ((m = ktRe.exec(body)) !== null) {
    const plugin: GradlePlugin = { id: `org.jetbrains.kotlin.${m[1]}` };
    if (m[2]) plugin.version = m[2];
    out.push(plugin);
  }
  return out;
}

/**
 * Extract dependencies from the `dependencies { ... }` block. Handles
 * the string-notation forms — module-map / `group:` / `name:` syntax is
 * intentionally skipped because the pilot projects don't use it.
 */
function extractDependencies(src: string): GradleDependency[] {
  const body = blockBody(src, "dependencies");
  if (!body) return [];
  const out: GradleDependency[] = [];
  // configurations we recognize; add more as needed.
  const configs =
    "implementation|api|testImplementation|testRuntimeOnly|runtimeOnly|compileOnly|" +
    "testCompileOnly|annotationProcessor|testAnnotationProcessor|developmentOnly|" +
    "kapt|ksp";
  const re = new RegExp(
    `\\b(${configs})\\s*\\(?\\s*["']([^"':]+):([^"':]+)(?::([^"']+))?["']\\s*\\)?`,
    "g",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const dep: GradleDependency = {
      configuration: m[1],
      group: m[2],
      name: m[3],
    };
    if (m[4]) dep.version = m[4];
    out.push(dep);
  }
  return out;
}

/**
 * `java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }`
 * is the modern way to declare the project's Java version. Also accept
 * the legacy `sourceCompatibility = JavaVersion.VERSION_17` and the
 * `maven.compiler.release`-style properties.
 */
function extractJavaVersion(src: string): string | undefined {
  const javaBlock = blockBody(src, "java");
  if (javaBlock) {
    const m = /JavaLanguageVersion\.of\(\s*(\d+)\s*\)/.exec(javaBlock);
    if (m) return m[1];
  }
  const top = /JavaLanguageVersion\.of\(\s*(\d+)\s*\)/.exec(src);
  if (top) return top[1];
  const src2 =
    /(?:sourceCompatibility|targetCompatibility)\s*=?\s*(?:JavaVersion\.VERSION_)?["']?(\d+)/.exec(
      src,
    );
  if (src2) return src2[1];
  return undefined;
}

/**
 * Kotlin version is typically declared either as the `kotlin("jvm")
 * version "1.9.22"` plugin OR as `kotlinVersion = "1.9.22"` in
 * gradle.properties. We read the plugin here; properties are out of
 * scope for this parser.
 */
function extractKotlinVersion(plugins: GradlePlugin[]): string | undefined {
  for (const p of plugins) {
    if (p.id.startsWith("org.jetbrains.kotlin.") && p.version) return p.version;
    if (p.id === "kotlin" && p.version) return p.version;
  }
  return undefined;
}

/**
 * Parse `include ':svc-a', ':svc-b'` / `include("svc-a", "svc-b")`
 * from a settings.gradle(.kts) file. Accepts either argument style.
 */
export function parseSettingsGradle(src: string): string[] {
  const clean = stripComments(src);
  const out = new Set<string>();
  const re = /\binclude\b\s*\(?\s*([^)\n]+)\)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    const args = m[1];
    const strRe = /["']([^"']+)["']/g;
    let s: RegExpExecArray | null;
    while ((s = strRe.exec(args)) !== null) {
      out.add(s[1].replace(/^:+/, ""));
    }
  }
  return Array.from(out);
}

// --- Public API ------------------------------------------------------------

/**
 * Parse a build.gradle or build.gradle.kts string. `isKotlinDsl` may
 * be passed by the caller or auto-sniffed.
 */
export function parseGradle(
  content: string,
  isKotlinDsl?: boolean,
): ParsedGradle {
  const clean = stripComments(content);
  const kotlin = isKotlinDsl ?? isKotlinDslContent(content);
  const structuredPlugins = extractPlugins(clean);
  const deps = extractDependencies(clean);
  const javaVersion = extractJavaVersion(clean);
  const kotlinVersion = extractKotlinVersion(structuredPlugins);
  const group = extractField(clean, "group");
  const version = extractField(clean, "version");
  return {
    group,
    version,
    dependencies: deps,
    plugins: structuredPlugins.map((p) => p.id),
    subprojects: [],
    javaVersion,
    kotlinVersion,
    isKotlinDsl: kotlin,
  };
}

/**
 * Return the structured (id + version) plugins list. Used by the
 * route layer to detect Spring Boot version, Detekt, SpotBugs, etc.
 */
export function parseGradlePlugins(content: string): GradlePlugin[] {
  return extractPlugins(stripComments(content));
}
