/** Parses a user input string into a positive (> 0) number, or null if invalid. */
export const parsePositiveInput = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : null;
};

/** Parses a user input string into a non-negative (>= 0) number, or null if invalid. */
export const parseNonNegativeInput = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : null;
};
