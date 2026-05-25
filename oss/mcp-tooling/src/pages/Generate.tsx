import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Link as LinkIcon, Loader2 } from 'lucide-react';
import { GenerateRequest } from '../types/database';

export function Generate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');

  const [formData, setFormData] = useState({
    connectorName: '',
    targetRuntime: 'worker-ts' as const,
    authMode: 'none' as const,
    specUrl: '',
    file: null as File | null,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, file });
      if (!formData.connectorName) {
        const name = file.name.replace(/\.(json|yaml|yml)$/i, '');
        setFormData({ ...formData, file, connectorName: name });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let specContent = '';

      if (uploadMethod === 'file' && formData.file) {
        specContent = await formData.file.text();
      } else if (uploadMethod === 'url' && formData.specUrl) {
        const response = await fetch(formData.specUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch spec: ${response.status}`);
        }
        specContent = await response.text();
      } else {
        throw new Error('Please provide a spec file or URL');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-connector`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const body: GenerateRequest = {
        connectorName: formData.connectorName,
        targetRuntime: formData.targetRuntime,
        authMode: formData.authMode,
        specContent: uploadMethod === 'file' ? specContent : undefined,
        specUrl: uploadMethod === 'url' ? formData.specUrl : undefined,
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const result = await response.json();
      navigate(`/connector/${result.connectorId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Generate MCP Connector
        </h1>
        <p className="text-gray-600">
          Upload an OpenAPI spec to automatically generate an MCP connector
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Connector Name
          </label>
          <input
            type="text"
            value={formData.connectorName}
            onChange={(e) => setFormData({ ...formData, connectorName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            placeholder="my-api-connector"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-3">
            Upload Method
          </label>
          <div className="flex gap-4 mb-4">
            <button
              type="button"
              onClick={() => setUploadMethod('file')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                uploadMethod === 'file'
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Upload className="w-5 h-5" />
              <span className="font-medium">Upload File</span>
            </button>
            <button
              type="button"
              onClick={() => setUploadMethod('url')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                uploadMethod === 'url'
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <LinkIcon className="w-5 h-5" />
              <span className="font-medium">Spec URL</span>
            </button>
          </div>

          {uploadMethod === 'file' ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
              <input
                type="file"
                accept=".json,.yaml,.yml"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                required
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {formData.file ? formData.file.name : 'Click to upload'}
                </p>
                <p className="text-xs text-gray-500">
                  OpenAPI JSON or YAML (max 5MB)
                </p>
              </label>
            </div>
          ) : (
            <input
              type="url"
              value={formData.specUrl}
              onChange={(e) => setFormData({ ...formData, specUrl: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="https://api.example.com/openapi.json"
              required
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Target Runtime
            </label>
            <select
              value={formData.targetRuntime}
              onChange={(e) => setFormData({ ...formData, targetRuntime: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="worker-ts">TypeScript Worker</option>
              <option value="worker-go">Go Worker</option>
              <option value="download-only">Download Only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Auth Mode
            </label>
            <select
              value={formData.authMode}
              onChange={(e) => setFormData({ ...formData, authMode: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="auto">Auto-detect</option>
              <option value="api_key">API Key</option>
              <option value="oauth_client">OAuth2 Client</option>
              <option value="jwt">JWT/Bearer</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Connector'
          )}
        </button>
      </form>
    </div>
  );
}
