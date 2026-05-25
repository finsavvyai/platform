// @ts-nocheck
/**
 * Validation panel showing errors, warnings, and suggestions
 */

'use client';

import React from 'react';
import * as monaco from 'monaco-editor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';

import { ValidationError, ValidationWarning, ValidationSuggestion } from '@/types/policy-management';

interface ValidationPanelProps {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  editorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>;
  monacoRef: React.RefObject<typeof monaco | null>;
}

export function ValidationPanel({
  errors,
  warnings,
  suggestions,
  editorRef,
  monacoRef
}: ValidationPanelProps) {
  return (
    <div className="w-80 border-l bg-gray-50 overflow-y-auto">
      <Tabs defaultValue="errors" className="h-full">
        <TabsList className="grid w-full grid-cols-3 m-2">
          <TabsTrigger value="errors" className="text-xs">
            <XCircle className="h-3 w-3 mr-1" />Errors ({errors.length})
          </TabsTrigger>
          <TabsTrigger value="warnings" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />Warnings ({warnings.length})
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="text-xs">
            <Lightbulb className="h-3 w-3 mr-1" />Tips ({suggestions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="errors" className="p-2">
          <ScrollArea className="h-[calc(100%-40px)]">
            {errors.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm">No errors found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {errors.map((error, index) => (
                  <Card key={index} className="border-red-200 bg-red-50">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-800">{error.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-red-600">Line {error.line}, Column {error.column}</span>
                            <Badge variant="outline" className="text-xs border-red-300 text-red-700">{error.type}</Badge>
                          </div>
                          {error.fix && <p className="text-xs text-red-600 mt-1">Fix: {error.fix}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="warnings" className="p-2">
          <ScrollArea className="h-[calc(100%-40px)]">
            {warnings.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm">No warnings</p>
              </div>
            ) : (
              <div className="space-y-2">
                {warnings.map((warning, index) => (
                  <Card key={index} className="border-yellow-200 bg-yellow-50">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-800">{warning.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-yellow-600">Line {warning.line}, Column {warning.column}</span>
                            <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700">{warning.type}</Badge>
                          </div>
                          {warning.suggestion && <p className="text-xs text-yellow-600 mt-1">Suggestion: {warning.suggestion}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="suggestions" className="p-2">
          <ScrollArea className="h-[calc(100%-40px)]">
            {suggestions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Lightbulb className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No suggestions available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {suggestions.map((suggestion, index) => (
                  <Card key={index} className="border-blue-200 bg-blue-50">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-800">{suggestion.message}</p>
                          <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 mt-1">{suggestion.type}</Badge>
                          <p className="text-xs text-blue-600 mt-2">{suggestion.description}</p>
                          <Button
                            size="sm" variant="outline" className="mt-2 text-xs"
                            onClick={() => {
                              if (editorRef.current) {
                                const model = editorRef.current.getModel();
                                const position = editorRef.current.getPosition();
                                if (model && position) {
                                  model.pushEditOperations([], [{
                                    range: new monacoRef.current!.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                    text: suggestion.code
                                  }], () => null);
                                }
                              }
                            }}
                          >
                            Apply Suggestion
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
