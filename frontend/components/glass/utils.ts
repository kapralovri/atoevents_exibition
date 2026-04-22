/**
 * Deterministic hue (0..360) from any string — used for brand-color tiles.
 * Same name → same color across the app.
 */
export function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

/** Returns `"H S% L%"` HSL triple for CSS */
export function brandHsl(name: string, saturation = 75, lightness = 44): string {
  return `${hueFromString(name)} ${saturation}% ${lightness}%`;
}

/** Initials from a name string ("Aviotech Ltd." → "AL") */
export function initialsOf(name: string, max = 2): string {
  if (!name) return "?";
  return (
    name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .map((w) => w[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, max)
      .join("") || "?"
  );
}

/** D-N helper: days diff from now, `D-14`, `D+3`, etc. */
export function daysUntil(iso?: string | null): { days: number; label: string; urgency: "ok" | "warn" | "overdue" } | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const now = Date.now();
  const days = Math.ceil((then - now) / (1000 * 60 * 60 * 24));
  const urgency: "ok" | "warn" | "overdue" = days < 0 ? "overdue" : days <= 7 ? "warn" : "ok";
  const label = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `D−${days}`;
  return { days, label, urgency };
}
