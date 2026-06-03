import type { Metrics } from "./types";

export function formatMetricValue(metric: keyof Metrics, value: number) {
  if (metric === "companyCost") {
    return `${value} 元`;
  }

  if (metric === "timeLeft") {
    return `${value} 分钟`;
  }

  return `${value}`;
}
