/**
 * Reads a typed number. Money fields may include S$, $, commas, or spaces.
 * A trailing percent sign is allowed. Anything else that is not a number is rejected.
 */
export function parseDecimal(raw: string): number | null {
  let cleaned = raw
    .trim()
    .replace(/s\$/gi, "")
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .replace(/%$/, "")
    .trim();
  if (cleaned.startsWith(".")) cleaned = `0${cleaned}`;
  if (cleaned.startsWith("-.")) cleaned = `-0${cleaned.slice(1)}`;
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
