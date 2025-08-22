import React, { useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import CrudGrid from '../../components/grids/CrudGrid';

/** ---------- helpers & validation ---------- */
function sanitizeITS(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 8);
}

function validateUser(row) {
  const its = sanitizeITS(row.its_number);
  if (its.length !== 8) return false;
  if (!['user', 'admin', 'scanner', 'reporting'].includes(row.role || 'user')) return false;
  return true;
}

function buildNewUser() {
  return { its_number: '', role: 'user', email: '' };
}

/** ---------- Supabase adapters ---------- */
async function loadUsers() {
  const { data, error } = await supabase.from('users').select('*').order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}
async function createUser(row) {
  const payload = {
    its_number: sanitizeITS(row.its_number),
    role: row.role || 'user',
    email: row.email || null,
  };
  if (!payload.its_number || payload.its_number.length !== 8) {
    throw new Error('ITS must be 8 digits.');
  }
  const { data, error } = await supabase.from('users').insert(payload).select().single();
  if (error) throw error;
  return data;
}
async function updateUser(row) {
  const payload = {
    its_number: sanitizeITS(row.its_number),
    role: row.role || 'user',
    email: row.email || null,
  };
  const { error } = await supabase.from('users').update(payload).eq('id', row.id);
  if (error) throw error;
}
async function deleteUsers(rows) {
  const ids = rows.map(r => r.id);
  const { error } = await supabase.from('users').delete().in('id', ids);
  if (error) throw error;
}

/** ---------- Page wired to CrudGrid ---------- */
export default function UsersPage() {
  const gridApiRef = useRef(null);

  const columns = useMemo(() => ([
    { field: 'id', hide: true },
    {
      headerName: 'ITS',
      field: 'its_number',
      editable: true,
      width: 160,
      valueSetter: p => { p.data.its_number = sanitizeITS(p.newValue); return true; },
      cellClassRules: {
        'ag-cell-invalid': params => sanitizeITS(params.value).length !== 8
      }
    },
    {
      headerName: 'Role',
      field: 'role',
      editable: true,
      width: 180,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['user', 'admin', 'scanner', 'reporting'] }
    },
    {
      headerName: 'Email',
      field: 'email',
      editable: true,
      flex: 1,
      minWidth: 260
    }
  ]), []);

  return (
    <CrudGrid
      ref={gridApiRef}
      title="All Users"
      columns={columns}
      loadRows={loadUsers}
      createRow={createUser}
      updateRow={updateUser}
      deleteRows={deleteUsers}
      buildNewRow={buildNewUser}
      getRowKey={(r) => r.id}
      validate={validateUser}
      pageSize={20}
    />
  );
}