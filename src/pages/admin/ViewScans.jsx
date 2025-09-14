// src/pages/admin/ViewScans.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CrudGrid from '../../components/grids/CrudGrid';
import { db } from '../../libs';
import { supabase } from '../../supabaseClient';

const SCHEMA = process.env.REACT_APP_SUPABASE_DB || 'public';
const TABLE = 'scans';

function formatDubaiTime(isoString) {
    if (!isoString) return '';
    try {
        const dt = new Date(isoString);
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Dubai',
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).format(dt);
    } catch {
        return isoString;
    }
}

/** Build and keep lookup maps used in value formatters */
function useScanLookups() {
    const [eventTitles, setEventTitles] = useState(() => new Map());       // event_id -> title
    const [locations, setLocations] = useState(() => new Map());           // location_id -> name
    const [gateNameByEEP, setGateNameByEEP] = useState(() => new Map());   // event_entry_point_id -> entry_points.name
    const [elMap, setElMap] = useState(() => new Map());                   // event_location_id -> { location_id, event_date, start_time, end_time }
    const [dumpNameByDetail, setDumpNameByDetail] = useState(() => new Map()); // dump_detail_id -> dump_header.name

    const load = useCallback(async () => {
        const [
            { data: ev },   // events
            { data: loc },  // locations
            { data: eps },  // entry_points (id,name)
            { data: eep },  // event_entry_points (id, entry_point_id)
            { data: els },  // event_locations
            { data: dds },  // dump_detail (id, dump_header_id)
            { data: dhs },  // dump_header (id, name)
        ] = await Promise.all([
            supabase.schema(SCHEMA).from('events').select('id,title'),
            supabase.schema(SCHEMA).from('locations').select('id,name'),
            supabase.schema(SCHEMA).from('entry_points').select('id,name'),
            supabase.schema(SCHEMA).from('event_entry_points').select('id,entry_point_id'),
            supabase.schema(SCHEMA).from('event_locations').select('id,location_id,event_date,start_time,end_time'),
            supabase.schema(SCHEMA).from('dump_detail').select('id,dump_header_id'),
            supabase.schema(SCHEMA).from('dump_header').select('id,name'),
        ]);

        // Maps
        const epName = new Map((eps || []).map(r => [r.id, r.name || `Gate ${r.id}`]));
        setGateNameByEEP(new Map((eep || []).map(r => [r.id, epName.get(r.entry_point_id) || `Gate ${r.entry_point_id}`])));

        const headerName = new Map((dhs || []).map(r => [r.id, r.name || `Dump ${r.id}`]));
        setDumpNameByDetail(new Map((dds || []).map(r => [r.id, headerName.get(r.dump_header_id) || `Dump ${r.dump_header_id}`])));

        setEventTitles(new Map((ev || []).map(r => [r.id, r.title || `Event #${r.id}`])));
        setLocations(new Map((loc || []).map(r => [r.id, r.name || `Location #${r.id}`])));
        setElMap(new Map((els || []).map(r => [r.id, {
            location_id: r.location_id,
            event_date: r.event_date,
            start_time: r.start_time,
            end_time: r.end_time
        }])));
    }, []);

    useEffect(() => { load(); }, [load]);

    return { eventTitles, locations, gateNameByEEP, elMap, dumpNameByDetail, reload: load };
}

const scansCrud = db.makeCrud({
    schema: SCHEMA,
    table: TABLE,
    pk: 'id',
    select:
        'id,event_id,event_location_id,event_entry_point_id,dump_detail_id,device_details,its_number,is_valid,repeated_entry,scanned_at,created_at,updated_at,deleted_at',
});

