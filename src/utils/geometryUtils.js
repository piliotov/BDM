// Geometry utilities for drawing paths and calculating intersections

// Calculate where a line from point1 to point2 intersects a rectangle
export function calculateIntersectionPoint(point1, point2, width = 100, height = 50) {
  // Vector from point1 to point2
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  
  // Normalized direction vector
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return point2;
  
  const nx = dx / length;
  const ny = dy / length;
  
  // Half dimensions of node
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  
  // Calculate intersection with rectangle
  let t;
  
  // Check which edge we're intersecting
  if (Math.abs(nx) * halfHeight > Math.abs(ny) * halfWidth) {
    // Intersecting left or right edge
    t = halfWidth / Math.abs(nx);
  } else {
    // Intersecting top or bottom edge
    t = halfHeight / Math.abs(ny);
  }
  
  // Calculate intersection point
  return {
    x: point2.x - nx * t,
    y: point2.y - ny * t
  };
}

// Generate an angled path between waypoints - no curves, just angled segments
export function generatePath(waypoints) {
  if (!waypoints || waypoints.length < 2) return '';
  
  const path = [`M ${waypoints[0].x} ${waypoints[0].y}`];
  
  // For each segment, create angled paths
  for (let i = 1; i < waypoints.length; i++) {
    const curr = waypoints[i];
    
    // Simple line for direct connection
    path.push(`L ${curr.x} ${curr.y}`);
  }
  
  return path.join(' ');
}

// Generate an angled path with Manhattan-style segments (horizontal and vertical lines)
export function generateAngledPath(waypoints) {
  if (!waypoints || waypoints.length < 2) return '';
  
  const path = [`M ${waypoints[0].x} ${waypoints[0].y}`];
  
  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i-1];
    const curr = waypoints[i];
    
    // Add a 90-degree bend for each segment
    const midX = (prev.x + curr.x) / 2;
    path.push(`L ${midX} ${prev.y}`);
    path.push(`L ${midX} ${curr.y}`);
    path.push(`L ${curr.x} ${curr.y}`);
  }
  
  return path.join(' ');
}
