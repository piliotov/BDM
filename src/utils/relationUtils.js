import { 
  getDockingPoint, 
  layoutConnection, 
} from './canvasUtils';
import { CONSTRAINTS } from './diagramUtils';

// --- Relation Types ---
export const RELATION_TYPES = {
  RESP_EXISTENCE: 'resp_existence', 
  RESPONSE: 'response',
  PRECEDENCE: 'precedence',
  RESPONDED_EXISTENCE: 'responded_existence',
  CO_EXISTENCE: 'co_existence',
  NON_RESPONSE: 'non_response',
  NON_PRECEDENCE: 'non_precedence',
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
  
  // For relations with just two points (direct), recalculate completely
  if (!relation.waypoints || relation.waypoints.length <= 2) {
    const newWaypoints = layoutConnection(sourceNode, targetNode);
    return {
      ...relation,
      waypoints: newWaypoints
    };
  }
  
  // For relations with custom waypoints, only update the endpoints
  const updatedWaypoints = [...relation.waypoints];
  
  // Update source docking point
  const sourceSize = { width: 100, height: 50 };
  const secondPoint = updatedWaypoints[1];
  updatedWaypoints[0] = getDockingPoint(
    sourceNode, 
    secondPoint,
    sourceSize
  );
  
  // Update target docking point
  const targetSize = { width: 100, height: 50 };
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
 * Get relation visual style based on type (like bpmn-js)
 * @param {string} type Relation type
 * @param {boolean} isSelected Is relation selected
 * @returns {Object} Visual properties
 */
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

  // Case 1: Prevent relations to INIT nodes
  if (targetNode.constraint === CONSTRAINTS.INIT) {
    return false;
  }

  // Count existing incoming relations to this target
  const incomingRelations = diagram.relations.filter(r => r.targetId === targetId);
  const incomingCount = incomingRelations.length;

  // Case 2: Check other constraints
  switch (targetNode.constraint) {
    case CONSTRAINTS.ABSENCE:
      // No relations allowed
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
