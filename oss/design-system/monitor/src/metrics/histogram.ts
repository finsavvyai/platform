interface HistogramInstance {
  observe(value: number, labels?: Record<string, string>): void;
  getPrometheus(): string;
}

export function createHistogram(
  name: string,
  help: string,
  buckets?: number[]
): HistogramInstance {
  const defaultBuckets = buckets ?? [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  const observations: number[] = [];

  return {
    observe(value: number, _labels?: Record<string, string>): void {
      observations.push(value);
    },

    getPrometheus(): string {
      let output = `# HELP ${name} ${help}\n`;
      output += `# TYPE ${name} histogram\n`;

      const sum = observations.reduce((a, b) => a + b, 0);
      const count = observations.length;

      for (const bucket of defaultBuckets) {
        const count_in_bucket = observations.filter(
          (v) => v <= bucket
        ).length;
        output += `${name}_bucket{le="${bucket}"} ${count_in_bucket}\n`;
      }

      output += `${name}_bucket{le="+Inf"} ${count}\n`;
      output += `${name}_sum ${sum}\n`;
      output += `${name}_count ${count}\n`;

      return output;
    },
  };
}
