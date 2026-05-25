import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowRight, Clock, CheckCircle2, XCircle, Plus, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Connector } from '../types/database';

export function Dashboard() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConnectors();
  }, []);

  const loadConnectors = async () => {
    try {
      const { data, error } = await supabase
        .from('connectors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnectors(data || []);
    } catch (error) {
      console.error('Failed to load connectors:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 font-light">Loading your connectors...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 mb-3 tracking-tight">
            Your Connectors
          </h1>
          <p className="text-lg text-gray-600 font-light">
            Manage and monitor your MCP integrations
          </p>
        </div>
        <Link
          to="/generate"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-2xl font-semibold shadow-elevated hover:shadow-floating transition-all duration-300 transform hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          New Connector
        </Link>
      </div>

      {connectors.length === 0 ? (
        <div className="glass rounded-3xl shadow-elevated p-16 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl flex items-center justify-center mx-auto mb-6 animate-float">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Start your journey
            </h3>
            <p className="text-gray-600 mb-8 font-light leading-relaxed">
              Generate your first MCP connector from any API specification
              and join developers building next-gen integrations
            </p>
            <Link
              to="/generate"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-4 rounded-2xl font-semibold shadow-elevated hover:shadow-floating transition-all duration-300 transform hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              Generate Your First Connector
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {connectors.map((connector) => (
            <Link
              key={connector.id}
              to={`/connector/${connector.id}`}
              className="glass rounded-3xl shadow-soft hover:shadow-elevated transition-all duration-300 group p-8"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      connector.status === 'active' ? 'bg-gradient-to-br from-green-500 to-emerald-500' :
                      connector.status === 'error' ? 'bg-gradient-to-br from-red-500 to-pink-500' :
                      'bg-gradient-to-br from-yellow-500 to-orange-500'
                    }`}>
                      {getStatusIcon(connector.status)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                        {connector.name}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span className="font-medium">v{connector.version}</span>
                        <span className="w-1 h-1 bg-gray-400 rounded-full" />
                        <span>{connector.runtime}</span>
                        <span className="w-1 h-1 bg-gray-400 rounded-full" />
                        <span>{connector.auth_mode}</span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(connector.status)}`}>
                      {connector.status}
                    </span>
                  </div>
                  {connector.manifest_content && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Sparkles className="w-4 h-4" />
                      <span className="font-medium">
                        {(connector.manifest_content as any).tools?.length || 0} tools generated
                      </span>
                    </div>
                  )}
                </div>
                <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