export default function ViewScans() {
    const gridRef = useRef(null);
    const [quickFilter, setQuickFilter] = useState('');

    const { eventTitles, locations, gateNameByEEP, elMap, dumpNameByDetail, reload } = useScanLookups();

    const loadRows = useCallback(async () => {
        await reload();
        return scansCrud.load({ orderBy: 'scanned_at', ascending: false });
    }, [reload]);

    const yesNo = (b) => (b ? 'Yes' : 'No');

    const columns = useMemo(() => {
        return [
            { field: 'id', headerName: 'ID', width: 110, hide: true },
            { field: 'its_number', headerName: 'ITS', width: 140 },
            {
                headerName: 'Valid',
                field: 'is_valid',
                width: 110,
                valueFormatter: (p) => yesNo(!!p.value),
            },
            {
                headerName: 'Repeated Entry',
                field: 'repeated_entry',
                width: 150,
                valueFormatter: (p) => yesNo(!!p.value),
            },
            {
                headerName: 'Scanned At',
                field: 'scanned_at',
                minWidth: 210,
                valueFormatter: (p) => formatDubaiTime(p.value),
            },
            {
                headerName: 'Event',
                field: 'event_id',
                minWidth: 220,
                valueFormatter: (p) => (p.value ? (eventTitles.get(Number(p.value)) || `Event #${p.value}`) : ''),
                tooltipValueGetter: (p) => (p.value ? (eventTitles.get(Number(p.value)) || `Event #${p.value}`) : ''),
            },
            {
                headerName: 'Location',
                field: 'event_location_id',
                minWidth: 200,
                valueFormatter: (p) => {
                    const el = elMap.get(Number(p.value));
                    if (!el) return '';
                    const locName = locations.get(Number(el.location_id)) || `Location #${el.location_id}`;
                    return locName;
                },
            },
            {
                headerName: 'Date',
                field: 'event_location_id',
                width: 130,
                valueFormatter: (p) => {
                    const el = elMap.get(Number(p.value));
                    if (!el?.event_date) return '';
                    try {
                        return new Date(el.event_date).toLocaleDateString('en-GB');
                    } catch {
                        return String(el.event_date).slice(0, 10);
                    }
                },
            },
            {
                headerName: 'From',
                field: 'event_location_id',
                width: 110,
                valueFormatter: (p) => {
                    const t = elMap.get(Number(p.value))?.start_time;
                    return t ? String(t).slice(0, 5) : '';
                },
            },
            {
                headerName: 'To',
                field: 'event_location_id',
                width: 110,
                valueFormatter: (p) => {
                    const t = elMap.get(Number(p.value))?.end_time;
                    return t ? String(t).slice(0, 5) : '';
                },
            },
            {
                headerName: 'Gate',
                field: 'event_entry_point_id',
                minWidth: 180,
                valueFormatter: (p) => (p.value ? (gateNameByEEP.get(Number(p.value)) || '') : ''),
            },
            {
                headerName: 'Dump File',
                field: 'dump_detail_id',
                minWidth: 220,
                valueFormatter: (p) => (p.value ? (dumpNameByDetail.get(Number(p.value)) || '') : ''),
            },
            {
                headerName: 'Device',
                field: 'device_details',
                flex: 1,
                minWidth: 260,
                valueFormatter: (p) => {
                    if (!p.value) return '';
                    try {
                        const s = JSON.stringify(p.value);
                        return s.length > 140 ? s.slice(0, 140) + '…' : s;
                    } catch {
                        return String(p.value);
                    }
                },
                tooltipValueGetter: (p) => {
                    if (!p.value) return '';
                    try { return JSON.stringify(p.value); } catch { return String(p.value); }
                },
            },
            {
                headerName: 'Created',
                field: 'created_at',
                minWidth: 210,
                valueFormatter: (p) => formatDubaiTime(p.value),
                hide: true
            },
            {
                headerName: 'Updated',
                field: 'updated_at',
                minWidth: 210,
                valueFormatter: (p) => formatDubaiTime(p.value),
                hide: true
            },
        ];
    }, [eventTitles, locations, gateNameByEEP, elMap, dumpNameByDetail]);

    // toolbar styles
    const headerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' };
    const rightControls = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' };
    const btn = (bg = '#006400') => ({ background: bg, color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer' });
    const ghostBtn = { background: '#fff', color: '#1C1C1C', border: '1px solid #DDD', padding: '10px 14px', borderRadius: 12, fontWeight: 700, cursor: 'pointer' };
    const input = { height: 40, borderRadius: 12, border: '1px solid #DDD', outline: 'none', padding: '0 12px', background: '#fff', minWidth: 220 };

    const onRefresh = useCallback(() => gridRef.current?.refresh?.(), []);
    const onFilterChange = (v) => {
        setQuickFilter(v);
        gridRef.current?.setQuickFilter?.(v);
    };
    const exportCsv = useCallback(() => {
        const fileName = 'scans_' + new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19) + '.csv';
        gridRef.current?.exportCsv?.({
            fileName,
            processCellCallback: (params) => {
                const id = params.column.getColId();
                if (id === 'scanned_at' || id === 'created_at' || id === 'updated_at') {
                    return formatDubaiTime(params.value);
                }
                if (id === 'event_id') return eventTitles.get(Number(params.value)) || params.value || '';
                if (id === 'event_entry_point_id') return gateNameByEEP.get(Number(params.value)) || '';
                if (id === 'dump_detail_id') return dumpNameByDetail.get(Number(params.value)) || '';
                if (id === 'event_location_id') {
                    const el = elMap.get(Number(params.value));
                    if (!el) return '';
                    return locations.get(Number(el.location_id)) || el.location_id || '';
                }
                if (id === 'device_details') {
                    try { return JSON.stringify(params.value) } catch { return String(params.value ?? '') }
                }
                if (id === 'is_valid' || id === 'repeated_entry') return yesNo(!!params.value);
                return params.value ?? '';
            },
        });
    }, [eventTitles, gateNameByEEP, dumpNameByDetail, elMap, locations]);

    return (
        <div>
            <div style={headerStyle}>
                <h2 style={{ margin: 0 }}>Scans (Read-only)</h2>
                <div style={rightControls}>
                    <input
                        placeholder="Quick filter…"
                        value={quickFilter}
                        onChange={(e) => onFilterChange(e.target.value)}
                        style={input}
                    />
                    <button onClick={onRefresh} style={ghostBtn}>Refresh</button>
                    <button onClick={exportCsv} style={btn()}>Export CSV</button>
                </div>
            </div>

            <CrudGrid
                ref={gridRef}
                title=""
                columns={columns}
                loadRows={() => scansCrud.load({ orderBy: 'scanned_at', ascending: false })}
                readOnly
                showActions={false}
                showAddButton={false}
                showRefreshButton={false}
                pageSize={50}
            />
        </div>
    );
}