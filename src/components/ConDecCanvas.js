import React, { useRef } from 'react';
import { ConDecRelation } from './ConDecRelations';
import { ConDecNode } from './ConDecNode';
import { ConDecNodeMenu } from './ConDecNodeMenu';

// Helper: intersection of line and rectangle
function calculateIntersectionPoint(source, target, width = 100, height = 50) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / length;
  const ny = dy / length;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  let tx = Infinity, ty = Infinity;
  if (ny !== 0) {
    const tTop = (target.y - halfHeight - source.y) / dy;
    const tBottom = (target.y + halfHeight - source.y) / dy;
    if (tTop >= 0 && tTop <= 1) {
      const x = source.x + tTop * dx;
      if (Math.abs(x - target.x) <= halfWidth) {
        tx = tTop; ty = tTop;
      }
    }
    if (tBottom >= 0 && tBottom <= 1) {
      const x = source.x + tBottom * dx;
      if (Math.abs(x - target.x) <= halfWidth) {
        if (tBottom < tx) { tx = tBottom; ty = tBottom; }
      }
    }
  }
  if (nx !== 0) {
    const tLeft = (target.x - halfWidth - source.x) / dx;
    const tRight = (target.x + halfWidth - source.x) / dx;
    if (tLeft >= 0 && tLeft <= 1) {
      const y = source.y + tLeft * dy;
      if (Math.abs(y - target.y) <= halfHeight) {
        if (tLeft < tx) { tx = tLeft; ty = tLeft; }
      }
    }
    if (tRight >= 0 && tRight <= 1) {
      const y = source.y + tRight * dy;
      if (Math.abs(y - target.y) <= halfHeight) {
        if (tRight < tx) { tx = tRight; ty = tRight; }
      }
    }
  }
  if (tx !== Infinity) {
    return {
      x: source.x + tx * dx,
      y: source.y + ty * dy
    };
  }
  return target;
}

