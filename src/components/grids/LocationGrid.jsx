// src/pages/admin/LocationsPage.jsx
import React, { useMemo, useRef } from 'react';
import CrudGrid from '../../components/grids/CrudGrid';
import { db, sanitize, v, constants } from '../../libs';

// --- constants / table ---
const TABLE = 'locations';
const STATUS = constants.STATUS || ['active', 'inactive'];

// --- validators & sanitizers ---
const validateLocation = (row) => {
  // code: same 2–32, A-Z/0-9/_ rule as event type (we can reuse the validator)
  if (!v.isEventTypeCode(row?.code)) return false;

  // name required (sanitized non-empty)
  if (!sanitize.sanitizeName(row?.name)) return false;

  // status one-of
  const s = sanitize.normalizeOneOf(row?.status, STATUS, 'active');
  return STATUS.includes(s);
};

const sanitizeInsert = (row) => ({
  code: sanitize.sanitizeCode(row.code),
  name: sanitize.sanitizeName(row.name),
  description: sanitize.nullIfEmpty(row.description),
  status: sanitize.normalizeOneOf(row.status, STATUS, 'active'),
});

const sanitizeUpdate = (row) => ({
  id: row.id,
  code: sanitize.sanitizeCode(row.code),
  name: sanitize.sanitizeName(row.name),
  description: sanitize.nullIfEmpty(row.description),
  status: sanitize.normalizeOneOf(row.status, STATUS, 'active'),
});

// --- CRUD binding (generic helpers) ---
const locCrud = db.makeCrud({
  schema: process.env.REACT_APP_SUPABASE_DB, // e.g. "itsscanning"
  table: TABLE,
  pk: 'id',
  // don’t select updated_at / deleted_at so they don’t show in the grid
  select: 'id,code,name,description,status,created_at',
  sanitizeInsert,
  sanitizeUpdate,
  validate: validateLocation,
});

function buildNewLocation() {
  return { code: '', name: '', description: '', status: 'active' };
}

export default function LocationsPage() {
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
          p.data.code = sanitize.sanitizeCode(p.newValue);
          return true;
        },
        cellClassRules: {
          'ag-cell-invalid': (params) => !v.isEventTypeCode(params.value),
        },
        tooltipValueGetter: () =>
          '2–32 chars. A–Z, 0–9, underscores only (auto-sanitized).',
      },

      {
        headerName: 'Name',
        field: 'name',
        editable: true,
        flex: 1,
        minWidth: 240,
        valueSetter: (p) => {
          p.data.name = sanitize.sanitizeName(p.newValue);
          return true;
        },
        cellClassRules: {
          'ag-cell-invalid': (params) => !sanitize.sanitizeName(params.value),
        },
        tooltipValueGetter: () => 'Required. Up to 120 characters.',
      },

      {
        headerName: 'Description',
        field: 'description',
        editable: true,
        flex: 1,
        minWidth: 300,
        valueSetter: (p) => {
          p.data.description = sanitize.nullIfEmpty(p.newValue);
          return true;
        },
      },

      {
        headerName: 'Status',
        field: 'status',
        editable: true,
        width: 160,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: STATUS },
        valueSetter: (p) => {
          p.data.status = sanitize.normalizeOneOf(p.newValue, STATUS, 'active');
          return true;
        },
        cellClassRules: {
          'ag-cell-invalid': (params) =>
            !STATUS.includes(sanitize.normalizeOneOf(params.value, STATUS, 'active')),
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
      title="Locations"
      columns={columns}
      loadRows={() => locCrud.load({ orderBy: 'id', ascending: true })}
      createRow={locCrud.create}
      updateRow={locCrud.update}
      deleteRows={locCrud.remove}
      buildNewRow={buildNewLocation}
      getRowKey={(r) => r.id}
      validate={validateLocation}
      pageSize={20}
    />
  );
}