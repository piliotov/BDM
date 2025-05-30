// Lasso (multi-select) utilities for ConDecCanvas
import { getAllSelectableElementsInBox } from '../multiSelectionUtils';

/**
 * Handles mouse down event for lasso selection
 * @param {Object} params - Parameters object
 * @param {Event} params.e - Mouse event
 * @param {boolean} params.lassoActive - Whether lasso mode is active
 * @param {Object} params.svgRef - SVG reference
 * @param {Object} params.canvasOffset - Canvas offset
 * @param {number} params.zoom - Zoom level
 * @param {Function} params.setLassoStart - Setter for lasso start position
 * @param {Function} params.setLassoBox - Setter for lasso box
 * @param {Object} params.lassoStartedOnCanvas - Ref for tracking lasso start
 * @param {Object} params.props - Props object containing setters
 */
export function handleLassoMouseDown({ e, lassoActive, svgRef, canvasOffset, zoom, setLassoStart, setLassoBox, lassoStartedOnCanvas, props }) {
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

/**
 * Handles mouse move event for lasso selection
 * @param {Object} params - Parameters object
 * @param {Event} params.e - Mouse event
 * @param {boolean} params.lassoActive - Whether lasso mode is active
 * @param {Object} params.lassoStart - Lasso start position
 * @param {Object} params.lassoStartedOnCanvas - Ref for tracking lasso start
 * @param {Object} params.svgRef - SVG reference
 * @param {Object} params.canvasOffset - Canvas offset
 * @param {number} params.zoom - Zoom level
 * @param {Function} params.setLassoBox - Setter for lasso box
 * @param {Object} params.diagram - Diagram object
 * @param {Object} params.props - Props object containing setters
 */
export function handleLassoMouseMove({ e, lassoActive, lassoStart, lassoStartedOnCanvas, svgRef, canvasOffset, zoom, setLassoBox, diagram, props }) {
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
  
  // Update multi-selected elements live (nodes, relation points, nary diamonds)
  if (props.setMultiSelectedNodes && diagram?.nodes && diagram?.relations) {
    const selectedElements = getAllSelectableElementsInBox(diagram.nodes, diagram.relations, box);
    // For backward compatibility, still use setMultiSelectedNodes but pass a combined object
    props.setMultiSelectedNodes(selectedElements.nodes);
    // Store additional selections if the parent component supports it
    if (props.setMultiSelectedElements) {
      props.setMultiSelectedElements(selectedElements);
    }
  }
  
  e.stopPropagation();
}

/**
 * Handles mouse up event for lasso selection
 * @param {Object} params - Parameters object
 * @param {Event} params.e - Mouse event
 * @param {boolean} params.lassoActive - Whether lasso mode is active
 * @param {Object} params.lassoStart - Lasso start position
 * @param {Object} params.lassoStartedOnCanvas - Ref for tracking lasso start
 * @param {Object} params.lassoBox - Current lasso box
 * @param {Function} params.setLassoStart - Setter for lasso start position
 * @param {Function} params.setLassoBox - Setter for lasso box
 * @param {Object} params.diagram - Diagram object
 * @param {Object} params.props - Props object containing setters
 */
export function handleLassoMouseUp({ e, lassoActive, lassoStart, lassoStartedOnCanvas, lassoBox, setLassoStart, setLassoBox, diagram, props }) {
  if (!lassoActive || !lassoStart || !lassoStartedOnCanvas.current) {
    setLassoStart(null);
    setLassoBox(null);
    lassoStartedOnCanvas.current = false;
    return;
  }
  
  // --- Finalize selection using the last box, not the cleared one ---
  const finalizedBox = lassoBox;
  setLassoStart(null);
  setLassoBox(null);
  lassoStartedOnCanvas.current = false;
  
  if (props.setSelectionBox) props.setSelectionBox(null);
  
  // Ensure multi-selection is finalized on mouse up, even if mouse hasn't moved
  if (props.setMultiSelectedNodes && diagram?.nodes && diagram?.relations && finalizedBox) {
    const selectedElements = getAllSelectableElementsInBox(diagram.nodes, diagram.relations, finalizedBox);
    props.setMultiSelectedNodes(selectedElements.nodes);
    if (props.setMultiSelectedElements) {
      props.setMultiSelectedElements(selectedElements);
    }
  }
}

/**
 * Renders the lasso selection box
 * @param {Object} lassoBox - Lasso box dimensions
 * @param {number} zoom - Zoom level
 * @returns {JSX.Element|null} Lasso box element or null
 */
export function renderLassoBox(lassoBox, zoom) {
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