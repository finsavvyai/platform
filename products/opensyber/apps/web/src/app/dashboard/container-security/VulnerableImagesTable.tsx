'use client';

import type { ContainerImage, Severity } from './types';
import { SEVERITY_COLORS } from './types';

interface Props {
  images: ContainerImage[];
  severityFilter: Severity | 'All';
}

export function VulnerableImagesTable({
  images,
  severityFilter,
}: Props): React.ReactElement {
  const sorted = [...images].sort(
    (a, b) => b.vulns.Critical - a.vulns.Critical
  );

  const filtered =
    severityFilter === 'All'
      ? sorted
      : sorted.filter((img) => img.vulns[severityFilter] > 0);

  const totalVulns = (img: ContainerImage): number =>
    img.vulns.Critical + img.vulns.High + img.vulns.Medium + img.vulns.Low;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30">
      <div className="px-6 py-4 border-b border-neutral-800">
        <h2 className="text-lg font-semibold">Top Vulnerable Images</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-400">
              <th className="px-6 py-3 font-medium">Image</th>
              <th className="px-6 py-3 font-medium">Tag</th>
              <th className="px-6 py-3 font-medium">Total CVEs</th>
              <th className="px-6 py-3 font-medium">Critical</th>
              <th className="px-6 py-3 font-medium">High</th>
              <th className="px-6 py-3 font-medium">Base Image</th>
              <th className="px-6 py-3 font-medium">Size</th>
              <th className="px-6 py-3 font-medium">Last Scan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {filtered.map((img) => (
              <tr
                key={img.id}
                className="hover:bg-neutral-800/30 transition"
              >
                <td className="px-6 py-3 font-medium">{img.name}</td>
                <td className="px-6 py-3 text-neutral-400">{img.tag}</td>
                <td className="px-6 py-3">{totalVulns(img)}</td>
                <td className="px-6 py-3">
                  {img.vulns.Critical > 0 ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS.Critical}`}>
                      {img.vulns.Critical}
                    </span>
                  ) : (
                    <span className="text-neutral-500">0</span>
                  )}
                </td>
                <td className="px-6 py-3">
                  {img.vulns.High > 0 ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS.High}`}>
                      {img.vulns.High}
                    </span>
                  ) : (
                    <span className="text-neutral-500">0</span>
                  )}
                </td>
                <td className="px-6 py-3 text-neutral-400">
                  {img.baseImage}
                </td>
                <td className="px-6 py-3 text-neutral-400">
                  {img.sizeMB} MB
                </td>
                <td className="px-6 py-3 text-neutral-400">
                  {new Date(img.lastScanned).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
