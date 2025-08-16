import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { supabase } from '../../supabaseClient';

export default function UsersGridSimple() {
  const gridRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('users').select('*').order('id', { ascending: true });
    if (error) alert(error.message);
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onRowValueChanged = async (e) => {
    const r = e.data;
    const payload = {
      its_number: String(r.its_number || '').replace(/\D/g, '').slice(0, 8),
      role: r.role || 'user',
      email: r.email || null,
    };
    const { error } = await supabase.from('users').update(payload).eq('id', r.id);
    if (error) { alert('Save failed: ' + error.message); load(); }
  };

  const deleteSelected = async () => {
    const sel = gridRef.current.api.getSelectedRows();
    if (!sel.length) return;
    if (!window.confirm(`Delete ${sel.length} user(s)?`)) return;
    const ids = sel.map(r => r.id);
    const { error } = await supabase.from('users').delete().in('id', ids);
    if (error) return alert(error.message);
    setRows(prev => prev.filter(r => !ids.includes(r.id)));
  };

  const [newIts, setNewIts] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newEmail, setNewEmail] = useState('');
  const addUser = async () => {
    const its = String(newIts || '').replace(/\D/g, '').slice(0, 8);
    if (!its) return alert('ITS (8 digits) required');
    const { error } = await supabase.from('users').insert({ its_number: its, role: newRole, email: newEmail || null });
    if (error) return alert(error.message);
    setNewIts(''); setNewRole('user'); setNewEmail('');
    load();
  };

  const columnDefs = useMemo(() => [
    { field: 'id', hide: true },
    {
      headerName: 'ITS', field: 'its_number', editable: true, width: 140,
      valueSetter: p => { p.data.its_number = String(p.newValue || '').replace(/\D/g, '').slice(0, 8); return true; }
    },
    {
      headerName: 'Role', field: 'role', editable: true, width: 140,
      cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['user', 'admin'] }
    },
    { headerName: 'Email', field: 'email', editable: true, flex: 1, minWidth: 220 },
    {
      headerName: '', width: 110, sortable: false, filter: false,
      cellRenderer: p => <button onClick={() => supabase.from('users').delete().eq('id', p.data.id).then(load)} style={btn('#8B0000')}>Delete</button>
    },
  ], []);

  return (
    <div>
      {/* toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <input placeholder="ITS" value={newIts} onChange={e=>setNewIts(e.target.value)} style={inp()} maxLength={8}/>
        <select value={newRole} onChange={e=>setNewRole(e.target.value)} style={inp()}>
          <option value="user">user</option><option value="admin">admin</option>
        </select>
        <input placeholder="Email (optional)" value={newEmail} onChange={e=>setNewEmail(e.target.value)} style={{...inp(), minWidth:220}}/>
        <button onClick={addUser} style={btn()}>Add</button>
        <button onClick={deleteSelected} style={btn('#8B0000')}>Delete Selected</button>
        <button onClick={load} style={btn('#1C1C1C')}>Refresh</button>
      </div>

      <div className="ag-theme-quartz" style={{ height: 520, width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          editType="fullRow"
          onRowValueChanged={onRowValueChanged}
          rowSelection="multiple"
          pagination
          paginationPageSize={20}
        />
      </div>
      {loading && <div style={{ marginTop: 6, fontWeight: 800 }}>Loading…</div>}
    </div>
  );
}

const btn = (bg = '#006400') => ({ background: bg, color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer' });
const inp = () => ({ height: 40, borderRadius: 12, border: 'none', outline: 'none', padding: '0 12px', background: '#fff' });