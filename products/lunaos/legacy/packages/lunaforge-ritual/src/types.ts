export interface RitualStep {
  id: string;
  type: "command" | "test" | "fileChange" | "http" | "custom";
  label: string;
  data: any;
}

export interface RitualDefinition {
  id: string;
  name: string;
  trigger: "manual" | "pattern" | "prediction";
  steps: RitualStep[];
}
