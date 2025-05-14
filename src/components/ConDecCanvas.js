import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { ConDecRelation } from './ConDecRelations';
import { ConDecNode } from './ConDecNode';
import { ConDecNodeMenu } from './FloatingNodeMenu'; // <-- Add this import
import { calculateIntersectionPoint } from '../utils/geometryUtils';
import { useCanvasPanning } from '../utils/canvasUtils';
import { updateRelationsForNode } from '../utils/relationUtils';
import { RelationMarkers } from '../utils/relationIconUtils';
import {
  startConnectMode,
  endConnectMode,
  getConnectModeState,
  shouldHandleNodeClick
} from '../utils/connectModeUtils';

export const ConDecCanvas = forwardRef(function ConDecCanvas(props, ref) {
  const {
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
    setMousePosition,
    draggedElement,
    setDraggedElement,
    onCanvasClick,
    canvasOffset = { x: 0, y: 0 },
    setCanvasOffset,
    onCanvasMouseDown,
    onSelectionMouseMove,
    onSelectionMouseUp,
    zoom = 1,
    onCanvasWheel,
    selectionBox,
    isPanning = false,
    setIsPanning,
    panStart = { x: 0, y: 0 },
    setPanStart,
    panOrigin = { x: 0, y: 0 },
    setPanOrigin,
    multiSelectedNodes = [],
    renderMultiSelectBoundingBox,
    renderMultiSelectMenu,
    saveToUndoStack,
  } = props;

  // Always call useRef
  const svgRef = useRef();

  // Forward the ref if provided
  useImperativeHandle(ref, () => svgRef.current, []);

  const [alignmentGuides, setAlignmentGuides] = useState({ x: null, y: null });

  // Add state for connect-from-node-menu mode
  const [connectFromNodeMenu, setConnectFromNodeMenu] = useState(null);

  // Set up canvas panning functionality
  const { handlePanStart, handlePanMove, handlePanEnd } = useCanvasPanning({
    setCanvasOffset,
    setIsPanning,
    setPanStart,
    setPanOrigin,
    canvasOffset,
    zoom
  });

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
    
    const nodes = [...diagram.nodes];
    const relations = [...diagram.relations];
    
    const selectedNodeId = selectedElement?.type === 'node' ? selectedElement.element.id : null;
    const selectedRelationId = selectedElement?.type === 'relation' ? selectedElement.element.id : null;
    
    relations.sort((a, b) => {
      if (a.id === selectedRelationId) return 1; 
      if (b.id === selectedRelationId) return -1;
      return 0;
    });
    
    nodes.sort((a, b) => {
      if (a.id === selectedNodeId) return 1; 
      if (b.id === selectedNodeId) return -1;
      return 0;
    });
    
    const relationElements = relations.map(relation => {
      const sourceNode = nodes.find(n => n.id === relation.sourceId);
      const targetNode = nodes.find(n => n.id === relation.targetId);
      if (!sourceNode || !targetNode) return null;
      
      const isSelected = !multiSelectedNodes.length && selectedElement &&
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
          saveToUndoStack={saveToUndoStack}
        />
      );
    });
    
    const handleNodeClick = (nodeId, e) => {
      e.stopPropagation();
      // --- Handle connect-from-node-menu mode ---
      if (connectFromNodeMenu && connectFromNodeMenu.sourceId && nodeId !== connectFromNodeMenu.sourceId) {
        // Create relation from sourceId to nodeId
        if (props.onRelationCreate) {
          props.onRelationCreate(connectFromNodeMenu.sourceId, nodeId);
        }
        setConnectFromNodeMenu(null);
        if (props.setMode) props.setMode('hand');
        return;
      }
      // --- Handle palette addRelation mode (drag) ---
      if (props.mode === 'addRelation' && props.setNewRelation) {
        // Start drag mode as before
        const sourceNode = diagram.nodes.find(n => n.id === nodeId);
        props.setNewRelation({
          sourceId: nodeId,
          sourceNode,
          targetId: null,
          targetNode: null,
          currentX: sourceNode.x,
          currentY: sourceNode.y
        });
        return;
      }
      // Otherwise, normal selection
      props.onSelectElement('node', nodeId);
    };

    const nodeElements = nodes.map(node => {
      const isSelected = !multiSelectedNodes.length && selectedElement &&
        selectedElement.type === 'node' &&
        selectedElement.element.id === node.id;
      
      return (
        <React.Fragment key={node.id}>
          <ConDecNode
            node={node}
            isSelected={isSelected}
            mode={props.mode}
            onSelect={(e) => handleNodeClick(node.id, e)}
            onDoubleClick={() => {}}
            onDragStart={e => handleNodeInteractionStart(node.id, e)}
            onMenu={null}
            onRename={(newName, clearEditing) => {
              if (clearEditing) {
                const updatedNodes = diagram.nodes.map(n =>
                  n.id === node.id
                    ? { ...n, name: newName, editing: undefined }
                    : n
                );
                if (typeof props.onNodeEdit === 'function') {
                  props.onNodeEdit(updatedNodes);
                }
              } else {
                // Just update name
                const updatedNodes = diagram.nodes.map(n =>
                  n.id === node.id
                    ? { ...n, name: newName }
                    : n
                );
                if (typeof props.onNodeEdit === 'function') {
                  props.onNodeEdit(updatedNodes);
                }
              }
            }}
            onRenameBlur={() => {}}
          />
        </React.Fragment>
      );
    });

    // --- Render floating menu for selected node (if not multi-selected) ---
    let nodeMenu = null;
    if (
      selectedElement &&
      selectedElement.type === 'node' &&
      (!multiSelectedNodes || !multiSelectedNodes.length)
    ) {
      const node = nodes.find(n => n.id === selectedElement.element.id);
      if (node) {
        nodeMenu = (
          <ConDecNodeMenu
            node={node}
            diagram={diagram}
            onEdit={props.onNodeMenuEdit}
            onDelete={props.onNodeMenuDelete}
            onAppend={props.onAppend}
            onClose={props.onNodeMenuClose}
            zoom={zoom}
            onConnect={(node) => {
              // Enable connect-from-node-menu mode
              setConnectFromNodeMenu({ sourceId: node.id });
              if (props.setMode) props.setMode('connectFromNodeMenu');
            }}
          />
        );
      }
    }

    // --- Show temporary line for connect-from-node-menu mode ---
    let temporaryRelation = null;
    if (connectFromNodeMenu && connectFromNodeMenu.sourceId) {
      const sourceNode = nodes.find(n => n.id === connectFromNodeMenu.sourceId);
      if (sourceNode && props.mousePosition) {
        const sourcePoint = { x: sourceNode.x, y: sourceNode.y };
        const targetPoint = {
          x: (props.mousePosition.x - (props.canvasOffset?.x || 0)) / (props.zoom || 1),
          y: (props.mousePosition.y - (props.canvasOffset?.y || 0)) / (props.zoom || 1)
        };
        const sourceEdgePoint = calculateIntersectionPoint(targetPoint, sourcePoint);
        temporaryRelation = (
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
      }
    } else if (props.newRelation && props.newRelation.sourceNode) {
      // ...existing code for palette drag mode...
      temporaryRelation = renderTemporaryRelation();
    }

    return (
      <>
        {relationElements}
        {temporaryRelation}
        {nodeElements}
        {nodeMenu}
        {/* Render blue bounding box for multi-select */}
        {renderMultiSelectBoundingBox && renderMultiSelectBoundingBox()}
        {/* Render floating menu for multi-select */}
        {renderMultiSelectMenu && renderMultiSelectMenu()}
      </>
    );
  };

  // Helper: find alignment lines for the dragged node
  function getAlignmentGuides(draggedNode, nodes) {
    if (!draggedNode) return { x: null, y: null };
    // Snap threshold (in px)
    const threshold = 2;
    let guideX = null, guideY = null;
    for (const n of nodes) {
      if (n.id === draggedNode.id) continue;
      if (Math.abs(n.x - draggedNode.x) <= threshold) guideX = n.x;
      if (Math.abs(n.y - draggedNode.y) <= threshold) guideY = n.y;
    }
    return { x: guideX, y: guideY };
  }

  // Enhance handleMouseMove to show alignment guides
  const handleMouseMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    setMousePosition && setMousePosition({ x: currentX, y: currentY });

    // Handle panning when in hand mode and mouse button is pressed
    if (isPanning && mode === 'hand') {
      handlePanMove(e, isPanning, panStart, panOrigin);
      return;
    }

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

      // Update relations connected to the dragged node
      const draggedNode = updatedNodes.find(node => node.id === draggedElement.id);
      const updatedRelations = updateRelationsForNode(draggedNode, { ...diagram, nodes: updatedNodes });

      // Update diagram with new node positions and relation waypoints
      if (typeof onNodeEdit === 'function') {
        onNodeEdit(updatedNodes);
      }
      if (typeof onRelationEdit === 'function') {
        onRelationEdit(updatedRelations);
      }

      // Find alignment guides
      const guides = getAlignmentGuides(draggedNode, updatedNodes);
      setAlignmentGuides(guides);
    } else {
      setAlignmentGuides({ x: null, y: null });
      if (newRelation && newRelation.sourceId) {
        setNewRelation && setNewRelation(prev => ({
          ...prev,
          currentX: currentX,
          currentY: currentY
        }));
      } else if (mode === 'select' && selectionBox) {
        onSelectionMouseMove && onSelectionMouseMove(e);
      }
    }
  };

  // Enhance handleMouseUp to clear guides
  const handleMouseUp = (e) => {
    // End panning if active
    if (isPanning) {
      handlePanEnd();
      return;
    }

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
    setAlignmentGuides({ x: null, y: null });
  };

  // Enhanced canvas mouse down handler to support panning
  const handleCanvasMouseDown = (e) => {
    // Start panning if in hand mode and left mouse button is pressed
    if (mode === 'hand' && e.button === 0 && e.target.classList.contains('condec-canvas')) {
      handlePanStart(e);
      return;
    }
    
    // Otherwise, delegate to the provided handler
    if (onCanvasMouseDown) {
      onCanvasMouseDown(e);
    }
  };

  const handleCanvasClick = (e) => {
    if (connectFromNodeMenu) {
      setConnectFromNodeMenu(null);
      if (props.setMode) props.setMode('hand');
      return;
    }
    if (getConnectModeState().isActive) {
      endConnectMode();
      // Optionally, reset mode or UI
      return;
    }
    if (onCanvasClick) onCanvasClick(e);
  };

  // --- Relation waypoint handlers ---
  const handleWaypointDrag = (relationId, waypoints, updatedRelations) => {
    if (!relationId) return;
    
    // If updatedRelations is provided (e.g., when dragging label), use that
    if (updatedRelations) {
      // Create a merged list of relations, replacing only the updated one
      const mergedRelations = diagram.relations.map(rel => {
        // Find if this relation is in updatedRelations
        const updatedRel = updatedRelations.find(r => r.id === rel.id);
        // If found, use the updated version, otherwise keep the existing one
        return updatedRel || rel;
      });
      
      onRelationEdit && onRelationEdit(mergedRelations);
      return;
    }
    
    // Otherwise, update only the waypoints
    const updatedRelationsList = diagram.relations.map(rel => 
      rel.id === relationId ? { ...rel, waypoints } : rel
    );
    
    onRelationEdit && onRelationEdit(updatedRelationsList);
  };
  
  // Enhance the handleWaypointDragEnd function to properly save label positions
  const handleWaypointDragEnd = (relationId, isLabelDrag = false) => {
    if (!relationId) return;

    if (typeof onRelationEdit === 'function' && diagram.relations) {
      saveToUndoStack && saveToUndoStack();
      
      const relation = diagram.relations.find(r => r.id === relationId);
      if (relation) {
        // Make sure we keep any updates to the relation
        const updatedRelations = diagram.relations.map(r => 
          r.id === relationId ? relation : r
        );
        
        onRelationEdit(updatedRelations);
      }
    }
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
    cursorStyle = isPanning ? 'grabbing' : (draggedElement ? 'grabbing' : 'grab');
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
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseDown={handleCanvasMouseDown}
        onWheel={onCanvasWheel}
        onContextMenu={(e) => e.preventDefault()} // Prevent default context menu
        style={{ cursor: cursorStyle, userSelect: 'none' }}
      >
        {/* Use the RelationMarkers component from the utility */}
        <RelationMarkers />

        <g transform={`translate(${canvasOffset.x},${canvasOffset.y}) scale(${zoom})`}>
          {/* Render alignment guides */}
          {alignmentGuides.x !== null && (
            <line
              x1={alignmentGuides.x}
              y1={-10000}
              x2={alignmentGuides.x}
              y2={10000}
              stroke="#1976d2"
              strokeWidth={1.5/zoom}
              strokeDasharray="4,2"
              pointerEvents="none"
            />
          )}
          {alignmentGuides.y !== null && (
            <line
              x1={-10000}
              y1={alignmentGuides.y}
              x2={10000}
              y2={alignmentGuides.y}
              stroke="#1976d2"
              strokeWidth={1.5/zoom}
              strokeDasharray="4,2"
              pointerEvents="none"
            />
          )}
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
});