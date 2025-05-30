import React, { useRef, useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import {
  useCanvasPanning,
  RelationMarkers,
  endConnectMode,
  getConnectModeState,
  getAlignmentGuidesForPoint,
  renderAlignmentGuidesSVG,
  getNodeCenter,
  getNodeEdgePoint,
  handleLassoMouseDown,
  handleLassoMouseMove,
  handleLassoMouseUp,
  renderLassoBox,
  renderMultiSelectBoundingBox,
  renderMultiSelectMenu,
  renderHologramNode,
  handleCanvasMouseMove,
  handleCanvasMouseUp,
  handleCanvasMouseDown,
  renderDiagramElements
} from '../utils/canvas';


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
    zoom = 1,
    onCanvasWheel,
    selectionBox,
    isPanning = false,
    setIsPanning,
    setPanStart,
    setPanOrigin,
    multiSelectedNodes = [],
    multiSelectedElements = { nodes: [], relationPoints: [], naryDiamonds: [] },
    saveToUndoStack,
    naryStartNode,
    naryMouse,
    onNaryRelationClick,
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

  // Add state for diamond dragging
  const [draggedDiamond, setDraggedDiamond] = useState(null);

  // Track latest node sizes by id
  const [nodeSizes, setNodeSizes] = useState({});

  // Callback to update node size from ConDecNode
  const handleNodeSize = (nodeId, size) => {
    setNodeSizes(prev => {
      if (!size || !nodeId) return prev;
      if (prev[nodeId] && prev[nodeId].width === size.width && prev[nodeId].height === size.height) return prev;
      return { ...prev, [nodeId]: size };
    });
    if (props.onNodeSizeChange) {
      props.onNodeSizeChange(nodeId, size);
    }
  };

  // Set up canvas panning functionality
  const { handlePanStart, handlePanMove, handlePanEnd } = useCanvasPanning({
    setCanvasOffset,
    setIsPanning,
    setPanStart,
    setPanOrigin,
    canvasOffset,
    zoom
  });

  // --- Lasso (multi-select) state ---
  const [lassoStart, setLassoStart] = useState(null);
  const [lassoBox, setLassoBox] = useState(null);
  const lassoActive = mode === 'select';
  // Track if lasso was started on empty canvas
  const lassoStartedOnCanvas = useRef(false);

  // --- Multi-select drag state ---
  const [multiDragStart, setMultiDragStart] = useState(null);

  // --- Node drag/relation logic ---
  const handleNodeInteractionStart = (nodeId, e) => {
    // Check if we have an extended multi-selection (includes relation points or nary diamonds)
    const hasExtendedSelection = multiSelectedElements && 
      (multiSelectedElements.relationPoints?.length > 0 || multiSelectedElements.naryDiamonds?.length > 0);
    
    // If extended multi-select is active and node is in selection, start group drag
    if (hasExtendedSelection) {
      const totalElements = (multiSelectedElements.nodes?.length || 0) + 
                           (multiSelectedElements.relationPoints?.length || 0) + 
                           (multiSelectedElements.naryDiamonds?.length || 0);
      const nodeInSelection = multiSelectedElements.nodes?.find(n => n.id === nodeId);
      
      if (totalElements > 1 && nodeInSelection) {
        setMultiDragStart({
          type: 'extended',
          startX: e.clientX,
          startY: e.clientY,
          selectedElements: {
            nodes: multiSelectedElements.nodes?.map(n => ({ id: n.id, x: n.x, y: n.y })) || [],
            relationPoints: multiSelectedElements.relationPoints?.map(rp => ({ 
              relationId: rp.relationId, 
              waypointIndex: rp.waypointIndex, 
              x: rp.x, 
              y: rp.y 
            })) || [],
            naryDiamonds: multiSelectedElements.naryDiamonds?.map(nd => ({ 
              relationId: nd.relationId, 
              x: nd.x, 
              y: nd.y 
            })) || []
          }
        });
        e.stopPropagation();
        return;
      }
    }
    // If traditional multi-select is active and node is in selection, start group drag
    else if (multiSelectedNodes && multiSelectedNodes.length > 1 && multiSelectedNodes.find(n => n.id === nodeId)) {
      setMultiDragStart({
        type: 'nodes',
        nodeIds: multiSelectedNodes.map(n => n.id),
        startX: e.clientX,
        startY: e.clientY,
        nodePositions: multiSelectedNodes.map(n => ({ id: n.id, x: n.x, y: n.y }))
      });
      e.stopPropagation();
      return;
    }
    // In select mode, select node and allow dragging
    if (mode === 'select') {
      if (props.onSelectElement) {
        props.onSelectElement('node', nodeId);
      }
      if (diagram && Array.isArray(diagram.nodes)) {
        const foundNode = diagram.nodes.find(n => n.id === nodeId);
        setDraggedElement({
          id: nodeId,
          startX: e.clientX,
          startY: e.clientY,
          elementX: foundNode ? foundNode.x : 0,
          elementY: foundNode ? foundNode.y : 0
        });
      }
      e.stopPropagation();
      return;
    }
    // In hand mode, allow dragging
    if (mode === 'hand') {
      if (diagram && Array.isArray(diagram.nodes)) {
        const foundNode = diagram.nodes.find(n => n.id === nodeId);
        setDraggedElement({
          id: nodeId,
          startX: e.clientX,
          startY: e.clientY,
          elementX: foundNode ? foundNode.x : 0,
          elementY: foundNode ? foundNode.y : 0
        });
      }
      e.stopPropagation();
      return;
    }
    if (mode === 'addRelation') {
      // Only allow setting source if not already active
      if (!relationCreationState.active && diagram && Array.isArray(diagram.nodes)) {
        const sourceNode = diagram.nodes.find(n => n.id === nodeId);
        setRelationCreationState({
          active: true,
          sourceNode,
          sourceId: nodeId
        });
      }
      // If already active, do nothing (wait for target)
    }
  };

  const handleNaryDiamondInteractionStart = (relationId, x, y, e) => {
    // Check if we have an extended multi-selection that includes this nary diamond
    const hasExtendedSelection = multiSelectedElements && 
      (multiSelectedElements.relationPoints?.length > 0 || multiSelectedElements.naryDiamonds?.length > 0);
    
    if (hasExtendedSelection) {
      const totalElements = (multiSelectedElements.nodes?.length || 0) + 
                           (multiSelectedElements.relationPoints?.length || 0) + 
                           (multiSelectedElements.naryDiamonds?.length || 0);
      const diamondInSelection = multiSelectedElements.naryDiamonds?.find(nd => 
        nd.relationId === relationId);
      
      if (totalElements > 1 && diamondInSelection) {
        setMultiDragStart({
          type: 'extended',
          startX: e.clientX,
          startY: e.clientY,
          selectedElements: {
            nodes: multiSelectedElements.nodes?.map(n => ({ id: n.id, x: n.x, y: n.y })) || [],
            relationPoints: multiSelectedElements.relationPoints?.map(rp => ({ 
              relationId: rp.relationId, 
              waypointIndex: rp.waypointIndex, 
              x: rp.x, 
              y: rp.y 
            })) || [],
            naryDiamonds: multiSelectedElements.naryDiamonds?.map(nd => ({ 
              relationId: nd.relationId, 
              x: nd.x, 
              y: nd.y 
            })) || []
          }
        });
        e.stopPropagation();
        return;
      }
    }
  
    if (mode !== 'hand') return;
    e.stopPropagation();
    
    // Find the relation to get its diamond position
    const relation = diagram?.relations?.find(r => r.id === relationId);
    if (!relation) return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    
    setDraggedDiamond({
      relationId: relation.id,
      startX,
      startY,
      originalPos: { ...relation.diamondPos }
    });
    
    // Only call saveToUndoStack if it's available
    if (saveToUndoStack) {
      saveToUndoStack();
    }
  };

  const handleWaypointDrag = (relationId, waypoints, updatedRelations) => {
    if (!relationId) return;
    if (updatedRelations && diagram && Array.isArray(diagram.relations)) {
      const mergedRelations = diagram.relations.map(rel => {
        const updatedRel = updatedRelations.find(r => r.id === rel.id);
        return updatedRel || rel;
      });
      onRelationEdit && onRelationEdit(mergedRelations);
      return;
    }
    if (diagram && Array.isArray(diagram.relations)) {
      const relationToUpdate = diagram.relations.find(rel => rel.id === relationId);
      if (!relationToUpdate) return;
      const updatedRelation = {
        ...relationToUpdate,
        waypoints: waypoints
      };
      const updatedRelationsList = diagram.relations.map(rel =>
        rel.id === relationId ? updatedRelation : rel
      );
      onRelationEdit && onRelationEdit(updatedRelationsList);
    }
  };

  const handleWaypointDragEnd = (relationId, isLabelDrag = false, prevWaypoints = null) => {
    if (!relationId) return;
    if (typeof onRelationEdit === 'function' && diagram && Array.isArray(diagram.relations)) {
      // Only save to undo stack if waypoints actually changed
      const relation = diagram.relations.find(r => r.id === relationId);
      if (relation && prevWaypoints && Array.isArray(relation.waypoints) && Array.isArray(prevWaypoints)) {
        const changed = relation.waypoints.length !== prevWaypoints.length ||
          relation.waypoints.some((wp, i) => !prevWaypoints[i] || wp.x !== prevWaypoints[i].x || wp.y !== prevWaypoints[i].y);
        if (changed && saveToUndoStack) saveToUndoStack();
      } else if (saveToUndoStack) {
        // Fallback: always save if no previous waypoints provided
        saveToUndoStack();
      }
      const updatedRelations = diagram.relations.map(r =>
        r.id === relationId ? relation : r
      );
      onRelationEdit(updatedRelations);
    }
  };

  // Handler for alignment check from relation drag
  const handleAlignmentCheck = (point, relationId = null) => {
    if (diagram && Array.isArray(diagram.nodes) && Array.isArray(diagram.relations)) {
      const guides = getAlignmentGuidesForPoint(point, diagram.nodes);
      setAlignmentGuides(guides);
    }
  };

  // --- Render alignment guides as SVG lines ---
  function renderAlignmentGuides() {
    return renderAlignmentGuidesSVG(alignmentGuides, zoom);
  }

  // --- Render nodes/relations with z-index management ---
  const renderDiagramElementsWrapper = () => {
    return renderDiagramElements({
      diagram,
      selectedElement,
      multiSelectedNodes,
      mode,
      zoom,
      naryStartNode,
      naryMouse,
      relationCreationState,
      relationMouse,
      connectFromNodeMenu,
      nodeSizes,
      props,
      handleNodeInteractionStart,
      handleNaryDiamondInteractionStart,
      handleWaypointDrag,
      handleWaypointDragEnd,
      handleAlignmentCheck,
      handleNodeSize,
      canvasOffset,
      saveToUndoStack,
      setConnectFromNodeMenu,
      setRelationCreationState,
      setRelationMouse,
      onNaryRelationClick,
      getNodeCenter,
      getNodeEdgePoint,
      renderAlignmentGuides
    });
  };

  // Enhance handleMouseMove to show alignment guides and update temporary relation
  const handleMouseMoveWrapper = (e) => {
    handleCanvasMouseMove({
      e,
      isPanning,
      handlePanMove,
      lassoActive,
      lassoStart,
      lassoStartedOnCanvas,
      multiDragStart,
      diagram,
      zoom,
      onNodeEdit,
      onRelationEdit,
      draggedElement,
      setAlignmentGuides,
      setMousePosition,
      setRelationMouse,
      mode,
      relationCreationState,
      selectionBox,
      onSelectionMouseMove,
      svgRef,
      canvasOffset,
      setLassoBox,
      props,
      setMultiDragStart
    });
  };

  const handleMouseUpWrapper = (e) => {
    handleCanvasMouseUp({
      e,
      lassoActive,
      lassoStart,
      lassoStartedOnCanvas,
      multiDragStart,
      diagram,
      zoom,
      onNodeEdit,
      onRelationEdit,
      saveToUndoStack,
      isPanning,
      handlePanEnd,
      draggedElement,
      setDraggedElement,
      connectFromNodeMenu,
      setConnectFromNodeMenu,
      setAlignmentGuides,
      lassoBox,
      setLassoStart,
      setLassoBox,
      props,
      setMultiDragStart
    });
  };

  const handleCanvasClick = (e) => {
    if (!e.target.classList.contains('condec-canvas')) {
      return;
    }

    // Only clear selection if LMB (button 0)
    if (e.button === 0) {
      // Don't switch to hand mode when in select mode - keep selection active
      if (mode !== 'select' && props.setMode) {
        props.setMode('hand');
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

      if (connectFromNodeMenu) {
        setConnectFromNodeMenu(null);
        return;
      }

      // Clear n-ary state
      if (props.setNaryStartNode) {
        props.setNaryStartNode(null);
      }
      if (props.setNaryMouse) {
        props.setNaryMouse(null);
      }

      // In select mode, clicking empty canvas clears multi-selection but keeps mode
      if (mode === 'select') {
        // Do NOT clear multi-selection or single selection here!
        return;
      }

      // Clear multi-selection if present (for other modes)
      if (props.setMultiSelectedNodes && multiSelectedNodes && multiSelectedNodes.length > 0) {
        props.setMultiSelectedNodes([]);
      }

      // Clear single node/relation selection if present (for other modes)
      if (selectedElement && props.onSelectElement) {
        props.onSelectElement(null);
      }

      if (getConnectModeState().isActive) {
        endConnectMode();
        return;
      }
    }

    // Pass through to parent handler for mode-specific logic like addActivity
    if (onCanvasClick) onCanvasClick(e);
  };

  const handleCanvasMouseDownWrapper = (e) => {
    handleCanvasMouseDown({
      e,
      mode,
      handlePanStart,
      lassoActive,
      svgRef,
      canvasOffset,
      zoom,
      setLassoStart,
      setLassoBox,
      lassoStartedOnCanvas,
      props
    });
  };

  // Handle diamond dragging
  // Extract diagram.relations for useEffect dependency
  const diagramRelations = diagram && diagram.relations;
  useEffect(() => {
    if (!draggedDiamond || !diagram || !Array.isArray(diagram.relations)) return;
    const handleMouseMove = (e) => {
      const deltaX = (e.clientX - draggedDiamond.startX) / zoom;
      const deltaY = (e.clientY - draggedDiamond.startY) / zoom;
      const newPos = {
        x: draggedDiamond.originalPos.x + deltaX,
        y: draggedDiamond.originalPos.y + deltaY
      };
      // Update the relation's diamond position
      const updatedRelations = diagram.relations.map(r =>
        r.id === draggedDiamond.relationId
          ? { ...r, diamondPos: newPos }
          : r
      );
      if (onRelationEdit) {
        onRelationEdit(updatedRelations);
      }
    };
    const handleMouseUp = () => {
      setDraggedDiamond(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedDiamond, diagram, diagramRelations, onRelationEdit, zoom, saveToUndoStack]);

  // Function to render hologram node preview
  const renderHologramNodeWrapper = () => {
    return renderHologramNode({
      mode: props.mode,
      hologramNodePosition: props.hologramNodePosition,
      diagram,
      zoom
    });
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
  } else if (props.mode === 'addActivity') {
    cursorStyle = 'crosshair';
  }

  return (
    <div className="condec-canvas-container" style={{ flex: 1, position: 'relative' }}>
      {(mode === 'nary') && (
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
          {!naryStartNode
            ? 'Click on a node to start a choice constraint'
            : 'Click on a relation (diamond) to create the choice constraint'}
        </div>
      )}
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
        onMouseMove={handleMouseMoveWrapper}
        onMouseUp={handleMouseUpWrapper}
        onMouseDown={handleCanvasMouseDownWrapper}
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
        {renderDiagramElementsWrapper()}
        {renderHologramNodeWrapper()}
        {renderMultiSelectBoundingBox({ multiSelectedNodes, multiSelectedElements, zoom, diagram, multiDragStart })}
        {renderMultiSelectMenu({ multiSelectedNodes, multiSelectedElements, props, zoom, diagram, multiDragStart })}
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
        {renderLassoBox(lassoBox, zoom)}
        </g>
      </svg>
    </div>
  );
});