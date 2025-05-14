import React, { useRef, useEffect, useState } from 'react';
import { RELATION_TYPES } from '../utils/relationUtils';
import relationDescriptions from '../utils/relationDescriptions';

// Group relation types for easier selection
const RELATION_GROUPS = {
  BASIC: [
    RELATION_TYPES.RESP_EXISTENCE,
    RELATION_TYPES.COEXISTENCE,
    RELATION_TYPES.RESPONSE,
    RELATION_TYPES.PRECEDENCE,
    RELATION_TYPES.SUCCESSION
  ],
  ALTERNATE: [
    RELATION_TYPES.ALT_RESPONSE,
    RELATION_TYPES.ALT_PRECEDENCE,
    RELATION_TYPES.ALT_SUCCESSION
  ],
  CHAIN: [
    RELATION_TYPES.CHAIN_RESPONSE,
    RELATION_TYPES.CHAIN_PRECEDENCE,
    RELATION_TYPES.CHAIN_SUCCESSION
  ],
  NEGATIVE: [
    RELATION_TYPES.RESP_ABSENCE,
    RELATION_TYPES.NOT_COEXISTENCE,
    RELATION_TYPES.NEG_RESPONSE,
    RELATION_TYPES.NEG_PRECEDENCE,
    RELATION_TYPES.NEG_SUCCESSION
  ],
  NEGATIVE_ALTERNATE: [
    RELATION_TYPES.NEG_ALT_RESPONSE,
    RELATION_TYPES.NEG_ALT_PRECEDENCE,
    RELATION_TYPES.NEG_ALT_SUCCESSION
  ],
  NEGATIVE_CHAIN: [
    RELATION_TYPES.NEG_CHAIN_RESPONSE,
    RELATION_TYPES.NEG_CHAIN_PRECEDENCE,
    RELATION_TYPES.NEG_CHAIN_SUCCESSION
  ]
};

