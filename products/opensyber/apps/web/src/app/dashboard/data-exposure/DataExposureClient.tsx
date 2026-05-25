'use client';

import { useState } from 'react';
import { Eye } from 'lucide-react';
import type { ExposureStats, DataClassification, ServiceExposure, ExposureEvent } from './types';
import { ExposureStatsRow } from './ExposureStatsRow';
import { ClassificationGrid } from './ClassificationGrid';
import { ServiceBarChart } from './ServiceBarChart';
import { ExposureEventsTable } from './ExposureEventsTable';

export function DataExposureClient(): React.ReactElement {
  const [events, setEvents] = useState<ExposureEvent[]>([]);

  const stats: ExposureStats = {
    anonymousLinks: 0,
    avgOrgLinks: 0,
    externalShares: 0,
    piiRecords: 0,
    unencryptedFiles: 0,
  };
  const classifications: DataClassification[] = [];
  const services: ServiceExposure[] = [];

  function handleFix(id: string): void {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function handleIgnore(id: string): void {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function handleCreateIncident(id: string): void {
    const event = events.find((e) => e.id === id);
    if (event) {
      alert(`Incident created for: ${event.dataType} at ${event.location}`);
    }
  }

  function handleRemediate(id: string): void {
    alert(`Remediation started for classification ${id}`);
  }

  const isEmpty = events.length === 0 && classifications.length === 0 && services.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Eye className="h-8 w-8 text-info" />
          Data Exposure
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Discovers and classifies sensitive data across your SaaS
          applications, cloud storage, and internal services. Identifies
          anonymous links, external shares, and unencrypted records
          before they become breaches.
        </p>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <Eye className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Data Exposure Data Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start seeing data exposure findings. Data will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <ExposureStatsRow stats={stats} />
          <ClassificationGrid
            classifications={classifications}
            onRemediate={handleRemediate}
          />
          <ServiceBarChart services={services} />
          <ExposureEventsTable
            events={events}
            onFix={handleFix}
            onIgnore={handleIgnore}
            onCreateIncident={handleCreateIncident}
          />
        </>
      )}
    </div>
  );
}
