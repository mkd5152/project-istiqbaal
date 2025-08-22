import React, { useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import CrudGrid from './CrudGrid';

/** ---------- helpers & validation ---------- */
const STATUSES = ['active', 'inactive'];

function sanitizeCode(v) {
  // Uppercase, spaces & dashes -> underscore, strip non [A-Z0-9_], trim to 32
  const s = String(v || '')
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, 32);
  return s;
}
function normalizeStatus(v) {
  const s = String(v || '').toLowerCase();
  return STATUSES.includes(s) ? s : 'active';
}
function isValidCode(v) {
  const s = sanitizeCode(v);
  return s.length >= 2 && s.length <= 32;
}
function validateEventType(row) {
  if (!isValidCode(row.code)) return false;
  if (!String(row.name || '').trim()) return false;
  if (!STATUSES.includes(normalizeStatus(row.status))) return false;
  return true;
}
function buildNewEventType() {
  return { code: '', name: '', description: '', status: 'active' };
}

/** ---------- Supabase adapters ---------- */
async function loadEventTypes() {
  const { data, error } = await supabase
    .from('event_type')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function createEventType(row) {
  const payload = {
    code: sanitizeCode(row.code),
    name: String(row.name || '').trim(),
    description: row.description ? String(row.description) : null,
    status: normalizeStatus(row.status),
  };
  if (!validateEventType(payload)) {
    throw new Error('Please fill Code (2–32 chars), Name, and valid Status.');
  }
  const { data, error } = await supabase
    .from('event_type')
    .insert(payload)
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Code already exists.');
    throw error;
  }
  return data;
}

async function updateEventType(row) {
  const payload = {
    code: sanitizeCode(row.code),
    name: String(row.name || '').trim(),
    description: row.description ? String(row.description) : null,
    status: normalizeStatus(row.status),
  };
  if (!validateEventType(payload)) {
    throw new Error('Please fill Code (2–32 chars), Name, and valid Status.');
  }
  const { error } = await supabase
    .from('event_type')
    .update(payload)
    .eq('id', row.id);
  if (error) {
    if (error.code === '23505') throw new Error('Code already exists.');
    throw error;
  }
}

async function deleteEventTypes(rows) {
  const ids = rows.map((r) => r.id);
  const { error } = await supabase.from('event_type').delete().in('id', ids);
  if (error) throw error;
}

/** ---------- Page wired to CrudGrid ---------- */
export default function EventTypeGrid() {
  const gridRef = useRef(null);

  const columns = useMemo(
    () => [
      { field: 'id', hide: true },

      {
        headerName: 'Code',
        field: 'code',
        editable: true,
        width: 200,
        valueSetter: (p) => {
          p.data.code = sanitizeCode(p.newValue);
          return true;
        },
        cellClassRules: { 'ag-cell-invalid': (params) => !isValidCode(params.value) },
        tooltipValueGetter: () => '2–32 chars. Only A–Z, 0–9, underscore.',
      },

      {
        headerName: 'Name',
        field: 'name',
        editable: true,
        flex: 1,
        minWidth: 220,
        cellClassRules: {
          'ag-cell-invalid': (params) => !String(params.value || '').trim(),
        },
      },

      {
        headerName: 'Description',
        field: 'description',
        editable: true,
        flex: 1,
        minWidth: 260,
      },

      {
        headerName: 'Status',
        field: 'status',
        editable: true,
        width: 160,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: STATUSES },
        valueSetter: (p) => {
          p.data.status = normalizeStatus(p.newValue);
          return true;
        },
        cellClassRules: {
          'ag-cell-invalid': (params) => !STATUSES.includes(normalizeStatus(params.value)),
        },
      },

      {
        headerName: 'Created',
        field: 'created_at',
        editable: false,
        width: 210,
        valueFormatter: (p) =>
          p.value
            ? new Date(p.value).toLocaleString('en-GB', {
              timeZone: 'Asia/Dubai',
              year: 'numeric',
              month: 'short',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
            : '',
      },
    ],
    []
  );

  return (
    <CrudGrid
      ref={gridRef}
      title="Event Types"
      columns={columns}
      loadRows={loadEventTypes}
      createRow={createEventType}
      updateRow={updateEventType}
      deleteRows={deleteEventTypes}
      buildNewRow={buildNewEventType}
      getRowKey={(r) => r.id}
      validate={validateEventType}
      pageSize={20}
    />
  );
}