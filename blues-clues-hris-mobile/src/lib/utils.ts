/**
 * Shared utility functions — mirrors web src/lib/utils.ts
 */

/** Basic email format check (sufficient for mock; backend will validate properly) */
export function isValidEmail(value: string): boolean {
  const s = value.trim();
  return s.includes("@") && s.includes(".");
}

/** Returns the uppercase first letter of a name, or "?" as fallback */
export function getInitial(name?: string): string {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

/** Clamps a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Calculates step tracker progress width as a percentage */
export function stepProgress(currentStep: number, totalSteps: number): number {
  return clamp((currentStep / (totalSteps - 1)) * 100, 0, 100);
}
