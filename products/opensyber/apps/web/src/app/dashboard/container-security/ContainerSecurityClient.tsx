'use client';

import { useState } from 'react';
import { Box, Search } from 'lucide-react';
import type { ContainerImage, RuntimeContainer, CveDataPoint, Severity, Registry } from './types';
import { ContainerStats } from './ContainerStats';
import { ImageRegistryGrid } from './ImageRegistryGrid';
import { CveTimeline } from './CveTimeline';
import { VulnerableImagesTable } from './VulnerableImagesTable';
import { RuntimeContainerList } from './RuntimeContainerList';

const REGISTRIES: Array<Registry | 'All'> = [
  'All',
  'Docker Hub',
  'ECR',
  'GCR',
  'ACR',
];

const SEVERITIES: Array<Severity | 'All'> = [
  'All',
  'Critical',
  'High',
  'Medium',
  'Low',
];

export function ContainerSecurityClient(): React.ReactElement {
  const [images, setImages] = useState<ContainerImage[]>([]);
  const [registryFilter, setRegistryFilter] = useState<Registry | 'All'>(
    'All'
  );
  const [severityFilter, setSeverityFilter] = useState<Severity | 'All'>(
    'All'
  );
  const [searchQuery, setSearchQuery] = useState('');

  const containers: RuntimeContainer[] = [];
  const cveTimeline: CveDataPoint[] = [];

  function handleScan(id: string): void {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id
          ? { ...img, lastScanned: new Date().toISOString() }
          : img
      )
    );
  }

  function handleViewCves(id: string): void {
    const img = images.find((i) => i.id === id);
    if (img) {
      const total =
        img.vulns.Critical + img.vulns.High + img.vulns.Medium + img.vulns.Low;
      alert(`${img.name}:${img.tag} has ${total} CVEs`);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Box className="h-8 w-8 text-info" />
          Container Security
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Scans container images for vulnerabilities and monitors runtime
          container health, resource usage, and risk posture across all
          registries.
        </p>
      </div>

      {images.length === 0 && containers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <Box className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Container Security Data Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start seeing container security data. Data will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <ContainerStats images={images} containers={containers} />

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-neutral-800 bg-neutral-900 pl-9 pr-4 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-signal focus:outline-none"
              />
            </div>
            <select
              value={registryFilter}
              onChange={(e) =>
                setRegistryFilter(e.target.value as Registry | 'All')
              }
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-signal focus:outline-none"
            >
              {REGISTRIES.map((r) => (
                <option key={r} value={r}>
                  {r === 'All' ? 'All Registries' : r}
                </option>
              ))}
            </select>
            <select
              value={severityFilter}
              onChange={(e) =>
                setSeverityFilter(e.target.value as Severity | 'All')
              }
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-signal focus:outline-none"
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s === 'All' ? 'All Severities' : s}
                </option>
              ))}
            </select>
          </div>

          <ImageRegistryGrid
            images={images}
            registryFilter={registryFilter}
            searchQuery={searchQuery}
            onScan={handleScan}
            onViewCves={handleViewCves}
          />

          <CveTimeline data={cveTimeline} />
          <VulnerableImagesTable
            images={images}
            severityFilter={severityFilter}
          />
          <RuntimeContainerList containers={containers} />
        </>
      )}
    </div>
  );
}
