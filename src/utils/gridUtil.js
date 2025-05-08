/**
 * Grid utilities for snapping elements to grid
 */

// Default grid settings
const DEFAULT_GRID_SIZE = 10; // Grid size in pixels

/**
 * Snap a value to the nearest grid line
 * @param {number} value - The value to snap
 * @param {number} gridSize - The grid size
 * @returns {number} The snapped value
 */
export function snapToGrid(value, gridSize = DEFAULT_GRID_SIZE) {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap a point to the grid
 * @param {Object} point - The point with x and y coordinates
 * @param {number} gridSize - The grid size
 * @returns {Object} The snapped point
 */
export function snapPointToGrid(point, gridSize = DEFAULT_GRID_SIZE) {
  return {
    x: snapToGrid(point.x, gridSize),
    y: snapToGrid(point.y, gridSize)
  };
}

/**
 * Enable snapping during drag operations
 * @param {Object} node - The node being dragged
 * @param {number} deltaX - Change in X position
 * @param {number} deltaY - Change in Y position
 * @param {number} gridSize - The grid size
 * @returns {Object} The node with snapped position
 */
export function snapNodeDuringDrag(node, deltaX, deltaY, gridSize = DEFAULT_GRID_SIZE) {
  const newX = node.x + deltaX;
  const newY = node.y + deltaY;
  return {
    ...node,
    x: snapToGrid(newX, gridSize),
    y: snapToGrid(newY, gridSize)
  };
}
