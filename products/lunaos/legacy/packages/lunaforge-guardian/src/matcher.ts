export function matchPattern(pattern: string, path: string): boolean {
  if (pattern === "**") return true;
  if (pattern.endsWith("/**")) {
    const prefix = pattern.slice(0, -3);
    return path === prefix || path.startsWith(prefix + "/");
  }
  return path === pattern;
}
