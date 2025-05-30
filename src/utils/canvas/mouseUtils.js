// Mouse handling utilities for ConDecCanvas
import { updateRelationsForNode } from '../relationUtils';
import { getAlignmentGuides } from './index';
import { 
  handleLassoMouseDown, 
  handleLassoMouseMove, 
  handleLassoMouseUp 
} from './lassoUtils';
import { 
  handleExtendedMultiDragMove, 
  handleTraditionalMultiDragMove,
  handleExtendedMultiDragUp,
  handleTraditionalMultiDragUp
} from './multiDragUtils';

/**
 * Handles mouse move events for the canvas
 * @param {Object} params - Parameters object
 * @param {Event} params.e - Mouse event
 * @param {boolean} params.isPanning - Whether canvas is being panned
 * @param {Function} params.handlePanMove - Pan move handler
 * @param {boolean} params.lassoActive - Whether lasso mode is active
 * @param {Object} params.lassoStart - Lasso start position
 * @param {Object} params.lassoStartedOnCanvas - Lasso started on canvas ref
 * @param {Object} params.multiDragStart - Multi-drag start state
 * @param {Object} params.diagram - Diagram object
 * @param {number} params.zoom - Zoom level
 * @param {Function} params.onNodeEdit - Node edit callback
 * @param {Function} params.onRelationEdit - Relation edit callback
 * @param {Object} params.draggedElement - Currently dragged element
 * @param {Function} params.setAlignmentGuides - Alignment guides setter
 * @param {Function} params.setMousePosition - Mouse position setter
 * @param {Function} params.setRelationMouse - Relation mouse setter
 * @param {string} params.mode - Current mode
 * @param {Object} params.relationCreationState - Relation creation state
 * @param {Object} params.selectionBox - Selection box
 * @param {Function} params.onSelectionMouseMove - Selection mouse move handler
 * @param {Object} params.svgRef - SVG reference
 * @param {Object} params.canvasOffset - Canvas offset
 * @param {Function} params.setLassoBox - Lasso box setter
 * @param {Object} params.props - Props object
 * @param {Function} params.setMultiDragStart - Multi-drag start setter
 */
