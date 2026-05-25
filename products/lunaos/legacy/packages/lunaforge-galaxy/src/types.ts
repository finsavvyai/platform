export interface GalaxyNode {
  id: string;
  label: string;
  weight: number;
  kind: "file" | "module" | "service";
}

export interface GalaxyEdge {
  from: string;
  to: string;
  weight: number;
}

export interface GalaxySnapshot {
  nodes: GalaxyNode[];
  edges: GalaxyEdge[];
}
