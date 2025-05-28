// Returns array of nodes fully inside the selection rectangle
export function getNodesInMultiSelectionBox(nodes, selectionBox) {
  if (!selectionBox) return [];
  return nodes.filter(node => {
    const nodeLeft = node.x - 50;
    const nodeRight = node.x + 50;
    const nodeTop = node.y - 25;
    const nodeBottom = node.y + 25;
    return (
      nodeLeft >= selectionBox.x &&
      nodeRight <= selectionBox.x + selectionBox.width &&
      nodeTop >= selectionBox.y &&
      nodeBottom <= selectionBox.y + selectionBox.height
    );
  });
}

/**
 * Find all relations that connect selected nodes and automatically include them
 * @param {Array} selectedNodes Array of selected nodes
 * @param {Array} relations Array of all relations
 * @returns {Array} Array of relation endpoints and waypoints to include in selection
 */
export function getRelationsForSelectedNodes(selectedNodes, relations) {
  if (!selectedNodes || !relations || selectedNodes.length < 2) return [];
  
  const selectedNodeIds = selectedNodes.map(node => node.id);
  const relationPoints = [];
  
  relations.forEach(relation => {
    // Check if both source and target nodes are selected
    if (selectedNodeIds.includes(relation.sourceId) && 
        selectedNodeIds.includes(relation.targetId)) {
      
      // Include all waypoints (including endpoints) for relations between selected nodes
      if (relation.waypoints && relation.waypoints.length > 0) {
        relation.waypoints.forEach((waypoint, index) => {
          relationPoints.push({
            type: 'waypoint',
            relationId: relation.id,
            waypointIndex: index,
            x: waypoint.x,
            y: waypoint.y
          });
        });
      }
    }
  });
  
  return relationPoints;
}

// Returns array of relation waypoints/midpoints inside the selection rectangle
export function getRelationPointsInMultiSelectionBox(relations, selectionBox) {
  if (!selectionBox || !relations) return [];
  const points = [];
  
  relations.forEach(relation => {
    // Include waypoints (excluding endpoints)
    if (relation.waypoints && relation.waypoints.length > 2) {
      for (let i = 1; i < relation.waypoints.length - 1; i++) {
        const waypoint = relation.waypoints[i];
        const pointSize = 5; // waypoint control point size
        if (waypoint.x - pointSize >= selectionBox.x &&
            waypoint.x + pointSize <= selectionBox.x + selectionBox.width &&
            waypoint.y - pointSize >= selectionBox.y &&
            waypoint.y + pointSize <= selectionBox.y + selectionBox.height) {
          points.push({
            type: 'waypoint',
            relationId: relation.id,
            index: i,
            x: waypoint.x,
            y: waypoint.y
          });
        }
      }
    }
    
  });
  
  return points;
}

// Returns array of nary diamonds inside the selection rectangle
export function getNaryDiamondsInMultiSelectionBox(relations, selectionBox) {
  if (!selectionBox || !relations) return [];
  
  return relations
    .filter(relation => relation.activities && Array.isArray(relation.activities) && relation.activities.length > 1)
    .filter(relation => {
      if (!relation.diamondPos) return false;
      const diamondSize = 15; // half the diamond size
      return (
        relation.diamondPos.x - diamondSize >= selectionBox.x &&
        relation.diamondPos.x + diamondSize <= selectionBox.x + selectionBox.width &&
        relation.diamondPos.y - diamondSize >= selectionBox.y &&
        relation.diamondPos.y + diamondSize <= selectionBox.y + selectionBox.height
      );
    })
    .map(relation => ({
      type: 'naryDiamond',
      relationId: relation.id,
      x: relation.diamondPos.x,
      y: relation.diamondPos.y
    }));
}

