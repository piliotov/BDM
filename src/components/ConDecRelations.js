import React, { useState, useEffect } from 'react';

// --- Relation Types ---
export const RELATION_TYPES = {
    RESP_EXISTENCE: 'resp_existence', 
    RESPONSE: 'response',
    PRECEDENCE: 'precedence',
    SUCCESSION: 'succession',
    COEXISTENCE: 'coexistence',
    ALT_RESPONSE: 'alt_response',
    ALT_PRECEDENCE: 'alt_precedence',
    ALT_SUCCESSION: 'alt_succession',
    CHAIN_RESPONSE: 'chain_response',
    CHAIN_PRECEDENCE: 'chain_precedence',
    CHAIN_SUCCESSION: 'chain_succession',
    RESP_ABSENCE: 'resp_absence',
    NOT_COEXISTENCE: 'not_coexistence',
    NEG_RESPONSE: 'neg_response',
    NEG_PRECEDENCE: 'neg_precedence',
    NEG_SUCCESSION: 'neg_succession',
    NEG_ALT_RESPONSE: 'neg_alt_response',
    NEG_ALT_PRECEDENCE: 'neg_alt_precedence',
    NEG_ALT_SUCCESSION: 'neg_alt_succession',
    NEG_CHAIN_RESPONSE: 'neg_chain_response',
    NEG_CHAIN_PRECEDENCE: 'neg_chain_precedence',
    NEG_CHAIN_SUCCESSION: 'neg_chain_succession'
};

// --- Relation Visualization Helper ---
export function getRelationVisual(type, isSelected) {
  const baseStyle = {
    stroke: isSelected ? '#1a73e8' : '#444',
    strokeWidth: isSelected ? 2.5 : 1.5,  // Keep the visual stroke width reasonable
    cursor: 'pointer',
  };

  let style = { ...baseStyle };
  let sourceBall = false;
  let targetBall = false;
  let targetArrow = false;
  let sourceArrow = false;
  let negation = false;
  let parallel = false;
  let treeparallel = false;

  switch (type) {
    case RELATION_TYPES.RESP_EXISTENCE:
      sourceBall = true;
      break;
    case RELATION_TYPES.COEXISTENCE:
      sourceBall = true;
      targetBall = true;
      break;
    case RELATION_TYPES.RESPONSE:
      sourceBall = true;
      targetArrow = true;
      break;
    case RELATION_TYPES.PRECEDENCE:
      targetArrow = true;
      parallel = true;
      break;
    case RELATION_TYPES.SUCCESSION:
      sourceBall = true;
      targetArrow = true;
      parallel = true;
      break;
    case RELATION_TYPES.ALT_RESPONSE:
      sourceBall = true;
      targetArrow = true;
      parallel = true;
      break;
    case RELATION_TYPES.ALT_PRECEDENCE:
      sourceArrow = true;
      targetBall = true;
      parallel = true;
      break;
    case RELATION_TYPES.ALT_SUCCESSION:
      sourceBall = true;
      targetBall = true;
      parallel = true;
      break;
    case RELATION_TYPES.CHAIN_RESPONSE:
      sourceBall = true;
      targetArrow = true;
      parallel = true;
      break;
    case RELATION_TYPES.CHAIN_PRECEDENCE:
      sourceArrow = true;
      targetBall = true;
      parallel = true;
      break;
    case RELATION_TYPES.CHAIN_SUCCESSION:
      sourceBall = true;
      targetBall = true;
      parallel = true;
      break;
    default:
      targetArrow = true;
  }

  if (type.startsWith('neg_') || type.startsWith('NEG_') || type.includes('NEG')) {
    negation = true;
  }
  
  return { style, sourceBall, targetBall, targetArrow, sourceArrow, negation, parallel };
}

