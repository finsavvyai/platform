/**
 * API Documentation Page - Main Component
 * Interactive API documentation with live playground
 */

import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Label } from '@/components/ui/Label';
import { CheckCircle } from 'lucide-react';
import { useAPI } from '@/hooks/use-api';
import type { PlaygroundState, TabValue } from './types';
import {
  overviewEndpoints,
  ragEndpoints,
  documentsEndpoints,
  paymentsEndpoints,
} from './endpoint-data';
import { EndpointCard } from './EndpointCard';
import { PlaygroundTab } from './PlaygroundTab';

export default function APIDocsPage() {
  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('');
  const [playground, setPlayground] = useState<PlaygroundState>({
    endpoint: '',
    method: 'GET',
    requestBody: '',
    headers: '{}',
    response: '',
    loading: false,
    error: null,
  });

  const api = useAPI();

  const allPlaygroundEndpoints = useMemo(
    () => [...ragEndpoints, ...documentsEndpoints, ...paymentsEndpoints],
    []
  );

  const handleEndpointPlayground = async () => {
    if (!playground.endpoint) return;

    setPlayground((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const headers = JSON.parse(playground.headers || '{}');
      const body = playground.requestBody
        ? JSON.parse(playground.requestBody)
        : {};

      const response = await api.request(
        playground.method,
        playground.endpoint,
        { headers, body }
      );

      setPlayground((prev) => ({
        ...prev,
        response: JSON.stringify(response, null, 2),
        loading: false,
        error: null,
      }));
    } catch (error) {
      setPlayground((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Request failed',
        response: '',
      }));
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">API Documentation</h1>
        <p className="text-lg text-gray-600 mb-4">
          Interactive API documentation with live playground for testing
          endpoints
        </p>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            All endpoints require authentication. Use the Developer CLI to
            configure your API key.
          </AlertDescription>
        </Alert>
      </div>

      <div className="flex items-center space-x-4 mb-6">
        <div className="flex-1">
          <Label htmlFor="endpoint-search" className="text-sm font-medium">
            Search Endpoints
          </Label>
          <Input
            id="endpoint-search"
            placeholder="Search by path or method..."
            value={selectedEndpoint}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSelectedEndpoint(e.target.value)
            }
            className="w-full"
          />
        </div>
        <Button
          variant="outline"
          onClick={() =>
            (window.location.href = '/docs/api/openapi.json')
          }
        >
          Download OpenAPI Spec
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value: string) => setActiveTab(value as TabValue)}
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rag">RAG</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="playground">Playground</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {overviewEndpoints.map((ep) => (
              <EndpointCard key={ep.path} endpoint={ep} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rag">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ragEndpoints.map((ep) => (
              <EndpointCard key={ep.path} endpoint={ep} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {documentsEndpoints.map((ep) => (
              <EndpointCard key={ep.path} endpoint={ep} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paymentsEndpoints.map((ep) => (
              <EndpointCard key={ep.path} endpoint={ep} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="playground">
          <PlaygroundTab
            playground={playground}
            setPlayground={setPlayground}
            onSendRequest={handleEndpointPlayground}
            availableEndpoints={allPlaygroundEndpoints}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
