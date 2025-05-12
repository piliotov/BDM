import React, { useState, useRef, useEffect } from 'react';
import { validateNodeConstraint } from '../utils/nodeConstraintUtils'; // <-- Add this import

// --- Node Types and Constraints ---
export const NODE_TYPES = {
  ACTIVITY: 'activity'
};

export const CONSTRAINTS = {
  ABSENCE: 'absence',
  ABSENCE_N: 'absence_n',
  EXISTENCE_N: 'existence_n',
  EXACTLY_N: 'exactly_n',
  INIT: 'init'
};

// --- Render a single node with inline renaming and menu trigger ---
export function ConDecNode({
  node,
  isSelected,
  mode,
  onSelect,
  onDoubleClick,
  onDragStart,
  onMenu,
  onRename,
  onRenameBlur
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.name);
  const inputRef = useRef();

  // Check if the constraint is valid based on actual diagram (not just incomingRelationsCount)
  const isConstraintViolated = () => {
    if (!node.constraint) return false;
    // Try to use global diagram for validation if available
    if (window?.condecDiagramForValidation) {
      const result = validateNodeConstraint(node, window.condecDiagramForValidation);
      return !result.valid;
    }
    // fallback to old logic
    const incomingCount = node.incomingRelationsCount || 0;
    switch(node.constraint) {
      case CONSTRAINTS.ABSENCE:
        return incomingCount > 0;
      case CONSTRAINTS.ABSENCE_N:
        return incomingCount > (node.constraintValue || 0);
      case CONSTRAINTS.EXISTENCE_N:
        return incomingCount < (node.constraintValue || 0);
      case CONSTRAINTS.EXACTLY_N:
        return incomingCount !== (node.constraintValue || 0);
      case CONSTRAINTS.INIT:
        return incomingCount > 0;
      default:
        return false;
    }
  };

  const constraintViolated = isConstraintViolated();

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // When node changes, reset edit value
  useEffect(() => {
    setEditValue(node.name);
  }, [node.name]);

  const width = 100;
  const height = 50;
  const x = node.x;
  const y = node.y;

  // Constraint notation
  let constraintNotation = null;
  if (node.constraint) {
    switch(node.constraint) {
      case CONSTRAINTS.ABSENCE:
        constraintNotation = (
          <text x={x} y={y-height/2-10} textAnchor="middle" fontSize="10px">0</text>
        );
        break;
      case CONSTRAINTS.ABSENCE_N:
        constraintNotation = (
          <text x={x} y={y-height/2-10} textAnchor="middle" fontSize="10px">
            0..{node.constraintValue || "n"}
          </text>
        );
        break;
      case CONSTRAINTS.EXISTENCE_N:
        constraintNotation = (
          <text x={x} y={y-height/2-10} textAnchor="middle" fontSize="10px">
            {node.constraintValue || "n"}..∗
          </text>
        );
        break;
      case CONSTRAINTS.EXACTLY_N:
        constraintNotation = (
          <text x={x} y={y-height/2-10} textAnchor="middle" fontSize="10px">
            {node.constraintValue || "n"}
          </text>
        );
        break;
      case CONSTRAINTS.INIT:
        constraintNotation = (
          <text x={x} y={y-height/2-10} textAnchor="middle" fontSize="10px">
            init
          </text>
        );
        break;
      default:
        break;
    }
  }

  return (
    <g
      className="condec-node"
      data-node-id={node.id}
      transform={`translate(0, 0)`}
      onClick={(e) => { 
        e.stopPropagation();
        onSelect(e); 
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
        if (onDoubleClick) onDoubleClick();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onDragStart(e);
      }}
      style={{ pointerEvents: 'all' }}
    >
      <rect
        x={x - width/2}
        y={y - height/2}
        width={width}
        height={height}
        rx="5"
        ry="5"
        fill={constraintViolated ? "#ffebee" : "#f5f5f5"}
        stroke={constraintViolated ? '#d32f2f' : (isSelected ? '#1a73e8' : '#000')}
        strokeWidth={constraintViolated ? 2.5 : (isSelected ? 2.5 : 1.5)}
        fillOpacity={0.95}
        style={{ cursor: mode === 'addRelation' ? 'crosshair' : 'pointer' }}
      />
      
      {/* Constraint violation indicator */}
      {constraintViolated && (
        <g>
          <circle
            cx={x + width/2 - 10}
            cy={y - height/2 + 10}
            r={8}
            fill="#d32f2f"
            stroke="#fff"
            strokeWidth="1"
          />
          <text
            x={x + width/2 - 10}
            y={y - height/2 + 10}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="12px"
            fill="#fff"
            fontWeight="bold"
            style={{ userSelect: 'none' }}
          >
            !
          </text>
        </g>
      )}
      
      {constraintNotation}
      {/* Inline renaming input or text */}
      {editing ? (
        <foreignObject
          x={x - width/2}
          y={y + height/2 + 2}
          width={width}
          height={30}
        >
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            style={{
              width: '98%',
              fontSize: '13px',
              padding: '2px',
              border: '1px solid #1a73e8',
              borderRadius: '3px'
            }}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (editValue.trim() && editValue !== node.name) {
                onRename(editValue);
              }
              if (onRenameBlur) onRenameBlur();
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                setEditing(false);
                if (editValue.trim() && editValue !== node.name) {
                  onRename(editValue);
                }
                if (onRenameBlur) onRenameBlur();
              }
              if (e.key === 'Escape') {
                setEditing(false);
                setEditValue(node.name);
                if (onRenameBlur) onRenameBlur();
              }
            }}
          />
        </foreignObject>
      ) : (
        <text
          x={node.x}
          y={node.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="12px"
          pointerEvents="none"
          style={{
            userSelect: 'none',
            fill: constraintViolated ? '#d32f2f' : '#222',
            fontWeight: constraintViolated ? 'bold' : 'normal'
          }}
        >
          {node.name}
        </text>
      )}
    </g>
  );
}
