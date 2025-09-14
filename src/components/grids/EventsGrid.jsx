// src/pages/admin/EventsGrid.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CrudGrid from '../../components/grids/CrudGrid';
import { db } from '../../libs';
import { supabase } from '../../supabaseClient';
import { Link } from 'react-router-dom';

const SCHEMA = process.env.REACT_APP_SUPABASE_DB || 'public';
const TABLE = 'events';

function useEventTypeMap() {
  const [map, setMap] = useState(() => new Map());

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('event_types')
      .select('id,name')
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (!error && data) {
      setMap(new Map(data.map((r) => [r.id, r.name || `Type #${r.id}`])));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { map, reload: load };
}

const eventsCrud = db.makeCrud({
  schema: SCHEMA,
  table: TABLE,
  pk: 'id',
  select: 'id,event_type_id,title,description,jaman_included,require_print,created_by,created_at,deleted_at',
});

export default function EventsGrid() {
  const gridRef = useRef(null);
  const { map: typeMap, reload: reloadTypes } = useEventTypeMap();

  const loadRows = useCallback(async () => {
    const [rows] = await Promise.all([
      eventsCrud.load({ orderBy: 'id', ascending: true }),
      reloadTypes(),
    ]);
    return rows;
  }, [reloadTypes]);

  const yesNo = (b) => (b ? 'Yes' : 'No');

  const columns = useMemo(
    () => [
      { field: 'id', hide: true },
      { headerName: 'Title', field: 'title', flex: 1, minWidth: 220 },
      {
        headerName: 'Event Type',
        field: 'event_type_id',
        minWidth: 200,
        valueFormatter: (p) => (p.value ? typeMap.get(Number(p.value)) || `Type #${p.value}` : ''),
      },
      { headerName: 'Jaman Included', field: 'jaman_included', width: 160, valueFormatter: (p) => yesNo(!!p.value) },
      { headerName: 'Require Print', field: 'require_print', width: 150, valueFormatter: (p) => yesNo(!!p.value) },
      { headerName: 'Description', field: 'description', flex: 1.2, minWidth: 260, valueFormatter: (p) => (p.value ? String(p.value) : '') },
      { headerName: 'Created By', field: 'created_by', minWidth: 220, valueFormatter: (p) => (p.value ? String(p.value) : ''), tooltipValueGetter: (p) => (p.value ? String(p.value) : '') },
      {
        headerName: 'Created',
        field: 'created_at',
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
      {
        headerName: '',
        field: '__view',
        width: 120,
        minWidth: 110,
        maxWidth: 140,
        pinned: 'right',
        suppressMenu: true,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: (p) => {
          const id = p?.data?.id;
          const style = {
            background: '#1C1C1C',
            color: '#fff',
            border: 'none',
            padding: '8px 12px',
            borderRadius: 10,
            fontWeight: 800,
            cursor: 'pointer',
          };
          return (
            <Link to={`/admin/events/${id}`} title="View / Edit">
              <button style={style}>View</button>
            </Link>
          );
        },
      },
    ],
    [typeMap]
  );

  return (
    <CrudGrid
      ref={gridRef}
      title="All Events"
      columns={columns}
      loadRows={loadRows}
      readOnly
      showActions={false}
      showAddButton={false}
      showRefreshButton={true}
      pageSize={20}
    />
  );
}