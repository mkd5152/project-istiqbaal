// src/libs/sanitize.js

/** Trim, collapse spaces, clamp length */
export const cleanText = (v, max = 255) =>
  String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** ITS: exactly 8 digits (soft sanitize) */
export const sanitizeITS = (v) => String(v ?? '').replace(/\D/g, '').slice(0, 8);

/** Upper snake code (A–Z, 0–9, _) with max len */
export const sanitizeCode = (v, max = 32) =>
  String(v ?? '')
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, max);

/** Name – allow letters/numbers/spaces; keep punctuation minimal */
export const sanitizeName = (v, max = 120) => cleanText(v, max);

/** Email -> null if empty */
export const sanitizeEmail = (v) => {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
};

/** Coerce empty string -> null; else trimmed string */
export const nullIfEmpty = (v) => {
  const s = String(v ?? '').trim();
  return s ? s : null;
};

/** Enforce one-of list with fallback */
export const normalizeOneOf = (v, list, fallback) =>
  list.includes(v) ? v : fallback;

/** Booleans from various truthy/falsey inputs */
export const toBool = (v) =>
  typeof v === 'boolean'
    ? v
    : ['1', 'true', 'yes', 'y', 'on'].includes(String(v).toLowerCase());

/** Date-only (YYYY-MM-DD) or null */
export const sanitizeDate = (v) => {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** Time (HH:mm or HH:mm:ss) or null */
export const sanitizeTime = (v) => {
  const s = String(v ?? '').trim();
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(s) ? s : null;
};