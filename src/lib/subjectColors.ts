export const SUBJECT_HUES: Record<string, number> = {
  "Capital Markets": 200,
  "International Finance": 100,
  "Financial Engineering": 280,
  "Applied Programming in Finance": 340,
  "Econometrics": 30,
  "Computational Finance": 160,
};

export const SUBJECT_SHORTS: Record<string, string> = {
  "Capital Markets": "Capital Markets",
  "International Finance": "Int'l Finance",
  "Financial Engineering": "Fin. Engineering",
  "Applied Programming in Finance": "Appl. Programming",
  "Econometrics": "Econometrics",
  "Computational Finance": "Comp. Finance",
};

export function subjectColor(hue: number, lightness = 65): string {
  return `oklch(${lightness}% 0.10 ${hue})`;
}

export function subjectColorSoft(hue: number): string {
  return `oklch(28% 0.04 ${hue} / 0.55)`;
}