// Helper function to calculate midpoint of a path
function getPathMidpoint(waypoints) {
  if (waypoints.length < 2) return waypoints[0] || { x: 0, y: 0 };

  // Calculate total length
  let totalLength = 0;
  const segmentLengths = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const dx = waypoints[i + 1].x - waypoints[i].x;
    const dy = waypoints[i + 1].y - waypoints[i].y;
    const len = Math.hypot(dx, dy);
    segmentLengths.push(len);
    totalLength += len;
  }
  if (totalLength === 0) return waypoints[0];

  // Find the segment containing the midpoint
  let midDist = totalLength / 2;
  let acc = 0;
  for (let i = 0; i < segmentLengths.length; i++) {
    if (acc + segmentLengths[i] >= midDist) {
      const remain = midDist - acc;
      const ratio = remain / segmentLengths[i];
      const x = waypoints[i].x + (waypoints[i + 1].x - waypoints[i].x) * ratio;
      const y = waypoints[i].y + (waypoints[i + 1].y - waypoints[i].y) * ratio;
      return { x, y };
    }
    acc += segmentLengths[i];
  }
  // Fallback
  return waypoints[waypoints.length - 1];
}

// Returns all selectable elements inside the selection rectangle
export function getAllSelectableElementsInBox(nodes, relations, selectionBox) {
  if (!selectionBox) return { nodes: [], relationPoints: [], naryDiamonds: [] };
  
  const selectedNodes = getNodesInMultiSelectionBox(nodes, selectionBox);
  const manuallySelectedRelationPoints = getRelationPointsInMultiSelectionBox(relations, selectionBox);
  const autoSelectedRelationPoints = getRelationsForSelectedNodes(selectedNodes, relations);
  
  // Combine manually selected relation points with automatically included relation endpoints/waypoints
  // Remove duplicates by creating a Set based on relationId + waypointIndex
  const allRelationPoints = [...manuallySelectedRelationPoints, ...autoSelectedRelationPoints];
  const uniqueRelationPoints = allRelationPoints.filter((point, index, arr) => 
    arr.findIndex(p => 
      p.relationId === point.relationId && 
      p.waypointIndex === point.waypointIndex
    ) === index
  );
  
  return {
    nodes: selectedNodes,
    relationPoints: uniqueRelationPoints,
    naryDiamonds: getNaryDiamondsInMultiSelectionBox(relations, selectionBox)
  };
}

// Returns bounding box {x, y, width, height} for a list of mixed selectable elements
export function getBoundingBoxForMultiSelectedNodes(nodes) {
  if (!nodes || nodes.length === 0) return null;
  const left = Math.min(...nodes.map(n => n.x - 50));
  const right = Math.max(...nodes.map(n => n.x + 50));
  const top = Math.min(...nodes.map(n => n.y - 25));
  const bottom = Math.max(...nodes.map(n => n.y + 25));
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

// Returns bounding box for mixed selection (nodes, relation points, nary diamonds)
export function getBoundingBoxForMixedSelection(selectedElements) {
  if (!selectedElements || 
      (!selectedElements.nodes?.length && 
       !selectedElements.relationPoints?.length && 
       !selectedElements.naryDiamonds?.length)) {
    return null;
  }
  
  const allPoints = [];
  
  // Add nodes with their bounds
  if (selectedElements.nodes) {
    selectedElements.nodes.forEach(node => {
      const nodeWidth = node.width || node.size?.width || 100;
      const nodeHeight = node.height || node.size?.height || 50;
      allPoints.push(
        { x: node.x - nodeWidth/2, y: node.y - nodeHeight/2 },
        { x: node.x + nodeWidth/2, y: node.y + nodeHeight/2 }
      );
    });
  }
  
  // Add relation points
  if (selectedElements.relationPoints) {
    selectedElements.relationPoints.forEach(point => {
      allPoints.push({ x: point.x, y: point.y });
    });
  }
  
  // Add nary diamonds
  if (selectedElements.naryDiamonds) {
    selectedElements.naryDiamonds.forEach(diamond => {
      allPoints.push({ x: diamond.x, y: diamond.y });
    });
  }
  
  if (allPoints.length === 0) return null;
  
  const left = Math.min(...allPoints.map(p => p.x));
  const right = Math.max(...allPoints.map(p => p.x));
  const top = Math.min(...allPoints.map(p => p.y));
  const bottom = Math.max(...allPoints.map(p => p.y));
  
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

