import React from 'react';

// Minimal BPMN-style context pad (floating round buttons)
const ICON_SIZE = 22;

// Define icons for edit, delete, and append actions
const EditIcon = (
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 2000 2000"><path fill="currentColor" d="M1511.45 292.911a415.8 415.8 0 0 0-415.8 415.8a415.8 415.8 0 0 0 415.8 415.8a415.8 415.8 0 0 0 397.194-292.826l-298.378 79.95l-232.313-152.986l124.695-248.645l313.27-83.94A415.8 415.8 0 0 0 1511.45 292.91zm-492.602 555.194L96.6 1480.02c-28.476 84.174 63.924 222.774 158.995 227.068l902.881-618.354a415.8 415.8 0 0 1-139.626-240.63z"/></svg>
);

const DeleteIcon = (
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 2048 2048"><path fill="currentColor" d="m387.16 644.33l128.932 1231.742h1024.733l118.83-1231.51h-1272.5zm144.374 130.007h985.481l-94.107 971.506h-789.33z"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.344" d="m7.033 1040.98l.944 7.503m5.013-7.503l-.943 7.503" transform="matrix(96.7529 0 0 87.18526 55.328 -89814.987)"/><path fill="currentColor" d="M758.125 337.314L343.5 458.662v60.722h1361v-60.722l-419.687-121.348z"/><path fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="69.952" d="M793.259 211.429h461.482v168.06H793.26z"/></svg>
);

const AppendIcon = (
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 2048 2048"><rect width="17.563" height="14.478" x="1.23" y="1035.052" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.034" rx="2.759" transform="translate(55.328 -99820.702) scale(96.7529)"/></svg>
);

// Map action keys to icons and colors
const ACTION_ICONS = {
  edit: { icon: EditIcon, color: '#1976d2', title: 'Edit' },
  append: { icon: AppendIcon, color: '#43a047', title: 'Append Activity' },
  delete: { icon: DeleteIcon, color: '#d32f2f', title: 'Delete' },
  // Add more actions/icons as needed
};

// Helper function to validate constraints
function validateNodeConstraints(node, diagram = { relations: [] }) {
  const incomingRelations = diagram.relations.filter(r => r.targetId === node.id).length;
  const outgoingRelations = diagram.relations.filter(r => r.sourceId === node.id).length;

  switch (node.constraint) {
    case 'absence':
      return incomingRelations === 0
        ? { valid: true }
        : { valid: false, message: 'Must have no incoming relations' };

    case 'absence_n':
      return incomingRelations <= (node.constraintValue || 0)
        ? { valid: true }
        : { valid: false, message: `Exceeds max ${node.constraintValue} incoming relations` };

    case 'existence_n':
      return incomingRelations >= (node.constraintValue || 0)
        ? { valid: true }
        : { valid: false, message: `Needs at least ${node.constraintValue} incoming relations` };

    case 'exactly_n':
      return incomingRelations === (node.constraintValue || 0)
        ? { valid: true }
        : { valid: false, message: `Must have exactly ${node.constraintValue} incoming relations` };

    case 'init':
      return incomingRelations === 0
        ? { valid: true }
        : { valid: false, message: 'Init activities cannot have incoming relations' };

    default:
      return { valid: true };
  }
}

// --- Main Node Menu (without wrench button and type menu) ---
export function ConDecNodeMenu({
  node,
  diagram = { relations: [] },
  onEdit,
  onDelete,
  onAppend,
  onClose,
  zoom = 1
}) {
  if (!node) return null;

  // Remove error message and text, keep only buttons
  const actions = Object.entries(ACTION_ICONS);

  const ICON_SIZE = 22;
  const nodeWidth = 100;
  const nodeHeight = 50;
  const pad = 8 / zoom;
  const baseX = node.x + nodeWidth / 2 + pad;
  const baseY = node.y - nodeHeight / 2 - pad;

  const btnClass = "condec-context-btn";
  const btnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: `${ICON_SIZE}px`,
    height: `${ICON_SIZE}px`,
    background: '#fff',
    border: '1px solid transparent',
    margin: '0 2px',
    cursor: 'pointer',
    transition: 'none',
    outline: 'none',
    padding: 0
  };

  return (
    <>
      <style>
        {`
          .condec-context-btn:hover {
            opacity: 0.6; 
          }
        `}
      </style>
      <g
        className="bpmn-context-pad"
        style={{ pointerEvents: 'all' }}
        transform={`translate(${baseX},${baseY}) scale(${1/zoom})`}
      >
        <foreignObject x={0} y={0} width={ICON_SIZE * 4 + 32} height={ICON_SIZE + 4}>
          <div style={{ display: 'flex', gap: 4, background: 'none', pointerEvents: 'all', alignItems: 'center' }}>
            {actions.map(([key, action]) => (
              <button
                key={key}
                className={btnClass}
                style={btnStyle}
                title={action.title}
                onClick={(e) => {
                  e.stopPropagation();
                  if (key === 'edit' && onEdit) onEdit(node, e);
                  if (key === 'delete' && onDelete) onDelete(node);
                  if (key === 'append' && onAppend) onAppend(node);
                }}
              >
                {action.icon}
              </button>
            ))}
          </div>
        </foreignObject>
      </g>
    </>
  );
}
