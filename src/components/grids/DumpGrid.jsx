// src/components/grids/DumpGrid.jsx
import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';

import CrudGrid from './CrudGrid';
import { supabase } from '../../supabaseClient';
import { db, sanitize } from '../../libs';

// --- constants ---
const SCHEMA = process.env.REACT_APP_SUPABASE_DB; // e.g. "itsscanning"
const DH_TABLE = 'dump_header';
const DD_TABLE = 'dump_detail';

// --- styles (compact, consistent with your theme) ---
const wrap = { display: 'grid', gap: 16 };
const card = {
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 4px 16px rgba(0,0,0,.06)',
  border: '1px solid rgba(0,0,0,.06)',
  padding: 16,
};
const title = { margin: 0, fontSize: 18, fontWeight: 800 };
const row = { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' };
const lab = { fontWeight: 700, minWidth: 110 };
const sel = {
  height: 42,
  borderRadius: 10,
  border: '1px solid #E2E8F0',
  padding: '0 12px',
  fontWeight: 600,
  background: '#fff',
};
const inp = {
  height: 42,
  borderRadius: 10,
  border: '1px solid #E2E8F0',
  padding: '0 12px',
  background: '#fff',
};
const primary = {
  height: 44,
  padding: '0 16px',
  borderRadius: 12,
  border: 'none',
  background: '#0B7A0B',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
};
const ghost = {
  height: 44,
  padding: '0 16px',
  borderRadius: 12,
  border: '1px solid #E2E8F0',
  background: '#fff',
  color: '#1C1C1C',
  fontWeight: 800,
  cursor: 'pointer',
};
const badge = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 999,
  background: '#f6faf7',
  border: '1px solid #E2E8F0',
  fontSize: 12,
  fontWeight: 700,
};

// ---------- helpers: parsing & validation ----------
const toISODate = (d) =>
  new Date(d).toISOString().slice(0, 10); // YYYY-MM-DD

function parseExcelDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    // Excel serial -> JS date (UTC-ish)
    // 25569 = days between 1899-12-30 and 1970-01-01
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return sanitize.sanitizeDate(toISODate(new Date(ms))); // validates/normalizes
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return sanitize.sanitizeDate(s); // already ISO
  // Try DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (m) {
    const [ , dd, mm, yyyy ] = m;
    const iso = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
    return sanitize.sanitizeDate(iso);
  }
  return null;
}

function normalizeHeaderKey(k) {
  return String(k || '')
    .toLowerCase()
    .replace(/[\s.-]+/g, '_')
    .trim();
}

/**
 * Accepts ITS-only sheet (one column) or a sheet with headers:
 * its / its_number, name, dob, jamaat, photo (case-insensitive; spaces/dashes OK)
 */
function parseSheetToRecords(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const results = [];
  const errors = [];
  const dedup = new Map(); // its -> true

  // Heuristic: detect if first row has only 1 key & it looks like ITS list
  const first = rows[0] || {};
  const keys = Object.keys(first);
  const singleITSMode =
    keys.length === 1 &&
    /^\D*its/i.test(keys[0] || '') && // header contains "its"
    true;

  for (let i = 0; i < rows.length; i++) {
    let rec = rows[i];
    let its = '';
    let name = null;
    let dob = null;
    let jamaat = null;
    let photo = null;

    if (singleITSMode) {
      its = sanitize.sanitizeITS(rec[keys[0]]);
    } else {
      // normalize keys
      const norm = {};
      for (const k of Object.keys(rec)) norm[normalizeHeaderKey(k)] = rec[k];

      its = sanitize.sanitizeITS(norm.its_number ?? norm.its ?? norm['its id'] ?? norm['its_no']);
      name = sanitize.sanitizeName(norm.name);
      dob = parseExcelDate(norm.dob);
      jamaat = sanitize.nullIfEmpty(norm.jamaat);
      photo = sanitize.nullIfEmpty(norm.photo);
    }

    if (!its || its.length !== 8) {
      errors.push(`Row ${i + 2}: invalid ITS "${rec[keys[0]] ?? rec.its ?? ''}"`);
      continue;
    }

    if (dedup.has(its)) continue; // remove duplicates
    dedup.set(its, true);

    results.push({
      its_number: its,
      name: name || null,
      dob: dob || null,
      jamaat: jamaat || null,
      photo: photo || null,
    });
  }

  return { results, errors };
}

