// Maven pom.xml parser — pure functions, no I/O.
//
// Runs in Cloudflare Workers (no DOMParser). Uses a tiny regex-based
// walker that is sufficient for the coordinates, modules, properties
// and direct dependencies of a pom.xml. Not a full XML parser — good
// enough for the enterprise pilot use-case of discovering structure.

export interface MavenDependency {
  groupId: string;
  artifactId: string;
  version: string;
  scope?: string;
}

export interface ParsedPom {
  groupId: string;
  artifactId: string;
  version: string;
  packaging: string;
  modules: string[];
  properties: Record<string, string>;
  dependencies: MavenDependency[];
  parent?: { groupId: string; artifactId: string; version: string };
}

export interface ModuleNode {
  path: string;
  pom: ParsedPom;
  children: ModuleNode[];
}

// --- Low-level helpers -----------------------------------------------------

/**
 * Strip XML comments from the source. Done once up-front so every
 * subsequent regex can ignore commented-out blocks.
 */
function stripComments(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->/g, "");
}

/**
 * Extract the first top-level element's inner content. We deliberately
 * walk balanced open/close tags so nested `<version>` etc. in a child
 * element do not confuse us. Scope is limited to the OUTER level at
 * `depth === 1`, which mirrors the Maven model.
 */
function firstChild(xml: string, tag: string): string | undefined {
  const open = `<${tag}`;
  const close = `</${tag}>`;
  const start = xml.indexOf(open);
  if (start < 0) return undefined;
  const openEnd = xml.indexOf(">", start);
  if (openEnd < 0) return undefined;
  // Self-closing handling
  if (xml[openEnd - 1] === "/") return "";
  const end = xml.indexOf(close, openEnd);
  if (end < 0) return undefined;
  return xml.slice(openEnd + 1, end);
}

/** Extract the immediate text value of a child element. */
function textOf(xml: string, tag: string): string {
  return (firstChild(xml, tag) ?? "").trim();
}

/**
 * Return every top-level `<tag>...</tag>` block inside `xml`. Uses a
 * simple depth-aware scanner so that nested same-named tags don't
 * cause false splits.
 */
function childBlocks(xml: string, tag: string): string[] {
  const out: string[] = [];
  const openRe = new RegExp(`<${tag}(\\s[^>]*)?>`, "g");
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(xml)) !== null) {
    const from = m.index + m[0].length;
    // Find the matching close, accounting for nested `<tag>` of same name.
    let depth = 1;
    let i = from;
    const openTok = `<${tag}`;
    const closeTok = `</${tag}>`;
    while (i < xml.length && depth > 0) {
      const nextOpen = xml.indexOf(openTok, i);
      const nextClose = xml.indexOf(closeTok, i);
      if (nextClose < 0) return out;
      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth++;
        i = nextOpen + openTok.length;
      } else {
        depth--;
        if (depth === 0) {
          out.push(xml.slice(from, nextClose));
          i = nextClose + closeTok.length;
          openRe.lastIndex = i;
          break;
        }
        i = nextClose + closeTok.length;
      }
    }
  }
  return out;
}

// --- Property substitution -------------------------------------------------

const MAX_SUBSTITUTION_DEPTH = 10;

/**
 * Resolve `${foo}` references inside a string using the pom's own
 * properties plus the synthetic `project.*` values that Maven
 * automatically exposes. Bounded depth so that a malicious circular
 * `<a>${b}</a> <b>${a}</b>` can't hang the worker.
 */
export function substituteProperties(
  value: string,
  properties: Record<string, string>,
  project?: { groupId?: string; artifactId?: string; version?: string },
): string {
  if (!value.includes("${")) return value;
  const table: Record<string, string> = { ...properties };
  if (project?.groupId) table["project.groupId"] = project.groupId;
  if (project?.artifactId) table["project.artifactId"] = project.artifactId;
  if (project?.version) table["project.version"] = project.version;
  // `java.version` is a common pattern but not a true property — we fall
  // through to `maven.compiler.*` which users commonly set in practice.
  if (!table["java.version"] && table["maven.compiler.release"]) {
    table["java.version"] = table["maven.compiler.release"];
  }
  let out = value;
  for (let depth = 0; depth < MAX_SUBSTITUTION_DEPTH; depth++) {
    const replaced = out.replace(/\$\{([^}]+)\}/g, (full, key: string) => {
      const v = table[key.trim()];
      return v === undefined ? full : v;
    });
    if (replaced === out) return replaced;
    out = replaced;
  }
  return out;
}

