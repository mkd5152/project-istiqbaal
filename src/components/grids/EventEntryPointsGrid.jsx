// src/pages/admin/EntryPointsPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import CrudGrid from '../../components/grids/CrudGrid';
import { db, sanitize, constants } from '../../libs';

const SCHEMA = process.env.REACT_APP_SUPABASE_DB; // e.g. "itsscanning"
const TABLE = 'entry_points';
const LOOKUP = 'locations';
const STATUS = constants.STATUS || ['active', 'inactive'];

/* ---------- validation & sanitize ---------- */
const validateEntryPoint = (row) => {
  const name = sanitize.sanitizeName(row?.name);
  const locId = Number(row?.location_id);
  const st = sanitize.normalizeOneOf(row?.status, STATUS, 'active');
  return !!name && Number.isFinite(locId) && locId > 0 && STATUS.includes(st);
};

const coerceJSON = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'object') return v; // already JSON
  try {
    const parsed = JSON.parse(String(v));
    return typeof parsed === 'object' ? parsed : null;
  } catch {
    return null; // invalid -> null (user sees pretty string but we store null if invalid)
  }
};

const sanitizeInsert = (row) => {
  const code = sanitize.sanitizeCode(row.code);
  return {
    name: sanitize.sanitizeName(row.name),
    location_id: Number(row.location_id) || null,
    code: code || null,                     // optional
    description: sanitize.nullIfEmpty(row.description),
    device_details: coerceJSON(row.device_details),  // jsonb
    status: sanitize.normalizeOneOf(row.status, STATUS, 'active'),
  };
};

const sanitizeUpdate = (row) => {
  const code = sanitize.sanitizeCode(row.code);
  return {
    id: row.id,
    name: sanitize.sanitizeName(row.name),
    location_id: Number(row.location_id) || null,
    code: code || null,
    description: sanitize.nullIfEmpty(row.description),
    device_details: coerceJSON(row.device_details),
    status: sanitize.normalizeOneOf(row.status, STATUS, 'active'),
  };
};

/* ---------- CRUD binding ---------- */
const epCrud = db.makeCrud({
  schema: SCHEMA,
  table: TABLE,
  pk: 'id',
  select: 'id,name,location_id,code,description,device_details,status,created_at',
  sanitizeInsert,
  sanitizeUpdate,
  validate: validateEntryPoint,
});

function buildNewEntryPoint() {
  return {
    name: '',
    location_id: '',
    code: '',
    description: '',
    device_details: '',
    status: 'active',
  };
}

export default function EntryPointsPage() {
  const gridRef = useRef(null);

  // Load locations for dropdown
  const [locations, setLocations] = useState([]);
  const [loadingLocs, setLoadingLocs] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await db.loadRows({
          schema: SCHEMA,
          table: LOOKUP,
          select: 'id,name',
          where: { status: 'active' },   // only active locations
          orderBy: 'name',
          ascending: true,
        });
        if (!alive) return;
        setLocations(rows || []);
      } catch (err) {
        console.error('Load locations error:', err);
        alert('Failed to load locations');
      } finally {
        if (alive) setLoadingLocs(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Build safe labels for dropdown (handle duplicate names)
  const { labelById, idByLabel, labels } = useMemo(() => {
    const nameCount = new Map();
    for (const l of locations) nameCount.set(l.name, (nameCount.get(l.name) || 0) + 1);

    const _labelById = new Map();
    const _idByLabel = new Map();
    const _labels = [];
    for (const l of locations) {
      const dup = (nameCount.get(l.name) || 0) > 1;
      const label = dup ? `${l.name} (#${l.id})` : l.name;
      _labels.push(label);
      _labelById.set(l.id, label);
      _idByLabel.set(label, l.id);
    }
    return { labelById: _labelById, idByLabel: _idByLabel, labels: _labels };
  }, [locations]);

  const columns = useMemo(
    () => [
      { field: 'id', hide: true },
      // Code (optional; sanitized to UPPER_SNAKE)
      {
        headerName: 'Code',
        field: 'code',
        editable: true,
        width: 180,
        valueSetter: (p) => {
          const code = sanitize.sanitizeCode(p.newValue);
          p.data.code = code || null; // allow empty -> null (unique idx is partial)
          return true;
        },
        tooltipValueGetter: () => 'Optional. A–Z, 0–9, underscore. e.g., GATE_01',
      },
      // Name (required)
      {
        headerName: 'Name',
        field: 'name',
        editable: true,
        flex: 1,
        minWidth: 220,
        valueSetter: (p) => { p.data.name = sanitize.sanitizeName(p.newValue); return true; },
        cellClassRules: { 'ag-cell-invalid': (params) => !sanitize.sanitizeName(params.value) },
        tooltipValueGetter: () => 'Required. Up to 120 characters.',
      },

      // Location (dropdown from active locations)
      {
        headerName: 'Location',
        field: 'location_id',
        editable: true,
        width: 240,
        valueGetter: (p) => (p.data?.location_id ? labelById.get(p.data.location_id) || '' : ''),
        valueSetter: (p) => {
          const label = String(p.newValue || '');
          const id = idByLabel.get(label);
          if (id) { p.data.location_id = id; return true; }
          return false;
        },
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: labels },
        cellClassRules: { 'ag-cell-invalid': (params) => !(Number(params.data?.location_id) > 0) },
        tooltipValueGetter: () => 'Pick a location.',
      },
      // Description (optional)
      {
        headerName: 'Description',
        field: 'description',
        editable: true,
        flex: 1,
        minWidth: 240,
        valueSetter: (p) => { p.data.description = sanitize.nullIfEmpty(p.newValue); return true; },
      },

      // Device Details (JSON)
      {
        headerName: 'Device Details (JSON)',
        field: 'device_details',
        editable: true,
        flex: 1,
        minWidth: 260,
        valueGetter: (p) => {
          const val = p.data?.device_details;
          if (val == null || val === '') return '';
          try { return typeof val === 'string' ? val : JSON.stringify(val); }
          catch { return ''; }
        },
        valueSetter: (p) => {
          const obj = coerceJSON(p.newValue);
          p.data.device_details = obj; // stores null on invalid JSON
          return true;
        },
        tooltipValueGetter: () => 'Optional JSON, e.g. {"model":"NFC-100","serial":"A1"}',
      },

      // Status (active/inactive)
      {
        headerName: 'Status',
        field: 'status',
        editable: true,
        width: 140,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: STATUS },
        valueSetter: (p) => {
          p.data.status = sanitize.normalizeOneOf(p.newValue, STATUS, 'active');
          return true;
        },
        cellClassRules: {
          'ag-cell-invalid': (params) => !STATUS.includes(sanitize.normalizeOneOf(params.value, STATUS, 'active')),
        },
      },

      // Created
      {
        headerName: 'Created',
        field: 'created_at',
        editable: false,
        width: 200,
        valueFormatter: (p) =>
          p.value
            ? new Date(p.value).toLocaleString('en-GB', {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
            : '',
      },
    ],
    [labelById, idByLabel, labels]
  );

  if (loadingLocs) return <div className="p-4">Loading…</div>;

  return (
    <CrudGrid
      ref={gridRef}
      title="Entry Points"
      columns={columns}
      loadRows={() => epCrud.load({ orderBy: 'id', ascending: true })}
      createRow={epCrud.create}
      updateRow={epCrud.update}
      deleteRows={epCrud.remove}
      buildNewRow={buildNewEntryPoint}
      getRowKey={(r) => r.id}
      validate={validateEntryPoint}
      pageSize={20}
    />
  );
}