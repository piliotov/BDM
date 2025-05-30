/**
 * Canvas Utilities Index
 * 
 * This file consolidates all canvas-related utilities used by ConDecCanvas.js
 * to reduce the number of imports and improve code organization.
 */

// Geometry utilities
export { calculateIntersectionPoint } from '../geometryUtils';

// Canvas operations
export { useCanvasPanning } from '../canvasUtils';

// Relations handling
export { updateRelationsForNode } from '../relationUtils';

// Relation icons and markers
export { RelationMarkers } from '../relationIconUtils';

// Connect mode state management
export { endConnectMode, getConnectModeState } from '../connectModeUtils';

// Multi-selection utilities
export { 
  getBoundingBoxForMultiSelectedNodes, 
  getAllSelectableElementsInBox, 
  getBoundingBoxForMixedSelection 
} from '../multiSelectionUtils';

// Alignment utilities
export { 
  getAlignmentGuidesForPoint, 
  renderAlignmentGuidesSVG 
} from '../alignmentUtils';

// Canvas-specific utility functions
export const getNodeCenter = (node) => {
  return {
    x: node.x,
    y: node.y
  };
};

export const getNodeEdgePoint = (node, dx, dy) => {
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
};

export const getAlignmentGuides = (draggedNode, nodes) => {
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
};

// Export lasso utilities
export {
  handleLassoMouseDown,
  handleLassoMouseMove,
  handleLassoMouseUp,
  renderLassoBox
} from './lassoUtils';

// Export multi-drag utilities
export {
  handleExtendedMultiDragMove,
  handleTraditionalMultiDragMove,
  handleExtendedMultiDragUp,
  handleTraditionalMultiDragUp
} from './multiDragUtils';

// Export rendering utilities
export {
  renderMultiSelectBoundingBox,
  renderMultiSelectMenu,
  renderHologramNode
} from './renderUtils';

// Export mouse handling utilities
export {
  handleCanvasMouseMove,
  handleCanvasMouseUp,
  handleCanvasMouseDown
} from './mouseUtils';

// Export diagram rendering utilities
export {
  renderDiagramElements
} from './diagramRenderUtils';
