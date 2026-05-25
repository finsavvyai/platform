import type { ToxicCombination, Severity, RiskNode } from './types';

interface ApiNode {
  id?: string;
  label?: string;
  severity?: string;
  category?: string;
}

interface ApiAttackPath {
  id?: string;
  title?: string;
  severity?: string;
  nodes?: ApiNode[];
  blastRadius?: { assets?: number; dataStores?: number };
  detectedAt?: string;
  assetType?: string;
}

function mapSeverity(s?: string): Severity {
  const v = (s ?? '').toLowerCase();
  if (v === 'critical') return 'critical';
  if (v === 'high') return 'high';
  return 'medium';
}

function mapNode(n: ApiNode): RiskNode {
  return {
    id: n?.id ?? crypto.randomUUID(),
    label: n?.label ?? 'Unknown risk',
    severity: mapSeverity(n?.severity),
    category: n?.category ?? 'unknown',
  };
}

function pathToCombination(p: ApiAttackPath, idx: number): ToxicCombination {
  const nodes = Array.isArray(p.nodes) ? p.nodes.map(mapNode) : [];
  return {
    id: p.id ?? `api-tc-${idx}`,
    title: p.title ?? `Attack Path ${idx + 1}`,
    severity: mapSeverity(p.severity),
    blastRadius: {
      assets: p.blastRadius?.assets ?? nodes.length,
      dataStores: p.blastRadius?.dataStores ?? 0,
    },
    chain: nodes,
    detectedAt: p.detectedAt ?? new Date().toISOString(),
    assetType: p.assetType ?? 'cloud',
  };
}

export async function fetchToxicCombinations(): Promise<ToxicCombination[] | null> {
  const res = await fetch('/api/proxy/attack-paths', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 50 }),
  });
  if (!res.ok) return null;
  const json = await res.json();

  const paths: ApiAttackPath[] = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.paths) ? json.paths : [];

  if (!paths.length) return null;
  return paths.map(pathToCombination);
}
