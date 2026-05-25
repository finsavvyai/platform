// @ts-nocheck
/**
 * Monaco editor providers for Rego language
 */

import * as monaco from 'monaco-editor';
import { securitySnippets } from './security-snippets';

export function registerCompletionProvider(monacoInstance: typeof monaco) {
  monacoInstance.languages.registerCompletionItemProvider('rego', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };
      const suggestions = [
        ...['package', 'import', 'default', 'allow', 'deny', 'with',
          'as', 'not', 'every', 'some', 'in', 'if', 'else'].map(keyword => ({
          label: keyword,
          kind: monacoInstance.languages.CompletionItemKind.Keyword,
          insertText: keyword, range, detail: 'Rego keyword'
        })),
        ...['contains', 'count', 'sum', 'max', 'min', 'sort',
          'to_number', 'to_string', 'parse_json', 'http_send'].map(func => ({
          label: func,
          kind: monacoInstance.languages.CompletionItemKind.Function,
          insertText: func + '()', range, detail: 'Built-in function'
        })),
        ...securitySnippets.map(snippet => ({
          label: snippet.label,
          kind: monacoInstance.languages.CompletionItemKind.Snippet,
          insertText: snippet.insertText, range,
          documentation: snippet.documentation,
          insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet
        }))
      ];
      return { suggestions };
    }
  });
}

export function registerHoverProvider(monacoInstance: typeof monaco) {
  monacoInstance.languages.registerHoverProvider('rego', {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return;
      const functionDoc: Record<string, string> = {
        'contains': 'contains(array, element) - Check if array contains element',
        'count': 'count(collection) - Return number of items in collection',
        'sum': 'sum(collection) - Return sum of numeric values',
        'max': 'max(collection) - Return maximum value',
        'min': 'min(collection) - Return minimum value',
        'now': 'now() - Return current time in nanoseconds',
        'parse_json': 'parse_json(string) - Parse JSON string',
        'every': 'every variable in collection { rule } - Universal quantifier',
        'some': 'some variable in collection { rule } - Existential quantifier'
      };
      if (functionDoc[word.word]) {
        return {
          range: new monacoInstance.Range(
            position.lineNumber, word.startColumn,
            position.lineNumber, word.endColumn
          ),
          contents: [
            { value: `**${word.word}**` },
            { value: functionDoc[word.word] }
          ]
        };
      }
    }
  });
}

export function registerSignatureHelpProvider(monacoInstance: typeof monaco) {
  monacoInstance.languages.registerSignatureHelpProvider('rego', {
    signatureHelpTriggerCharacters: ['(', ','],
    provideSignatureHelp: (model, position) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1, startColumn: 1,
        endLineNumber: position.lineNumber, endColumn: position.column
      });
      const functionMatch = textUntilPosition.match(/(\w+)\([^)]*$/);
      if (functionMatch) {
        const signatures: Record<string, any> = {
          'contains': {
            label: 'contains(collection, element)',
            documentation: 'Check if collection contains element',
            parameters: [
              { label: 'collection', documentation: 'Array or set to search' },
              { label: 'element', documentation: 'Element to find' }
            ]
          },
          'count': {
            label: 'count(collection)',
            documentation: 'Count items in collection',
            parameters: [
              { label: 'collection', documentation: 'Array, set, or object to count' }
            ]
          },
          'sum': {
            label: 'sum(collection)',
            documentation: 'Sum numeric values in collection',
            parameters: [
              { label: 'collection', documentation: 'Collection of numbers' }
            ]
          }
        };
        if (signatures[functionMatch[1]]) {
          return { value: signatures[functionMatch[1]], activeParameter: 0 };
        }
      }
    }
  });
}
