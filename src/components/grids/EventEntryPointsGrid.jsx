import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import CrudGrid from './CrudGrid';

const LOOKUP_TABLE = 'locations';

/** ---------- helpers & validation ---------- */
function sanitizeName(v) {
  return String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
function validateEntryPoint(row) {
  const name = sanitizeName(row.name);
  const locId = Number(row.location_id);
  return name.length > 0 && Number.isFinite(locId) && locId > 0;
}
function buildNewEntryPoint() {
  return { name: '', location_id: '' };
}

/** ---------- Supabase adapters ---------- */
async function loadEntryPoints() {
  const { data, error } = await supabase
    .from('entry_points')
    .select('id,name,location_id')
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function createEntryPoint(row) {
  const payload = {
    name: sanitizeName(row.name),
    location_id: Number(row.location_id) || null,
  };
  if (!validateEntryPoint(payload)) {
    throw new Error('Please enter a Name and choose a Location.');
  }
  const { data, error } = await supabase
    .from('entry_points')
    .insert(payload)
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Entry point name already exists.');
    throw error;
  }
  return data;
}

async function updateEntryPoint(row) {
  const payload = {
    name: sanitizeName(row.name),
    location_id: Number(row.location_id) || null,
  };
  if (!validateEntryPoint(payload)) {
    throw new Error('Please enter a Name and choose a Location.');
  }
  const { data, error } = await supabase
    .from('entry_points')
    .update(payload)
    .eq('id', row.id)
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Entry point name already exists.');
    throw error;
  }
  return data;
}

async function deleteEntryPoints(rows) {
  const ids = rows.map((r) => r.id);
  const { error } = await supabase.from('entry_points').delete().in('id', ids);
  if (error) throw error;
}

/** ---------- Page wired to CrudGrid ---------- */
export default function EventEntryPointsGrid() {
  const gridRef = useRef(null);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from(LOOKUP_TABLE)
        .select('id,name')
        .order('name', { ascending: true });
      if (error) {
        console.error('Load locations error:', error);
        alert('Failed to load locations');
        return;
      }
      setLocations(data || []);
    })();
  }, []);

  const locById = useMemo(() => {
    const m = new Map();
    for (const l of locations) m.set(l.id, l.name);
    return m;
  }, [locations]);

  const idByName = useMemo(() => {
    const m = new Map();
    for (const l of locations) m.set(l.name, l.id);
    return m;
  }, [locations]);

  const locationNames = useMemo(() => locations.map((l) => l.name), [locations]);

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
        headerName: 'Location',
        field: 'location_id',
        editable: true,
        width: 260,
        valueGetter: (p) => (p.data?.location_id ? locById.get(p.data.location_id) || '' : ''),
        valueSetter: (p) => {
          const chosenName = String(p.newValue || '');
          const id = idByName.get(chosenName);
          if (id) {
            p.data.location_id = id;
            return true;
          }
          return false;
        },
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: locationNames },
        cellClassRules: {
          'ag-cell-invalid': (params) => {
            const hasId = Number(params.data?.location_id) > 0;
            const validName = idByName.has(String(params.value || ''));
            return !hasId && !validName;
          },
        },
        tooltipValueGetter: () => 'Pick a location.',
      },
    ],
    [locById, idByName, locationNames]
  );

  return (
    <CrudGrid
      ref={gridRef}
      title="Entry Points"
      columns={columns}
      loadRows={loadEntryPoints}
      createRow={createEntryPoint}
      updateRow={updateEntryPoint}
      deleteRows={deleteEntryPoints}
      buildNewRow={buildNewEntryPoint}
      getRowKey={(r) => r.id}
      validate={validateEntryPoint}
      pageSize={20}
    />
  );
}