async function insertDetailsInChunks({ headerId, records, chunkSize = 500 }) {
  for (let i = 0; i < records.length; i += chunkSize) {
    const slice = records.slice(i, i + chunkSize).map((r) => ({
      dump_header_id: headerId,
      its_number: r.its_number,
      name: r.name ?? null,
      dob: r.dob ?? null,
      jamaat: r.jamaat ?? null,
      photo: r.photo ?? null,
    }));

    const { error } = await supabase
      .schema(SCHEMA)
      .from(DD_TABLE)
      .insert(slice, { defaultToNull: true });

    if (error) throw error;
  }
}

// ---------- Dump Header CRUD (grid) ----------
const sanitizeDHInsert = (row) => ({
  code: sanitize.sanitizeCode(row.code),
  name: sanitize.sanitizeName(row.name),
  description: sanitize.nullIfEmpty(row.description),
  event_id: null,       // generic
  location_id: null,    // generic
});

const sanitizeDHUpdate = (row) => ({
  id: row.id,
  code: sanitize.sanitizeCode(row.code),
  name: sanitize.sanitizeName(row.name),
  description: sanitize.nullIfEmpty(row.description),
});

const dhCrud = db.makeCrud({
  schema: SCHEMA,
  table: DH_TABLE,
  pk: 'id',
  select: 'id,code,name,description,event_id,location_id,created_at',
  sanitizeInsert: sanitizeDHInsert,
  sanitizeUpdate: sanitizeDHUpdate,
  validate: (row) => !!sanitize.sanitizeCode(row.code) && !!sanitize.sanitizeName(row.name),
});

function buildNewDH() {
  const now = new Date();
  const ymd = now.toISOString().slice(0,10).replace(/-/g,'');
  const hms = now.toTimeString().slice(0,8).replace(/:/g,'');
  return {
    code: `GEN-${ymd}-${hms}`,
    name: `Generic Dump ${now.toLocaleString()}`,
    description: '',
  };
}

