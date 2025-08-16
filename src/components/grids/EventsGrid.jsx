import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { supabase } from '../../supabaseClient';

const EVENT_TYPES = ['Lecture','Prayer','Majlis','Dinner','Workshop','Volunteer Drive','Other'];

export default function EventsGrid() {
  const gridRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const btnBase = { background:'#006400', color:'#fff', border:'none', padding:'10px 14px', borderRadius:12, fontWeight:800, cursor:'pointer' };
  const btnDanger = { ...btnBase, background:'#8B0000' };
  const btnDark = { ...btnBase, background:'#1C1C1C' };

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: ev, error: e1 }, { data: locs, error: e2 }] = await Promise.all([
      supabase.from('events').select('*').order('id', { ascending: true }),
      supabase.from('locations').select('id,name').order('name', { ascending: true })
    ]);
    if (e1) console.error('events load error:', e1);
    if (e2) console.error('locations load error:', e2);
    setRows(ev || []);
    setLocations(locs || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const idToLocation = useMemo(() => {
    const map = new Map();
    locations.forEach(l => map.set(l.id, l.name));
    return map;
  }, [locations]);

  const onRowValueChanged = async (e) => {
    const r = e.data;
    const payload = {
      title: r.title || null,
      type: r.type || null,
      date: r.date || null,
      start_time: r.start_time || null,
      end_time: r.end_time || null,
      location_id: r.location_id ? Number(r.location_id) : null,
      jaman_needed: !!r.jaman_needed,
      print_needed: !!r.print_needed,
      description: r.description || null,
    };
    const { error } = await supabase.from('events').update(payload).eq('id', r.id);
    if (error) { alert('Save failed: ' + error.message); await fetchAll(); }
  };

  const deleteRows = async (list) => {
    if (!list?.length) return;
    if (!window.confirm(`Delete ${list.length} event(s)?`)) return;
    const ids = list.map(r => r.id);
    const { error } = await supabase.from('events').delete().in('id', ids);
    if (error) { alert('Delete failed: ' + error.message); return; }
    setRows(prev => prev.filter(r => !ids.includes(r.id)));
  };

  const onDeleteSelected = () => {
    const selected = gridRef.current.api.getSelectedRows();
    deleteRows(selected);
  };

  // Simple input validators
  const onlyDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const onlyTime = (v) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);

  const columnDefs = useMemo(() => [
    { field:'id', hide:true },
    { headerName:'Title', field:'title', editable:true, flex:1, minWidth:180 },
    {
      headerName:'Type', field:'type', editable:true, width:170,
      cellEditor:'agSelectCellEditor', cellEditorParams:{ values: EVENT_TYPES }
    },
    {
      headerName:'Date', field:'date', editable:true, width:140,
      valueSetter: (p) => { const v = String(p.newValue || '').slice(0,10); if (v && !onlyDate(v)) return false; p.data.date=v; return true; }
    },
    {
      headerName:'From', field:'start_time', editable:true, width:120,
      valueSetter: (p) => { const v = String(p.newValue || '').slice(0,5); if (v && !onlyTime(v)) return false; p.data.start_time=v; return true; }
    },
    {
      headerName:'To', field:'end_time', editable:true, width:120,
      valueSetter: (p) => { const v = String(p.newValue || '').slice(0,5); if (v && !onlyTime(v)) return false; p.data.end_time=v; return true; }
    },
    {
      headerName:'Location', field:'location_id', editable:true, width:200,
      cellEditor:'agSelectCellEditor',
      cellEditorParams:{ values: locations.map(l => String(l.id)) },
      valueFormatter: (p) => idToLocation.get(Number(p.value)) || ''
    },
    { headerName:'Jaman?', field:'jaman_needed', editable:true, width:120, cellEditor:'agSelectCellEditor', cellEditorParams:{ values:['true','false'] },
      valueGetter: p => !!p.data.jaman_needed, valueSetter: p => { p.data.jaman_needed = String(p.newValue) === 'true'; return true; } },
    { headerName:'Print?', field:'print_needed', editable:true, width:120, cellEditor:'agSelectCellEditor', cellEditorParams:{ values:['true','false'] },
      valueGetter: p => !!p.data.print_needed, valueSetter: p => { p.data.print_needed = String(p.newValue) === 'true'; return true; } },
    { headerName:'', field:'actions', width:120, editable:false, sortable:false, filter:false,
      cellRenderer: (p) => (<button style={btnDanger} onClick={() => deleteRows([p.data])}>Delete</button>) },
  ], [btnDanger, locations, idToLocation]);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginBottom:12, flexWrap:'wrap' }}>
        <button style={btnDanger} onClick={onDeleteSelected}>Delete Selected</button>
        <button style={btnDark} onClick={fetchAll}>Refresh</button>
      </div>

      {/* Grid */}
      <div className="ag-theme-quartz" style={{ height: 520, width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ sortable:true, filter:true, resizable:true }}
          editType="fullRow"
          onRowValueChanged={onRowValueChanged}
          rowSelection="multiple"
          animateRows
          pagination
          paginationPageSize={20}
        />
      </div>

      {loading && <div style={{ marginTop:8, fontWeight:800 }}>Loading…</div>}
    </div>
  );
}