// src/components/grids/CrudActionsRenderer.jsx
import React, { useMemo } from 'react';
import { confirmDelete } from '../../libs/dialogs';

const baseBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 30, padding: '0 10px', borderRadius: 999,
  border: '1px solid transparent', fontSize: 12, fontWeight: 700,
  lineHeight: 1, cursor: 'pointer', userSelect: 'none',
  transition: 'transform .06s ease, box-shadow .12s ease, opacity .12s ease',
};
const theme = {
  ghost:   { ...baseBtn, background: '#fff',     color: '#222', borderColor: '#E2E8F0' },
  primary: { ...baseBtn, background: '#0F766E',  color: '#fff' },
  danger:  { ...baseBtn, background: '#8B0000',  color: '#fff' },
};
const hover = { transform: 'translateY(-1px)', boxShadow: '0 2px 8px rgba(0,0,0,.08)' };
const icon = { width: 14, height: 14, display: 'inline-block' };

function Icon({ type }) {
  if (type === 'edit') return (<svg viewBox="0 0 24 24" style={icon}><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42L18.37 3.29a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.83z"/></svg>);
  if (type === 'save') return (<svg viewBox="0 0 24 24" style={icon}><path fill="currentColor" d="M17 3H5a2 2 0 0 0-2 2v14l4-4h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/></svg>);
  if (type === 'cancel') return (<svg viewBox="0 0 24 24" style={icon}><path fill="currentColor" d="M18.3 5.71L12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.3 19.71 2.89 18.3 9.18 12 2.89 5.71 4.3 4.29 10.59 10.6l6.3-6.31z"/></svg>);
  if (type === 'delete') return (<svg viewBox="0 0 24 24" style={icon}><path fill="currentColor" d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>);
  return null;
}

export default function CrudActionsRenderer(props) {
  const { data, context } = props;

  const rowId = useMemo(() => context?.rowKey?.(data), [context, data]);
  const isEditing = context?.editingRowId === rowId;
  const isNew = !!data?.__isNew;
  const isValid = useMemo(
    () => (context?.isRowValid ? context.isRowValid(data) : true),
    [context, data]
  );

  const label =
    data?.name || data?.title || data?.code || data?.email || data?.its_number || `#${data?.id}`;

  const Row = ({ children }) => (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, height: '100%' }}>
      {children}
    </div>
  );

  if (isNew) {
    return (
      <Row>
        <button
          onClick={() => { context?.commitEdits?.(); context?.onSaveNew?.(data); }}
          disabled={!isValid}
          title="Save"
          style={{ ...theme.primary, opacity: isValid ? 1 : 0.6 }}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, hover)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, { transform: '', boxShadow: '' })}
        ><Icon type="save" />Save</button>

        <button
          onClick={() => context?.onCancelNew?.(data)}
          title="Cancel"
          style={theme.ghost}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, hover)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, { transform: '', boxShadow: '' })}
        ><Icon type="cancel" />Cancel</button>
      </Row>
    );
  }

  if (isEditing) {
    return (
      <Row>
        <button
          onClick={() => context?.commitEdits?.()}
          title="Save"
          style={theme.primary}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, hover)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, { transform: '', boxShadow: '' })}
        ><Icon type="save" />Save</button>

        <button
          onClick={() => context?.cancelEdits?.()}
          title="Cancel"
          style={theme.ghost}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, hover)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, { transform: '', boxShadow: '' })}
        ><Icon type="cancel" />Cancel</button>
      </Row>
    );
  }

  return (
    <Row>
      <button
        onClick={() => context?.onEdit?.(data)}
        title="Edit"
        style={theme.ghost}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, hover)}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, { transform: '', boxShadow: '' })}
      ><Icon type="edit" />Edit</button>

      <button
        onClick={async () => {
          const ok = await confirmDelete(label);
          if (ok) context?.onDeleteExisting?.(data);
        }}
        title="Delete"
        style={theme.danger}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, hover)}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, { transform: '', boxShadow: '' })}
      ><Icon type="delete" />Delete</button>
    </Row>
  );
}