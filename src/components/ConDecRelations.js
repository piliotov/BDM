import React, { useState, useEffect } from 'react';
import { generatePath } from '../utils/geometryUtils';
import { getRelationVisual } from '../utils/relationUtils';
import { getRelationMarkerIds } from '../utils/relationIconUtils';

// Export relations types for backward compatibility
export { RELATION_TYPES } from '../utils/relationUtils';

// --- Render a single relation ---
export function ConDecRelation({
  relation,
  sourceNode,
  targetNode,
  isSelected,
  onSelect,
  calculateIntersectionPoint,
  onWaypointDrag,
  onWaypointDragEnd,
  canvasOffset = { x: 0, y: 0 },
  zoom = 1
}) {
  const [draggedWaypointIndex, setDraggedWaypointIndex] = useState(null);
  const [currentWaypoints, setCurrentWaypoints] = useState([]);
  const [isDraggingLabel, setIsDraggingLabel] = useState(false);
  const [labelOffset, setLabelOffset] = useState(relation.labelOffset || { x: 0, y: 0 });
  
  // Calculate initial waypoints when relation or nodes change
  useEffect(() => {
    if (!sourceNode || !targetNode) return;
    
    // Get existing waypoints or calculate new ones
    const waypoints = relation.waypoints || [];
    const sourcePoint = { x: sourceNode.x, y: sourceNode.y };
    const targetPoint = { x: targetNode.x, y: targetNode.y };
    
    // Calculate edge intersections
    const sourceEdgePoint = calculateIntersectionPoint(targetPoint, sourcePoint);
    const targetEdgePoint = calculateIntersectionPoint(sourcePoint, targetPoint);
    
    // Use existing waypoints or create default ones
    const points = waypoints.length > 0 ? 
      waypoints : 
      [
        { x: sourceEdgePoint.x, y: sourceEdgePoint.y },
        { x: targetEdgePoint.x, y: targetEdgePoint.y }
      ];
      
    setCurrentWaypoints(points);
    
    // If relation has a saved labelOffset, use it
    if (relation.labelOffset) {
      setLabelOffset(relation.labelOffset);
    }
  }, [relation, sourceNode, targetNode, calculateIntersectionPoint]);
  
  // Handle waypoint dragging
  useEffect(() => {
    if (draggedWaypointIndex === null || currentWaypoints.length === 0) return;
    
    const handleWaypointDrag = (e) => {
      e.stopPropagation(); // Stop propagation to prevent other events
      
      const svg = e.target.closest('svg') || document.querySelector('svg.condec-canvas');
      if (!svg) return;
      
      // Get SVG coordinates
      const point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
      
      // Update waypoint position
      const updatedWaypoints = [...currentWaypoints];
      updatedWaypoints[draggedWaypointIndex] = { 
        x: (svgPoint.x - canvasOffset.x) / zoom, 
        y: (svgPoint.y - canvasOffset.y) / zoom 
      };
      
      setCurrentWaypoints(updatedWaypoints);
      
      // Notify parent
      if (onWaypointDrag) {
        onWaypointDrag(relation.id, updatedWaypoints);
      }
    };
    
    const handleWaypointDragEnd = (e) => {
      e.stopPropagation(); // Stop propagation to prevent other events
      setDraggedWaypointIndex(null);
      if (onWaypointDragEnd) {
        onWaypointDragEnd(relation.id);
      }
    };
    
    window.addEventListener('mousemove', handleWaypointDrag);
    window.addEventListener('mouseup', handleWaypointDragEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleWaypointDrag);
      window.removeEventListener('mouseup', handleWaypointDragEnd);
    };
  }, [draggedWaypointIndex, currentWaypoints, relation.id, canvasOffset, zoom, onWaypointDrag, onWaypointDragEnd]);

  // Handle label dragging
  useEffect(() => {
    if (!isDraggingLabel) return;
    
    const handleLabelDrag = (e) => {
      e.stopPropagation(); // Stop propagation to prevent other events
      
      const svg = e.target.closest('svg') || document.querySelector('svg.condec-canvas');
      if (!svg) return;
      
      // Get SVG coordinates
      const point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
      
      // Calculate midpoint for reference
      const midIndex = Math.floor(currentWaypoints.length / 2);
      const midPoint = currentWaypoints[midIndex] || {
        x: (currentWaypoints[0].x + currentWaypoints[currentWaypoints.length - 1].x) / 2,
        y: (currentWaypoints[0].y + currentWaypoints[currentWaypoints.length - 1].y) / 2
      };
      
      // Calculate offset from midpoint
      const newOffset = {
        x: ((svgPoint.x - canvasOffset.x) / zoom) - midPoint.x,
        y: ((svgPoint.y - canvasOffset.y) / zoom) - midPoint.y
      };
      
      setLabelOffset(newOffset);
      
      // Update relation with new label offset
      if (onWaypointDrag) {
        const updatedRelations = [{
          ...relation,
          labelOffset: newOffset
        }];
        onWaypointDrag(relation.id, currentWaypoints, updatedRelations);
      }
    };

    const handleLabelDragEnd = (e) => {
      e.stopPropagation(); // Stop propagation to prevent other events
      setIsDraggingLabel(false);
      if (onWaypointDragEnd) {
        onWaypointDragEnd(relation.id);
      }
    };
    
    window.addEventListener('mousemove', handleLabelDrag);
    window.addEventListener('mouseup', handleLabelDragEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleLabelDrag);
      window.removeEventListener('mouseup', handleLabelDragEnd);
    };
  }, [isDraggingLabel, relation, currentWaypoints, canvasOffset, zoom, onWaypointDrag, onWaypointDragEnd]);
  
  // Early return if we don't have the necessary data
  if (!sourceNode || !targetNode || currentWaypoints.length < 2) {
    return null;
  }

  // Create path for the relation
  const pathData = generatePath(currentWaypoints);
  
  // Use getRelationVisual to get style and negation state
  const { style, negation, pathStyle } = getRelationVisual(relation.type, isSelected);

  // Get marker IDs based on relation type
  const { startMarkerId, endMarkerId } = getRelationMarkerIds(relation.type);

  // Calculate the true midpoint along the path (by length)
  function getPathMidpoint(points) {
    if (points.length < 2) return points[0] || { x: 0, y: 0 };

    // Calculate total length
    let totalLength = 0;
    const segmentLengths = [];
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      const len = Math.hypot(dx, dy);
      segmentLengths.push(len);
      totalLength += len;
    }
    if (totalLength === 0) return points[0];

    // Find the segment containing the midpoint
    let midDist = totalLength / 2;
    let acc = 0;
    for (let i = 0; i < segmentLengths.length; i++) {
      if (acc + segmentLengths[i] >= midDist) {
        const remain = midDist - acc;
        const ratio = remain / segmentLengths[i];
        const x = points[i].x + (points[i + 1].x - points[i].x) * ratio;
        const y = points[i].y + (points[i + 1].y - points[i].y) * ratio;
        return { x, y };
      }
      acc += segmentLengths[i];
    }
    // Fallback
    return points[points.length - 1];
  }

  // Calculate midpoint for label and negation marker
  const midPoint = getPathMidpoint(currentWaypoints);

  // Place label at the midpoint plus the label offset
  const labelX = midPoint.x;
  const labelY = midPoint.y;

  // Control point size adjusts with zoom
  const controlPointSize = 8 / zoom;
  
  // Handle control point drag start
  const handleWaypointMouseDown = (index, e) => {
    e.stopPropagation();
    setDraggedWaypointIndex(index);
  };
  
  // Add a new waypoint between two existing ones
  const handleAddWaypoint = (index, midX, midY, e) => {
    e.stopPropagation();
    const newWaypoints = [...currentWaypoints];
    newWaypoints.splice(index + 1, 0, { x: midX, y: midY });
    
    setCurrentWaypoints(newWaypoints);
    
    if (onWaypointDrag) {
      onWaypointDrag(relation.id, newWaypoints);
      if (onWaypointDragEnd) {
        onWaypointDragEnd(relation.id);
      }
    }
  };

  // Handle label mouse down for dragging
  const handleLabelMouseDown = (e) => {
    e.stopPropagation();
    setIsDraggingLabel(true);
  };
  
  // Handle relation click - ensure it captures events
  const handleRelationClick = (e) => {
    e.stopPropagation();
    if (draggedWaypointIndex === null) {
      onSelect(e);
    }
  };

  // Helper to trim a path at both ends by a certain length (for parallel lines)
  function trimWaypoints(pts, trimLen) {
    if (pts.length < 2 || trimLen <= 0) return pts;
    // Calculate total length
    let totalLength = 0;
    const segLens = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i + 1].x - pts[i].x;
      const dy = pts[i + 1].y - pts[i].y;
      const len = Math.hypot(dx, dy);
      segLens.push(len);
      totalLength += len;
    }
    if (totalLength === 0) return pts;

    // Only trim if the path is long enough
    if (totalLength < trimLen * 2) return pts;

    // Trim from start
    let remain = trimLen;
    let i = 0;
    let start = { ...pts[0] };
    while (remain > 0 && i < segLens.length) {
      if (segLens[i] > remain) {
        const ratio = remain / segLens[i];
        start = {
          x: pts[i].x + (pts[i + 1].x - pts[i].x) * ratio,
          y: pts[i].y + (pts[i + 1].y - pts[i].y) * ratio
        };
        break;
      }
      remain -= segLens[i];
      i++;
    }

    // Trim from end
    remain = trimLen;
    let j = segLens.length - 1;
    let end = { ...pts[pts.length - 1] };
    while (remain > 0 && j >= 0) {
      if (segLens[j] > remain) {
        const ratio = remain / segLens[j];
        end = {
          x: pts[j + 1].x - (pts[j + 1].x - pts[j].x) * ratio,
          y: pts[j + 1].y - (pts[j + 1].y - pts[j].y) * ratio
        };
        break;
      }
      remain -= segLens[j];
      j--;
    }

    // Build new trimmed waypoints
    const newPts = [];
    if (i === j + 1) {
      // Only one segment remains after trimming
      newPts.push(start, end);
    } else {
      newPts.push(start);
      for (let k = i + 1; k <= j + 1; k++) {
        newPts.push(pts[k]);
      }
      newPts.push(end);
    }
    return newPts;
  }

  // Helper: offset a polyline by a fixed distance perpendicular to the local segment direction at each point
  function offsetPolyline(points, offset) {
    if (points.length < 2 || offset === 0) return points.map(pt => ({ ...pt }));
    const out = [];
    for (let i = 0; i < points.length; i++) {
      // For each point, get the direction of the segment at that point
      let dx = 0, dy = 0;
      if (i === 0) {
        dx = points[1].x - points[0].x;
        dy = points[1].y - points[0].y;
      } else if (i === points.length - 1) {
        dx = points[i].x - points[i - 1].x;
        dy = points[i].y - points[i - 1].y;
      } else {
        // Use the angle bisector for smooth offset at corners
        const dx1 = points[i].x - points[i - 1].x;
        const dy1 = points[i].y - points[i - 1].y;
        const dx2 = points[i + 1].x - points[i].x;
        const dy2 = points[i + 1].y - points[i].y;
        // Normalize
        const len1 = Math.hypot(dx1, dy1);
        const len2 = Math.hypot(dx2, dy2);
        let nx1 = 0, ny1 = 0, nx2 = 0, ny2 = 0;
        if (len1 > 0) {
          nx1 = -dy1 / len1;
          ny1 = dx1 / len1;
        }
        if (len2 > 0) {
          nx2 = -dy2 / len2;
          ny2 = dx2 / len2;
        }
        // Average the normals for smooth join
        const nx = nx1 + nx2;
        const ny = ny1 + ny2;
        const nlen = Math.hypot(nx, ny);
        if (nlen > 0) {
          out.push({
            x: points[i].x + (nx / nlen) * offset,
            y: points[i].y + (ny / nlen) * offset
          });
          continue;
        } else {
          dx = dx1 + dx2;
          dy = dy1 + dy2;
        }
      }
      // Perpendicular vector (normalize)
      const len = Math.hypot(dx, dy);
      if (len === 0) {
        out.push({ ...points[i] });
      } else {
        const nx = -dy / len;
        const ny = dx / len;
        out.push({
          x: points[i].x + nx * offset,
          y: points[i].y + ny * offset
        });
      }
    }
    return out;
  }

  // Helper: generate a smooth SVG path (cubic Bezier) from polyline points
  function generateSmoothPath(points) {
    if (points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      // Control points: halfway between points for smoothness
      const c1x = p0.x + (p1.x - p0.x) / 3;
      const c1y = p0.y + (p1.y - p0.y) / 3;
      const c2x = p0.x + 2 * (p1.x - p0.x) / 3;
      const c2y = p0.y + 2 * (p1.y - p0.y) / 3;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p1.x} ${p1.y}`;
    }
    return d;
  }

  // Helper: get marker offset in px for a markerId (from relationUtils)
  function getMarkerOffsetForId(markerId, isEnd = false, startMarkerId = null) {
    if (!markerId) return 0;
    // Special case: start ball and end arrow-ball (for coexistence)
    if (
      isEnd &&
      markerId.includes('arrow-ball') &&
      startMarkerId &&
      startMarkerId.includes('ball')
    ) {
      return 25;
    }
    // Use larger values for end marker (secondary lines should stop further away)
    if (markerId.includes('arrow-ball')) return isEnd ? 18 : 13;
    if (markerId.includes('arrow')) return isEnd ? 16 : 8;
    if (markerId.includes('ball')) return isEnd ? 14 : 7;
    return 0;
  }

  // Helper: trim both ends of a polyline by different amounts
  function trimBothEndsDiff(pts, trimStart, trimEnd) {
    if ((!trimStart && !trimEnd) || pts.length < 2) return pts;
    let trimmed = pts;
    if (trimStart) trimmed = trimWaypoints(trimmed, trimStart);
    if (trimEnd) trimmed = trimWaypoints(trimmed.slice().reverse(), trimEnd).slice().reverse();
    return trimmed;
  }

  return (
    <g 
      className="condec-relation"
      onMouseDown={handleRelationClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Invisible wider path for easier selection - always rendered first */}
      <path
        d={pathData}
        stroke="transparent"
        strokeWidth={10/zoom}
        fill="none"
        pointerEvents="stroke"
      />

      {/* Main center path with markers (always render for markers, even if alt, but invisible for alt) */}
      {(pathStyle !== 'alt') && (
        <path
          d={generateSmoothPath(currentWaypoints)}
          fill="none"
          {...style}
          markerEnd={endMarkerId}
          markerStart={startMarkerId}
          pointerEvents="none"
        />
      )}

      {/* For alt: render a center path only for markers, but invisible */}
      {pathStyle === 'alt' && (startMarkerId || endMarkerId) && (
        <path
          d={generateSmoothPath(currentWaypoints)}
          fill="none"
          stroke="transparent"
          strokeWidth={style.strokeWidth || 1.5}
          markerEnd={endMarkerId}
          markerStart={startMarkerId}
          pointerEvents="none"
        />
      )}

      {/* Parallel lines for alt/chain, trimmed at ends, no markers */}
      {(() => {
        const offset = 3; // px
        // Use larger trim for side lines so they end before markers
        const trimStart = getMarkerOffsetForId(startMarkerId, false);
        const trimEnd = getMarkerOffsetForId(endMarkerId, true, startMarkerId);

        function trimSideLine(pts) {
          return trimBothEndsDiff(pts, trimStart, trimEnd);
        }

        if (pathStyle === 'chain') {
          return [-offset, offset].map((off, i) => (
            <path
              key={`chain-parallel-${i}`}
              d={generateSmoothPath(trimSideLine(offsetPolyline(currentWaypoints, off)))}
              fill="none"
              {...style}
              pointerEvents="none"
            />
          ));
        }
        if (pathStyle === 'alt') {
          return [offset, -offset].map((off, i) => (
            <path
              key={`alt-parallel-${i}`}
              d={generateSmoothPath(trimSideLine(offsetPolyline(currentWaypoints, off)))}
              fill="none"
              {...style}
              pointerEvents="none"
            />
          ));
        }
        return null;
      })()}

      {/* Render negation marker at midpoint perpendicular to path */}
      {negation && (() => {
        // Calculate direction at midpoint
        let angle = 0;
        if (currentWaypoints.length >= 2) {
          // Find the segment containing the midpoint
          let totalLength = 0;
          const segmentLengths = [];
          for (let i = 0; i < currentWaypoints.length - 1; i++) {
        const dx = currentWaypoints[i + 1].x - currentWaypoints[i].x;
        const dy = currentWaypoints[i + 1].y - currentWaypoints[i].y;
        const len = Math.hypot(dx, dy);
        segmentLengths.push(len);
        totalLength += len;
          }
          let midDist = totalLength / 2;
          let acc = 0;
          for (let i = 0; i < segmentLengths.length; i++) {
        if (acc + segmentLengths[i] >= midDist) {
          // Direction vector of this segment
          const dx = currentWaypoints[i + 1].x - currentWaypoints[i].x;
          const dy = currentWaypoints[i + 1].y - currentWaypoints[i].y;
          angle = Math.atan2(dy, dx) * 180 / Math.PI + 90; // Perpendicular
          break;
        }
        acc += segmentLengths[i];
          }
        }
        return (
          <use 
        href="#midpoint-negation" 
        x={midPoint.x} 
        y={midPoint.y}
        width={20/zoom}
        height={20/zoom}
        stroke={style.stroke}
        transform={`rotate(${angle},${midPoint.x},${midPoint.y})`}
        pointerEvents="none"
          />
        );
      })()}

      {/* Draggable Label */}
      <g 
        className="condec-relation-label" 
        cursor={isSelected ? "move" : "pointer"}
        onMouseDown={isSelected ? handleLabelMouseDown : handleRelationClick}
        transform={`translate(${labelOffset.x || 0},${labelOffset.y || 0})`}
        pointerEvents="all" // Ensure click events work on this element
      >
        {/* Background rect for easier selection */}
        <rect
          x={labelX - 40}
          y={labelY - 10}
          width={80} 
          height={20}
          fill="transparent"
          stroke={isSelected ? "#1a73e8" : "transparent"}
          strokeWidth={isSelected ? 1/zoom : 0}
          strokeDasharray={isSelected ? `${2/zoom},${1/zoom}` : "0"}
          pointerEvents="all" // Ensure click events work on this element
        />
        <text
          x={labelX}
          y={labelY}
          fontSize={`${12/zoom}px`}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={style.stroke}
          pointerEvents="none"
        >
          {relation.type}
        </text>
      </g>

      {/* Control points - only visible when selected */}
      {isSelected && currentWaypoints.map((point, index) => (
        <rect
          key={`wp-${index}`}
          x={point.x - controlPointSize/2}
          y={point.y - controlPointSize/2}
          width={controlPointSize}
          height={controlPointSize}
          fill={draggedWaypointIndex === index ? "#f44336" : "#1a73e8"}
          stroke="#fff"
          strokeWidth={1/zoom}
          cursor="move"
          onMouseDown={(e) => handleWaypointMouseDown(index, e)}
          pointerEvents="all" // Ensure click events work on this element
        />
      ))}
      
      {/* Add waypoint button (middle of each segment) - only when selected */}
      {isSelected && currentWaypoints.length > 1 && currentWaypoints.slice(0, -1).map((point, idx) => {
        const nextPoint = currentWaypoints[idx + 1];
        const midX = (point.x + nextPoint.x) / 2;
        const midY = (point.y + nextPoint.y) / 2;
        return (
          <circle
            key={`add-wp-${idx}`}
            cx={midX}
            cy={midY}
            r={controlPointSize / 2}
            fill="#ffffff"
            stroke="#1a73e8"
            strokeWidth={1/zoom}
            cursor="pointer"
            opacity={0.7}
            onMouseDown={(e) => handleAddWaypoint(idx, midX, midY, e)}
            pointerEvents="all" // Ensure click events work on this element
          />
        );
      })}
    </g>
  );
}