export function ConDecCanvas({
  diagram,
  selectedElement,
  mode,
  onSelectElement,
  onNodeRename,
  onRelationCreate,
  onNodeEdit,
  onRelationEdit,
  newRelation,
  setNewRelation,
  mousePosition,
  setMousePosition,
  draggedElement,
  setDraggedElement,
  onCanvasClick,
  canvasOffset = { x: 0, y: 0 },
  onCanvasMouseDown,
  onSelectionMouseMove,
  onSelectionMouseUp,
  zoom = 1,
  onCanvasWheel,
  selectionBox,
  onNodeMenuEdit,
  onNodeMenuDelete,
  onNodeMenuClose
}) {
  const svgRef = useRef();

  // --- Node drag/relation logic ---
  const handleNodeInteractionStart = (nodeId, e) => {
    if (mode === 'addRelation') {
      const sourceNode = diagram.nodes.find(n => n.id === nodeId);
      setNewRelation({
        sourceId: nodeId,
        sourceNode,
        targetId: null,
        targetNode: null,
        currentX: e.clientX,
        currentY: e.clientY
      });
    } else {
      setDraggedElement({
        id: nodeId,
        startX: e.clientX,
        startY: e.clientY,
        elementX: diagram.nodes.find(n => n.id === nodeId).x,
        elementY: diagram.nodes.find(n => n.id === nodeId).y
      });
    }
  };

  // --- Render nodes/relations with z-index management ---
  const renderDiagramElements = () => {
    if (!diagram || !diagram.nodes || !diagram.relations) return null;
    
    // Create a copy of nodes and relations to sort by z-index
    const nodes = [...diagram.nodes];
    const relations = [...diagram.relations];
    
    // Determine selected element IDs
    const selectedNodeId = selectedElement?.type === 'node' ? selectedElement.element.id : null;
    const selectedRelationId = selectedElement?.type === 'relation' ? selectedElement.element.id : null;
    
    // Sort relations to render selected ones on top
    relations.sort((a, b) => {
      if (a.id === selectedRelationId) return 1; // Selected relation on top
      if (b.id === selectedRelationId) return -1;
      return 0; // Keep original order for others
    });
    
    // Sort nodes to render selected ones on top
    nodes.sort((a, b) => {
      if (a.id === selectedNodeId) return 1; // Selected node on top
      if (b.id === selectedNodeId) return -1;
      return 0; // Keep original order for others
    });
    
    // Render relations first (they should be behind nodes)
    const relationElements = relations.map(relation => {
      const sourceNode = nodes.find(n => n.id === relation.sourceId);
      const targetNode = nodes.find(n => n.id === relation.targetId);
      if (!sourceNode || !targetNode) return null;
      
      const isSelected = selectedElement &&
        selectedElement.type === 'relation' &&
        selectedElement.element.id === relation.id;
      
      return (
        <ConDecRelation
          key={relation.id}
          relation={relation}
          sourceNode={sourceNode}
          targetNode={targetNode}
          isSelected={isSelected}
          onSelect={(e) => {
            e.stopPropagation();
            onSelectElement('relation', relation.id);
          }}
          calculateIntersectionPoint={calculateIntersectionPoint}
          onWaypointDrag={handleWaypointDrag}
          onWaypointDragEnd={handleWaypointDragEnd}
          canvasOffset={canvasOffset}
          zoom={zoom}
        />
      );
    });
    
    // Then render nodes (they should be on top of relations)
    const nodeElements = nodes.map(node => {
      const isSelected = selectedElement &&
        selectedElement.type === 'node' &&
        selectedElement.element.id === node.id;
      
      return (
        <React.Fragment key={node.id}>
          <ConDecNode
            node={node}
            isSelected={isSelected}
            mode={mode}
            onSelect={(e) => {
              e.stopPropagation();
              onSelectElement('node', node.id);
            }}
            onDoubleClick={() => {}}
            onDragStart={e => handleNodeInteractionStart(node.id, e)}
            onMenu={null}
            onRename={name => onNodeRename(node.id, name)}
            onRenameBlur={() => {}}
          />
          {isSelected && (
            <ConDecNodeMenu
              node={node}
              onEdit={() => onNodeMenuEdit(node)}
              onDelete={onNodeMenuDelete}
              onClose={onNodeMenuClose}
              zoom={zoom}
            />
          )}
        </React.Fragment>
      );
    });

    // Render temporary relation if creating a new one
    const temporaryRelation = newRelation && renderTemporaryRelation();
    
    return (
      <>
        {relationElements}
        {temporaryRelation}
        {nodeElements}
      </>
    );
  };

  const handleMouseMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    setMousePosition && setMousePosition({ x: currentX, y: currentY });

    if (draggedElement) {
      // Convert mouse movement to diagram coordinates (centered)
      const deltaX = (e.clientX - draggedElement.startX) / zoom;
      const deltaY = (e.clientY - draggedElement.startY) / zoom;
      const updatedNodes = diagram.nodes.map(node => {
        if (node.id === draggedElement.id) {
          return {
            ...node,
            x: draggedElement.elementX + deltaX,
            y: draggedElement.elementY + deltaY
          };
        }
        return node;
      });
      if (typeof onNodeEdit === 'function') onNodeEdit(updatedNodes);
    } else if (newRelation && newRelation.sourceId) {
      setNewRelation && setNewRelation(prev => ({
        ...prev,
        currentX: currentX,
        currentY: currentY
      }));
    } else if (mode === 'select' && selectionBox) {
      onSelectionMouseMove && onSelectionMouseMove(e);
    }
  };

  const handleMouseUp = (e) => {
    if (draggedElement) {
      setDraggedElement && setDraggedElement(null);
    } else if (newRelation && newRelation.sourceId) {
      const targetElement = e.target.closest('.condec-node');
      if (targetElement) {
        const targetId = targetElement.getAttribute('data-node-id');
        if (targetId && targetId !== newRelation.sourceId) {
          onRelationCreate && onRelationCreate(newRelation.sourceId, targetId);
        }
      }
      setNewRelation && setNewRelation(null);
    } else if (mode === 'select' && selectionBox) {
      onSelectionMouseUp && onSelectionMouseUp(e);
    }
  };

  // --- Relation waypoint handlers ---
  const handleWaypointDrag = (relationId, waypoints, updatedRelations) => {
    if (!relationId) return;
    
    // If updatedRelations is provided (e.g., when dragging label), use that
    if (updatedRelations) {
      onRelationEdit && onRelationEdit(updatedRelations);
      return;
    }
    
    // Otherwise, update only the waypoints
    const updatedRelationsList = diagram.relations.map(rel => 
      rel.id === relationId ? { ...rel, waypoints } : rel
    );
    
    onRelationEdit && onRelationEdit(updatedRelationsList);
  };
  
  const handleWaypointDragEnd = (relationId) => {
    // This function can be used to finalize the drag operation
    // e.g., saving to history stack for undo
  };

  const renderTemporaryRelation = () => {
    if (!newRelation || !newRelation.sourceNode) return null;
    // Convert source node position to canvas coordinates
    const sourcePoint = { x: newRelation.sourceNode.x, y: newRelation.sourceNode.y };
    // Get current mouse position as target
    const targetPoint = { 
      x: (newRelation.currentX - canvasOffset.x) / zoom, 
      y: (newRelation.currentY - canvasOffset.y) / zoom 
    };
    const sourceEdgePoint = calculateIntersectionPoint(targetPoint, sourcePoint);
    return (
      <line
        x1={sourceEdgePoint.x}
        y1={sourceEdgePoint.y}
        x2={targetPoint.x}
        y2={targetPoint.y}
        stroke="#1a73e8"
        strokeWidth="1.5"
        strokeDasharray="5,5"
        markerEnd="url(#arrow)"
        style={{ pointerEvents: 'none' }}
      />
    );
  };

  // Set cursor style based on current mode
  let cursorStyle = 'default';
  if (mode === 'hand') {
    cursorStyle = draggedElement ? 'grabbing' : 'default';
  } else if (mode === 'select') {
    cursorStyle = 'crosshair';
  }

  return (
    <div className="condec-canvas-container" style={{ flex: 1, position: 'relative' }}>
      <svg
        ref={svgRef}
        className="condec-canvas"
        width="100%"
        height="100%"
        onClick={onCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseDown={onCanvasMouseDown}
        onWheel={onCanvasWheel}
        style={{ cursor: cursorStyle, userSelect: 'none' }}
      >
        <g transform={`translate(${canvasOffset.x},${canvasOffset.y}) scale(${zoom})`}>
          <defs>
            <marker 
              id="arrow" 
              markerWidth="18" 
              markerHeight="18" 
              refX="12" 
              refY="4.5" 
              orient="auto" 
              markerUnits="strokeWidth">
              <path d="M0,0 L0,9 L13,4.5 z" fill="#333" />
            </marker>
            <marker 
              id="arrow-neg" 
              markerWidth="18" 
              markerHeight="18" 
              refX="12" 
              refY="4.5" 
              orient="auto" 
              markerUnits="strokeWidth">
              <path d="M0,0 L0,9 L13,4.5 z" fill="red" />
            </marker>
            <marker 
              id="arrow-start" 
              markerWidth="18" 
              markerHeight="18" 
              refX="6" 
              refY="4.5" 
              orient="auto" 
              markerUnits="strokeWidth">
              <path d="M13,0 L13,9 L0,4.5 z" fill="#333" />
            </marker>
            <marker 
              id="arrow-neg-start" 
              markerWidth="18" 
              markerHeight="18" 
              refX="6" 
              refY="4.5" 
              orient="auto" 
              markerUnits="strokeWidth">
              <path d="M13,0 L13,9 L0,4.5 z" fill="red" />
            </marker>
          </defs>
          
          {/* Render diagram elements with z-index management */}
          {renderDiagramElements()}
          
          {/* Render selection box if active */}
          {mode === 'select' && selectionBox && (
            <rect
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.width}
              height={selectionBox.height}
              fill="rgba(66, 133, 244, 0.1)"
              stroke="#4285f4"
              strokeWidth={1/zoom}
              strokeDasharray={`${4/zoom},${2/zoom}`}
              pointerEvents="none"
            />
          )}
        </g>
      </svg>
    </div>
  );
}