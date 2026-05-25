/**
 * API Documentation Page - Endpoint Card Renderer
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CodeBlock } from '@/components/ui/CodeBlock';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/Accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import { CopyButton } from '@/components/ui/CopyButton';
import { Info } from 'lucide-react';
import type { EndpointInfo } from './types';

interface EndpointCardProps {
  endpoint: EndpointInfo;
}

export function EndpointCard({ endpoint }: EndpointCardProps) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-mono">
            {endpoint.method} {endpoint.path}
          </CardTitle>
          <Badge variant="secondary">{endpoint.responses[0]?.code}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-2">
            {endpoint.description}
          </p>

          {endpoint.parameters.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Parameters:</h4>
              <div className="space-y-1">
                {endpoint.parameters.map((param, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-4 text-sm"
                  >
                    <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                      {param.type}
                    </code>
                    <div className="flex-1">
                      <Label
                        htmlFor={`param-${param.name}`}
                        className="text-xs font-medium"
                      >
                        {param.name}
                        {param.required && (
                          <span className="text-red-500">*</span>
                        )}
                      </Label>
                      <div className="text-xs text-gray-500">
                        {param.description}
                        {param.default != null && (
                          <span className="text-gray-400">
                            Default: {String(param.default)}
                          </span>
                        )}
                      </div>
                    </div>
                    {param.enum && (
                      <Select>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent>
                          {param.enum.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {endpoint.examples.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Examples:</h4>
            <Accordion type="single" className="w-full">
              {endpoint.examples.map((example, index) => (
                <AccordionItem key={index} value={`example-${index}`}>
                  <AccordionTrigger className="text-left text-sm">
                    <div className="flex items-center space-x-2">
                      <Info className="h-4 w-4" />
                      <span>{example.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {example.language}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        {example.description}
                      </p>

                      {example.request && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Request:
                            </span>
                            <CopyButton
                              value={JSON.stringify(
                                example.request,
                                null,
                                2
                              )}
                              className="h-6 w-6"
                            />
                          </div>
                          <CodeBlock
                            language={example.language}
                            code={JSON.stringify(example.request, null, 2)}
                          />
                        </div>
                      )}

                      {example.response && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Response:
                            </span>
                            <CopyButton
                              value={JSON.stringify(
                                example.response,
                                null,
                                2
                              )}
                              className="h-6 w-6"
                            />
                          </div>
                          <CodeBlock
                            language="json"
                            code={JSON.stringify(example.response, null, 2)}
                          />
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