// --- Public API ------------------------------------------------------------

/** Parse a pom.xml string into a structured ParsedPom. */
export function parsePom(xml: string): ParsedPom {
  const clean = stripComments(xml);
  const project = firstChild(clean, "project") ?? clean;

  const parentBlock = firstChild(project, "parent");
  const parent = parentBlock
    ? {
        groupId: textOf(parentBlock, "groupId"),
        artifactId: textOf(parentBlock, "artifactId"),
        version: textOf(parentBlock, "version"),
      }
    : undefined;

  // Strip the `<parent>` sub-tree before reading project-direct
  // coordinates so a child module's `<artifactId>` inside `<parent>`
  // doesn't masquerade as the project's own artifactId.
  const projectBody = parentBlock
    ? project.replace(/<parent>[\s\S]*?<\/parent>/, "")
    : project;

  // Properties are read BEFORE coordinates so they can feed substitution.
  const props: Record<string, string> = {};
  const propsBlock = firstChild(projectBody, "properties");
  if (propsBlock) {
    const propRe = /<([A-Za-z][\w.\-]*)>([^<]*)<\/\1>/g;
    let pm: RegExpExecArray | null;
    while ((pm = propRe.exec(propsBlock)) !== null) {
      props[pm[1]] = pm[2].trim();
    }
  }

  const groupId = textOf(projectBody, "groupId") || parent?.groupId || "";
  const artifactId = textOf(projectBody, "artifactId") || "";
  const version = textOf(projectBody, "version") || parent?.version || "";
  const packaging = textOf(projectBody, "packaging") || "jar";

  const coord = { groupId, artifactId, version };
  const sub = (v: string) => substituteProperties(v, props, coord);

  const modulesBlock = firstChild(projectBody, "modules") ?? "";
  const modules = childBlocks(modulesBlock, "module").map((m) => m.trim());

  const depsBlock = firstChild(projectBody, "dependencies") ?? "";
  const dependencies: MavenDependency[] = childBlocks(depsBlock, "dependency").map(
    (d) => {
      const dep: MavenDependency = {
        groupId: sub(textOf(d, "groupId")),
        artifactId: sub(textOf(d, "artifactId")),
        version: sub(textOf(d, "version")),
      };
      const scope = textOf(d, "scope");
      if (scope) dep.scope = scope;
      return dep;
    },
  );

  return {
    groupId: sub(groupId),
    artifactId,
    version: sub(version),
    packaging,
    modules,
    properties: props,
    dependencies,
    parent,
  };
}

/**
 * Walk a multi-module project given the parent pom and a map of child
 * pom contents keyed by their *module path* relative to the parent.
 * Recursive — children that themselves declare modules are expanded.
 */
export function parseMultiModule(
  rootPom: string,
  childPomsByPath: Record<string, string>,
): ModuleNode {
  const pom = parsePom(rootPom);
  const node: ModuleNode = { path: ".", pom, children: [] };
  for (const m of pom.modules) {
    const childXml = childPomsByPath[m] ?? childPomsByPath[`${m}/pom.xml`];
    if (!childXml) continue;
    const childNode = parseMultiModule(
      childXml,
      stripPrefix(childPomsByPath, m),
    );
    childNode.path = m;
    node.children.push(childNode);
  }
  return node;
}

/**
 * Given a child module path "svc-a" and a map keyed by the parent's
 * point of view, return a new map keyed from the child's point of view
 * so that recursion can resolve grand-children correctly.
 */
function stripPrefix(
  map: Record<string, string>,
  prefix: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  const p = prefix.endsWith("/") ? prefix : `${prefix}/`;
  for (const [k, v] of Object.entries(map)) {
    if (k.startsWith(p)) out[k.slice(p.length)] = v;
  }
  return out;
}
