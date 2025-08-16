import CustomStore from 'devextreme/data/custom_store';
import { supabase } from '../../supabaseClient';

function applyFilter(q, filter) {
  if (!filter || !Array.isArray(filter)) return q;
  const [field, op, val] = filter;
  if (typeof field !== 'string') return q;
  const oper = (op || '=').toLowerCase();
  if (oper === '=' || oper === 'eq') return q.eq(field, val);
  if (oper === 'contains') return q.ilike(field, `%${val}%`);
  if (oper === '>') return q.gt(field, val);
  if (oper === '<') return q.lt(field, val);
  return q;
}

export function createSupabaseStore(table, primaryKey = 'id', preprocess) {
  return new CustomStore({
    key: primaryKey,

    load: async (opts) => {
      const { skip = 0, take = 20, sort, filter, searchValue, searchExpr } = opts;
      let q = supabase.from(table).select('*', { count: 'exact' });

      if (Array.isArray(sort) && sort.length) {
        sort.forEach(s => { if (s?.selector) q = q.order(s.selector, { ascending: !s.desc }); });
      }
      q = applyFilter(q, filter);

      if (searchValue && typeof searchExpr === 'string') {
        q = q.ilike(searchExpr, `%${searchValue}%`);
      }

      if (take) q = q.range(skip, skip + take - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { data: data || [], totalCount: count ?? (data?.length || 0) };
    },

    insert: async (values) => {
      const payload = preprocess ? preprocess(values, 'insert') : values;
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) throw error;
      return data;
    },

    update: async (key, values) => {
      const payload = preprocess ? preprocess(values, 'update') : values;
      const { data, error } = await supabase.from(table).update(payload).eq(primaryKey, key).select().single();
      if (error) throw error;
      return data;
    },

    remove: async (key) => {
      const { error } = await supabase.from(table).delete().eq(primaryKey, key);
      if (error) throw error;
      return key;
    }
  });
}