// Generate a smooth path through waypoints
function generatePath(waypoints) {
  if (!waypoints || waypoints.length < 2) return '';
  
  let path = `M${waypoints[0].x},${waypoints[0].y}`;
  
  // For just two points, use a straight line
  if (waypoints.length === 2) {
    path += ` L${waypoints[1].x},${waypoints[1].y}`;
    return path;
  }
  
  // For multiple points, use a smooth curve
  for (let i = 0; i < waypoints.length - 1; i++) {
    const curr = waypoints[i];
    const next = waypoints[i + 1];
    
    // Use quadratic curves for middle segments
    if (i === 0) {
      path += ` Q${(curr.x + next.x) / 2},${(curr.y + next.y) / 2},${next.x},${next.y}`;
    } else if (i < waypoints.length - 2) {
      const nextNext = waypoints[i + 2];
      const cp1 = { x: (curr.x + next.x) / 2, y: (curr.y + next.y) / 2 };
      const cp2 = { x: (next.x + nextNext.x) / 2, y: (next.y + nextNext.y) / 2 };
      path += ` C${cp1.x},${cp1.y},${cp2.x},${cp2.y},${next.x},${next.y}`;
    } else {
      path += ` L${next.x},${next.y}`;
    }
  }
  
  return path;
}

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
  
  const {
    style,
    sourceBall,
    targetBall,
    targetArrow,
    sourceArrow,
    negation,
    parallel
  } = getRelationVisual(relation.type, isSelected);

  // Calculate midpoint for label
  const midIndex = Math.floor(currentWaypoints.length / 2);
  const midPoint = currentWaypoints[midIndex] || {
    x: (currentWaypoints[0].x + currentWaypoints[currentWaypoints.length - 1].x) / 2,
    y: (currentWaypoints[0].y + currentWaypoints[currentWaypoints.length - 1].y) / 2
  };

  // Calculate label position with offset
  const labelX = midPoint.x + (labelOffset ? labelOffset.x : 0);
  const labelY = midPoint.y + (labelOffset ? labelOffset.y : 0);

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
  
  // Get source and target edge points for markers
  const sourceEdgePoint = currentWaypoints[0];
  const targetEdgePoint = currentWaypoints[currentWaypoints.length - 1];
  
  // Handle relation click - ensure it captures events
  const handleRelationClick = (e) => {
    e.stopPropagation();
    if (draggedWaypointIndex === null) {
      onSelect(e);
    }
  };
  
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
        strokeWidth={10/zoom} // Wide hit area for easier selection
        fill="none"
        pointerEvents="stroke"
      />
      
      {/* Main visible path */}
      <path
        d={pathData}
        fill="none"
        {...style}
        markerEnd={targetArrow ? 'url(#arrow)' : ''}
        markerStart={sourceArrow ? 'url(#arrow-start)' : ''}
        pointerEvents="none" // Don't handle events on this path (the invisible one above will catch them)
      />
      
      {/* Source Ball */}
      {sourceBall && (
        <circle
          cx={sourceEdgePoint.x}
          cy={sourceEdgePoint.y}
          r={controlPointSize / 1.5}
          fill={style.stroke}
          pointerEvents="all" // Ensure click events work on this element
        />
      )}

      {/* Target Ball */}
      {targetBall && (
        <circle
          cx={targetEdgePoint.x}
          cy={targetEdgePoint.y}
          r={controlPointSize / 1.5}
          fill={style.stroke}
          pointerEvents="all" // Ensure click events work on this element
        />
      )}

      {/* Negation marker at midpoint */}
      {negation && (
        <g 
          transform={`translate(${midPoint.x},${midPoint.y})`}
          pointerEvents="all" // Ensure click events work on this element
        >
          <rect
            x={-10}
            y={-10}
            width={20}
            height={20}
            fill="transparent" 
            pointerEvents="all"
          />
          <line
            x1={-8}
            y1={-8}
            x2={8}
            y2={8}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
          />
          <line
            x1={8}
            y1={-8}
            x2={-8}
            y2={8}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
          />
        </g>
      )}

      {/* Draggable Label */}
      <g 
        className="condec-relation-label" 
        cursor={isSelected ? "move" : "pointer"}
        onMouseDown={isSelected ? handleLabelMouseDown : handleRelationClick}
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
