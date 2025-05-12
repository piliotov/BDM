import React, { useRef, useEffect, useState } from 'react';
import { CONSTRAINTS } from './ConDecNode';
import { validateNodeConstraint } from '../utils/nodeConstraintUtils'; // <-- Add this import

// Configuration for constraint types with their descriptions
const CONSTRAINT_CONFIG = {
  absence: { name: "Absence (0)", description: "Activity must not occur" },
  absence_n: { name: "Absence (0..n)", description: "Activity can occur at most n times" },
  existence_n: { name: "Existence (n..∗)", description: "Activity must occur at least n times" },
  exactly_n: { name: "Exactly (n)", description: "Activity must occur exactly n times" },
  init: { name: "Init", description: "Activity must be the first to occur" }
};

export function NodeEditMenu({
  node,
  editNodePopupPos,
  setDragOffset,
  setDraggingEditPopup,
  setEditNodePopup,
  setEditNodePopupPos,
  setDiagram,
  saveToUndoStack,
  setSelectedElement
}) {
  const popupRef = useRef(null);
  // Add local state to track form values
  const [formValues, setFormValues] = useState({
    name: node?.name || '',
    constraint: node?.constraint || 'none',
    constraintValue: node?.constraintValue || 1
  });

  // Update local state when node prop changes
  useEffect(() => {
    if (node) {
      setFormValues({
        name: node.name || '',
        constraint: node.constraint || 'none',
        constraintValue: node.constraintValue || 1
      });
    }
  }, [node]);

  // Prevent click events from bubbling up but allow normal interaction
  const stopPropagation = e => {
    e.stopPropagation();
    // Don't preventDefault on mousedown as it prevents normal interaction with form elements
  };

  // Handle outside clicks to close menu
  useEffect(() => {
    const handler = e => {
      // Only stop propagation for events outside the popup
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        e.stopPropagation();
        // Close the popup when clicking outside
        setEditNodePopup(null);
        setEditNodePopupPos({ x: null, y: null });
      }
    };
    
    document.addEventListener('mousedown', handler, true);
    
    return () => {
      document.removeEventListener('mousedown', handler, true);
    };
  }, [setEditNodePopup, setEditNodePopupPos]);

  if (!node) return null;

  // Helper function to update node in diagram
  const updateNode = (updates) => {
    saveToUndoStack();
    setDiagram(diagram => ({
      ...diagram,
      nodes: diagram.nodes.map(n => 
        n.id === node.id ? { ...n, ...updates } : n
      )
    }));
    // Also update selected element if this node is selected
    setSelectedElement(prev => {
      if (prev && prev.type === 'node' && prev.element.id === node.id) {
        return {
          ...prev,
          element: { ...prev.element, ...updates }
        };
      }
      return prev;
    });
  };

  // Get constraint validation status (use utility for actual diagram check)
  const getConstraintStatus = () => {
    if (!node || !node.id || !window?.condecDiagramForValidation) return { valid: true };
    const diagram = window.condecDiagramForValidation;
    return validateNodeConstraint(node, diagram);
  };

  const constraintStatus = getConstraintStatus();

  const handleNameChange = (e) => {
    const name = e.target.value;
    setFormValues(prev => ({ ...prev, name }));
    updateNode({ name });
  };

  const handleConstraintChange = (e) => {
    const constraint = e.target.value === 'none' ? null : e.target.value;
    // Reset constraint value when changing constraint type
    const constraintValue = constraint === CONSTRAINTS.ABSENCE_N || 
                            constraint === CONSTRAINTS.EXISTENCE_N || 
                            constraint === CONSTRAINTS.EXACTLY_N ? 1 : null;
    
    setFormValues(prev => ({ 
      ...prev, 
      constraint: e.target.value,
      constraintValue
    }));
    
    updateNode({ 
      constraint, 
      constraintValue
    });
  };

  const handleConstraintValueChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      setFormValues(prev => ({ ...prev, constraintValue: value }));
      updateNode({ constraintValue: value });
    }
  };

  return (
    <div
      className="condec-edit-node-popup"
      ref={popupRef}
      style={{
        position: 'fixed',
        left: editNodePopupPos.x !== null ? editNodePopupPos.x : '50%',
        top: editNodePopupPos.y !== null ? editNodePopupPos.y : '50%',
        transform:
          editNodePopupPos.x === null && editNodePopupPos.y === null
            ? 'translate(-50%, -50%)'
            : undefined,
        zIndex: 3000,
        background: '#fff',
        border: constraintStatus && !constraintStatus.valid ? '2px solid #d32f2f' : '1.5px solid #1976d2',
        borderRadius: 8,
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        minWidth: 320,
        maxWidth: 400,
        padding: 24
      }}
      onMouseDown={stopPropagation}
      onClick={stopPropagation}
      onFocus={stopPropagation}
    >
      <div
        className="condec-edit-node-popup-header"
        style={{
          fontWeight: 600,
          fontSize: 16,
          color: '#1976d2',
          marginBottom: 16,
          cursor: 'move',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
        onMouseDown={e => {
          const rect = e.currentTarget.parentNode.getBoundingClientRect();
          setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          });
          setDraggingEditPopup(true);
        }}
      >
        <span role="img" aria-label="wrench" style={{marginRight:8}}>🔧</span>
        Edit Activity Node
        {constraintStatus && !constraintStatus.valid && (
          <span title="Constraint violated" style={{ color: '#d32f2f', fontSize: 20, marginLeft: 8 }}>❗</span>
        )}
      </div>
      
      {/* Form fields */}
      <div className="property-group" style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Name:</label>
        <input
          type="text"
          value={formValues.name}
          onChange={handleNameChange}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: 4,
            border: '1px solid #ccc',
            fontSize: 14,
            background: constraintStatus && !constraintStatus.valid ? '#ffebee' : '#fff'
          }}
        />
      </div>

      <div className="property-group" style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Constraint:</label>
        <select
          value={formValues.constraint || 'none'}
          onChange={handleConstraintChange}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: 4,
            border: '1px solid #ccc',
            fontSize: 14,
            background: constraintStatus && !constraintStatus.valid ? '#ffebee' : '#fff'
          }}
        >
          <option value="none">None</option>
          {Object.entries(CONSTRAINTS).map(([key, value]) => (
            <option key={value} value={value}>
              {CONSTRAINT_CONFIG[value]?.name || value}
            </option>
          ))}
        </select>
      </div>

      {/* Show constraint value field only if constraint type requires it */}
      {formValues.constraint && ['absence_n', 'existence_n', 'exactly_n'].includes(formValues.constraint) && (
        <div className="property-group" style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Value (n):</label>
          <input
            type="number"
            min="1"
            step="1"
            value={formValues.constraintValue || 1}
            onChange={handleConstraintValueChange}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: 4,
              border: '1px solid #ccc',
              fontSize: 14,
              background: constraintStatus && !constraintStatus.valid ? '#ffebee' : '#fff'
            }}
          />
        </div>
      )}

      {/* Constraint explanation */}
      {formValues.constraint && formValues.constraint !== 'none' && (
        <div className="constraint-explanation" style={{ 
          marginBottom: 12,
          padding: '8px 10px',
          backgroundColor: '#f8f9fa',
          borderRadius: 4,
          fontSize: 13
        }}>
          <p style={{ margin: '0 0 6px 0', fontWeight: 500 }}>Constraint Details:</p>
          <p style={{ margin: 0, color: '#555' }}>{CONSTRAINT_CONFIG[formValues.constraint]?.description}</p>
          
          {/* Current status display */}
          <div style={{ 
            marginTop: 8,
            padding: '6px 8px',
            backgroundColor: constraintStatus?.valid ? '#e8f5e9' : '#ffebee',
            border: `1px solid ${constraintStatus?.valid ? '#a5d6a7' : '#ef9a9a'}`,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            color: constraintStatus?.valid ? '#2e7d32' : '#c62828'
          }}>
            <span style={{ marginRight: 6 }}>
              {constraintStatus?.valid ? 
                '✓ Valid' : 
                <span style={{ fontWeight: 'bold' }}>⚠️ Invalid</span>}
            </span>
            {!constraintStatus?.valid && (
              <span>{constraintStatus.message}</span>
            )}
            {constraintStatus?.valid && formValues.constraint && (
              <span>
                {node.incomingRelationsCount || 0} incoming relation(s)
              </span>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button
          style={{
            flex: 1,
            background: '#d32f2f',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: 14
          }}
          onClick={() => {
            saveToUndoStack();
            setDiagram(diagram => ({
              ...diagram,
              nodes: diagram.nodes.filter(n => n.id !== node.id),
              relations: diagram.relations.filter(r => r.sourceId !== node.id && r.targetId !== node.id)
            }));
            setEditNodePopup(null);
            setEditNodePopupPos({ x: null, y: null });
          }}
        >
          Delete
        </button>
        <button
          style={{
            flex: 1,
            background: '#f5f5f5',
            color: '#333',
            border: '1px solid #ccc',
            borderRadius: 4,
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: 14
          }}
          onClick={() => {
            setEditNodePopup(null);
            setEditNodePopupPos({ x: null, y: null });
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}