// ================== COMPONENT ==================
export default function DumpGrid() {
  const gridRef = useRef(null);

  // uploader state
  const [dumpType, setDumpType] = useState('Generic');
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState({ ok: 0, bad: 0, errors: [], sample: [] });
  const [busy, setBusy] = useState(false);

  // parse selected file
  async function handleFileChange(e) {
    const f = e?.target?.files?.[0];
    if (!f) return;
    setFile(f);
    setParsed({ ok: 0, bad: 0, errors: [], sample: [] });

    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const { results, errors } = parseSheetToRecords(firstSheet);

      setParsed({
        ok: results.length,
        bad: errors.length,
        errors: errors.slice(0, 20), // show first 20 if many
        sample: results.slice(0, 5),
      });

      if (!results.length) {
        await Swal.fire({
          title: 'No valid rows found',
          text: errors.length ? 'Your sheet may be missing a valid ITS column.' : 'Please check your file.',
          icon: 'error',
        });
      }
    } catch (err) {
      console.error(err);
      await Swal.fire({
        title: 'Failed to read file',
        text: err.message || 'Unsupported or corrupted file.',
        icon: 'error',
      });
    }
  }

  // upload to DB
  async function handleCreateDump() {
    if (!file || parsed.ok === 0) {
      await Swal.fire({ title: 'Nothing to upload', text: 'Please pick a file first.', icon: 'info' });
      return;
    }
    if (dumpType !== 'Generic') {
      await Swal.fire({ title: 'Unsupported type (yet)', text: 'Only “Generic” is supported for now.', icon: 'info' });
      return;
    }

    const confirm = await Swal.fire({
      title: 'Create dump from file?',
      html: `
        <div style="text-align:left">
          <div><b>Type:</b> Generic</div>
          <div><b>File:</b> ${sanitize.sanitizeName(file.name, 120)}</div>
          <div><b>Valid rows:</b> ${parsed.ok}</div>
          ${parsed.bad ? `<div><b>Invalid rows:</b> ${parsed.bad}</div>` : ''}
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, import',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) return;

    try {
      setBusy(true);

      // Reparse to get the full result set (not just sample)
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const { results } = parseSheetToRecords(firstSheet);
      if (!results.length) throw new Error('No valid rows to import.');

      const now = new Date();
      const ymd = now.toISOString().slice(0,10).replace(/-/g,'');
      const hms = now.toTimeString().slice(0,8).replace(/:/g,'');
      const code = `GEN-${ymd}-${hms}`;
      const name = `Generic Dump ${now.toLocaleString()}`;
      const description = `Imported ${results.length} records from ${file.name}`;

      // 1) create dump_header
      const header = await db.insertRow({
        schema: SCHEMA,
        table: DH_TABLE,
        row: { code, name, description, event_id: null, location_id: null },
        select: 'id,code,name,created_at',
      });

      // 2) bulk insert details (chunked)
      await insertDetailsInChunks({ headerId: header.id, records: results, chunkSize: 500 });

      await Swal.fire({
        title: 'Import complete',
        html: `<div style="text-align:left">
                 <div><b>Dump Code:</b> ${header.code}</div>
                 <div><b>Records:</b> ${results.length}</div>
               </div>`,
        icon: 'success',
      });

      // reset UI & refresh grid
      setFile(null);
      setParsed({ ok: 0, bad: 0, errors: [], sample: [] });
      try { document.getElementById('dump-file-input').value = ''; } catch {}
      gridRef.current?.refresh?.();
    } catch (err) {
      console.error(err);
      await Swal.fire({
        title: 'Import failed',
        text: err.message || 'Please check the file and try again.',
        icon: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  // ---------- grid columns for dump_header ----------
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
        tooltipValueGetter: () => 'Unique. A–Z, 0–9, underscore.',
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
      },
      {
        headerName: 'Description',
        field: 'description',
        editable: true,
        flex: 1,
        minWidth: 280,
        valueSetter: (p) => {
          p.data.description = sanitize.nullIfEmpty(p.newValue);
          return true;
        },
      },
      {
        headerName: 'Created',
        field: 'created_at',
        editable: false,
        width: 200,
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

  // Forbid creating headers via grid (use the uploader)
  async function blockCreate() {
    throw new Error('Please use the uploader above to create a dump.');
  }

  return (
    <div style={wrap}>
      {/* ------------- Section 1: Uploader ------------- */}
      <div style={card}>
        <h3 style={title}>Upload Dump</h3>

        <div style={{ ...row, marginTop: 12 }}>
          <div style={lab}>Type</div>
          <select
            style={sel}
            value={dumpType}
            onChange={(e) => setDumpType(e.target.value)}
          >
            <option value="Generic">Generic</option>
            {/* future types here */}
          </select>
        </div>

        <div style={{ ...row, marginTop: 8 }}>
          <div style={lab}>File</div>
          <input
            id="dump-file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            style={inp}
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={handleCreateDump}
            disabled={!file || parsed.ok === 0 || busy}
            style={{ ...primary, opacity: !file || parsed.ok === 0 || busy ? 0.65 : 1 }}
            title={!file ? 'Select a file first' : parsed.ok === 0 ? 'No valid rows found' : 'Create dump'}
          >
            {busy ? 'Processing…' : 'Create Dump'}
          </button>
        </div>

        {/* quick stats */}
        <div style={{ ...row, marginTop: 8 }}>
          <span style={badge}>Valid: {parsed.ok}</span>
          <span style={badge}>Invalid: {parsed.bad}</span>
          {parsed.sample.length > 0 && (
            <span style={{ ...badge, background: '#eef6f1' }}>
              Sample ITS: {parsed.sample.map((r) => r.its_number).join(', ')}
            </span>
          )}
        </div>

        {/* show a few errors, if any */}
        {parsed.bad > 0 && (
          <div style={{ marginTop: 8, color: '#8B0000', fontWeight: 700 }}>
            {parsed.errors.map((e, i) => (
              <div key={i} style={{ fontSize: 12 }}>{e}</div>
            ))}
            {parsed.bad > parsed.errors.length && (
              <div style={{ fontSize: 12, opacity: .8 }}>
                …and {parsed.bad - parsed.errors.length} more
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------- Section 2: Grid (dump_header) ------------- */}
      <div style={card}>
        <CrudGrid
          ref={gridRef}
          title="Uploaded Dumps"
          columns={columns}
          loadRows={() => dhCrud.load({ orderBy: 'id', ascending: false })}
          createRow={blockCreate}           // discourage grid-based creation
          updateRow={dhCrud.update}
          deleteRows={dhCrud.remove}        // soft delete via your helper
          buildNewRow={buildNewDH}
          getRowKey={(r) => r.id}
          validate={(r) => !!sanitize.sanitizeCode(r.code) && !!sanitize.sanitizeName(r.name)}
          pageSize={20}
        />
      </div>
    </div>
  );
}