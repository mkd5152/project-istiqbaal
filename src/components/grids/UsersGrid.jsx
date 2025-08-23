// src/pages/admin/UsersPage.jsx
import React, { useMemo, useRef } from 'react';
import CrudGrid from '../../components/grids/CrudGrid';
import { db, sanitize, v, constants } from '../../libs';

// constants
const TABLE = 'users';
const ROLES = constants.ROLES || ['user', 'admin', 'scanner', 'reporting'];
const STATUS = constants.STATUS || ['active', 'inactive'];

// validator & sanitizers
const validateUser = v.makeUserValidator({ roles: ROLES, statuses: STATUS });

const sanitizeInsert = (row) => ({
  its_number: sanitize.sanitizeITS(row.its_number),
  name: sanitize.sanitizeName(row.name),
  role: sanitize.normalizeOneOf(row.role, ROLES, 'user'),
  email: sanitize.sanitizeEmail(row.email),
  status: sanitize.normalizeOneOf(row.status, STATUS, 'active'),
});

const sanitizeUpdate = (row) => ({
  id: row.id,
  its_number: sanitize.sanitizeITS(row.its_number),
  name: sanitize.sanitizeName(row.name),
  role: sanitize.normalizeOneOf(row.role, ROLES, 'user'),
  email: sanitize.sanitizeEmail(row.email),
  status: sanitize.normalizeOneOf(row.status, STATUS, 'active'),
});

// bind CRUD to users table once
const usersCrud = db.makeCrud({
  schema: process.env.REACT_APP_SUPABASE_DB,
  table: TABLE,
  pk: 'id',
  select: 'id,its_number,name,role,auth_id,email,status,created_at',
  sanitizeInsert,
  sanitizeUpdate,
  validate: validateUser,
});

function buildNewUser() {
  return {
    its_number: '',
    name: '',
    role: 'user',
    email: '',
    status: 'active',
  };
}

export default function UsersPage() {
  const gridRef = useRef(null);

  const columns = useMemo(
    () => [
      { field: 'id', hide: true },

      {
        headerName: 'ITS',
        field: 'its_number',
        editable: true,
        width: 140,
        valueSetter: (p) => {
          p.data.its_number = sanitize.sanitizeITS(p.newValue);
          return true;
        },
        cellClassRules: {
          'ag-cell-invalid': (params) => !v.isITS(params.value),
        },
        tooltipValueGetter: () => '8 digits only',
      },

      {
        headerName: 'Name',
        field: 'name',
        editable: true,
        flex: 1,
        minWidth: 200,
        valueSetter: (p) => {
          p.data.name = sanitize.sanitizeName(p.newValue);
          return true;
        },
      },

      {
        headerName: 'Role',
        field: 'role',
        editable: true,
        width: 160,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ROLES },
        valueSetter: (p) => {
          p.data.role = sanitize.normalizeOneOf(p.newValue, ROLES, 'user');
          return true;
        },
      },

      {
        headerName: 'Email',
        field: 'email',
        editable: true,
        flex: 1,
        minWidth: 240,
        valueSetter: (p) => {
          p.data.email = sanitize.sanitizeEmail(p.newValue);
          return true;
        },
      },

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
      },

      {
        headerName: 'Auth ID',
        field: 'auth_id',
        editable: false,
        minWidth: 260,
        valueFormatter: (p) => (p.value ? String(p.value) : ''),
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
      title="All Users"
      columns={columns}
      loadRows={() => usersCrud.load({ orderBy: 'id', ascending: true })}
      createRow={usersCrud.create}
      updateRow={usersCrud.update}
      deleteRows={usersCrud.remove}
      buildNewRow={buildNewUser}
      getRowKey={(r) => r.id}
      validate={validateUser}
      pageSize={20}
    />
  );
}