export function handleCanvasMouseMove({
  e, isPanning, handlePanMove, lassoActive, lassoStart, lassoStartedOnCanvas,
  multiDragStart, diagram, zoom, onNodeEdit, onRelationEdit, draggedElement,
  setAlignmentGuides, setMousePosition, setRelationMouse, mode, relationCreationState,
  selectionBox, onSelectionMouseMove, svgRef, canvasOffset, setLassoBox, props,
  setMultiDragStart
}) {
  // Handle canvas panning first
  if (isPanning) {
    handlePanMove(e);
    return;
  }
  
  if (lassoActive && lassoStart && lassoStartedOnCanvas.current) {
    handleLassoMouseMove({
      e, lassoActive, lassoStart, lassoStartedOnCanvas, svgRef, canvasOffset,
      zoom, setLassoBox, diagram, props
    });
    return;
  }
  
  // Multi-drag
  if (multiDragStart && diagram && Array.isArray(diagram.nodes)) {
    // Handle extended multi-drag (nodes + relation points + nary diamonds)
    if (multiDragStart.type === 'extended' && multiDragStart.selectedElements) {
      handleExtendedMultiDragMove({
        multiDragStart, diagram, zoom, e, onNodeEdit, onRelationEdit, setMultiDragStart
      });
    }
    // Handle traditional multi-drag (nodes only)
    else if (multiDragStart.nodePositions) {
      handleTraditionalMultiDragMove({
        multiDragStart, diagram, zoom, e, onNodeEdit, onRelationEdit, setMultiDragStart
      });
    }
    return;
  }
  
  // Handle node dragging
  if (draggedElement && diagram && Array.isArray(diagram.nodes)) {
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
    
    // Define currentX and currentY for use below
    const rect = svgRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
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
  
  // Call the parent's mouse move handler
  if (props.onCanvasMouseMove) {
    props.onCanvasMouseMove(e);
  }
}

/**
 * Handles mouse up events for the canvas
 * @param {Object} params - Parameters object
 * @param {Event} params.e - Mouse event
 * @param {boolean} params.lassoActive - Whether lasso mode is active
 * @param {Object} params.lassoStart - Lasso start position
 * @param {Object} params.lassoStartedOnCanvas - Lasso started on canvas ref
 * @param {Object} params.multiDragStart - Multi-drag start state
 * @param {Object} params.diagram - Diagram object
 * @param {number} params.zoom - Zoom level
 * @param {Function} params.onNodeEdit - Node edit callback
 * @param {Function} params.onRelationEdit - Relation edit callback
 * @param {Function} params.saveToUndoStack - Save to undo stack callback
 * @param {boolean} params.isPanning - Whether canvas is being panned
 * @param {Function} params.handlePanEnd - Pan end handler
 * @param {Object} params.draggedElement - Currently dragged element
 * @param {Function} params.setDraggedElement - Dragged element setter
 * @param {Object} params.connectFromNodeMenu - Connect from node menu state
 * @param {Function} params.setConnectFromNodeMenu - Connect from node menu setter
 * @param {Function} params.setAlignmentGuides - Alignment guides setter
 * @param {Object} params.lassoBox - Lasso box
 * @param {Function} params.setLassoStart - Lasso start setter
 * @param {Function} params.setLassoBox - Lasso box setter
 * @param {Object} params.props - Props object
 * @param {Function} params.setMultiDragStart - Multi-drag start setter
 */
export function handleCanvasMouseUp({
  e, lassoActive, lassoStart, lassoStartedOnCanvas, multiDragStart, diagram,
  zoom, onNodeEdit, onRelationEdit, saveToUndoStack, isPanning, handlePanEnd,
  draggedElement, setDraggedElement, connectFromNodeMenu, setConnectFromNodeMenu,
  setAlignmentGuides, lassoBox, setLassoStart, setLassoBox, props, setMultiDragStart
}) {
  if (lassoActive && lassoStart && lassoStartedOnCanvas.current) {
    handleLassoMouseUp({
      e, lassoActive, lassoStart, lassoStartedOnCanvas, lassoBox,
      setLassoStart, setLassoBox, diagram, props
    });
    return;
  }
  
  if (multiDragStart && diagram && Array.isArray(diagram.nodes)) {
    // Handle extended multi-drag (nodes + relation points + nary diamonds)
    if (multiDragStart.type === 'extended' && multiDragStart.selectedElements) {
      handleExtendedMultiDragUp({
        multiDragStart, diagram, zoom, onNodeEdit, onRelationEdit, saveToUndoStack, props
      });
    }
    // Handle traditional multi-drag (nodes only)
    else if (multiDragStart.nodePositions) {
      handleTraditionalMultiDragUp({
        multiDragStart, diagram, zoom, onNodeEdit, saveToUndoStack, props
      });
    }
    
    setMultiDragStart(null);
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
  }
  setAlignmentGuides({ x: null, y: null });
}

/**
 * Handles mouse down events for the canvas
 * @param {Object} params - Parameters object
 * @param {Event} params.e - Mouse event
 * @param {string} params.mode - Current mode
 * @param {Function} params.handlePanStart - Pan start handler
 * @param {boolean} params.lassoActive - Whether lasso mode is active
 * @param {Object} params.svgRef - SVG reference
 * @param {Object} params.canvasOffset - Canvas offset
 * @param {number} params.zoom - Zoom level
 * @param {Function} params.setLassoStart - Lasso start setter
 * @param {Function} params.setLassoBox - Lasso box setter
 * @param {Object} params.lassoStartedOnCanvas - Lasso started on canvas ref
 * @param {Object} params.props - Props object
 */
export function handleCanvasMouseDown({
  e, mode, handlePanStart, lassoActive, svgRef, canvasOffset, zoom,
  setLassoStart, setLassoBox, lassoStartedOnCanvas, props
}) {
  // Allow panning in hand mode
  if (mode === 'hand' && e.button === 0 && e.target.classList.contains('condec-canvas')) {
    handlePanStart(e);
    return;
  }
  
  // Only activate lasso in select mode
  if (mode === 'select' && lassoActive) {
    handleLassoMouseDown({
      e, lassoActive, svgRef, canvasOffset, zoom, setLassoStart, setLassoBox,
      lassoStartedOnCanvas, props
    });
    return;
  }
  
  if (props.onCanvasMouseDown) {
    props.onCanvasMouseDown(e);
  }
}
