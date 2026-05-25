'use client';

import { RefreshCw, Eye } from 'lucide-react';
import type { ContainerImage } from './types';
import { REGISTRY_COLORS, SEVERITY_COLORS } from './types';
import type { Severity } from './types';

interface Props {
  images: ContainerImage[];
  registryFilter: string;
  searchQuery: string;
  onScan: (id: string) => void;
  onViewCves: (id: string) => void;
}

const SEVERITY_ORDER: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

export function ImageRegistryGrid({
  images,
  registryFilter,
  searchQuery,
  onScan,
  onViewCves,
}: Props): React.ReactElement {
  const filtered = images.filter((img) => {
    const matchesRegistry =
      registryFilter === 'All' || img.registry === registryFilter;
    const matchesSearch =
      !searchQuery ||
      `${img.name}:${img.tag}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesRegistry && matchesSearch;
  });

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Image Registry</h2>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-12 text-center">
          <p className="text-neutral-400">No images match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((img) => (
            <div
              key={img.id}
              className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">
                    {img.name}
                    <span className="text-neutral-400">:{img.tag}</span>
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {img.sizeMB} MB
                  </p>
                </div>
                <span
                  className={`rounded-md border px-2 py-0.5 text-xs font-medium ${REGISTRY_COLORS[img.registry]}`}
                >
                  {img.registry}
                </span>
              </div>

              <div className="flex gap-2 flex-wrap">
                {SEVERITY_ORDER.map((sev) =>
                  img.vulns[sev] > 0 ? (
                    <span
                      key={sev}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[sev]}`}
                    >
                      {img.vulns[sev]} {sev}
                    </span>
                  ) : null
                )}
              </div>

              <p className="text-xs text-neutral-500">
                Scanned{' '}
                {new Date(img.lastScanned).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onScan(img.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Scan Now
                </button>
                <button
                  onClick={() => onViewCves(img.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-info/30 px-3 py-1.5 text-xs text-info hover:bg-info/10 transition"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View CVEs
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
