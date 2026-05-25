import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Copy, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Connector, Job } from '../types/database';
import { generateWorkerCode } from '../lib/generator';

export function ConnectorDetail() {
  const { id } = useParams<{ id: string }>();
  const [connector, setConnector] = useState<Connector | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      loadConnector();
    }
  }, [id]);

  const loadConnector = async () => {
    try {
      const { data: connectorData, error: connectorError } = await supabase
        .from('connectors')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (connectorError) throw connectorError;
      setConnector(connectorData);

      if (connectorData) {
        const { data: jobData } = await supabase
          .from('jobs')
          .select('*')
          .eq('connector_id', connectorData.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setJob(jobData);
      }
    } catch (error) {
      console.error('Failed to load connector:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyManifest = () => {
    if (connector?.manifest_content) {
      navigator.clipboard.writeText(JSON.stringify(connector.manifest_content, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!connector || !connector.manifest_content) return;

    const manifest = JSON.stringify(connector.manifest_content, null, 2);
    const workerCode = generateWorkerCode(
      connector.manifest_content as any,
      connector.auth_mode
    );

    const files = {
      'manifest.json': manifest,
      'worker.ts': workerCode,
      'README.md': `# ${connector.name}\n\nGenerated MCP Connector\n\n## Usage\n\n1. Deploy worker.ts to your edge platform\n2. Configure environment variables for auth\n3. Use manifest.json with your MCP client\n`,
    };

    const zip = Object.entries(files)
      .map(([name, content]) => `File: ${name}\n${'='.repeat(50)}\n${content}\n\n`)
      .join('\n');

    const blob = new Blob([zip], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${connector.name}-bundle.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!connector) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connector not found</h2>
          <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const tools = (connector.manifest_content as any)?.tools || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{connector.name}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Version {connector.version}</span>
              <span>{connector.runtime}</span>
              <span>{connector.auth_mode}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopyManifest}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Manifest'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Bundle
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Status</div>
            <div className="flex items-center gap-2">
              {connector.status === 'active' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
              {connector.status === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
              {connector.status === 'draft' && <Clock className="w-5 h-5 text-yellow-600" />}
              <span className="font-semibold text-gray-900 capitalize">{connector.status}</span>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Tools</div>
            <div className="text-2xl font-bold text-gray-900">{tools.length}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Created</div>
            <div className="font-semibold text-gray-900">
              {new Date(connector.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {job && job.logs && job.logs.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Generation Logs</h3>
            <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm space-y-2 max-h-48 overflow-y-auto">
              {job.logs.map((log: any, idx: number) => (
                <div key={idx} className="flex gap-3">
                  <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className={log.level === 'error' ? 'text-red-400' : 'text-gray-300'}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Available Tools</h2>
        {tools.length === 0 ? (
          <p className="text-gray-600">No tools generated yet</p>
        ) : (
          <div className="space-y-4">
            {tools.map((tool: any, idx: number) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-1">{tool.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{tool.description}</p>
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-700 font-medium hover:text-gray-900">
                    View Schema
                  </summary>
                  <pre className="mt-2 bg-gray-50 p-3 rounded overflow-x-auto text-xs">
                    {JSON.stringify(tool.inputSchema, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
