// IP allowlist middleware — closes ENTERPRISE_CAPABILITIES.md §2.1
// "IP allowlist for admin API".
//
// Supports IPv4 CIDR + IPv6 CIDR. Match against the first entry of
// X-Forwarded-For (Cloudflare sets this to the client IP) falling back
// to the remote address. Deny-by-default when an allowlist is configured;
// no-op when the list is empty (feature off).

import type { Context, Next } from "hono";

export function parseCidrs(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ipMatchesCidr(ip: string, cidr: string): boolean {
  const [prefix, bitsRaw] = cidr.includes("/") ? cidr.split("/") : [cidr, ""];
  const bits = bitsRaw === "" ? (prefix.includes(":") ? 128 : 32) : Number(bitsRaw);
  if (Number.isNaN(bits)) return false;
  const ipBin = toBits(ip);
  const netBin = toBits(prefix);
  if (ipBin === null || netBin === null) return false;
  if (ipBin.length !== netBin.length) return false;
  return ipBin.slice(0, bits) === netBin.slice(0, bits);
}

function toBits(ip: string): string | null {
  if (ip.includes(":")) return ipv6Bits(ip);
  return ipv4Bits(ip);
}

function ipv4Bits(ip: string): string | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  return parts
    .map((p) => {
      const n = Number(p);
      if (Number.isNaN(n) || n < 0 || n > 255) return "";
      return n.toString(2).padStart(8, "0");
    })
    .join("");
}

function ipv6Bits(ip: string): string | null {
  const expanded = expandIpv6(ip);
  if (!expanded) return null;
  return expanded
    .split(":")
    .map((h) => parseInt(h, 16).toString(2).padStart(16, "0"))
    .join("");
}

function expandIpv6(ip: string): string | null {
  const [head, tail] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  if (left.length + right.length > 8) return null;
  if (ip.includes("::")) {
    const gap = 8 - left.length - right.length;
    const zeros = Array(gap).fill("0");
    return [...left, ...zeros, ...right].map((h) => h || "0").join(":");
  }
  return left.length === 8 ? left.join(":") : null;
}

export function ipAllowlist(cidrs: string[]) {
  return async (c: Context, next: Next) => {
    if (cidrs.length === 0) return next();
    const xff = c.req.header("x-forwarded-for");
    const ip = xff ? xff.split(",")[0].trim() : c.req.header("cf-connecting-ip") ?? "";
    if (!ip) return c.json({ error: "ip_required" }, 403);
    const allowed = cidrs.some((cidr) => ipMatchesCidr(ip, cidr));
    if (!allowed) return c.json({ error: "ip_denied", ip }, 403);
    return next();
  };
}
