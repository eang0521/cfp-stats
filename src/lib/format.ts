export function fmtRating(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}

export function fmtDecimal(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined) return "-";
  return value.toFixed(digits);
}

export function fmtPct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}
