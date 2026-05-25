import { useEffect, useState } from 'react';
import ArtifactReport from '../components/ArtifactReport';
import type { SizeChange } from '../components/ArtifactReport';
import EmptyArtifactsState from '../components/EmptyArtifactsState';
import PageHeader from '../components/PageHeader';
import { api } from '../hooks/useApi';

interface ArtifactRecord {
  name: string;
  size_bytes: number;
  version: string;
  created_at: string;
  project_id: string;
}

function computeSizeChanges(artifacts: ArtifactRecord[]): SizeChange[] {
  const byName = new Map<string, ArtifactRecord[]>();
  for (const a of artifacts) {
    const key = `${a.project_id}/${a.name}`;
    const list = byName.get(key) || [];
    list.push(a);
    byName.set(key, list);
  }

  const changes: SizeChange[] = [];
  for (const [key, records] of byName) {
    if (records.length < 2) {
      changes.push({
        name: key.split('/').pop() || key,
        oldSize: 0,
        newSize: records[0].size_bytes,
        diffBytes: records[0].size_bytes,
        diffPercent: 0,
      });
      continue;
    }
    const newest = records[0];
    const previous = records[1];
    const diff = newest.size_bytes - previous.size_bytes;
    const pct = previous.size_bytes > 0
      ? (diff / previous.size_bytes) * 100 : 0;
    changes.push({
      name: key.split('/').pop() || key,
      oldSize: previous.size_bytes,
      newSize: newest.size_bytes,
      diffBytes: diff,
      diffPercent: Math.round(pct * 10) / 10,
    });
  }
  return changes.sort((a, b) => Math.abs(b.diffPercent) - Math.abs(a.diffPercent));
}

export default function ArtifactsPage() {
  const [changes, setChanges] = useState<SizeChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getArtifactSizes()
      .then((artifacts) => setChanges(computeSizeChanges(artifacts)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl">
      <PageHeader title="Artifacts" description="Track build artifact sizes across runs" />
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : changes.length > 0 ? (
        <ArtifactReport changes={changes} />
      ) : (
        <EmptyArtifactsState />
      )}
    </div>
  );
}
