/**
 * Canvas utilities for handling operations like panning and zooming
 */

import { useRef } from 'react';

/**
 * Initialize canvas panning functionality
 * @param {Object} params Configuration parameters
 * @param {Function} params.setCanvasOffset Function to update canvas offset
 * @param {Function} params.setIsPanning Function to update panning state
 * @param {Function} params.setPanStart Function to set pan starting position
 * @param {Function} params.setPanOrigin Function to set pan origin
 * @param {Object} params.canvasOffset Current canvas offset
 * @param {Number} params.zoom Current zoom level
 * @returns {Object} Pan event handlers for the canvas
 */
export const useCanvasPanning = ({ 
  setCanvasOffset, 
  setIsPanning, 
  setPanStart, 
  setPanOrigin, 
  canvasOffset, 
  zoom 
}) => {
  
  // Use refs to store current panning state
  const panStateRef = useRef({
    isPanning: false,
    panStart: { x: 0, y: 0 },
    panOrigin: { x: 0, y: 0 }
  });
  
  // Start panning
  const handlePanStart = (e) => {
    const startPos = { x: e.clientX, y: e.clientY };
    const originPos = { x: canvasOffset.x, y: canvasOffset.y };
    
    panStateRef.current = {
      isPanning: true,
      panStart: startPos,
      panOrigin: originPos
    };
    
    setIsPanning(true);
    setPanStart(startPos);
    setPanOrigin(originPos);
  };

  // Continue panning
  const handlePanMove = (e) => {
    if (!panStateRef.current.isPanning) return;
    
    const dx = e.clientX - panStateRef.current.panStart.x;
    const dy = e.clientY - panStateRef.current.panStart.y;
    
    setCanvasOffset({
      x: panStateRef.current.panOrigin.x + dx,
      y: panStateRef.current.panOrigin.y + dy
    });
  };

  // End panning
  const handlePanEnd = () => {
    panStateRef.current.isPanning = false;
    setIsPanning(false);
  };

  return { handlePanStart, handlePanMove, handlePanEnd };
};

/**
 * Calculate the visible area of the canvas
 * @param {Object} canvasSize Canvas size in pixels
 * @param {Object} canvasOffset Canvas offset in pixels
 * @param {number} zoom Current zoom level
 * @returns {Object} Visible area bounds
 */
export function getVisibleCanvasBounds(canvasSize, canvasOffset, zoom) {
  // Calculate the bounds of the visible area in diagram coordinates
  const left = (0 - canvasOffset.x) / zoom;
  const top = (0 - canvasOffset.y) / zoom;
  const right = (canvasSize.width - canvasOffset.x) / zoom;
  const bottom = (canvasSize.height - canvasOffset.y) / zoom;

  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/**
 * Connection handling utilities inspired by bpmn-js
 */

// Manhattan layout directions (similar to bpmn-js)
export const DIRECTION = {
  NORTH: 'n',
  EAST: 'e',
  SOUTH: 's',
  WEST: 'w'
};

/**
 * Get the mid-point of a line segment
 * @param {Object} p1 First point {x, y}
 * @param {Object} p2 Second point {x, y}
 * @returns {Object} Mid point {x, y}
 */
export function getMidPoint(p1, p2) {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  };
}

/**
 * Calculate the direction between two points
 * @param {Object} p1 First point {x, y}
 * @param {Object} p2 Second point {x, y}
 * @returns {string} Direction (n, e, s, w)
 */
export function getDirection(p1, p2) {
  if (Math.abs(p1.x - p2.x) > Math.abs(p1.y - p2.y)) {
    return p1.x < p2.x ? DIRECTION.EAST : DIRECTION.WEST;
  } else {
    return p1.y < p2.y ? DIRECTION.SOUTH : DIRECTION.NORTH;
  }
}

/**
 * Get docking point on the boundary of a node
 * Now uses rectangle boundary intersection (not ellipse)
 * @param {Object} node Node with x, y coordinates
 * @param {Object} point External point to dock to
 * @param {Object} nodeSize Node size {width, height}
 * @returns {Object} Docking point {x, y}
 */
