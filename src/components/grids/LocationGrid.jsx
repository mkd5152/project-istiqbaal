import React, { useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import CrudGrid from './CrudGrid';

/** ---------- helpers & validation ---------- */
function sanitizeName(v) {
    // collapse whitespace, trim, cap at 120 chars
    return String(v ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
}
function validateLocation(row) {
    const name = sanitizeName(row.name);
    return name.length > 0;
}
function buildNewLocation() {
    return { name: '', description: '' };
}

/** ---------- Supabase adapters ---------- */
async function loadLocations() {
    const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('id', { ascending: true });
    if (error) throw error;
    return data || [];
}

async function createLocation(row) {
    const payload = {
        name: sanitizeName(row.name),
        description: row.description ? String(row.description) : null,
    };
    if (!validateLocation(payload)) {
        throw new Error('Please enter a Location Name.');
    }
    const { data, error } = await supabase
        .from('locations')
        .insert(payload)
        .select()
        .single();
    if (error) {
        if (error.code === '23505') throw new Error('Location name already exists.');
        throw error;
    }
    return data;
}

async function updateLocation(row) {
    const payload = {
        name: sanitizeName(row.name),
        description: row.description ? String(row.description) : null,
    };
    if (!validateLocation(payload)) {
        throw new Error('Please enter a Location Name.');
    }
    const { data, error } = await supabase
        .from('locations')
        .update(payload)
        .eq('id', row.id)
        .select()
        .single();
    if (error) {
        if (error.code === '23505') throw new Error('Location name already exists.');
        throw error;
    }
    return data;
}

async function deleteLocations(rows) {
    const ids = rows.map((r) => r.id);
    const { error } = await supabase.from('locations').delete().in('id', ids);
    if (error) throw error;
}

/** ---------- Page wired to CrudGrid ---------- */
export default function LocationGrid() {
    const gridRef = useRef(null);

    const columns = useMemo(
        () => [
            { field: 'id', hide: true },

            {
                headerName: 'Name',
                field: 'name',
                editable: true,
                flex: 1,
                minWidth: 260,
                valueSetter: (p) => {
                    p.data.name = sanitizeName(p.newValue);
                    return true;
                },
                cellClassRules: {
                    'ag-cell-invalid': (params) => !sanitizeName(params.value),
                },
                tooltipValueGetter: () => 'Required. Up to 120 characters.',
            },

            {
                headerName: 'Description',
                field: 'description',
                editable: true,
                flex: 1,
                minWidth: 320,
            },

            {
                headerName: 'Created',
                field: 'created_at',
                editable: false,
                width: 210,
                valueFormatter: (p) =>
                    p.value
                        ? new Date(p.value).toLocaleString('en-GB', {
                            timeZone: 'Asia/Dubai',
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
            loadRows={loadLocations}
            createRow={createLocation}
            updateRow={updateLocation}
            deleteRows={deleteLocations}
            buildNewRow={buildNewLocation}
            getRowKey={(r) => r.id}
            validate={validateLocation}
            pageSize={20}
        />
    );
}