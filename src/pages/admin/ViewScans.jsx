import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { supabase } from '../../supabaseClient';

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

export default function ViewScans() {
    const gridRef = useRef(null);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [quickFilter, setQuickFilter] = useState('');

    const load = useCallback(async () => {
        try {
            setLoading(true);
            gridRef.current?.api?.showLoadingOverlay?.();
            const { data, error } = await supabase
                .from('scans')
                .select('id, its_number, scanned_at')
                .order('scanned_at', { ascending: false });
            if (error) throw error;
            setRows(data || []);
            gridRef.current?.api?.hideOverlay?.();
        } catch (e) {
            alert(e.message || 'Failed to load scans');
            gridRef.current?.api?.hideOverlay?.();
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const exportCsv = useCallback(() => {
        const fileName =
            'scans_' +
            new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19) +
            '.csv';
        gridRef.current?.api?.exportDataAsCsv({
            fileName,
            // Use the formatted values (so scanned_at is pretty in the CSV)
            processCellCallback: (params) => {
                if (params.column.getColId() === 'scanned_at') {
                    return formatDubaiTime(params.value);
                }
                return params.value ?? '';
            },
        });
    }, []);

    const columns = useMemo(
        () => [
            { field: 'id', headerName: 'ID', width: 100, sortable: true, filter: 'agNumberColumnFilter' },
            { field: 'its_number', headerName: 'ITS', width: 260, sortable: true, filter: true },
            {
                field: 'scanned_at',
                headerName: 'Scanned At',
                flex: 1,
                minWidth: 100,
                sortable: true,
                filter: true, // keep simple text filter; CSV uses our formatter
                valueFormatter: (p) => formatDubaiTime(p.value),
            },
        ],
        []
    );

    const headerStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        gap: 8,
        flexWrap: 'wrap',
    };
    const rightControls = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' };
    const btn = (bg = '#006400') => ({
        background: bg,
        color: '#fff',
        border: 'none',
        padding: '10px 14px',
        borderRadius: 12,
        fontWeight: 800,
        cursor: 'pointer',
    });
    const ghostBtn = {
        background: '#fff',
        color: '#1C1C1C',
        border: '1px solid #DDD',
        padding: '10px 14px',
        borderRadius: 12,
        fontWeight: 700,
        cursor: 'pointer',
    };
    const input = {
        height: 40,
        borderRadius: 12,
        border: '1px solid #DDD',
        outline: 'none',
        padding: '0 12px',
        background: '#fff',
        minWidth: 220,
    };

    return (
        <div>
            {/* Header / toolbar */}
            <div style={headerStyle}>
                <h2 style={{ margin: 0 }}>Scans (Read-only)</h2>
                <div style={rightControls}>
                    <input
                        placeholder="Quick filter…"
                        value={quickFilter}
                        onChange={(e) => {
                            setQuickFilter(e.target.value);
                            gridRef.current?.api?.setGridOption?.('quickFilterText', e.target.value);
                        }}
                        style={input}
                    />
                    <button onClick={load} style={ghostBtn}>Refresh</button>
                    <button onClick={exportCsv} style={btn()}>Export CSV</button>
                </div>
            </div>

            {/* Grid */}
            <div className="ag-theme-quartz" style={{ height: 560, width: '100%' }}>
                <AgGridReact
                    ref={gridRef}
                    rowData={rows}
                    columnDefs={columns}
                    defaultColDef={{ sortable: true, filter: true, resizable: true }}
                    getRowId={(p) => String(p.data.id)}
                    // Read-only: no editing APIs wired
                    rowSelection="multiple"
                    pagination
                    paginationPageSize={50}
                    overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Loading…</span>'}
                    overlayNoRowsTemplate={'<span class="ag-overlay-no-rows-center">No scans found</span>'}
                />
            </div>

            {loading && <div style={{ marginTop: 6, fontWeight: 800 }}>Loading…</div>}
        </div>
    );
}