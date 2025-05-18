export const NODE_TYPES = {
  ACTIVITY: 'activity',
};

export const CONSTRAINTS = {
  ABSENCE: 'absence',
  ABSENCE_N: 'absence_n',
  EXISTENCE_N: 'existence_n',
  EXACTLY_N: 'exactly_n',
  INIT: 'init',
};

export const initialDiagram = {
  nodes: [
    {
      id: 'activity_1',
      type: NODE_TYPES.ACTIVITY,
      name: 'Activity',
      x: 150,
      y: 150,
      constraint: null,
      constraintValue: null,
    },
  ],
  relations: [],
};

// Helper: Convert diagram to ConDec XML string (custom format)
/**
 * Converts a diagram object to XML string.
 * @param {Object} diagram
 * @returns {string}
 */
export function diagramToXML(diagram) {
  // Disabled: XML export is not supported in ConDec modeler
  return '';
}

/**
 * Parse XML string and convert to diagram object.
 * @param {string} xmlString
 * @returns {Object} diagram { nodes: [], relations: [] }
 */
export function xmlToDiagram(xmlString) {
  // Disabled: XML import is not supported in ConDec modeler
  return { nodes: [], relations: [] };
}

// Create a new relation
export function createNewRelation(sourceId, targetId, relationType, diagram, calculateIntersectionPoint) {
  const sourceNode = diagram.nodes.find(n => n.id === sourceId);
  const targetNode = diagram.nodes.find(n => n.id === targetId);
  
  if (!sourceNode || !targetNode) {
    return null;
  }
  
  // Calculate initial waypoints
  const sourcePoint = { x: sourceNode.x, y: sourceNode.y };
  const targetPoint = { x: targetNode.x, y: targetNode.y };
  
  // Calculate edge intersection points
  const sourceEdgePoint = calculateIntersectionPoint(targetPoint, sourcePoint);
  const targetEdgePoint = calculateIntersectionPoint(sourcePoint, targetPoint);
  
  const waypoints = [
    { x: sourceEdgePoint.x, y: sourceEdgePoint.y },
    { x: targetEdgePoint.x, y: targetEdgePoint.y }
  ];

  return {
    id: `relation_${Date.now()}`,
    type: relationType,
    sourceId: sourceId,
    targetId: targetId,
    waypoints: waypoints
  };
}
