// Sortable hotspot table for the Risk tab on AnalyticsPage.
// Heatmap: warm colors for risky (BF<=1), cool amber for 2, muted for healthy.

import { useMemo, useState } from "react";
import BusFactorBadge from "./BusFactorBadge";

export interface HotspotRow {
  path: string;
  bus_factor: number;
  total: number;
  top_author_hash: string;
  last_touched: string;
}

interface Props {
  rows: HotspotRow[];
  loading?: boolean;
}

type SortKey = "total" | "bus_factor" | "path";

function heatCellClass(bf: number, touches: number): string {
  if (bf <= 1 && touches > 20) return "bg-red-500/5";
  if (bf <= 1 && touches > 10) return "bg-orange-500/5";
  if (bf <= 1) return "bg-amber-500/5";
  return "";
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function sortRows(rows: HotspotRow[], key: SortKey, desc: boolean): HotspotRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (key === "path") return desc ? b.path.localeCompare(a.path) : a.path.localeCompare(b.path);
    const av = key === "total" ? a.total : a.bus_factor;
    const bv = key === "total" ? b.total : b.bus_factor;
    return desc ? bv - av : av - bv;
  });
  return copy;
}

export default function HotspotTable({ rows, loading = false }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [desc, setDesc] = useState<boolean>(true);

  const sorted = useMemo(() => sortRows(rows, sortKey, desc), [rows, sortKey, desc]);

  function toggle(k: SortKey) {
    if (k === sortKey) setDesc(!desc);
    else { setSortKey(k); setDesc(true); }
  }

  if (loading) {
    return <div className="rounded-2xl border border-surface-border p-6 text-zinc-500">Loading hotspots...</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-border p-6 text-zinc-400">
        No risky hotspots detected. Run <code className="text-emerald-300">pushci intel hotspots</code> and upload to see data here.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
      <table className="w-full text-sm">
        <thead className="border-b border-surface-border text-left text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="cursor-pointer px-4 py-3 font-medium" onClick={() => toggle("path")}>File</th>
            <th className="cursor-pointer px-4 py-3 font-medium" onClick={() => toggle("bus_factor")}>Bus Factor</th>
            <th className="cursor-pointer px-4 py-3 font-medium" onClick={() => toggle("total")}>Touches</th>
            <th className="px-4 py-3 font-medium">Top Author</th>
            <th className="px-4 py-3 font-medium">Last Touched</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.path} className={`border-b border-surface-border/50 ${heatCellClass(r.bus_factor, r.total)}`}>
              <td className="px-4 py-3 font-mono text-xs text-zinc-200">{r.path}</td>
              <td className="px-4 py-3"><BusFactorBadge busFactor={r.bus_factor} /></td>
              <td className="px-4 py-3 text-zinc-300">{r.total}x</td>
              <td className="px-4 py-3 font-mono text-xs text-zinc-500">{r.top_author_hash.slice(0, 8) || "—"}</td>
              <td className="px-4 py-3 text-zinc-500">{formatDate(r.last_touched)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
