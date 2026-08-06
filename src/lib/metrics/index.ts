// Metrics wrapper: uses prom-client when available (server-side), falls back to
// an in-memory exporter for tests and single-process dev.
type Labels = Record<string, string | number | boolean> | undefined;

let prom: any = null;
let registry: any = null;
const fallbackCounters = new Map<string, Map<string, number>>();

void (async () => {
  try {
    prom = await import("prom-client");
    registry = new prom.Registry();
    // collect default metrics to the registry
    try {
      prom.collectDefaultMetrics({ register: registry });
    } catch {}
  } catch (e) {
    prom = null;
  }
})();

function labelKey(labels: Labels): string {
  if (!labels || Object.keys(labels).length === 0) return "_";
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}=${String((labels as any)[k])}`)
    .join(",");
}

export function incrementCounter(name: string, labels?: Labels, value = 1) {
  if (prom && registry) {
    // ensure a counter exists on the registry
    const metricName = `${name}`;
    let metric = registry.getSingleMetric(metricName);
    if (!metric) {
      // create a generic counter with label names from provided labels
      const labelNames = labels ? Object.keys(labels) : [];
      metric = new prom.Counter({ name: metricName, help: metricName, labelNames, registers: [registry] });
    }
    if (labels && Object.keys(labels).length > 0) {
      metric.inc(labels, value);
    } else {
      metric.inc(value);
    }
    return;
  }

  // fallback in-memory
  const key = labelKey(labels);
  let series = fallbackCounters.get(name);
  if (!series) {
    series = new Map();
    fallbackCounters.set(name, series);
  }
  series.set(key, (series.get(key) ?? 0) + value);
}

export async function getPrometheusText(): Promise<string> {
  if (prom && registry) {
    try {
      return await registry.metrics();
    } catch (e) {
      // fall through to fallback
    }
  }

  const lines: string[] = [];
  for (const [name, series] of fallbackCounters) {
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
  fallbackCounters.clear();
  if (prom && registry) {
    try {
      registry.clear();
    } catch {}
  }
}

export default { incrementCounter, getPrometheusText, resetAllMetrics };
