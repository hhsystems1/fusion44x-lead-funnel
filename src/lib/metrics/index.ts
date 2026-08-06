// Lightweight in-memory Prometheus-style metrics exporter.
// Not suitable for multi-instance production without a real metrics backend.
type Labels = Record<string, string | number | boolean> | undefined;

const counters = new Map<string, Map<string, number>>();

function labelKey(labels: Labels): string {
  if (!labels || Object.keys(labels).length === 0) return "_";
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}=${String((labels as any)[k])}`)
    .join(",");
}

export function incrementCounter(name: string, labels?: Labels, value = 1) {
  const key = labelKey(labels);
  let series = counters.get(name);
  if (!series) {
    series = new Map();
    counters.set(name, series);
  }
  series.set(key, (series.get(key) ?? 0) + value);
}

export function getPrometheusText(): string {
  const lines: string[] = [];
  for (const [name, series] of counters) {
    for (const [key, val] of series) {
      if (key === "_") {
        lines.push(`${name} ${val}`);
      } else {
        const labelPairs = key
          .split(",")
          .map((p) => {
            const [k, v] = p.split("=");
            return `${k}="${String(v).replace(/"/g, '\\"')}"`;
          })
          .join(",");
        lines.push(`${name}{${labelPairs}} ${val}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

export function resetAllMetrics() {
  counters.clear();
}

export default { incrementCounter, getPrometheusText, resetAllMetrics };
