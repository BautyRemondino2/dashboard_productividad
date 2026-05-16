/**
 * oklch-based color system for subjects.
 * Each subject is identified by its hue value; lightness and chroma stay constant
 * so colors look equally vivid across all subjects on the dark slate background.
 */

/** Map subject names to their canonical hue (0-360). */
export const SUBJECT_HUES: Record<string, number> = {
  "Capital Markets":                200,
  "Financial Engineering":          280,
  "Computational Finance":          160,
  "Econometrics":                    30,
  "Applied Programming in Finance": 340,
};

/** Resolve hue for a subject name, returning a default if not found. */
export function subjectHue(name: string): number {
  return SUBJECT_HUES[name] ?? 220;
}

/**
 * Full-saturation subject color.
 * @param hue   oklch hue (0-360)
 * @param L     lightness % (default 70)
 */
export function subjectColor(hue: number, L = 70): string {
  return `oklch(${L}% 0.10 ${hue})`;
}

/**
 * Soft/muted version used for backgrounds and gradients.
 * Very low lightness + chroma + 55% opacity.
 */
export function subjectColorSoft(hue: number): string {
  return `oklch(28% 0.04 ${hue} / 0.55)`;
}

/**
 * Slightly more opaque background tint for card accents (no alpha).
 */
export function subjectColorBg(hue: number): string {
  return `oklch(22% 0.04 ${hue})`;
}
