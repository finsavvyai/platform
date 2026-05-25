/**
 * API Documentation Page - Playground Tab
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import { CopyButton } from '@/components/ui/CopyButton';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PlayCircle, AlertTriangle } from 'lucide-react';
import type { EndpointInfo, PlaygroundState } from './types';

interface PlaygroundTabProps {
  playground: PlaygroundState;
  setPlayground: React.Dispatch<React.SetStateAction<PlaygroundState>>;
  onSendRequest: () => Promise<void>;
  availableEndpoints: EndpointInfo[];
}

export function PlaygroundTab({
  playground,
  setPlayground,
  onSendRequest,
  availableEndpoints,
}: PlaygroundTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>API Playground</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Label>Endpoint</Label>
            <Select
              value={playground.endpoint}
              onValueChange={(value: string) => {
                const selected = availableEndpoints.find(
                  (ep) => ep.path === value
                );
                if (selected) {
                  setPlayground((prev) => ({
                    ...prev,
                    endpoint: selected.path,
                    method: selected.method,
                    requestBody: JSON.stringify(
                      selected.examples[0]?.request || {},
                      null,
                      2
                    ),
                  }));
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an endpoint" />
              </SelectTrigger>
              <SelectContent>
                {availableEndpoints.map((endpoint) => (
                  <SelectItem
                    key={endpoint.path}
                    value={endpoint.path}
                  >
                    {endpoint.method} {endpoint.path}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <Label>Method</Label>
            <Select
              value={playground.method}
              onValueChange={(value: string) =>
                setPlayground((prev) => ({
                  ...prev,
                  method: value,
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <Label htmlFor="headers">Headers (JSON)</Label>
            <Textarea
              id="headers"
              placeholder='{"Content-Type": "application/json"}'
              value={playground.headers}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setPlayground((prev) => ({
                  ...prev,
                  headers: e.target.value,
                }))
              }
              className="min-h-24"
            />
          </div>
        </div>

        <div className="space-y-4">
          <Label htmlFor="request-body">Request Body (JSON)</Label>
          <Textarea
            id="request-body"
            placeholder='{"query": "Your question here..."}'
            value={playground.requestBody}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setPlayground((prev) => ({
                ...prev,
                requestBody: e.target.value,
              }))
            }
            className="min-h-32"
          />
        </div>

        <div className="flex items-center space-x-4">
          <Button
            onClick={onSendRequest}
            disabled={!playground.endpoint || playground.loading}
            className="flex-1"
          >
            {playground.loading ? (
              <>
                <LoadingSpinner className="mr-2" />
                Sending...
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 h-4 w-4" />
                Send Request
              </>
            )}
          </Button>

          {playground.response && (
            <Button
              variant="outline"
              onClick={() =>
                setPlayground((prev) => ({ ...prev, response: '' }))
              }
            >
              Clear
            </Button>
          )}
        </div>

        {playground.error && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{playground.error}</AlertDescription>
          </Alert>
        )}

        {playground.response && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Response:</Label>
              <CopyButton
                value={playground.response}
                className="h-6 w-6"
              />
            </div>
            <CodeBlock language="json" code={playground.response} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
