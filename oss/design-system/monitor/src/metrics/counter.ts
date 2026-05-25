interface CounterInstance {
  increment(labels?: Record<string, string>): void;
  getValue(): number;
  getPrometheus(): string;
}

export function createCounter(
  name: string,
  help: string,
  labels?: string[]
): CounterInstance {
  let value = 0;
  const labelNames = labels ?? [];
  const labelValues: Record<string, Record<string, string>> = {};

  return {
    increment(labelMap?: Record<string, string>): void {
      if (labelMap) {
        const key = JSON.stringify(labelMap);
        if (!labelValues[key]) {
          labelValues[key] = labelMap;
        }
        value += 1;
      } else {
        value += 1;
      }
    },

    getValue(): number {
      return value;
    },

    getPrometheus(): string {
      let output = `# HELP ${name} ${help}\n`;
      output += `# TYPE ${name} counter\n`;

      if (Object.keys(labelValues).length === 0) {
        output += `${name} ${value}\n`;
      } else {
        for (const key of Object.keys(labelValues)) {
          const labels = labelValues[key];
          const labelStr = labelNames
            .map((lbl) => `${lbl}="${labels[lbl]}"`)
            .join(',');
          output += `${name}{${labelStr}} 1\n`;
        }
      }

      return output;
    },
  };
}