export function RelationEditMenu({
  relation,
  nodes,
  setEditNodePopup,
  setEditNodePopupPos,
  setDiagram,
  saveToUndoStack,
  setSelectedElement
}) {
  const popupRef = useRef(null);
  // Track current form values
  const [relationType, setRelationType] = useState(relation?.type || RELATION_TYPES.RESPONSE);
  const [sourceNodeId, setSourceNodeId] = useState(relation?.sourceId || '');
  const [targetNodeId, setTargetNodeId] = useState(relation?.targetId || '');
  
  // Update local state when relation prop changes
  useEffect(() => {
    if (relation) {
      setRelationType(relation.type || RELATION_TYPES.RESPONSE);
      setSourceNodeId(relation.sourceId || '');
      setTargetNodeId(relation.targetId || '');
    }
  }, [relation]);

  // Find the source and target nodes for this relation
  const sourceNode = nodes?.find(node => node.id === sourceNodeId);
  const targetNode = nodes?.find(node => node.id === targetNodeId);

  // Get current relation description
  const relationInfo = {
    label: relationType,
    description: relationDescriptions[relationType] || 'No description available'
  };

  // For handling changes
  const handleChangeType = (e) => {
    const newType = e.target.value;
    setRelationType(newType);
    
    // Update the relation in the diagram
    saveToUndoStack();
    setDiagram(diagram => ({
      ...diagram,
      relations: diagram.relations.map(r =>
        r.id === relation.id ? { ...r, type: newType } : r
      )
    }));
  };

  const handleChangeSource = (e) => {
    const newSourceId = e.target.value;
    setSourceNodeId(newSourceId);
    
    // Update the relation in the diagram
    saveToUndoStack();
    setDiagram(diagram => ({
      ...diagram,
      relations: diagram.relations.map(r =>
        r.id === relation.id ? { ...r, sourceId: newSourceId } : r
      )
    }));
  };

  const handleChangeTarget = (e) => {
    const newTargetId = e.target.value;
    setTargetNodeId(newTargetId);
    
    // Update the relation in the diagram
    saveToUndoStack();
    setDiagram(diagram => ({
      ...diagram,
      relations: diagram.relations.map(r =>
        r.id === relation.id ? { ...r, targetId: newTargetId } : r
      )
    }));
  };

  // Reverse the relation direction (swap source and target, update in diagram)
  const handleReverseRelation = () => {
    saveToUndoStack();
    // Swap source and target in local state
    setSourceNodeId(targetNodeId);
    setTargetNodeId(sourceNodeId);

    // Update in the diagram
    setDiagram(diagram => ({
      ...diagram,
      relations: diagram.relations.map(r =>
        r.id === relation.id
          ? {
              ...r,
              sourceId: targetNodeId,
              targetId: sourceNodeId,
              // Optionally reverse waypoints if present
              waypoints: r.waypoints ? [...r.waypoints].reverse() : undefined
            }
          : r
      )
    }));
  };

  // For handling delete
  const handleDeleteRelation = () => {
    saveToUndoStack();
    setDiagram(diagram => ({
      ...diagram,
      relations: diagram.relations.filter(r => r.id !== relation.id)
    }));
    // Close the popup after deletion
    setEditNodePopup(null);
    setEditNodePopupPos({ x: null, y: null });
    // Deselect the relation
    setSelectedElement(null);
  };

  // For handling close - also deselect the relation
  const handleCloseMenu = () => {
    setEditNodePopup(null);
    setEditNodePopupPos({ x: null, y: null });
    setSelectedElement(null);
  };

  if (!relation) {
    return null;
  }

  // Render the relation type options grouped by category
  const renderRelationOptions = () => {
    return Object.entries(RELATION_GROUPS).map(([groupKey, relationTypes]) => (
      <optgroup key={groupKey} label={groupKey.replace(/_/g, ' ')}>
        {relationTypes.map(type => (
          <option
            key={type}
            value={type}
            title={relationDescriptions[type] || type}
          >
            {type}
          </option>
        ))}
      </optgroup>
    ));
  };

  return (
    <div
      className="condec-edit-relation-sidebar"
      ref={popupRef}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: '300px',
        background: '#fff',
        borderLeft: '1px solid #1976d2',
        boxShadow: '-2px 0 12px rgba(0,0,0,0.1)',
        zIndex: 1000,
        padding: '20px',
        overflowY: 'auto',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div
        className="condec-sidebar-header"
        style={{
          fontWeight: 600,
          fontSize: 16,
          color: '#1976d2',
          marginBottom: 16,
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          Edit Relation
        </div>
        <button
          onClick={handleCloseMenu}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            color: '#666',
            padding: '4px'
          }}
          title="Close"
        >
          ×
        </button>
      </div>
      
      <div className="property-group" style={{ marginBottom: 16 }}>
        {/* Source-Target Direction Control */}
        <div className="relation-direction-control" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          margin: '0 0 16px 0',
          padding: '10px',
          background: '#f5f5f5',
          borderRadius: '8px'
        }}>
          <div style={{ flex: 1, textAlign: 'right', fontWeight: 'bold', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sourceNode?.name || 'Source'}
          </div>
          {/* Single arrow button for direction */}
          <button 
            onClick={handleReverseRelation}
            style={{
              background: '#e3f2fd',
              border: '1px solid #1976d2',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              minWidth: '36px',
              flexShrink: 0
            }}
            title="Reverse relation direction"
          >
            {/* Single arrow icon*/}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
          <div style={{ flex: 1, fontWeight: 'bold', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {targetNode?.name || 'No name for the target node'}
          </div>
        </div>
        
        {/* Source Node Selection */}
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Source Node:</label>
        <select
          value={sourceNodeId}
          onChange={handleChangeSource}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: 4,
            border: '1px solid #ccc',
            fontSize: 14,
            marginBottom: 12
          }}
        >
          {nodes.map(node => (
            <option key={node.id} value={node.id}>
              {node.name || `Node ${node.id.slice(0, 6)}...`}
            </option>
          ))}
        </select>
        
        {/* Target Node Selection */}
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Target Node:</label>
        <select
          value={targetNodeId}
          onChange={handleChangeTarget}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: 4,
            border: '1px solid #ccc',
            fontSize: 14,
            marginBottom: 12
          }}
        >
          {nodes.map(node => (
            <option key={node.id} value={node.id}>
              {node.name || `Node ${node.id.slice(0, 6)}...`}
            </option>
          ))}
        </select>
        
        {/* Relation Type Selection */}
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Relation Type:</label>
        <select
          value={relationType}
          onChange={handleChangeType}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: 4,
            border: '1px solid #ccc',
            fontSize: 14
          }}
        >
          {renderRelationOptions()}
        </select>
      </div>
    

      <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
        <button
          style={{
            width: '100%',
            background: '#d32f2f',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: 14,
            marginBottom: '8px'
          }}
          onClick={handleDeleteRelation}
        >
          Delete Relation
        </button>
      </div>
    </div>
  );
}

export default RelationEditMenu;
