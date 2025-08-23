// src/pages/admin/EventTypesPage.jsx
import React, { useMemo, useRef } from 'react';
import CrudGrid from '../../components/grids/CrudGrid';
import { db, sanitize, v, constants } from '../../libs';

// --- constants / table ---
const TABLE = 'event_types';
const STATUS = constants.STATUS || ['active', 'inactive'];

// --- validators & sanitizers ---
const validateEventType = v.makeEventTypeValidator({ statuses: STATUS });

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

// --- CRUD binding (uses your generic helpers) ---
const etCrud = db.makeCrud({
  schema: process.env.REACT_APP_SUPABASE_DB, // set to "itsscanning" in .env
  table: TABLE,
  pk: 'id',
  select: 'id,code,name,description,status,created_at',
  sanitizeInsert,
  sanitizeUpdate,
  validate: validateEventType,
});

function buildNewEventType() {
  return { code: '', name: '', description: '', status: 'active' };
}

export default function EventTypesPage() {
  const gridRef = useRef(null);

  const columns = useMemo(
    () => [
      { field: 'id', hide: true },

      {
        headerName: 'Code',
        field: 'code',
        editable: true,
        width: 220,
        valueSetter: (p) => {
          p.data.code = sanitize.sanitizeCode(p.newValue);
          return true;
        },
        cellClassRules: {
          'ag-cell-invalid': (params) => !v.isEventTypeCode(params.value),
        },
        tooltipValueGetter: () => '2–32 chars. A–Z, 0–9, underscores only (auto-sanitized).',
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
      title="Event Types"
      columns={columns}
      loadRows={() => etCrud.load({ orderBy: 'id', ascending: true })}
      createRow={etCrud.create}
      updateRow={etCrud.update}
      deleteRows={etCrud.remove}           // soft-delete supported by helper
      buildNewRow={buildNewEventType}
      getRowKey={(r) => r.id}
      validate={validateEventType}
      pageSize={20}
    />
  );
}