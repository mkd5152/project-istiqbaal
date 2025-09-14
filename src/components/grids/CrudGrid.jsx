// src/components/grids/CrudGrid.jsx
import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle,
  useMemo, useRef, useState
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import CrudActionsRenderer from './CrudActionsRenderer';

/**
 * Generic CRUD Grid
 * Props:
 *  - columns, loadRows, createRow, updateRow, deleteRows
 *  - buildNewRow(): object
 *  - getRowKey(row): string|number
 *  - validate?(row): boolean
 *  - pageSize?: number
 *  - title?: string
 *  - readOnly?: boolean                // NEW: disables editing & actions
 *  - showAddButton?: boolean           // NEW: default true (ignored if readOnly)
 *  - showRefreshButton?: boolean       // NEW: default true
 *  - showActions?: boolean             // NEW: default true (ignored if readOnly)
 */
const CrudGrid = forwardRef(function CrudGrid(
  {
    columns,
    loadRows,
    createRow,
    updateRow,
    deleteRows,
    buildNewRow,
    getRowKey,
    validate,
    pageSize = 20,
    title,
    readOnly = false,
    showAddButton = true,
    showRefreshButton = true,
    showActions = true,
  },
  ref
) {
  const gridRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRowId, setEditingRowId] = useState(null);

  const rowKey = useCallback((r) => {
    if (r?.id != null) return String(r.id);
    if (r?.tempId) return r.tempId;
    return getRowKey ? String(getRowKey(r)) : JSON.stringify(r);
  }, [getRowKey]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      gridRef.current?.api?.showLoadingOverlay?.();
      const data = await loadRows();
      setRows(data || []);
      gridRef.current?.api?.hideOverlay?.();
    } catch (e) {
      alert(e.message || 'Failed to load data');
      gridRef.current?.api?.hideOverlay?.();
    } finally {
      setLoading(false);
    }
  }, [loadRows]);

  useEffect(() => { load(); }, [load]);

  useImperativeHandle(ref, () => ({
    addNewRow() {
      if (readOnly) return;
      const api = gridRef.current?.api;
      const tempId = 'new-' + Date.now();
      const blank = buildNewRow ? buildNewRow() : {};
      const newRow = { tempId, __isNew: true, ...blank };
      api.applyTransaction({ add: [newRow], addIndex: 0 });
      const firstEditable = columns.find(c => c.editable && !c.hide)?.field || columns[0]?.field;
      setEditingRowId(tempId);
      setTimeout(() => api.startEditingCell({ rowIndex: 0, colKey: firstEditable }), 0);
    },
    refresh() { load(); },
    /** Export the current grid as CSV. Pass ag-Grid CSV options if needed. */
    exportCsv(opts) {
      gridRef.current?.api?.exportDataAsCsv?.(opts || {});
    },
  }), [buildNewRow, columns, load, readOnly]);

  const onEdit = useCallback((row) => {
    if (readOnly) return;
    const id = rowKey(row);
    const api = gridRef.current?.api;
    const rowNode = api.getRowNode(id) || api.getDisplayedRowAtIndex(api.getDisplayedRowCount() - 1);
    const rowIndex = rowNode ? rowNode.rowIndex : 0;
    const firstEditable = columns.find(c => c.editable && !c.hide)?.field || columns[0]?.field;
    setEditingRowId(id);
    api.startEditingCell({ rowIndex, colKey: firstEditable });
  }, [columns, rowKey, readOnly]);

  const onSaveNew = useCallback(async (row) => {
    try {
      if (validate && !validate(row)) return;
      const saved = await createRow(row);
      const api = gridRef.current?.api;
      setEditingRowId(null);
      api.applyTransaction({ remove: [row] });
      api.applyTransaction({ add: [saved], addIndex: 0 });
    } catch (e) {
      alert(e.message || 'Create failed');
    }
  }, [createRow, validate]);

  const onCancelNew = useCallback((row) => {
    setEditingRowId(null);
    gridRef.current?.api?.applyTransaction?.({ remove: [row] });
  }, []);

  const onDeleteExisting = useCallback(async (row) => {
    try {
      await deleteRows([row]);
      gridRef.current?.api?.applyTransaction?.({ remove: [row] });
    } catch (e) {
      alert(e.message || 'Delete failed');
    }
  }, [deleteRows]);

  const isRowValid = useCallback((row) => (validate ? !!validate(row) : true), [validate]);

  const onRowValueChanged = useCallback(async (e) => {
    if (readOnly) return;
    const r = e.data;
    if (r.__isNew) return;
    try {
      await updateRow(r);
    } catch (err) {
      alert('Save failed: ' + (err.message || 'Unknown error'));
      load();
    }
  }, [updateRow, load, readOnly]);

  const onRowEditingStarted = useCallback((e) => {
    if (readOnly) return;
    setEditingRowId(rowKey(e.data));
  }, [rowKey, readOnly]);

  const onRowEditingStopped = useCallback(() => {
    if (readOnly) return;
    setEditingRowId(null);
  }, [readOnly]);

  const commitEdits = useCallback(() => {
    gridRef.current?.api?.stopEditing(false);
  }, []);
  const cancelEdits = useCallback(() => {
    gridRef.current?.api?.stopEditing(true);
  }, []);

  const baseColumns = useMemo(
    () => (readOnly ? columns.map(c => ({ ...c, editable: false })) : columns),
    [columns, readOnly]
  );

  const actionCol = useMemo(
    () => ({
      headerName: '',
      field: '__actions',
      width: 180,
      minWidth: 160,
      maxWidth: 200,
      sortable: false,
      filter: false,
      resizable: false,
      suppressMenu: true,
      pinned: 'right',
      lockPinned: true,
      cellRenderer: CrudActionsRenderer,
      cellStyle: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: '8px',
      },
    }),
    []
  );

  const columnDefs = useMemo(
    () => (readOnly || !showActions ? baseColumns : [...baseColumns, actionCol]),
    [baseColumns, actionCol, readOnly, showActions]
  );

  const headerStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10
  };
  const primaryBtn = {
    background: '#006400', color: '#fff', border: 'none',
    padding: '10px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer'
  };
  const ghostBtn = {
    background: '#fff', color: '#1C1C1C', border: '1px solid #DDD',
    padding: '10px 14px', borderRadius: 12, fontWeight: 700, cursor: 'pointer'
  };

  return (
    <div>
      <div style={headerStyle}>
        <h2 style={{ margin: 0 }}>{title || ''}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {!readOnly && showAddButton && (
            <button onClick={() => ref?.current?.addNewRow?.()} style={primaryBtn}>+ Add New</button>
          )}
          {showRefreshButton && (
            <button onClick={() => ref?.current?.refresh?.()} style={ghostBtn}>Refresh</button>
          )}
        </div>
      </div>

      <div className="ag-theme-quartz" style={{ height: 560, width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          getRowId={(p) => rowKey(p.data)}
          context={{
            rowKey,
            editingRowId,
            isRowValid,
            onEdit,
            onSaveNew,
            onCancelNew,
            onDeleteExisting,
            commitEdits,
            cancelEdits
          }}
          editType={readOnly ? undefined : 'fullRow'}
          stopEditingWhenCellsLoseFocus={!readOnly}
          suppressClickEdit={readOnly}
          onRowValueChanged={readOnly ? undefined : onRowValueChanged}
          onRowEditingStarted={readOnly ? undefined : onRowEditingStarted}
          onRowEditingStopped={readOnly ? undefined : onRowEditingStopped}
          rowSelection="multiple"
          pagination
          paginationPageSize={pageSize}
          overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Loading…</span>'}
          overlayNoRowsTemplate={'<span class="ag-overlay-no-rows-center">No records</span>'}
        />
      </div>
      {loading && <div style={{ marginTop: 6, fontWeight: 800 }}>Loading…</div>}
    </div>
  );
});

export default CrudGrid;