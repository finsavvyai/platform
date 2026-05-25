export interface ServiceNode {
  id: string;
  label: string;
  kind: "service" | "db" | "queue" | "external";
}

export interface ServiceLink {
  from: string;
  to: string;
  kind: "http" | "rpc" | "event" | "db";
}

export interface RuntimePulse {
  nodeId: string;
  timestamp: string;
  load: number;
  latencyMs?: number;
}

export interface OrchestraSnapshot {
  nodes: ServiceNode[];
  links: ServiceLink[];
  pulses: RuntimePulse[];
}
