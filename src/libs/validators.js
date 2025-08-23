// src/libs/validators.js
import { sanitizeITS, normalizeOneOf } from './sanitize';

export const isITS = (v) => sanitizeITS(v).length === 8;
export const isNonEmpty = (v) => String(v ?? '').trim().length > 0;
export const isOneOf = (v, list) => list.includes(v);

/** Quick “config-based” validator */
export function validateRequired(obj, keys = []) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v === undefined || v === null || String(v).trim() === '') return false;
  }
  return true;
}

/** Users validator shortcut */
export function makeUserValidator({ roles, statuses }) {
  return (row) => {
    if (!isITS(row.its_number)) return false;
    if (!isOneOf(normalizeOneOf(row.role, roles, null), roles)) return false;
    if (!isOneOf(normalizeOneOf(row.status, statuses, null), statuses)) return false;
    return true;
  };
}