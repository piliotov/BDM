import { 
  getDockingPoint, 
  layoutConnection, 
} from './canvasUtils';
import { CONSTRAINTS } from './diagramUtils';
// We use these functions indirectly through imports in other files
/* eslint-disable no-unused-vars */
import { getRelationMarkerIds } from './relationIconUtils';
/* eslint-enable no-unused-vars */

// --- Relation Types ---
export const RELATION_TYPES = {
  RESP_EXISTENCE: 'resp_existence',
  COEXISTENCE: 'coexistence',
  RESPONSE: 'response', 
  PRECEDENCE: 'precedence',
  SUCCESSION: 'succession',
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

/**
 * Create a connection between nodes with proper waypoints and layout
 * Similar to how bpmn-js handles connections
 * @param {string} sourceId Source node ID
 * @param {string} targetId Target node ID
 * @param {string} relationType Type of relation
 * @param {Object} diagram Current diagram
 * @returns {Object} New relation object
 */
export function createRelation(sourceId, targetId, relationType, diagram) {
  const sourceNode = diagram.nodes.find(n => n.id === sourceId);
  const targetNode = diagram.nodes.find(n => n.id === targetId);
  
  if (!sourceNode || !targetNode) {
    return null;
  }
  
  // Generate waypoints using manhattan routing
  const waypoints = layoutConnection(sourceNode, targetNode);
  
  return {
    id: `relation_${Date.now()}`,
    type: relationType || RELATION_TYPES.RESPONSE,
    sourceId: sourceId,
    targetId: targetId,
    waypoints: waypoints,
    labelOffset: { x: 0, y: -10 } // Default label position above the middle
  };
}

/**
 * Calculate marker offset for proper line endings
 * This function is used by components that import this file
 * @param {string} markerId The ID of the marker
 * @returns {number} The offset value to adjust the path
 */
/* eslint-disable no-unused-vars */
function getMarkerOffset(markerId) {
  if (!markerId) return 0;
  
  // Different markers need different offsets to make lines end precisely at the marker
  if (markerId.includes('arrow')) return 5;
  if (markerId.includes('ball')) return 5;
  if (markerId.includes('arrow-ball')) return 8;
  
  return 0;
}
/* eslint-enable no-unused-vars */

/**
 * Update relation waypoints dynamically when nodes move (bpmn-js behavior)
 * @param {Object} relation Relation to update
 * @param {Object} diagram Current diagram
 * @returns {Object} Updated relation
 */
export function updateRelationWaypoints(relation, diagram) {
  const sourceNode = diagram.nodes.find(n => n.id === relation.sourceId);
  const targetNode = diagram.nodes.find(n => n.id === relation.targetId);
  if (!sourceNode || !targetNode) {
    return relation;
  }
  // Always use actual node size if present
  const sourceSize = { width: sourceNode.width || sourceNode.size?.width || 100, height: sourceNode.height || sourceNode.size?.height || 50 };
  const targetSize = { width: targetNode.width || targetNode.size?.width || 100, height: targetNode.height || targetNode.size?.height || 50 };
  if (!relation.waypoints || relation.waypoints.length <= 2) {
    const newWaypoints = layoutConnection(sourceNode, targetNode, sourceSize, targetSize);
    return {
      ...relation,
      waypoints: newWaypoints
    };
  }
  const updatedWaypoints = [...relation.waypoints];
  // Update source docking point
  const secondPoint = updatedWaypoints[1];
  updatedWaypoints[0] = getDockingPoint(
    sourceNode,
    secondPoint,
    sourceSize
  );
  // Update target docking point
  const secondLastPoint = updatedWaypoints[updatedWaypoints.length - 2];
  updatedWaypoints[updatedWaypoints.length - 1] = getDockingPoint(
    targetNode,
    secondLastPoint,
    targetSize
  );
  return {
    ...relation,
    waypoints: updatedWaypoints
  };
}

/**
 * Handle midpoint dragging while keeping endpoints fixed to nodes
 * Uses the same algorithm as node dragging to ensure consistency
 * @param {Object} relation Relation being updated
 * @param {Array} waypoints Updated waypoints with moved midpoint
 * @param {Object} diagram Current diagram
 * @returns {Object} Updated relation with fixed endpoints
 */
export function updateRelationWithFixedEndpoints(relation, waypoints, diagram) {
  const sourceNode = diagram.nodes.find(n => n.id === relation.sourceId);
  const targetNode = diagram.nodes.find(n => n.id === relation.targetId);
  if (!sourceNode || !targetNode || waypoints.length < 2) {
    return { ...relation, waypoints };
  }
  const updatedWaypoints = [...waypoints];
  // Always use actual node size if present
  const sourceSize = { width: sourceNode.width || sourceNode.size?.width , height: sourceNode.height || sourceNode.size?.height || 50 };
  const targetSize = { width: targetNode.width || targetNode.size?.width , height: targetNode.height || targetNode.size?.height || 50 };
  // Update source docking point
  const secondPoint = updatedWaypoints[1];
  updatedWaypoints[0] = getDockingPoint(
    sourceNode,
    secondPoint,
    sourceSize
  );
  // Update target docking point
  const secondLastPoint = updatedWaypoints[updatedWaypoints.length - 2];
  updatedWaypoints[updatedWaypoints.length - 1] = getDockingPoint(
    targetNode,
    secondLastPoint,
    targetSize
  );
  return {
    ...relation,
    waypoints: updatedWaypoints
  };
}

/**
 * Recalculate all relations connected to a node after it is moved
 * @param {Object} node Node that was moved
 * @param {Object} diagram Current diagram
 * @returns {Array} Updated relations
 */
export function updateRelationsForNode(node, diagram) {
  return diagram.relations.map(relation => {
    if (relation.sourceId === node.id || relation.targetId === node.id) {
      return updateRelationWaypoints(relation, diagram);
    }
    return relation;
  });
}

/**
 * Get visual representation for a relation type
 * @param {string} relationType - The type of relation
 * @param {boolean} isSelected - Whether the relation is selected
 * @returns {Object} Visual properties for the relation
 */
export function getRelationVisual(relationType, isSelected) {
  // Check if relation is negative
  let neg = relationType.startsWith('neg_');
  let rest = neg ? relationType.slice(4) : relationType;
  
  // Determine path style based on alt or chain prefix
  let pathStyle = 'none'; // Default: single line
  
  if (rest.startsWith('alt_')) {
    pathStyle = 'alt'; // Two parallel lines
    rest = rest.slice(4);
  } else if (rest.startsWith('chain_')) {
    pathStyle = 'chain'; // Three parallel lines
    rest = rest.slice(6);
  }
  
  // The remaining part is the base relation type
  let baseType = rest;

  // Base style - same color for all relations
  const baseStyle = {
    stroke: isSelected ? '#1a73e8' : '#555555',
    strokeWidth: isSelected ? 2 : 1.5,
  };

  // Negation logic - only changes the dash pattern, not the color
  const isNegative = neg ||
    relationType === 'not_coexistence' ||
    relationType === 'resp_absence';

  let style = { ...baseStyle };
  let negation = false;

  if (isNegative) {
    negation = true;
  }

  return { 
    style, 
    negation, 
    pathStyle,
    baseType 
  };
}

/**
 * Get a human-friendly label for a relation type
 * @param {string} relationType
 * @returns {string}
 */
export function getRelationLabel(relationType) {
  // Remove neg_, alt_, chain_ prefixes for base label
  let neg = relationType.startsWith('neg_');
  let rest = neg ? relationType.slice(4) : relationType;
  let prefix = '';
  if (rest.startsWith('alt_')) {
    prefix = 'Alt ';
    rest = rest.slice(4);
  } else if (rest.startsWith('chain_')) {
    prefix = 'Chain ';
    rest = rest.slice(6);
  }
  // Map base type to label
  const baseLabels = {
    resp_existence: 'Resp. Existence',
    coexistence: 'Coexistence',
    response: 'Response',
    precedence: 'Precedence',
    succession: 'Succession',
    resp_absence: 'Resp. Absence',
    not_coexistence: 'Not Coexistence',
  };
  // Fallback: capitalize and replace _ with space
  let base = baseLabels[rest] || (rest.charAt(0).toUpperCase() + rest.slice(1).replace(/_/g, ' '));
  if (neg || relationType === 'not_coexistence' || relationType === 'resp_absence') {
    return `¬${prefix}${base}`;
  }
  return `${prefix}${base}`;
}

/**
 * Function to check if a relation is allowed
 * @param {Object} diagram Current diagram
 * @param {string} sourceId Source node ID
 * @param {string} targetId Target node ID
 * @returns {boolean} Whether relation is allowed
 */
export function isRelationAllowed(diagram, sourceId, targetId) {
  const targetNode = diagram.nodes.find(n => n.id === targetId);
  if (!targetNode) return false;
  
  // Important: Init nodes can never be targets (only sources)
  if (targetNode.constraint === CONSTRAINTS.INIT) {
    return false;
  }

  // Count existing incoming relations to this target
  const incomingRelations = diagram.relations.filter(r => r.targetId === targetId);
  const incomingCount = incomingRelations.length;

  // Check other constraints
  switch (targetNode.constraint) {
    case CONSTRAINTS.ABSENCE:
      // No incoming relations allowed
      return false;

    case CONSTRAINTS.ABSENCE_N:
      // Cannot exceed the maximum allowed count
      return incomingCount < (targetNode.constraintValue || 0);

    case CONSTRAINTS.EXACTLY_N:
      // Cannot exceed exact count
      return incomingCount < (targetNode.constraintValue || 0);

    default:
      // Allow relation for other constraints or no constraint
      return true;
  }
}

/**
 * Handle relation reconnection like bpmn-js
 * @param {Object} relation Relation to update
 * @param {string} newSourceId New source node ID (or null if unchanged)
 * @param {string} newTargetId New target node ID (or null if unchanged)
 * @param {Object} diagram Current diagram
 * @returns {Object} Updated relation
 */
export function reconnectRelation(relation, newSourceId, newTargetId, diagram) {
  const sourceId = newSourceId || relation.sourceId;
  const targetId = newTargetId || relation.targetId;
  
  const sourceNode = diagram.nodes.find(n => n.id === sourceId);
  const targetNode = diagram.nodes.find(n => n.id === targetId);
  
  if (!sourceNode || !targetNode) {
    return relation;
  }
  
  // Create new waypoints for the connection
  const newWaypoints = layoutConnection(sourceNode, targetNode);
  
  return {
    ...relation,
    sourceId: sourceId,
    targetId: targetId,
    waypoints: newWaypoints
  };
}

/**
 * Update the label position of a relation
 * @param {Object} relation - The relation to update
 * @param {Object} labelOffset - The new label offset {x, y}
 * @param {Object} diagram - The current diagram
 * @returns {Object} - The updated diagram
 */
export function updateRelationLabelPosition(relation, labelOffset, diagram) {
  if (!diagram || !relation) return diagram;
  
  const updatedRelations = diagram.relations.map(r => 
    r.id === relation.id ? { ...r, labelOffset } : r
  );
  
  return {
    ...diagram,
    relations: updatedRelations
  };
}

/**
 * Update a node's size in the diagram and update all connected relations
 * @param {string} nodeId - The id of the node to update
 * @param {{width: number, height: number}} newSize - The new size of the node
 * @param {Object} diagram - The current diagram state
 * @returns {Object} Updated diagram with node size and recalculated relations
 */
export function updateNodeSizeAndRelations(nodeId, newSize, diagram) {
  // Update the node's size in the diagram
  const updatedNodes = diagram.nodes.map(node =>
    node.id === nodeId ? { ...node, width: newSize.width, height: newSize.height } : node
  );
  // Update all relations connected to this node
  const updatedRelations = diagram.relations.map(relation => {
    if (relation.sourceId === nodeId || relation.targetId === nodeId) {
      return updateRelationWaypoints(relation, { ...diagram, nodes: updatedNodes });
    }
    return relation;
  });
  return {
    ...diagram,
    nodes: updatedNodes,
    relations: updatedRelations
  };
}
