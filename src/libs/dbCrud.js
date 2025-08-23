// src/libs/dbCrud.js
import { supabase } from '../supabaseClient';

export function fromTable(schema = 'public', table) {
  return schema && schema !== 'public'
    ? supabase.schema(schema).from(table)
    : supabase.from(table);
}

export async function loadRows({
  schema = 'public',
  table,
  select = '*',
  orderBy = 'id',
  ascending = true,
  limit,
  page,
  range,
  filters = [],
  includeDeleted = false,     // <— NEW: hide soft-deleted by default
  signal,
}) {
  let q = fromTable(schema, table).select(select, { head: false });

  // hide soft-deleted by default
  if (!includeDeleted) q = q.is('deleted_at', null);

  for (const f of filters) {
    if (!f) continue;
    const { fn = 'eq', col, val, args = [] } = f;
    if (!col) continue;
    if (fn === 'eq') q = q.eq(col, val);
    else if (fn === 'neq') q = q.neq(col, val);
    else if (fn === 'ilike') q = q.ilike(col, val);
    else if (fn === 'in') q = q.in(col, Array.isArray(val) ? val : []);
    else if (fn === 'is') q = q.is(col, val);
    else if (fn === 'gt') q = q.gt(col, val);
    else if (fn === 'gte') q = q.gte(col, val);
    else if (fn === 'lt') q = q.lt(col, val);
    else if (fn === 'lte') q = q.lte(col, val);
    else if (typeof q[fn] === 'function') q = q[fn](col, ...args);
  }

  if (orderBy) q = q.order(orderBy, { ascending, nullsFirst: true });

  if (Array.isArray(range) && range.length === 2) {
    q = q.range(range[0], range[1]);
  } else if (limit && page) {
    const from = (page - 1) * limit;
    q = q.range(from, from + limit - 1);
  } else if (limit) {
    q = q.limit(limit);
  }

  if (signal) q = q.abortSignal(signal);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function insertRow({ schema = 'public', table, row, select = '*' }) {
  const { data, error } = await fromTable(schema, table).insert(row).select(select).single();
  if (error) throw error;
  return data;
}

export async function updateRow({ schema = 'public', table, pk = 'id', row, select = '*' }) {
  if (row[pk] == null) throw new Error(`updateRow: missing ${pk}`);
  const { data, error } = await fromTable(schema, table)
    .update(row)
    .eq(pk, row[pk])
    .select(select)
    .maybeSingle();
  if (error) throw error;
  return data ?? row;
}

/** Soft delete by default; set hard=true only for permanent delete */
export async function deleteByIds({
  schema = 'public',
  table,
  pk = 'id',
  ids = [],
  soft = true,                // <— NEW: soft delete default
}) {
  if (!ids.length) return;

  if (soft) {
    const nowIso = new Date().toISOString();
    const { error } = await fromTable(schema, table)
      .update({ deleted_at: nowIso })
      .in(pk, ids);
    if (error) throw error;
    return;
  }

  // hard delete (rare)
  const { error } = await fromTable(schema, table).delete().in(pk, ids);
  if (error) throw error;
}

/** Factory stays the same, but remove() uses soft delete via deleteByIds */
export function makeCrud({
  schema = 'public',
  table,
  pk = 'id',
  select = '*',
  sanitizeInsert,
  sanitizeUpdate,
  validate,
}) {
  return {
    async load(opts = {}) {
      return loadRows({ schema, table, select, ...opts });
    },
    async create(row) {
      const payload = sanitizeInsert ? sanitizeInsert(row) : row;
      if (validate && !validate(payload)) throw new Error('Validation failed.');
      return insertRow({ schema, table, row: payload, select });
    },
    async update(row) {
      const payload = sanitizeUpdate ? sanitizeUpdate(row) : row;
      if (validate && !validate(payload)) throw new Error('Validation failed.');
      return updateRow({ schema, table, row: payload, pk, select });
    },
    async remove(rows = [], { soft = true } = {}) {
      const ids = rows.map((r) => r[pk]).filter((v) => v != null);
      return deleteByIds({ schema, table, pk, ids, soft });
    },
  };
}