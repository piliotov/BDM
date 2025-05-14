import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { ConDecRelation } from './ConDecRelations';
import { ConDecNode } from './ConDecNode';
import { ConDecNodeMenu } from './FloatingNodeMenu'; 
import { calculateIntersectionPoint } from '../utils/geometryUtils';
import { useCanvasPanning } from '../utils/canvasUtils';
import { updateRelationsForNode, updateRelationWithFixedEndpoints } from '../utils/relationUtils';
import { RelationMarkers } from '../utils/relationIconUtils';
import {
  endConnectMode,
  getConnectModeState,
} from '../utils/connectModeUtils';

export const ConDecCanvas = forwardRef(function ConDecCanvas(props, ref) {
  const {
    diagram,
    selectedElement,
    mode,
    onNodeEdit,
    onRelationEdit,
    setMousePosition,
    draggedElement,
    setDraggedElement,
    onCanvasClick,
    canvasOffset = { x: 0, y: 0 },
    setCanvasOffset,
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

  // State for tracking relation source when using connect from node menu
  const [connectFromNodeMenu, setConnectFromNodeMenu] = useState(null);

  // State for two-step relation creation
  const [relationCreationState, setRelationCreationState] = useState({
    active: false,
    sourceNode: null,
    sourceId: null
  });
  const [relationMouse, setRelationMouse] = useState(null);

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
      // Only allow setting source if not already active
      if (!relationCreationState.active) {
        const sourceNode = diagram.nodes.find(n => n.id === nodeId);
        setRelationCreationState({
          active: true,
          sourceNode,
          sourceId: nodeId
        });
      }
      // If already active, do nothing (wait for target)
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
            props.onSelectElement('relation', relation.id);
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
        if (props.onRelationCreate) {
          props.onRelationCreate(connectFromNodeMenu.sourceId, nodeId);
        }
        setConnectFromNodeMenu(null);
        if (props.setMode) props.setMode('hand');
        return;
      }
      
      // --- Palette relation tool: click source, then click target ---
      if (props.mode === 'addRelation') {
        if (!relationCreationState.active) {
          // First click: set source node
          const sourceNode = diagram.nodes.find(n => n.id === nodeId);
          setRelationCreationState({
            active: true,
            sourceNode,
            sourceId: nodeId
          });
          setRelationMouse(null);
          return;
        } else if (
          relationCreationState.active &&
          nodeId !== relationCreationState.sourceId
        ) {
          // Only allow target selection if source is already set and target is different
          if (props.onRelationCreate) {
            props.onRelationCreate(relationCreationState.sourceId, nodeId);
          }
          setRelationCreationState({
            active: false,
            sourceNode: null,
            sourceId: null
          });
          setRelationMouse(null);
          return;
        }
        // If already active and clicking the source again, ignore (do not reset source)
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
              // Enable connect-from-node-menu mode with visual feedback
              setConnectFromNodeMenu({ 
                sourceId: node.id,
                sourceNode: node  // Store the entire node to draw the line
              });
              if (props.setMode) props.setMode('connectFromNodeMenu');
            }}
          />
        );
      }
    }

    // --- Show temporary line for relation creation modes ---
    let temporaryRelation = null;
    
    // For addRelation mode (palette tool)
    if (
      props.mode === 'addRelation' &&
      relationCreationState.active &&
      relationCreationState.sourceNode &&
      relationMouse
    ) {
      const sourcePoint = { x: relationCreationState.sourceNode.x, y: relationCreationState.sourceNode.y };
      const targetPoint = {
        x: (relationMouse.x - (props.canvasOffset?.x || 0)) / (props.zoom || 1),
        y: (relationMouse.y - (props.canvasOffset?.y || 0)) / (props.zoom || 1)
      };

      temporaryRelation = (
        <>
          <line
            x1={sourcePoint.x}
            y1={sourcePoint.y}
            x2={targetPoint.x}
            y2={targetPoint.y}
            stroke="#1a73e8"
            strokeWidth="1.5"
            strokeDasharray="5,5"
            markerEnd="url(#arrow)"
            style={{ pointerEvents: 'none' }}
          />
          <circle
            cx={sourcePoint.x}
            cy={sourcePoint.y}
            r="3"
            fill="#1a73e8"
            style={{ pointerEvents: 'none' }}
          />
        </>
      );
    }
    // For connect-from-node-menu mode (floating menu)
    else if (
      props.mode === 'connectFromNodeMenu' &&
      connectFromNodeMenu &&
      connectFromNodeMenu.sourceNode &&
      props.mousePosition
    ) {
      const sourceNode = connectFromNodeMenu.sourceNode;
      const sourcePoint = { x: sourceNode.x, y: sourceNode.y };
      const targetPoint = {
        x: (props.mousePosition.x - (props.canvasOffset?.x || 0)) / (props.zoom || 1),
        y: (props.mousePosition.y - (props.canvasOffset?.y || 0)) / (props.zoom || 1)
      };
      temporaryRelation = (
        <>
          <line
            x1={sourcePoint.x}
            y1={sourcePoint.y}
            x2={targetPoint.x}
            y2={targetPoint.y}
            stroke="#1a73e8"
            strokeWidth="1.5"
            strokeDasharray="5,5"
            markerEnd="url(#arrow)"
            style={{ pointerEvents: 'none' }}
          />
          <circle
            cx={sourcePoint.x}
            cy={sourcePoint.y}
            r="3"
            fill="#1a73e8"
            style={{ pointerEvents: 'none' }}
          />
        </>
      );
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

  // Enhance handleMouseMove to show alignment guides and update temporary relation
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

    // Handle node dragging
    if (draggedElement) {
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

      const draggedNode = updatedNodes.find(node => node.id === draggedElement.id);
      const updatedRelations = updateRelationsForNode(draggedNode, { ...diagram, nodes: updatedNodes });

      if (typeof onNodeEdit === 'function') {
        onNodeEdit(updatedNodes);
      }
      if (typeof onRelationEdit === 'function') {
        onRelationEdit(updatedRelations);
      }

      const guides = getAlignmentGuides(draggedNode, updatedNodes);
      setAlignmentGuides(guides);
    } else {
      setAlignmentGuides({ x: null, y: null });
      
      // Update mouse position for temporary relation in any of the relation modes
      if (((mode === 'addRelation' && relationCreationState.active) || 
           mode === 'connectFromNodeMenu') && !draggedElement) {
        setMousePosition({ x: currentX, y: currentY });
      }
      
      if (mode === 'addRelation' && relationCreationState.active && !draggedElement) {
        setRelationMouse({ x: currentX, y: currentY });
      }
      
      if (mode === 'select' && selectionBox) {
        onSelectionMouseMove && onSelectionMouseMove(e);
      }
    }
  };

  // Enhance handleMouseUp to clear guides
  const handleMouseUp = (e) => {
    if (isPanning) {
      handlePanEnd();
      return;
    }

    if (draggedElement) {
      setDraggedElement && setDraggedElement(null);
    } else if (connectFromNodeMenu && connectFromNodeMenu.sourceId) {
      const targetElement = e.target.closest('.condec-node');
      if (targetElement) {
        const targetId = targetElement.getAttribute('data-node-id');
        if (targetId && targetId !== connectFromNodeMenu.sourceId) {
          props.onRelationCreate && props.onRelationCreate(connectFromNodeMenu.sourceId, targetId);
        }
      }
      setConnectFromNodeMenu(null);
      if (props.setMode) props.setMode('hand');
    } else if (mode === 'select' && selectionBox) {
      onSelectionMouseUp && onSelectionMouseUp(e);
    }
    setAlignmentGuides({ x: null, y: null });
  };

  const handleCanvasClick = (e) => {
    if (!e.target.classList.contains('condec-canvas')) {
      return;
    }
    
    if (relationCreationState.active) {
      setRelationCreationState({
        active: false,
        sourceNode: null,
        sourceId: null,
        tempWaypoints: null
      });
      setRelationMouse(null);
      return;
    }
    
    if (relationCreationState.active || connectFromNodeMenu || mode === 'connectFromNodeMenu') {
      setRelationCreationState({
        active: false,
        sourceNode: null,
        sourceId: null
      });
      setRelationMouse(null);
      setConnectFromNodeMenu(null);
      if (props.setMode && mode === 'connectFromNodeMenu') {
        props.setMode('hand');
      }
      return;
    }
    
    if (mode === 'select') {
      if (props.setMode) {
        props.setMode('hand');
      }
      return;
    }
    
    if (getConnectModeState().isActive) {
      endConnectMode();
      return;
    }
    
    if (onCanvasClick) onCanvasClick(e);
  };

  const handleCanvasMouseDown = (e) => {
    // Start panning if in hand mode and left mouse button is pressed
    if (mode === 'hand' && e.button === 0 && e.target.classList.contains('condec-canvas')) {
      handlePanStart(e);
      return;
    }
    // Otherwise, delegate to the provided handler
    if (props.onCanvasMouseDown) {
      props.onCanvasMouseDown(e);
    }
  };

  const handleWaypointDrag = (relationId, waypoints, updatedRelations) => {
    if (!relationId) return;
    
    if (updatedRelations) {
      const mergedRelations = diagram.relations.map(rel => {
        const updatedRel = updatedRelations.find(r => r.id === rel.id);
        return updatedRel || rel;
      });
      
      onRelationEdit && onRelationEdit(mergedRelations);
      return;
    }
    
    const relationToUpdate = diagram.relations.find(rel => rel.id === relationId);
    if (!relationToUpdate) return;
    
    const updatedRelation = updateRelationWithFixedEndpoints(
      relationToUpdate,
      waypoints,
      diagram
    );
    
    const updatedRelationsList = diagram.relations.map(rel => 
      rel.id === relationId ? updatedRelation : rel
    );
    
    onRelationEdit && onRelationEdit(updatedRelationsList);
  };

  const handleWaypointDragEnd = (relationId, isLabelDrag = false) => {
    if (!relationId) return;

    if (typeof onRelationEdit === 'function' && diagram.relations) {
      saveToUndoStack && saveToUndoStack();
      
      const relation = diagram.relations.find(r => r.id === relationId);
      if (relation) {
        const updatedRelations = diagram.relations.map(r => 
          r.id === relationId ? relation : r
        );
        
        onRelationEdit(updatedRelations);
      }
    }
  };

  let cursorStyle = 'default';
  if (mode === 'hand') {
    cursorStyle = isPanning ? 'grabbing' : (draggedElement ? 'grabbing' : 'grab');
  } else if (mode === 'select') {
    cursorStyle = 'crosshair';
  } else if (mode === 'addRelation') {
    cursorStyle = relationCreationState.active ? 'crosshair' : 'pointer';
  } else if (mode === 'connectFromNodeMenu') {
    cursorStyle = connectFromNodeMenu ? 'crosshair' : 'pointer';
  }

  return (
    <div className="condec-canvas-container" style={{ flex: 1, position: 'relative' }}>
      {(connectFromNodeMenu || relationCreationState.active) && (
        <div 
          style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(25, 118, 210, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            zIndex: 1000,
            pointerEvents: 'none',
            fontSize: '14px'
          }}
        >
          {relationCreationState.active ? 
            "Click on a target node to create relation or click on canvas to cancel" :
            "Click on a target node to create relation or click on empty space to cancel"}
        </div>
      )}
      
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
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: cursorStyle, userSelect: 'none' }}
      >
        <RelationMarkers />

        <g transform={`translate(${canvasOffset.x},${canvasOffset.y}) scale(${zoom})`}>
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
          {renderDiagramElements()}
          
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