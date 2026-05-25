'use client';

import { Box, ShieldAlert, Play, Bug } from 'lucide-react';
import type { ContainerImage, RuntimeContainer } from './types';

interface Props {
  images: ContainerImage[];
  containers: RuntimeContainer[];
}

export function ContainerStats({ images, containers }: Props): React.ReactElement {
  const totalImages = images.length;
  const vulnerableImages = images.filter(
    (i) => i.vulns.Critical > 0 || i.vulns.High > 0
  ).length;
  const runningContainers = containers.filter(
    (c) => c.status === 'Running'
  ).length;
  const criticalCves = images.reduce((sum, i) => sum + i.vulns.Critical, 0);

  const cards = [
    {
      label: 'Total Images',
      value: totalImages,
      icon: Box,
      color: 'text-info',
      subtitle: 'across all registries',
    },
    {
      label: 'Vulnerable Images',
      value: vulnerableImages,
      icon: ShieldAlert,
      color: 'text-amber-400',
      subtitle: 'with critical or high CVEs',
    },
    {
      label: 'Running Containers',
      value: runningContainers,
      icon: Play,
      color: 'text-green-400',
      subtitle: `of ${containers.length} total`,
    },
    {
      label: 'Critical CVEs',
      value: criticalCves,
      icon: Bug,
      color: 'text-red-400',
      subtitle: 'require immediate attention',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400">{c.label}</p>
            <c.icon className={`h-5 w-5 ${c.color}`} />
          </div>
          <p className={`mt-2 text-3xl font-bold ${c.color}`}>{c.value}</p>
          <p className="mt-1 text-xs text-neutral-500">{c.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
