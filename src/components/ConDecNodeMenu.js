import React from 'react';
import { transform } from 'tiny-svg';

// Minimal BPMN-style context pad (floating round buttons)
const ICON_SIZE = 22;

const EditIcon = (
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 2000 2000"><path fill="currentColor" d="M1511.45 292.911a415.8 415.8 0 0 0-415.8 415.8a415.8 415.8 0 0 0 415.8 415.8a415.8 415.8 0 0 0 397.194-292.826l-298.378 79.95l-232.313-152.986l124.695-248.645l313.27-83.94A415.8 415.8 0 0 0 1511.45 292.91zm-492.602 555.194L96.6 1480.02c-28.476 84.174 63.924 222.774 158.995 227.068l902.881-618.354a415.8 415.8 0 0 1-139.626-240.63z"/></svg>
);

const DeleteIcon = (
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 2048 2048"><path fill="currentColor" d="m387.16 644.33l128.932 1231.742h1024.733l118.83-1231.51h-1272.5zm144.374 130.007h985.481l-94.107 971.506h-789.33z"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.344" d="m7.033 1040.98l.944 7.503m5.013-7.503l-.943 7.503" transform="matrix(96.7529 0 0 87.18526 55.328 -89814.987)"/><path fill="currentColor" d="M758.125 337.314L343.5 458.662v60.722h1361v-60.722l-419.687-121.348z"/><path fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="69.952" d="M793.259 211.429h461.482v168.06H793.26z"/></svg>
);

// Append icon (same as in palette), fix SVG props
const AppendIcon = (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="#43a047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="11" fill="#fff" stroke="#43a047" strokeWidth="2"/>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="#43a047" strokeWidth="2" fill="none"/>
    <line x1="12" y1="8" x2="12" y2="16" stroke="#43a047" strokeWidth="2"/>
    <line x1="8" y1="12" x2="16" y2="12" stroke="#43a047" strokeWidth="2"/>
  </svg>
);

// Map action keys to icons and colors
const ACTION_ICONS = {
  edit: { icon: EditIcon, color: '#1976d2', title: 'Edit' },
  append: { icon: AppendIcon, color: '#43a047', title: 'Append Activity' },
  delete: { icon: DeleteIcon, color: '#d32f2f', title: 'Delete' },
  // Add more actions/icons as needed
};

// Example utility functions to mimic ContextPadProvider logic
function getContextPadActions(node, { onEdit, onDelete, onAppend }) {
  // You can expand this logic to match BPMN types and rules as in ContextPadProvider.js
  const actions = [];

  // Example: always allow edit, append, delete if handlers are provided
  if (onEdit) {
    actions.push({
      key: 'edit',
      handler: onEdit,
      ...ACTION_ICONS.edit
    });
  }
  if (onAppend) {
    actions.push({
      key: 'append',
      handler: onAppend,
      ...ACTION_ICONS.append
    });
  }
  if (onDelete) {
    actions.push({
      key: 'delete',
      handler: onDelete,
      ...ACTION_ICONS.delete
    });
  }
  return actions;
}

export function ConDecNodeMenu({
  node,
  onEdit,
  onDelete,
  onAppend,
  zoom = 1
}) {
  if (!node) return null;

  const nodeWidth = 100;
  const nodeHeight = 50;
  const pad = 8 / zoom;
  const baseX = node.x + nodeWidth / 2 + pad;
  const baseY = node.y - nodeHeight / 2 - pad;

  const actions = getContextPadActions(node, { onEdit, onDelete, onAppend });

 
  const btnClass = "condec-context-btn";
  const btnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: `${ICON_SIZE}px`,
    height: `${ICON_SIZE}px`,
    background: '#fff', // white background
    border: '1px solid transparent',
    margin: '0 2px',
    cursor: 'pointer',
    transition: 'none',
    outline: 'none',
    padding: 0
  };
// Add hover effect
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
        <foreignObject x={0} y={0} width={ICON_SIZE * actions.length + 12} height={ICON_SIZE + 4}>
          <div style={{ display: 'flex', gap: 4, background: 'none', pointerEvents: 'all' }}>
            {actions.map(action => (
              <button
                key={action.key}
                className={btnClass}
                style={{ ...btnStyle, borderColor: 'transparent' }}
                title={action.title}
                tabIndex={-1}
                onClick={e => { e.stopPropagation(); action.handler && action.handler(node); }}
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