export function getDockingPoint(node, point, nodeSize) {
  // Use actual node size if present
  const width = node.width || node.size?.width || (nodeSize?.width ?? 100);
  const height = node.height || node.size?.height || (nodeSize?.height ?? 50);
  const centerX = node.x;
  const centerY = node.y;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  // Vector from center to external point
  const dx = point.x - centerX;
  const dy = point.y - centerY;

  // If the external point is at the center, just return the rightmost point
  if (dx === 0 && dy === 0) {
    return { x: centerX + halfWidth, y: centerY };
  }

  // Calculate intersection with rectangle boundary
  // Parametric line: (x, y) = (centerX, centerY) + t * (dx, dy)
  // Find t where the line hits the rectangle
  const tx = dx !== 0 ? halfWidth / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? halfHeight / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);

  return {
    x: centerX + dx * t,
    y: centerY + dy * t
  };
}

/**
 * Function to create perpendicular waypoints (Manhattan routing)
 * inspired by the layout approach in bpmn-js
 * @param {Object} source Source node
 * @param {Object} target Target node
 * @param {Object} sourceSize Source node size
 * @param {Object} targetSize Target node size
 * @param {number} connectionPadding Padding distance from nodes
 * @returns {Array} Array of waypoints
 */
export function createManhattanWaypoints(
  source,
  target,
  sourceSize,
  targetSize,
  connectionPadding = 20
) {
  // Use actual node sizes if present
  const sWidth = source.width || source.size?.width || (sourceSize?.width ?? 100);
  const sHeight = source.height || source.size?.height || (sourceSize?.height ?? 50);
  const tWidth = target.width || target.size?.width || (targetSize?.width ?? 100);
  const tHeight = target.height || target.size?.height || (targetSize?.height ?? 50);

  // Get source and target dock points
  const sourceDock = getDockingPoint(source, target, { width: sWidth, height: sHeight });
  const targetDock = getDockingPoint(target, source, { width: tWidth, height: tHeight });

  // Get horizontal and vertical distance
  const dx = targetDock.x - sourceDock.x;
  const dy = targetDock.y - sourceDock.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  // If nodes are aligned horizontally or vertically, just use two points
  if (adx < 1e-2 || ady < 1e-2) {
    return [
      { x: sourceDock.x, y: sourceDock.y },
      { x: targetDock.x, y: targetDock.y }
    ];
  }

}

/**
 * Snap a point to a grid
 * @param {Object} point Point to snap
 * @param {number} gridSize Grid size
 * @returns {Object} Snapped point
 */
export function snapToGrid(point, gridSize = 10) {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize
  };
}

/**
 * Check if a point is close to a line segment
 * @param {Object} point Point to check
 * @param {Object} start Line start
 * @param {Object} end Line end
 * @param {number} threshold Distance threshold
 * @returns {boolean} True if point is close to line
 */
export function isPointNearLine(point, start, end, threshold = 5) {
  // Calculate distance from point to line segment
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) {
    // If start and end are the same point, calculate distance to that point
    const distToPoint = Math.sqrt(
      Math.pow(point.x - start.x, 2) + 
      Math.pow(point.y - start.y, 2)
    );
    return distToPoint <= threshold;
  }
  
  // Calculate projection of point onto line
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (length * length);
  
  if (t < 0) {
    // Beyond the start of the line
    return Math.sqrt(
      Math.pow(point.x - start.x, 2) + 
      Math.pow(point.y - start.y, 2)
    ) <= threshold;
  } else if (t > 1) {
    // Beyond the end of the line
    return Math.sqrt(
      Math.pow(point.x - end.x, 2) + 
      Math.pow(point.y - end.y, 2)
    ) <= threshold;
  } else {
    // Projection falls on the line segment
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    return Math.sqrt(
      Math.pow(point.x - projX, 2) + 
      Math.pow(point.y - projY, 2)
    ) <= threshold;
  }
}

/**
 * Add a new waypoint at the closest position on a connection path
 * @param {Array} waypoints Existing waypoints
 * @param {Object} point Click position
 * @returns {Array} Updated waypoints with new waypoint
 */
