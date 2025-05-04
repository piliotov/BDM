import React from 'react';

export function ConDecNodeMenu({
  node,
  onEdit,
  onDelete,
  onClose,
  zoom = 1
}) {
  // Base size that will be scaled by zoom
  const baseButtonSize = 30;
  const baseIconSize = 18;
  const baseBorderRadius = 4;
  const baseFontSize = 14;
  const menuWidth = 3 * baseButtonSize + 16;
  const menuHeight = baseButtonSize + 8;
  // Calculate scaled properties
  const buttonSize = baseButtonSize / zoom;
  const iconSize = baseIconSize / zoom;
  const borderRadius = baseBorderRadius / zoom;
  const fontSize = baseFontSize / zoom;
  const gap = 4 / zoom;
  const padding = 4 / zoom;
  // Menu position: right of node
  const nodeWidth = 100;
  const nodeHeight = 50;
  const menuX = node.x + nodeWidth / 2 + 12 / zoom;
  const menuY = node.y;

  return (
    <g className="condec-node-menu" transform={`translate(${menuX},${menuY})`}>
      <rect
        x={0}
        y={-menuHeight / 2 / zoom}
        width={menuWidth / zoom}
        height={menuHeight / zoom}
        rx={borderRadius}
        fill="#fff"
        stroke="#e0e0e0"
        strokeWidth={1 / zoom}
        filter="url(#menuShadow)"
      />
      {/* Edit button */}
      <g
        style={{ cursor: 'pointer' }}
        onClick={onEdit}
        transform={`translate(${padding + buttonSize / 2},0)`}
      >
        <rect x={-buttonSize / 2} y={-buttonSize / 2} width={buttonSize} height={buttonSize} rx={borderRadius} fill="#f5f5f5" />
        <svg width={iconSize} height={iconSize} x={-iconSize / 2} y={-iconSize / 2} viewBox="0 0 24 24" fill="none">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="#5F6368"/>
        </svg>
      </g>
      {/* Delete button */}
      <g
        style={{ cursor: 'pointer' }}
        onClick={onDelete}
        transform={`translate(${padding * 2 + buttonSize * 1.5},0)`}
      >
        <rect x={-buttonSize / 2} y={-buttonSize / 2} width={buttonSize} height={buttonSize} rx={borderRadius} fill="#f5f5f5" />
        <svg width={iconSize} height={iconSize} x={-iconSize / 2} y={-iconSize / 2} viewBox="0 0 24 24" fill="none">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="#d32f2f"/>
        </svg>
      </g>
      {/* Close button */}
      <g
        style={{ cursor: 'pointer' }}
        onClick={onClose}
        transform={`translate(${padding * 3 + buttonSize * 2.5},0)`}
      >
        <rect x={-buttonSize / 2} y={-buttonSize / 2} width={buttonSize} height={buttonSize} rx={borderRadius} fill="#f5f5f5" />
        <svg width={iconSize} height={iconSize} x={-iconSize / 2} y={-iconSize / 2} viewBox="0 0 24 24" fill="none">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="#5F6368"/>
        </svg>
      </g>
      {/* SVG filter for shadow */}
      <filter id="menuShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.15" />
      </filter>
    </g>
  );
}
