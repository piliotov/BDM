import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { ConDecRelation } from './ConDecRelations';
import { ConDecNode } from './ConDecNode';
import { ConDecNodeMenu } from './FloatingNodeMenu'; 
import { calculateIntersectionPoint } from '../utils/geometryUtils';
import { useCanvasPanning } from '../utils/canvasUtils';
import { updateRelationsForNode, updateRelationWithFixedEndpoints } from '../utils/relationUtils';
import { RelationMarkers } from '../utils/relationIconUtils';
import { endConnectMode,getConnectModeState,} from '../utils/connectModeUtils';
import { getNodesInMultiSelectionBox, getBoundingBoxForMultiSelectedNodes } from '../utils/multiSelectionUtils';

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

  // --- Lasso mouse handlers (bpmn-js style) ---
  function handleLassoMouseDown(e) {
    if (!lassoActive) return;
    // Only left mouse button
    if (e.button !== 0) return;
    // Only start lasso if clicking on empty canvas (not on node/relation)
    if (!e.target.classList.contains('condec-canvas')) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasOffset.x) / zoom;
    const y = (e.clientY - rect.top - canvasOffset.y) / zoom;
    setLassoStart({ x, y });
    setLassoBox({ x, y, width: 0, height: 0 });
    lassoStartedOnCanvas.current = true;
    if (props.setSelectionBox) props.setSelectionBox(null);
    if (props.setMultiSelectedNodes) props.setMultiSelectedNodes([]);
    e.stopPropagation();
  }

  function handleLassoMouseMove(e) {
    if (!lassoActive || !lassoStart || !lassoStartedOnCanvas.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasOffset.x) / zoom;
    const y = (e.clientY - rect.top - canvasOffset.y) / zoom;
    const box = {
      x: Math.min(lassoStart.x, x),
      y: Math.min(lassoStart.y, y),
      width: Math.abs(x - lassoStart.x),
      height: Math.abs(y - lassoStart.y)
    };
    setLassoBox(box);
    if (props.setSelectionBox) props.setSelectionBox(box);
    // Update multi-selected nodes live
    if (props.setMultiSelectedNodes && diagram?.nodes) {
      const selected = getNodesInMultiSelectionBox(diagram.nodes, box);
      props.setMultiSelectedNodes(selected);
    }
    e.stopPropagation();
  }

  function handleLassoMouseUp(e) {
    if (!lassoActive || !lassoStart || !lassoStartedOnCanvas.current) {
      setLassoStart(null);
      setLassoBox(null);
      lassoStartedOnCanvas.current = false;
      return;
    }
    setLassoStart(null);
    setLassoBox(null);
    lassoStartedOnCanvas.current = false;
    if (props.setSelectionBox) props.setSelectionBox(null);
    // Finalize selection (already set live)
    e.stopPropagation();
  }

  // --- Node drag/relation logic ---
  const handleNodeInteractionStart = (nodeId, e) => {
    // If multi-select is active and node is in selection, start group drag
    if (multiSelectedNodes && multiSelectedNodes.length > 1 && multiSelectedNodes.find(n => n.id === nodeId)) {
      setMultiDragStart({
        nodeIds: multiSelectedNodes.map(n => n.id),
        startX: e.clientX,
        startY: e.clientY,
        nodePositions: multiSelectedNodes.map(n => ({ id: n.id, x: n.x, y: n.y }))
      });
      e.stopPropagation();
      return;
    }
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

  // Helper: find alignment lines for any point (node center, relation waypoint, or relation midpoint)
  function getAlignmentGuidesForPoint(point, nodes, relations, excludeRelationId = null) {
    if (!point) return { x: null, y: null };
    const threshold = 2;
    let guideX = null, guideY = null;
    // Check node centers
    for (const n of nodes) {
      if (Math.abs(n.x - point.x) <= threshold) guideX = n.x;
      if (Math.abs(n.y - point.y) <= threshold) guideY = n.y;
    }
    // Check relation waypoints and midpoints
    for (const rel of relations) {
      if (rel.id === excludeRelationId) continue;
      if (Array.isArray(rel.waypoints)) {
        for (const wp of rel.waypoints) {
          if (Math.abs(wp.x - point.x) <= threshold) guideX = wp.x;
          if (Math.abs(wp.y - point.y) <= threshold) guideY = wp.y;
        }
        // Check midpoint of the relation path
        if (rel.waypoints.length >= 2) {
          const midIdx = Math.floor(rel.waypoints.length / 2);
          let mid;
          if (rel.waypoints.length % 2 === 0) {
            // Even: average two middle points
            const a = rel.waypoints[midIdx - 1], b = rel.waypoints[midIdx];
            mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          } else {
            mid = rel.waypoints[midIdx];
          }
          if (Math.abs(mid.x - point.x) <= threshold) guideX = mid.x;
          if (Math.abs(mid.y - point.y) <= threshold) guideY = mid.y;
        }
      }
    }
    return { x: guideX, y: guideY };
  }

  // Handler for alignment check from relation drag
  const handleAlignmentCheck = (point, relationId = null) => {
    const guides = getAlignmentGuidesForPoint(point, diagram.nodes, diagram.relations, relationId);
    setAlignmentGuides(guides);
  };

  // --- Render alignment guides as SVG lines ---
  function renderAlignmentGuides() {
    if (!alignmentGuides.x && !alignmentGuides.y) return null;
    // Get canvas bounds
    const minX = 0, minY = 0;
    // Use a large max value to cover the visible area
    const maxX = 4000, maxY = 2000;
    return (
      <g className="alignment-guides">
        {alignmentGuides.x !== null && (
          <line
            x1={alignmentGuides.x}
            y1={minY}
            x2={alignmentGuides.x}
            y2={maxY}
            stroke="#1a73e8"
            strokeDasharray="6,4"
            strokeWidth={2}
            pointerEvents="none"
          />
        )}
        {alignmentGuides.y !== null && (
          <line
            x1={minX}
            y1={alignmentGuides.y}
            x2={maxX}
            y2={alignmentGuides.y}
            stroke="#1a73e8"
            strokeDasharray="6,4"
            strokeWidth={2}
            pointerEvents="none"
          />
        )}
      </g>
    );
  }

  // --- Multi-select bounding box and menu ---
  function renderMultiSelectBoundingBox() {
    if (!multiSelectedNodes || multiSelectedNodes.length < 2) return null;
    const box = getBoundingBoxForMultiSelectedNodes(multiSelectedNodes);
    if (!box) return null;
    return (
      <g className="multi-select-bounding-box">
        <rect
          x={box.x - 10}
          y={box.y - 10}
          width={box.width + 20}
          height={box.height + 20}
          fill="transparent"
          stroke="#4285f4"
          strokeWidth={2/zoom}
          strokeDasharray={`${4/zoom},${2/zoom}`}
          rx={8/zoom}
          pointerEvents="none"
        />
      </g>
    );
  }

  function renderMultiSelectMenu() {
    if (!multiSelectedNodes || multiSelectedNodes.length < 2) return null;
    const box = getBoundingBoxForMultiSelectedNodes(multiSelectedNodes);
    if (!box) return null;
    const menuX = box.x + box.width + 18;
    const menuY = box.y - 32;
    function handleDeleteAll() {
      if (typeof props.onDeleteMultiSelected === 'function') {
        props.onDeleteMultiSelected(multiSelectedNodes);
      }
    }
    return (
      <foreignObject x={menuX} y={menuY} width={40} height={40} style={{ overflow: 'visible' }}>
        <div style={{
          background: 'none',
          border: 'none',
          borderRadius: 0,
          boxShadow: 'none',
          padding: 0,
          color: '#1976d2',
          fontWeight: 500,
          fontSize: 15,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 1000
        }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              borderRadius: 4,
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 4
            }}
            onClick={handleDeleteAll}
            tabIndex={0}
            title="Delete selected nodes"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 2048 2048"><path fill="currentColor" d="m387.16 644.33l128.932 1231.742h1024.733l118.83-1231.51h-1272.5zm144.374 130.007h985.481l-94.107 971.506h-789.33z"/><path fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.344" d="m7.033 1040.98l.944 7.503m5.013-7.503l-.943 7.503" transform="matrix(96.7529 0 0 87.18526 55.328 -89814.987)"/><path fill="currentColor" d="M758.125 337.314L343.5 458.662v60.722h1361v-60.722l-419.687-121.348z"/><path fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="69.952" d="M793.259 211.429h461.482v168.06H793.26z"/></svg>
          </button>
        </div>
      </foreignObject>
    );
  }

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
          allNodes={nodes} // pass all nodes for n-ary rendering
          onAlignmentCheck={handleAlignmentCheck} // <-- pass alignment check handler
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
      const isMultiSelected = multiSelectedNodes && multiSelectedNodes.find(n => n.id === node.id);
      return (
        <React.Fragment key={node.id}>
          <ConDecNode
            node={node}
            isSelected={isSelected}
            isMultiSelected={!!isMultiSelected}
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
            onSize={size => handleNodeSize(node.id, size)}
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
      let node = nodes.find(n => n.id === selectedElement.element.id);
      // Inject latest size if available
      if (node && nodeSizes[node.id]) {
        node = { ...node, ...nodeSizes[node.id] };
      }
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
              setConnectFromNodeMenu({ 
                sourceId: node.id,
                sourceNode: node
              });
              if (props.setMode) props.setMode('connectFromNodeMenu');
            }}
          />
        );
      }
    }

    // --- Show temporary line for relation creation modes ---
    let temporaryRelation = null;
    // Helper to get node center (x, y) from node with width/height
    function getNodeCenter(node) {
      return {
        x: node.x,
        y: node.y
      };
    }
    // Helper to get node edge point for a direction (dx, dy)
    function getNodeEdgePoint(node, dx, dy) {
      const w = node.width || node.size?.width || 100;
      const h = node.height || node.size?.height || 50;
      // Normalize direction
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      // Rectangle edge intersection
      const rx = w/2, ry = h/2;
      const tx = dx / len, ty = dy / len;
      // Find intersection with rectangle edge
      let scale = Math.min(
        Math.abs(rx / tx || Infinity),
        Math.abs(ry / ty || Infinity)
      );
      return {
        x: node.x + tx * scale,
        y: node.y + ty * scale
      };
    }
    // For addRelation mode (palette tool)
    if (
      props.mode === 'addRelation' &&
      relationCreationState.active &&
      relationCreationState.sourceNode &&
      relationMouse
    ) {
      const sourceNode = relationCreationState.sourceNode;
      const sourceCenter = getNodeCenter(sourceNode);
      // Target point in canvas coordinates
      const targetPoint = {
        x: (relationMouse.x - (props.canvasOffset?.x || 0)) / (props.zoom || 1),
        y: (relationMouse.y - (props.canvasOffset?.y || 0)) / (props.zoom || 1)
      };
      // Direction from source to target
      const dx = targetPoint.x - sourceCenter.x;
      const dy = targetPoint.y - sourceCenter.y;
      // Start at edge of source node
      const start = getNodeEdgePoint(sourceNode, dx, dy);
      temporaryRelation = (
        <>
          <line
            x1={start.x}
            y1={start.y}
            x2={targetPoint.x}
            y2={targetPoint.y}
            stroke="#1a73e8"
            strokeWidth="1.5"
            strokeDasharray="5,5"
            markerEnd="url(#arrow)"
            style={{ pointerEvents: 'none' }}
          />
          <circle
            cx={start.x}
            cy={start.y}
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
      const sourceCenter = getNodeCenter(sourceNode);
      const targetPoint = {
        x: (props.mousePosition.x - (props.canvasOffset?.x || 0)) / (props.zoom || 1),
        y: (props.mousePosition.y - (props.canvasOffset?.y || 0)) / (props.zoom || 1)
      };
      const dx = targetPoint.x - sourceCenter.x;
      const dy = targetPoint.y - sourceCenter.y;
      const start = getNodeEdgePoint(sourceNode, dx, dy);
      temporaryRelation = (
        <>
          <line
            x1={start.x}
            y1={start.y}
            x2={targetPoint.x}
            y2={targetPoint.y}
            stroke="#1a73e8"
            strokeWidth="1.5"
            strokeDasharray="5,5"
            markerEnd="url(#arrow)"
            style={{ pointerEvents: 'none' }}
          />
          <circle
            cx={start.x}
            cy={start.y}
            r="3"
            fill="#1a73e8"
            style={{ pointerEvents: 'none' }}
          />
        </>
      );
    }

    return (
      <>
        {renderAlignmentGuides()}
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
  function handleMouseMove(e) {
    if (lassoActive && lassoStart && lassoStartedOnCanvas.current) {
      handleLassoMouseMove(e);
      return;
    }
    // Multi-drag
    if (multiDragStart) {
      const deltaX = (e.clientX - multiDragStart.startX) / zoom;
      const deltaY = (e.clientY - multiDragStart.startY) / zoom;
      const updatedNodes = diagram.nodes.map(node => {
        const dragNode = multiDragStart.nodePositions.find(n => n.id === node.id);
        if (dragNode) {
          return { ...node, x: dragNode.x + deltaX, y: dragNode.y + deltaY };
        }
        return node;
      });
      if (typeof onNodeEdit === 'function') {
        onNodeEdit(updatedNodes);
      }
      // Optionally update relations
      if (typeof onRelationEdit === 'function') {
        onRelationEdit(diagram.relations);
      }
      // Update last mouse position for bounding box
      setMultiDragStart(prev => prev ? { ...prev, lastClientX: e.clientX, lastClientY: e.clientY } : prev);
      return;
    }
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
  }

  function handleMouseUp(e) {
    if (lassoActive && lassoStart && lassoStartedOnCanvas.current) {
      handleLassoMouseUp(e);
      return;
    }
    if (multiDragStart) {
      // Only save to undo stack if there was actual movement
      const deltaX = (multiDragStart.lastClientX !== undefined ? multiDragStart.lastClientX : multiDragStart.startX) - multiDragStart.startX;
      const deltaY = (multiDragStart.lastClientY !== undefined ? multiDragStart.lastClientY : multiDragStart.startY) - multiDragStart.startY;
      const moved = deltaX !== 0 || deltaY !== 0;
      const updatedNodes = diagram.nodes.map(node => {
        const dragNode = multiDragStart.nodePositions.find(n => n.id === node.id);
        if (dragNode) {
          return { ...node, x: dragNode.x + deltaX / zoom, y: dragNode.y + deltaY / zoom };
        }
        return node;
      });
      if (typeof onNodeEdit === 'function') {
        onNodeEdit(updatedNodes);
      }
      setMultiDragStart(null);
      // Update selection to new node positions
      if (props.setMultiSelectedNodes) {
        const newSelection = updatedNodes.filter(n => multiDragStart.nodeIds.includes(n.id));
        props.setMultiSelectedNodes(newSelection);
      }
      if (moved && saveToUndoStack) saveToUndoStack();
      return;
    }
    if (isPanning) {
      handlePanEnd();
    }
    if (draggedElement) {
      // Only save to undo stack if there was actual movement
      const deltaX = (e.clientX - draggedElement.startX) / zoom;
      const deltaY = (e.clientY - draggedElement.startY) / zoom;
      const moved = deltaX !== 0 || deltaY !== 0;
      if (moved && saveToUndoStack) saveToUndoStack();
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
  }

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
    
    if (mode === 'hand') {
      // Clear multi-selection if present
      if (props.setMultiSelectedNodes && multiSelectedNodes && multiSelectedNodes.length > 0) {
        props.setMultiSelectedNodes([]);
      }
      // Clear single node selection if present
      if (selectedElement && selectedElement.type === 'node' && props.onSelectElement) {
        props.onSelectElement(null);
      }
      return;
    }
    
    if (getConnectModeState().isActive) {
      endConnectMode();
      return;
    }
    
    if (onCanvasClick) onCanvasClick(e);
  };

  function handleCanvasMouseDown(e) {
    if (lassoActive) {
      handleLassoMouseDown(e);
      return;
    }
    if (mode === 'hand' && e.button === 0 && e.target.classList.contains('condec-canvas')) {
      handlePanStart(e);
      return;
    }
    if (props.onCanvasMouseDown) {
      props.onCanvasMouseDown(e);
    }
  }

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

  const handleWaypointDragEnd = (relationId, isLabelDrag = false, prevWaypoints = null) => {
    if (!relationId) return;
    if (typeof onRelationEdit === 'function' && diagram.relations) {
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

  // --- Render lasso rectangle ---
  function renderLassoBox() {
    if (!lassoBox) return null;
    return (
      <rect
        x={lassoBox.x}
        y={lassoBox.y}
        width={lassoBox.width}
        height={lassoBox.height}
        fill="rgba(66, 133, 244, 0.1)"
        stroke="#4285f4"
        strokeWidth={1/zoom}
        strokeDasharray={`${4/zoom},${2/zoom}`}
        pointerEvents="none"
      />
    );
  }

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
          {renderLassoBox()}
        </g>
      </svg>
    </div>
  );
});