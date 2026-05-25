// Type declarations for missing external modules

declare module '@tanstack/react-query-devtools' {
  import { FC } from 'react'
  export const ReactQueryDevtools: FC<{
    initialIsOpen?: boolean
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    panelProps?: Record<string, unknown>
    closeButtonProps?: Record<string, unknown>
    toggleButtonProps?: Record<string, unknown>
  }>
}

declare module '@next-auth/prisma-adapter' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function PrismaAdapter(prisma: any): any
}

declare module 'reactflow' {
  import { FC, ComponentType } from 'react'

  export interface Node {
    id: string
    type?: string
    position: { x: number; y: number }
    data: Record<string, unknown>
  }

  export interface Edge {
    id: string
    source: string
    target: string
    type?: string
    label?: string
  }

  export interface NodeProps {
    id: string
    data: Record<string, unknown>
    type?: string
    selected?: boolean
    isConnectable?: boolean
  }

  export type NodeTypes = Record<string, ComponentType<NodeProps>>

  export interface ReactFlowProps {
    nodes?: Node[]
    edges?: Edge[]
    onNodesChange?: (changes: unknown[]) => void
    onEdgesChange?: (changes: unknown[]) => void
    onConnect?: (connection: unknown) => void
    nodeTypes?: NodeTypes
    fitView?: boolean
    children?: React.ReactNode
    className?: string
  }

  const ReactFlow: FC<ReactFlowProps>
  export default ReactFlow

  export const Background: FC<{ variant?: string; gap?: number; size?: number }>
  export const Controls: FC<Record<string, unknown>>
  export const MiniMap: FC<Record<string, unknown>>
  export const Panel: FC<{ position?: string; children?: React.ReactNode }>

  export function useNodesState(initialNodes: Node[]): [Node[], (changes: unknown) => void, (nodes: Node[] | ((prev: Node[]) => Node[])) => void]
  export function useEdgesState(initialEdges: Edge[]): [Edge[], (changes: unknown) => void, (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void]

  export function addEdge(connection: unknown, edges: Edge[]): Edge[]
  export function Handle(props: { type: string; position: string; id?: string; style?: React.CSSProperties }): JSX.Element

  export type Position = 'top' | 'right' | 'bottom' | 'left'
  export const Position: {
    Top: 'top'
    Right: 'right'
    Bottom: 'bottom'
    Left: 'left'
  }
}

declare module '@monaco-editor/react' {
  import { FC } from 'react'

  export interface EditorProps {
    height?: string | number
    width?: string | number
    language?: string
    value?: string
    defaultValue?: string
    theme?: string
    options?: Record<string, unknown>
    onChange?: (value: string | undefined) => void
    onMount?: (editor: unknown, monaco: unknown) => void
    className?: string
  }

  const Editor: FC<EditorProps>
  export default Editor
}

declare module 'monaco-editor' {
  export interface IDisposable {
    dispose(): void
  }

  export namespace editor {
    function defineTheme(themeName: string, themeData: unknown): void
    function setModelMarkers(model: unknown, owner: string, markers: unknown[]): void
  }

  export namespace languages {
    function register(language: { id: string; extensions?: string[]; aliases?: string[] }): void
    function setMonarchTokensProvider(languageId: string, provider: unknown): IDisposable
    function registerCompletionItemProvider(languageId: string, provider: unknown): IDisposable
    function setLanguageConfiguration(languageId: string, configuration: unknown): IDisposable

    enum CompletionItemKind {
      Method = 0,
      Function = 1,
      Constructor = 2,
      Field = 3,
      Variable = 4,
      Class = 5,
      Struct = 6,
      Interface = 7,
      Module = 8,
      Property = 9,
      Event = 10,
      Operator = 11,
      Unit = 12,
      Value = 13,
      Constant = 14,
      Enum = 15,
      EnumMember = 16,
      Keyword = 17,
      Text = 18,
      Color = 19,
      File = 20,
      Reference = 21,
      Customcolor = 22,
      Folder = 23,
      TypeParameter = 24,
      User = 25,
      Issue = 26,
      Snippet = 27,
    }

    enum CompletionItemInsertTextRule {
      None = 0,
      KeepWhitespace = 1,
      InsertAsSnippet = 4,
    }
  }

  export namespace MarkerSeverity {
    const Error: number
    const Warning: number
    const Info: number
    const Hint: number
  }

  export interface Range {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  }

  export class Range {
    constructor(startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number)
  }
}
