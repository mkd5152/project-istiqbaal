import React, { useMemo } from 'react';

const btn = (bg = '#006400') => ({
  background: bg,
  color: '#fff',
  border: 'none',
  padding: '8px 12px',
  borderRadius: 10,
  fontWeight: 800,
  cursor: 'pointer'
});

export default function CrudActionsRenderer(props) {
  const { data, context } = props;

  const rowId = useMemo(() => context?.rowKey?.(data), [context, data]);
  const isEditing = context?.editingRowId === rowId;
  const isNew = !!data?.__isNew;
  const isValid = useMemo(
    () => (context?.isRowValid ? context.isRowValid(data) : true),
    [context, data]
  );

  if (isNew) {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => { context?.commitEdits?.(); context?.onSaveNew?.(data); }}
          disabled={!isValid}
          style={{ ...btn('#006400'), opacity: isValid ? 1 : 0.6 }}
        >
          Save
        </button>
        <button onClick={() => context?.onCancelNew?.(data)} style={btn('#8B0000')}>
          Cancel
        </button>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => context?.commitEdits?.()} style={btn('#006400')}>Save</button>
        <button onClick={() => context?.cancelEdits?.()} style={btn('#8B0000')}>Cancel</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => context?.onEdit?.(data)} style={btn('#1C1C1C')}>Edit</button>
      <button onClick={() => context?.onDeleteExisting?.(data)} style={btn('#8B0000')}>Delete</button>
    </div>
  );
}