export function addWaypointNearPosition(waypoints, point) {
  if (waypoints.length < 2) {
    return [...waypoints];
  }
  
  let minDistance = Infinity;
  let insertIndex = 0;
  let newPoint = null;
  
  // Find the closest segment
  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i+1];
    
    if (isPointNearLine(point, start, end)) {
      // Calculate projection onto line segment
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      // Normalize direction vector
      const nx = dx / length;
      const ny = dy / length;
      
      // Calculate vector from start to point
      const vx = point.x - start.x;
      const vy = point.y - start.y;
      
      // Calculate projection length
      const projLength = nx * vx + ny * vy;
      const clampedProjLength = Math.max(0, Math.min(length, projLength));
      
      // Calculate projection point
      const projX = start.x + clampedProjLength * nx;
      const projY = start.y + clampedProjLength * ny;
      
      const distance = Math.sqrt(
        Math.pow(point.x - projX, 2) + 
        Math.pow(point.y - projY, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        insertIndex = i + 1;
        newPoint = { x: projX, y: projY };
      }
    }
  }
  
  if (newPoint) {
    const newWaypoints = [...waypoints];
    newWaypoints.splice(insertIndex, 0, newPoint);
    return newWaypoints;
  }
  
  return waypoints;
}

/**
 * Creates a smooth path for relation visualization similar to bpmn-js
 * @param {Array} waypoints Array of waypoints
 * @param {boolean} smoothing Whether to use bezier curves for smoothing
 * @returns {string} SVG path data
 */
export function generateConnectionPath(waypoints, smoothing = true) {
  if (!waypoints || waypoints.length < 2) {
    return '';
  }
  
  // For just two points, use a straight line
  if (waypoints.length === 2) {
    return `M${waypoints[0].x},${waypoints[0].y} L${waypoints[1].x},${waypoints[1].y}`;
  }
  
  let path = `M${waypoints[0].x},${waypoints[0].y}`;
  
  if (smoothing) {
    // Use bezier curves for smooth corners (similar to bpmn-js)
    for (let i = 0; i < waypoints.length - 1; i++) {
      const curr = waypoints[i];
      const next = waypoints[i + 1];
      
      // For first segment, just draw to next point
      if (i === 0) {
        path += ` L${next.x},${next.y}`;
      } 
      // For last segment, just draw to last point
      else if (i === waypoints.length - 2) {
        path += ` L${next.x},${next.y}`;
      }
      // For middle segments, use bezier curves for corners
      else {
        const prev = waypoints[i - 1];
        
        // Check if we have a corner (direction change)
        const inDir = getDirection(prev, curr);
        const outDir = getDirection(curr, next);
        
        if (inDir !== outDir) {
          // Calculate control points for bezier (1/3 of the segment length)
          const thirdDistX = (next.x - curr.x) / 3;
          const thirdDistY = (next.y - curr.y) / 3;
          
          // Create bezier curve
          path += ` C${curr.x + thirdDistX},${curr.y + thirdDistY} ${next.x - thirdDistX},${next.y - thirdDistY} ${next.x},${next.y}`;
        } else {
          // Just use line if direction doesn't change
          path += ` L${next.x},${next.y}`;
        }
      }
    }
  } else {
    // Non-smooth version, just use lines
    for (let i = 1; i < waypoints.length; i++) {
      path += ` L${waypoints[i].x},${waypoints[i].y}`;
    }
  }
  
  return path;
}

/**
 * Auto-layout a connection between two nodes using improved heuristics
 * @param {Object} sourceNode Source node
 * @param {Object} targetNode Target node
 * @param {Array} existingWaypoints Existing waypoints (if any)
 * @returns {Array} Waypoints for connection
 */
export function layoutConnection(sourceNode, targetNode, existingWaypoints = []) {
  // If we already have waypoints and they're valid, use them
  if (existingWaypoints && existingWaypoints.length >= 2) {
    return existingWaypoints;
  }
  
  // Default sizes for activity nodes
  const sourceSize = { width: 100, height: 50 };
  const targetSize = { width: 100, height: 50 };
  
  // Calculate if nodes are in vertical or horizontal alignment
  const verticalAlign = Math.abs(sourceNode.x - targetNode.x) < 50;
  const horizontalAlign = Math.abs(sourceNode.y - targetNode.y) < 50;
  
  // Simple direct connection for aligned nodes
  if (verticalAlign || horizontalAlign) {
    const sourceDock = getDockingPoint(sourceNode, targetNode, sourceSize);
    const targetDock = getDockingPoint(targetNode, sourceNode, targetSize);
    return [
      { x: sourceDock.x, y: sourceDock.y },
      { x: targetDock.x, y: targetDock.y }
    ];
  }
  
  // Use manhattan routing if needed
  return createManhattanWaypoints(sourceNode, targetNode, sourceSize, targetSize);
}
